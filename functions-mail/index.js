import './runtime.js'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import nodemailer from 'nodemailer'

/**
 * De verzender van de e-mails, en verder niets.
 *
 * Deze functie staat bewust in een eigen codebase, om precies dezelfde reden
 * als `functions-meetings/`: ze hangt aan een geheim, en een functions-deploy
 * faalt in zijn geheel op een ontbrekend geheim. Stond ze bij de andere
 * functies, dan zou een ontbrekende SMTP-sleutel ook `ensureProfile`
 * meeslepen — en dan kan niemand meer inloggen. Dat is hier één keer gebeurd.
 *
 * De triggers in `functions/` weten hier niets van. Ze schrijven een rij in
 * `mailQueue` en zijn klaar. Is deze codebase niet uitgerold — omdat het
 * geheim er niet is — dan blijven die rijen op "wachtend" staan. Er wordt niet
 * gemaild, het logboek van de uitrol zegt waarom, en er gaat niets stuk. Zodra
 * de sleutel er is en dit uitgerold wordt, gaat alleen nieuwe post de deur
 * uit: een wachtrij van vorige maand alsnog versturen is geen dienst.
 *
 * Waarom SMTP van de eigen Google Workspace en niet een maildienst: dat staat
 * in `functions/mail.js`, bij de teksten.
 *
 * Het geheim is één connectiestring, niet vijf losse waarden:
 *
 *   firebase functions:secrets:set SMTP_URL --project je-planning
 *   smtps://plan%40jeconcept.be:<app-wachtwoord>@smtp.gmail.com:465
 *
 * Eén waarde is één ding dat fout kan staan, en de fout is meteen te zien.
 * De gebruikersnaam en het wachtwoord moeten URL-gecodeerd zijn (een @ wordt
 * %40); een app-wachtwoord van Google bevat spaties, die eruit mogen.
 */

// Nodig voor `event.data.ref`: die verwijzing hangt aan de beheerders-app.
initializeApp()

// De ophaler van de post staat in een eigen bestand maar in dezelfde codebase:
// hij hangt aan hetzelfde soort geheim en hoort bij dezelfde uitrol.
export { haalPostOp } from './postvak.js'

const REGION = 'europe-west1'
const SMTP_URL = defineSecret('SMTP_URL')

/** Van wie de post komt. Overschrijfbaar, want het adres is niet van de code. */
const AFZENDER = process.env.MAIL_FROM ?? 'JE Plan <plan@jeconcept.be>'

/**
 * Waar een antwoord van de klant hoort aan te komen.
 *
 * `info@jeconcept.be` is een Google Groep en geen postbus. Dat heeft twee
 * gevolgen die hier allebei staan omdat ze anders stilletjes fout gaan:
 *
 * 1. **Een groep kent geen plusadressering.** `info+e<id>@jeconcept.be` wordt
 *    door Google Groups niet als de groep herkend en bouncet. Het event kan
 *    dus niet in het antwoordadres — waar het in een gewone postbus wél had
 *    gekund. Het antwoordadres is gewoon de groep.
 * 2. **Het koppelen leunt dan op de draad.** `In-Reply-To` en `References`
 *    wijzen naar het bericht dat wij verstuurd hebben, en die koppen komen van
 *    het mailprogramma van de klant. Dat is even exact als een adres, en het
 *    werkt door een groep heen: Google Groups laat die koppen staan.
 *
 * Wie antwoordt, antwoordt dus aan de groep — en dat is ook waar het team het
 * wil zien. De tool leest mee via een postbus die lid is van die groep; zie
 * `postvak.js`.
 */
const ANTWOORD_AAN = process.env.MAIL_REPLY_TO ?? 'info@jeconcept.be'

