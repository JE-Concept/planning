import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

/**
 * De post van info@jeconcept.be ophalen.
 *
 * ── Waarom IMAP en niet de Gmail-API ──────────────────────────────────────
 * Dezelfde afweging als bij het versturen (zie `functions/mail.js`): geen
 * nieuwe leverancier, geen tweede account, geen extra koppeling die kan
 * verlopen. Het versturen gebruikt al een app-wachtwoord van de eigen Google
 * Workspace; het ophalen gebruikt er nog zo een. De Gmail-API met push is
 * sneller, maar vraagt een OAuth-client, een Pub/Sub-topic en een `watch` die
 * elke week vernieuwd moet worden — drie dingen die stil kunnen stoppen, voor
 * een paar minuten winst op een aanvraag die toch dezelfde dag beantwoord
 * wordt.
 *
 * ── Waarom er niets aan de mailbox verandert ──────────────────────────────
 * Dit is een gedeelde postbus waar mensen in werken. Berichten als gelezen
 * markeren of verplaatsen zou hun postvak overhoophalen, en de eerste keer dat
 * dat gebeurt is het vertrouwen weg. Daarom raakt deze functie geen enkele
 * vlag aan en onthoudt ze zelf waar ze gebleven was: het hoogste UID dat ze
 * gezien heeft, in `instellingen/postvak`. Dat is ook meteen het antwoord op
 * "wat als de functie twee keer draait": ze haalt dan niets nieuws op.
 *
 * ── Waarom het hier staat en niet bij de andere functies ──────────────────
 * Het hangt aan een geheim, en een functions-uitrol faalt in zijn geheel op
 * een ontbrekend geheim. Zonder `IMAP_URL` wordt deze codebase niet uitgerold
 * en gaat de rest gewoon door — dezelfde reden waarom de verzender hier staat.
 *
 *   firebase functions:secrets:set IMAP_URL --project je-planning
 *   imaps://info%40jeconcept.be:<app-wachtwoord>@imap.gmail.com:993
 *
 * De gebruikersnaam en het wachtwoord moeten URL-gecodeerd zijn (een @ wordt
 * %40); een app-wachtwoord van Google bevat spaties, die eruit mogen.
 */

const REGION = 'europe-west1'
const IMAP_URL = defineSecret('IMAP_URL')

/** Hoeveel berichten er hoogstens per beurt bijkomen. */
const PER_BEURT = 40

/**
 * Bij de allereerste keer niet de hele mailbox binnenhalen.
 *
 * Een postbus die jaren meegaat, bevat duizenden berichten die met geen enkel
 * event te maken hebben. Die allemaal inlezen kost geld, vult het postvak met
 * ruis en levert niets op. Dus: vanaf vandaag.
 */
const EERSTE_KEER_DAGEN = 14

const HOUDER = 'instellingen/postvak'

export const haalPostOp = onSchedule(
  { region: REGION, schedule: 'every 5 minutes', secrets: [IMAP_URL], timeoutSeconds: 120 },
  async () => {
    const url = IMAP_URL.value()
    if (!url) {
      logger.warn('Geen IMAP_URL; geen post opgehaald')
      return
    }

    const db = getFirestore()
    const houder = db.doc(HOUDER)
    const stand = (await houder.get()).data() ?? {}

    const client = new ImapFlow({ url, logger: false })
    await client.connect()

    let hoogste = Number(stand.laatsteUid ?? 0)
    let gelezen = 0

    try {
      const slot = await client.getMailboxLock('INBOX')
      try {
        // Zonder eerdere stand: alleen wat recent is. Met: alles daarna.
        const zoek = hoogste
          ? { uid: `${hoogste + 1}:*` }
          : { since: new Date(Date.now() - EERSTE_KEER_DAGEN * 86400000) }

        const berichten = []
        for await (const bericht of client.fetch(zoek, { uid: true, source: true }, { uid: Boolean(hoogste) })) {
          // `uid: "n:*"` geeft altijd minstens één bericht terug, ook wanneer
          // er niets nieuws is: het laatste. Dat is er al.
          if (bericht.uid <= hoogste) continue
          berichten.push(bericht)
          if (berichten.length >= PER_BEURT) break
        }

        for (const rauw of berichten) {
          const post = await simpleParser(rauw.source)
          await bewaar(db, post, rauw.uid)
          hoogste = Math.max(hoogste, rauw.uid)
          gelezen += 1
        }
      } finally {
        slot.release()
      }
    } finally {
      await client.logout().catch(() => {})
    }

    await houder.set(
      { laatsteUid: hoogste, laatsteKeer: FieldValue.serverTimestamp(), laatsteAantal: gelezen },
      { merge: true }
    )
    if (gelezen) logger.info('Post opgehaald', { aantal: gelezen, uid: hoogste })
  }
)

/**
 * Eén bericht wegschrijven.
 *
 * De documentnaam is de Message-ID: draait deze functie twee keer over
 * hetzelfde bericht, dan is het hetzelfde document en staat het één keer in de
 * draad. Het koppelen aan een event gebeurt niet hier maar in een trigger
 * (`koppelMail` in `functions/`) — dat rekenwerk hoort bij de rest van de
 * logica en niet bij het ophalen.
 *
 * De tekst wordt afgekapt. Een Firestore-document mag een megabyte zijn, en
 * een mailwisseling met vijftien keer hetzelfde citaat eronder haalt dat. Wie
 * de volledige mail wil, heeft de mailbox.
 */
async function bewaar(db, post, uid) {
  const messageId = String(post.messageId ?? '').replace(/^<|>$/g, '')
  const naam = (messageId || `uid-${uid}`).replace(/[^A-Za-z0-9._@-]/g, '_').slice(0, 180)

  await db
    .collection('mails')
    .doc(naam)
    .set(
      {
        richting: 'in',
        uid,
        messageId: messageId || null,
        inReplyTo: String(post.inReplyTo ?? '').replace(/^<|>$/g, '') || null,
        references: Array.isArray(post.references) ? post.references.join(' ') : post.references ?? null,
        van: post.from?.text ?? '',
        aan: post.to?.text ?? '',
        cc: post.cc?.text ?? '',
        onderwerp: post.subject ?? '',
        tekst: String(post.text ?? '').slice(0, 20000),
        bijlagen: (post.attachments ?? []).map((b) => ({
          naam: b.filename ?? '',
          type: b.contentType ?? '',
          grootte: b.size ?? 0,
        })),
        datum: post.date ?? new Date(),
        // Leeg tot de trigger gekeken heeft; zo is "nog niet bekeken" een
        // toestand en geen gok.
        eventId: null,
        customerId: null,
        koppeling: null,
        opgehaaldOp: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
}
