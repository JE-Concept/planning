import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

/**
 * Wat een klant van JE Plan te zien krijgt, zonder account.
 *
 * ── Waarom dit een functie is en geen Firestore-lezing ────────────────────
 * De klant heeft geen login, en dat moet ook niet: een offerte goedkeuren mag
 * geen account kosten. Maar een browser die rechtstreeks in Firestore leest,
 * leest altijd een heel document — en op een offerte staan marges, interne
 * opmerkingen en de gegevens van andere klanten. De rules kunnen geen velden
 * verbergen (zie `functions/social-projectie.js` voor dezelfde afweging).
 *
 * Daarom komt er niets van de database rechtstreeks naar de klant. Deze
 * functie leest met beheerdersrechten, kiest per veld wat mee mag, en stuurt
 * dat door. Wat hier niet in de lijst staat, ziet de klant nooit — ook niet
 * met de ontwikkelaarsconsole open.
 *
 * ── Twee sleutels, twee soorten toegang ───────────────────────────────────
 * `offerte/<token>` opent één offerte. Die token staat op de offerte zelf en
 * gaat mee in de mail waarmee ze verstuurd wordt.
 *
 * `klant/<token>` opent het portaal van één klant: al zijn dossiers, met de
 * stand van elk. Die token staat op de klantfiche en wordt pas aangemaakt
 * wanneer iemand in de tool de link opvraagt — een sleutel die nooit gedeeld
 * is, hoeft niet te bestaan.
 *
 * ── Waarom één antwoord op elke mislukking ────────────────────────────────
 * Geen token, verkeerde token, verlopen offerte: alle drie 404 met dezelfde
 * tekst. Wie het adres raadt, hoort niet te kunnen afleiden of een token
 * bestond. Dezelfde regel als bij de agendafeed.
 */

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/

/** Wat er van een offerte naar buiten mag. Een witte lijst, net als bij social. */
const OFFERTE_VELDEN = [
  'nummer',
  'datum',
  'geldigTot',
  'klantNaam',
  'eventNaam',
  'eventDatum',
  'locatie',
  'personen',
  'regels',
  'status',
  'antwoordOp',
  'feedback',
]

/** En van een event, voor het portaal. Geen bedragen die niet op een offerte staan. */
const EVENT_VELDEN = ['title', 'eventDate', 'location', 'pax', 'statusName']

const kies = (bron, velden) =>
  Object.fromEntries(velden.filter((v) => bron?.[v] !== undefined).map((v) => [v, bron[v]]))

/** Een datum die door JSON past. Firestore geeft een Timestamp, de browser wil tekst. */
const alsTekst = (waarde) => {
  const d = waarde?.toDate?.() ?? (waarde ? new Date(waarde) : null)
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null
}

const metDatums = (obj, velden) => {
  const uit = { ...obj }
  for (const veld of velden) if (veld in uit) uit[veld] = alsTekst(uit[veld])
  return uit
}

export function maakPortaal({ db, region }) {
  /*
    `invoker: 'private'` betekent hier niet dat de pagina privé is — het zegt
    tegen de Firebase CLI dat ze zelf geen IAM-binding moet zetten. Publiek
    bereikbaar wordt ze een stap later in de workflow. Dezelfde uitleg als bij
    `agenda.js`, en om dezelfde reden: zonder dit strandt de hele uitrol.
  */
  return onRequest({ region, cors: false, invoker: 'private' }, async (verzoek, antwoord) => {
    // Achter een hosting-rewrite draagt het pad nog het voorvoegsel; los
    // aangeroepen niet. Allebei moeten werken, anders is het lokaal testen
    // iets anders dan wat er live gebeurt.
    const pad = String(verzoek.path ?? '').replace(/^\/api\/portaal/, '').replace(/^\/+|\/+$/g, '')
    const delen = pad.split('/')

    const weiger = () => antwoord.status(404).json({ fout: 'niet_gevonden' })

    antwoord.set('Cache-Control', 'no-store')

    try {
      if (delen[0] === 'offerte' && TOKEN.test(delen[1] ?? '')) {
        if (verzoek.method === 'POST' && delen[2] === 'antwoord') {
          return await antwoordOpOfferte({ db, token: delen[1], body: verzoek.body, antwoord, weiger })
        }
        if (verzoek.method === 'GET') {
          return await toonOfferte({ db, token: delen[1], antwoord, weiger })
        }
      }

      if (delen[0] === 'klant' && TOKEN.test(delen[1] ?? '') && verzoek.method === 'GET') {
        return await toonKlant({ db, token: delen[1], antwoord, weiger })
      }
    } catch (err) {
      logger.error('Portaal', { pad, fout: String(err?.message ?? err) })
      return antwoord.status(500).json({ fout: 'server' })
    }

    return weiger()
  })
}

