import './runtime.js'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import nodemailer from 'nodemailer'
import { herkansing, isAanmeldfout, MAX_POGINGEN, redenVan } from './herkansing.js'

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
 * de sleutel er is en dit uitgerold wordt, gaat nieuwe post de deur uit, en
 * herkanst `mailHerkansen` wat het laatste etmaal bleef liggen. Een wachtrij
 * van vorige maand alsnog versturen is geen dienst; zie `herkansing.js`.
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
 * Een mislukte verzending laat de rij op "mislukt" staan met de reden erbij.
 * Opnieuw proberen doet `mailHerkansen`, een keer per kwartier en hooguit drie
 * keer: een lus die elke minuut opnieuw een mail probeert te sturen, is hoe
 * een afzender op een zwarte lijst komt.
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

    await verstuur(nodemailer.createTransport(url), event.data.ref, rij)
  }
)

/**
 * Eén rij versturen en bijwerken met wat er gebeurde — gedeeld door de
 * trigger en de herkansing, zodat beide precies hetzelfde in de rij zetten.
 */
async function verstuur(post, ref, rij) {
  try {
    const antwoord = await post.sendMail({
      from: AFZENDER,
      to: rij.aan,
      subject: rij.onderwerp,
      text: rij.tekst,
      // Alleen bij post aan een klant: een melding aan een collega hoort
      // niet in de groep te belanden.
      ...(rij.klantMail ? { replyTo: ANTWOORD_AAN } : {}),
    })

    await ref.update({
      status: 'verstuurd',
      reden: FieldValue.delete(),
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
      await bewaarUitgaand(ref.firestore, rij, antwoord.messageId)
    }

    logger.info('Mail verstuurd', { id: ref.id, soort: rij.soort ?? null })
    return true
  } catch (err) {
    await ref.update({
      status: 'mislukt',
      reden: redenVan(err),
      pogingen: (rij.pogingen ?? 0) + 1,
    })
    // Een geweigerde aanmelding is een instelling, geen mail: de log zegt dan
    // wat er te doen is in plaats van alleen de ruwe fout.
    logger.error(isAanmeldfout(err) ? 'Mail mislukt: aanmelding geweigerd' : 'Mail mislukt', {
      id: ref.id,
      fout: redenVan(err),
    })
    return false
  }
}

/**
 * Wat het laatste etmaal bleef liggen alsnog versturen, een keer per kwartier.
 *
 * Eerst één keer aanmelden bij de mailserver (`verify`). Weigert die, dan
 * gaat er deze ronde niets de deur uit en staat er één regel in de log in
 * plaats van een fout per mail — zeventig keer dezelfde melding helpt niemand,
 * en elke poging met een fout wachtwoord brengt een blokkade dichterbij.
 *
 * Geen samengestelde query: alleen `status in [...]`, de leeftijd wordt hier
 * nagekeken. Zo is er geen index nodig voor een lijst van hooguit een paar
 * honderd rijen.
 */
export const mailHerkansen = onSchedule(
  { region: REGION, schedule: 'every 15 minutes', secrets: [SMTP_URL], timeoutSeconds: 300 },
  async () => {
    const url = SMTP_URL.value()
    if (!url) return

    const db = getFirestore()
    const rijen = await db
      .collection('mailQueue')
      .where('status', 'in', ['wachtend', 'mislukt'])
      .limit(300)
      .get()
    if (rijen.empty) return

    const nu = Date.now()
    const teVersturen = []
    let verlopen = 0
    for (const doc of rijen.docs) {
      const wat = herkansing(doc.data(), nu)
      if (wat === 'verlopen') {
        await doc.ref.update({ status: 'verlopen', verlopenOp: FieldValue.serverTimestamp() })
        verlopen += 1
      } else if (wat === 'versturen') {
        teVersturen.push(doc)
      }
    }
    if (verlopen) logger.info('Mails verlopen (ouder dan een etmaal)', { aantal: verlopen })
    if (!teVersturen.length) return

    const post = nodemailer.createTransport(url)
    try {
      await post.verify()
    } catch (err) {
      logger.error('Mailserver weigert; herkansing overgeslagen', {
        fout: redenVan(err),
        wachtend: teVersturen.length,
      })
      return
    }

    let gelukt = 0
    for (const doc of teVersturen) {
      if (await verstuur(post, doc.ref, doc.data())) gelukt += 1
    }
    logger.info('Herkansing klaar', { gelukt, mislukt: teVersturen.length - gelukt, maxPogingen: MAX_POGINGEN })
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