/**
 * Eén rij uit de wachtrij versturen.
 *
 * Alleen bij het aanmaken, en de rij wordt daarna bijgewerkt met wat er
 * gebeurde. Dat is meteen het logboek: wie zich afvraagt of die herinnering
 * van dinsdag vertrokken is, kan het in Firestore zien staan.
 *
 * Een mislukte verzending laat de rij op "mislukt" staan met de reden erbij en
 * probeert het niet zelf opnieuw. Een mailserver die weigert, weigert meestal
 * ook de tweede keer — en een lus die elke minuut opnieuw een mail probeert te
 * sturen, is hoe een afzender op een zwarte lijst komt.
 */
export const sendQueuedMail = onDocumentCreated(
  { region: REGION, document: 'mailQueue/{id}', secrets: [SMTP_URL] },
  async (event) => {
    const rij = event.data?.data()
    if (!rij?.aan || rij.status !== 'wachtend') return

    const url = SMTP_URL.value()
    if (!url) {
      // Kan alleen wanneer het geheim leeg gezet is. Dan is niet mailen beter
      // dan omvallen: de rij blijft staan en zegt wat eraan scheelt.
      await event.data.ref.update({ status: 'wachtend', reden: 'Geen SMTP_URL ingesteld.' })
      logger.warn('Geen SMTP_URL; niet gemaild', { id: event.params.id })
      return
    }

    try {
      const post = nodemailer.createTransport(url)
      const antwoord = await post.sendMail({
        from: AFZENDER,
        to: rij.aan,
        subject: rij.onderwerp,
        text: rij.tekst,
        // Alleen bij post aan een klant: een melding aan een collega hoort
        // niet in de groep te belanden.
        ...(rij.klantMail ? { replyTo: ANTWOORD_AAN } : {}),
      })

      await event.data.ref.update({
        status: 'verstuurd',
        messageId: antwoord.messageId ?? null,
        verstuurdOp: FieldValue.serverTimestamp(),
      })

      /*
        Post aan een klant hoort in de draad van het event te staan, naast wat
        er binnenkwam. Interne meldingen niet: "er is op je taak gereageerd"
        is geen mailwisseling met de klant, en een draad die daarmee volloopt,
        leest niemand meer. Daarom alleen wanneer de rij het zelf zegt.
      */
      if (rij.eventId && rij.klantMail) {
        await bewaarUitgaand(event.data.ref.firestore, rij, antwoord.messageId)
      }

      logger.info('Mail verstuurd', { id: event.params.id, soort: rij.soort ?? null })
    } catch (err) {
      await event.data.ref.update({
        status: 'mislukt',
        reden: String(err?.message ?? err).slice(0, 300),
        pogingen: (rij.pogingen ?? 0) + 1,
      })
      logger.error('Mail mislukt', { id: event.params.id, fout: String(err?.message ?? err) })
    }
  }
)

/**
 * Een verstuurde mail in de draad van het event zetten.
 *
 * De Message-ID is de sleutel, net als bij binnenkomende post: antwoordt de
 * klant hierop, dan wijst zijn `In-Reply-To` naar dit bericht en weet de
 * koppeling meteen bij welk event het hoort.
 */
async function bewaarUitgaand(db, rij, messageId) {
  const schoon = String(messageId ?? '').replace(/^<|>$/g, '')
  const naam = (schoon || `uit-${Date.now()}`).replace(/[^A-Za-z0-9._@-]/g, '_').slice(0, 180)

  await db
    .collection('mails')
    .doc(naam)
    .set(
      {
        richting: 'uit',
        messageId: schoon || null,
        inReplyTo: null,
        references: null,
        van: AFZENDER,
        aan: rij.aan,
        cc: '',
        onderwerp: rij.onderwerp ?? '',
        tekst: String(rij.tekst ?? '').slice(0, 20000),
        bijlagen: [],
        datum: new Date(),
        eventId: rij.eventId,
        customerId: rij.customerId ?? null,
        // Geen gok: wij hebben hem zelf verstuurd vanaf dit event.
        koppeling: 'verstuurd',
        opgehaaldOp: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
}