/** De offerte zelf, met het minimum eromheen dat ze leesbaar maakt. */
async function toonOfferte({ db, token, antwoord, weiger }) {
  const snap = await db.collection('offertes').where('token', '==', token).limit(1).get()
  if (snap.empty) return weiger()

  const doc = snap.docs[0]
  const offerte = doc.data()

  // Een offerte die nog niet verstuurd is, bestaat voor de klant niet. Anders
  // kan een link die per ongeluk vertrekt een concept tonen met bedragen waar
  // nog aan gerekend werd.
  if (offerte.status === 'concept') return weiger()

  const klant = offerte.klantId ? (await db.collection('customers').doc(offerte.klantId).get()).data() : null
  const event = offerte.eventId ? (await db.collection('tasks').doc(offerte.eventId).get()).data() : null

  antwoord.json({
    offerte: metDatums(kies(offerte, OFFERTE_VELDEN), ['datum', 'geldigTot', 'eventDatum', 'antwoordOp']),
    // De aanspreking. Zonder naam blijft het "Dag," en dat is beter dan een
    // verkeerde naam.
    contact: hoofdContact(klant),
    // Wie ze kunnen bellen. Niet het hele team: één naam is een aanspreekpunt,
    // vijf namen is een doorverwijzing.
    aanspreekpunt: await aanspreekpuntVan(db, event),
    // Waar het over ging, in hun eigen woorden. Dat staat als omschrijving op
    // het event sinds de aanvraagmail erin komt.
    aanleiding: kortAf(event?.description, 600),
    // Het portaal, als ze er een hebben: "je andere dossiers staan hier".
    portaal: klant?.portalToken ? `klant/${klant.portalToken}` : null,
  })
}

/** Alle dossiers van één klant, met de stand van elk. */
async function toonKlant({ db, token, antwoord, weiger }) {
  const snap = await db.collection('customers').where('portalToken', '==', token).limit(1).get()
  if (snap.empty) return weiger()

  const klantDoc = snap.docs[0]
  const klant = klantDoc.data()

  const eventsSnap = await db
    .collection('tasks')
    .where('customerId', '==', klantDoc.id)
    .where('archived', '==', false)
    .get()

  const events = eventsSnap.docs
    .filter((d) => !d.data().parentId)
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (alsTekst(a.eventDate) ?? '') .localeCompare(alsTekst(b.eventDate) ?? ''))

  // Per event hoogstens één offerte, en alleen als ze verstuurd is.
  const offertes = new Map()
  for (const brok of stukjes(events.map((e) => e.id), 10)) {
    const rijen = await db.collection('offertes').where('eventId', 'in', brok).get()
    for (const rij of rijen.docs) {
      const o = rij.data()
      if (o.status !== 'concept') offertes.set(o.eventId, o)
    }
  }

  antwoord.json({
    klant: { naam: klant.name ?? '' },
    contact: hoofdContact(klant),
    events: events.map((e) => {
      const offerte = offertes.get(e.id) ?? null
      return {
        ...metDatums(kies(e, EVENT_VELDEN), ['eventDate']),
        stand: standVoorKlant(e.statusName),
        offerte: offerte
          ? { token: offerte.token, nummer: offerte.nummer, status: offerte.status }
          : null,
      }
    }),
  })
}

/** Goedkeuren, of een vraag stellen. Allebei één keer schrijven en klaar. */
async function antwoordOpOfferte({ db, token, body, antwoord, weiger }) {
  const snap = await db.collection('offertes').where('token', '==', token).limit(1).get()
  if (snap.empty) return weiger()

  const doc = snap.docs[0]
  const offerte = doc.data()
  if (offerte.status === 'concept') return weiger()

  const akkoord = body?.akkoord === true
  const feedback = String(body?.feedback ?? '').trim().slice(0, 4000)
  if (!akkoord && !feedback) return antwoord.status(400).json({ fout: 'leeg' })

  /*
    Een tweede keer goedkeuren is geen fout maar een dubbele klik, of iemand
    die de link nog eens opent. Dan verandert er niets en zegt het scherm wat
    er al staat — een foutmelding zou hier alleen maar ongerust maken.
  */
  if (offerte.status === 'goedgekeurd' && akkoord) {
    return antwoord.json({ status: 'goedgekeurd', alGebeurd: true })
  }

  await doc.ref.update({
    status: akkoord ? 'goedgekeurd' : 'feedback',
    antwoordOp: FieldValue.serverTimestamp(),
    ...(feedback ? { feedback } : {}),
  })

  /*
    Het event schuift mee. Een offerte die goedgekeurd is terwijl het dossier
    op "offerte verstuurd" blijft staan, is precies de soort achterstand
    waarvoor deze tool gebouwd is — en niemand hoeft ervoor in een mailbox te
    kijken.
  */
  if (akkoord && offerte.eventId) {
    const eventRef = db.collection('tasks').doc(offerte.eventId)
    const eventDoc = await eventRef.get()
    if (eventDoc.exists && eventDoc.data().statusName === 'offer send') {
      await eventRef.update({ statusName: 'offer accepted', updatedAt: FieldValue.serverTimestamp() })
    }
  }

  // Als notitie op het event, zodat het team het ziet waar het gesprek staat.
  if (offerte.eventId) {
    await db.collection('comments').add({
      taskId: offerte.eventId,
      postId: null,
      authorId: null,
      authorName: offerte.klantNaam || 'De klant',
      body: akkoord
        ? `Offerte ${offerte.nummer} goedgekeurd via de klantenpagina.${feedback ? `\n\n${feedback}` : ''}`
        : `Vraag bij offerte ${offerte.nummer} via de klantenpagina:\n\n${feedback}`,
      mentions: [],
      createdAt: FieldValue.serverTimestamp(),
    })
    await db
      .collection('tasks')
      .doc(offerte.eventId)
      .update({ commentCount: FieldValue.increment(1) })
      .catch(() => {})
  }

  logger.info('Offerte beantwoord', { nummer: offerte.nummer, akkoord })
  return antwoord.json({ status: akkoord ? 'goedgekeurd' : 'feedback' })
}

/** De contactpersoon die vooraan staat, of de klant zelf. */
function hoofdContact(klant) {
  if (!klant) return null
  const contacts = klant.contacts ?? []
  const hoofd = contacts.find((c) => c?.primary) ?? contacts[0] ?? null
  const naam = hoofd?.name || klant.name || ''
  return {
    naam,
    // Alleen de voornaam in de aanhef: "Dag Kristien" leest als een mens,
    // "Dag Kristien Maris" als een brief van de bank.
    voornaam: naam.split(' ')[0] ?? '',
  }
}

/** Eén naam om op terug te vallen: de eerste uitvoerder van het event. */
async function aanspreekpuntVan(db, event) {
  const uid = (event?.assignees ?? [])[0]
  if (!uid) return null
  const profiel = (await db.collection('profiles').doc(uid).get()).data()
  if (!profiel || profiel.active === false) return null
  return { naam: profiel.fullName ?? '', email: profiel.email ?? '' }
}

/**
 * De stand van het dossier, in woorden die een klant iets zeggen.
 *
 * "planning ongoing" en "ready to invoice" zijn onze woorden; de klant heeft
 * er niets aan en sommige ervan zou hij verkeerd lezen. Drie standen volstaan:
 * er wordt aan gewerkt, het ligt bij jou, het is rond.
 */
function standVoorKlant(statusName) {
  if (statusName === 'offer send') return 'bij_jou'
  if (['offer accepted', 'planning ongoing', 'planning ready'].includes(statusName)) return 'bevestigd'
  if (['ready to invoice', 'invoiced', 'complete'].includes(statusName)) return 'afgerond'
  return 'in_behandeling'
}

const kortAf = (tekst, max) => {
  const schoon = String(tekst ?? '').trim()
  return schoon.length > max ? `${schoon.slice(0, max)}…` : schoon
}

/** Firestore's `in` neemt hoogstens tien waarden; dus in stukjes. */
function* stukjes(lijst, per) {
  for (let i = 0; i < lijst.length; i += per) yield lijst.slice(i, i + per)
}
