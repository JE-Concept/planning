import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onMessagePublished } from 'firebase-functions/v2/pubsub'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { PubSub } from '@google-cloud/pubsub'
import { isEventLijst } from './events-bron.js'
import { BRONNEN, KAART_VOOR_SOORT, kaartId, kaartVelden, wordtKaart } from './messaging-kaart.js'
import { MAX_POGINGEN, VERWERKERS, herkansbaar, isVastgelopen, samenvatting, wachtOpDeBus } from './messaging-stand.js'
import { TOPIC_BERICHTEN, TOPIC_VASTGELOPEN, busBericht, isVoor, leesBusBericht, vastgelopenBericht } from './messaging-bus.js'

/**
 * De verwerkers van messaging: wat er in JE Plan gebeurt met een bericht dat
 * in de log `messaging` kwam. Zie `functions-messaging/messaging.js` voor
 * waarom er een log is.
 *
 * De weg van een bericht (zie `messaging-bus.js` voor waarom):
 *
 *   ingang ─▶ log `messaging` ─▶ relay ─▶ topic messaging-berichten ─▶ verwerker(s)
 *                                                                     └─ na MAX_POGINGEN ─▶ topic messaging-vastgelopen ─▶ melding
 *
 * - de **relay** (`messagingEvent`) is een trigger op de log: hij zet elke
 *   nieuwe rij op de bus en noteert dat op de rij. Hij verwerkt zelf niets.
 *   De naam is die van de trigger van vóór de bus: een functie van type
 *   veranderen of verwijderen vraagt bij de uitrol `--force`, en dat zet de
 *   pijplijn niet.
 * - elke **verwerker** is een abonnee op het topic met een eigen naam en een
 *   eigen stand op de rij (`verwerking.<naam>`): `klaar` met wat hij maakte,
 *   `fout` met de reden en het aantal pogingen, of `overgeslagen` als de
 *   soort niet voor hem is. Een bericht kan twee keer langskomen, dus elke
 *   verwerker kijkt eerst of hij al klaar is.
 * - de **herkansing** (elke 5 minuten) zet op de bus wat op `fout` staat en
 *   lang genoeg gewacht heeft (5, dan 15 minuten), met de naam van de
 *   verwerker erbij zodat de andere het laten liggen; en wat de relay miste.
 * - na MAX_POGINGEN gaat het bericht naar de **dead-letter-topic**; de
 *   melding aan de beheerders is daar een abonnee van. Een bericht dat drie
 *   keer faalt, heeft een mens nodig, en een vierde poging zonder mens is
 *   dezelfde fout voor de vierde keer.
 * - de **herspeelknop** in Instellingen → Messaging laat de verwerker meteen
 *   lopen, buiten de bus om: een beheerder die de oorzaak wegnam, wil het
 *   antwoord zien en niet op de bus wachten.
 *
 * De herkansing loopt via de bus en niet via het platform (`retry: true`):
 * een nieuwe functie met herkansing vraagt bij elke uitrol `--force`, en dat
 * zou de uitrol ook stilzwijgend functies laten wissen.
 *
 * Eerste verwerker: **event**. Een `reservatie.aangevraagd` of
 * `offerte.aangevraagd` van een bekende bron (zie `BRONNEN` in
 * `messaging-kaart.js`) wordt een kaart in de kolom `request` — geen
 * aanvraagrij, want zo'n aanvraag ís al een datum met een aantal personen,
 * alleen nog niet bevestigd. Een bron met `kaart: false` (de verhuursite)
 * komt in de log maar krijgt hier geen kaart: die maakt haar eigen weg al.
 * Het id van de kaart is afleidbaar uit het bericht, en `create` in plaats
 * van `set`: bestaat de kaart al, dan heeft het team ze misschien al
 * verplaatst, en die springt dan niet terug naar `request`.
 */

/**
 * Een minuut onthouden per instantie. Bij een piek leest elke verwerker
 * anders voor elk bericht alle lijsten en merken opnieuw; die veranderen
 * hooguit een paar keer per jaar. Een fout wordt niet onthouden.
 */
const ONTHOUD_MS = 60000
const geheugen = new Map()
async function onthouden(sleutel, haal) {
  const nu = Date.now()
  const hit = geheugen.get(sleutel)
  if (hit && nu - hit.op < ONTHOUD_MS) return hit.waarde
  const waarde = await haal()
  geheugen.set(sleutel, { op: nu, waarde })
  return waarde
}

function eventLijst(db) {
  return onthouden('eventlijst', async () => {
    const lijsten = await db.collection('lists').get()
    return lijsten.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((l) => !l.archived)
      .find(isEventLijst)
  })
}

/** Het merk van de bron in de werkruimte, zodat de kaart de juiste kleur krijgt. Geen merk is geen fout. */
function merkId(db, bron) {
  const naam = BRONNEN[bron]?.merk
  if (!naam) return null
  return onthouden(`merk:${naam}`, async () => {
    const snap = await db.collection('brands').where('name', '==', naam).limit(1).get()
    return snap.empty ? null : snap.docs[0].id
  })
}

/** Eén client per instantie; hij bundelt wat binnen enkele milliseconden vertrekt. */
let pubsub = null
async function standaardPubliceer(topic, { json, attributes }) {
  pubsub ??= new PubSub()
  return pubsub.topic(topic).publishMessage({ json, attributes })
}

async function maakKaart(db, bericht) {
  const kolomNaam = KAART_VOOR_SOORT[bericht.soort]
  const lijst = await eventLijst(db)
  if (!lijst) throw new Error('geen_eventlijst')
  const kolom =
    lijst.statuses?.find((s) => s.name === kolomNaam) ??
    lijst.statuses?.find((s) => s.kind === 'active') ??
    lijst.statuses?.[0]
  if (!kolom) throw new Error('geen_kolom')

  const id = kaartId(bericht)
  const ref = id ? db.collection('tasks').doc(id) : db.collection('tasks').doc()
  try {
    await ref.create({
      listId: lijst.id,
      listName: lijst.name ?? 'Events',
      spaceId: lijst.spaceId ?? null,
      brandId: lijst.brandId ?? null,
      parentId: null,
      position: Date.now(),
      statusId: kolom.id,
      statusName: kolom.name,
      statusColor: kolom.color,
      statusKind: kolom.kind,
      open: kolom.kind !== 'done' && kolom.kind !== 'closed',
      ...kaartVelden(bericht, { brandId: await merkId(db, bericht.bron) }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    if (err?.code !== 6) throw err // 6 = ALREADY_EXISTS: de kaart stond er al, laten staan
  }
  return ref.id
}

export function maakMessagingVerwerking({ db, region, verstuur, alleProfielen, publiceer = standaardPubliceer }) {
  const beheerders = (profielen) =>
    profielen.filter((p) => p.active !== false && (p.role === 'owner' || p.role === 'admin')).map((p) => p.id)

  /** De beheerders één keer laten weten dat een bericht vastgelopen is. */
  async function meldVastgelopen(ref, bericht, fout) {
    const profielen = await alleProfielen()
    const regel = samenvatting(bericht)
    await verstuur({
      soort: 'messaging',
      kandidaten: beheerders(profielen),
      profielen,
      push: () => ({
        title: 'Bericht van buiten vastgelopen',
        body: `${regel} — ${fout}`,
        url: '/instellingen?tab=messaging',
        tag: `messaging-${ref.id}`,
      }),
      mail: () => ({
        onderwerp: `Bericht van buiten vastgelopen: ${bericht.bron}`,
        tekst: [
          `Een bericht van ${bericht.bron} is ${MAX_POGINGEN} keer niet verwerkt geraakt.`,
          '',
          regel,
          `Laatste fout: ${fout}`,
          '',
          'Kijk onder Instellingen → Messaging; daar kun je het herspelen zodra de oorzaak weg is.',
        ].join('\n'),
      }),
    })
  }

  /**
   * Eén verwerker op één bericht. `gedwongen` is de herspeelknop: dan telt
   * "al klaar" of "vastgelopen" niet en begint de telling opnieuw.
   */
  async function verwerk(ref, bericht, { gedwongen = false } = {}) {
    const vorige = bericht.verwerking?.event
    if (!wordtKaart(bericht)) {
      if (vorige?.stand !== 'overgeslagen') {
        await ref.update({ 'verwerking.event': { stand: 'overgeslagen', op: FieldValue.serverTimestamp() } })
      }
      return 'overgeslagen'
    }
    if (!gedwongen && vorige?.stand === 'klaar') return 'klaar'

    try {
      const taskId = await maakKaart(db, bericht)
      await ref.update({ 'verwerking.event': { stand: 'klaar', taskId, op: FieldValue.serverTimestamp() } })
      return 'klaar'
    } catch (err) {
      const fout = String(err?.message ?? err).slice(0, 200)
      const pogingen = gedwongen ? 1 : (vorige?.pogingen ?? 0) + 1
      logger.warn('Verwerker event kon geen kaart maken', { id: ref.id, fout, pogingen })
      await ref.update({ 'verwerking.event': { stand: 'fout', fout, pogingen, op: FieldValue.serverTimestamp() } })
      // Precies één keer naar de dead-letter-topic: bij de poging die de grens haalt.
      if (pogingen === MAX_POGINGEN) {
        await publiceer(TOPIC_VASTGELOPEN, vastgelopenBericht(ref.id, 'event', fout))
      }
      return 'fout'
    }
  }

  // Hoeveel er tegelijk mag lopen. De ingang laat er maximaal 60 tegelijk
  // binnen (3 × 20); de verwerkers mogen iets ruimer, zodat een piek in de rij
  // van het topic wacht en niet in de ingang.
  const schaal = { concurrency: 20, maxInstances: 10, memory: '256MiB' }

  /** De relay: elke nieuwe rij in de log op de bus. Verwerkt zelf niets. */
  const relay = onDocumentCreated({ region, document: 'messaging/{id}', ...schaal }, async (snap) => {
    const rij = snap.data?.data()
    if (!rij) return
    const messageId = await publiceer(TOPIC_BERICHTEN, busBericht(snap.params.id, rij))
    await snap.data.ref.update({ bus: { stand: 'gepubliceerd', messageId, op: FieldValue.serverTimestamp() } })
  })

  /** Verwerker **event** als abonnee op de bus. */
  const verwerkerEvent = onMessagePublished({ region, topic: TOPIC_BERICHTEN, ...schaal }, async (gebeurtenis) => {
    const busbericht = leesBusBericht(gebeurtenis.data?.message?.json)
    if (!isVoor(busbericht, 'event')) return
    const ref = db.collection('messaging').doc(busbericht.id)
    const snap = await ref.get()
    if (!snap.exists) {
      logger.warn('Bericht op de bus staat niet in de log', { id: busbericht.id })
      return
    }
    await verwerk(ref, snap.data())
  })

  /** De dead-letter-topic: de beheerders één keer laten weten dat een bericht vastgelopen is. */
  const vastgelopen = onMessagePublished({ region, topic: TOPIC_VASTGELOPEN }, async (gebeurtenis) => {
    const json = gebeurtenis.data?.message?.json
    if (!json?.id) return
    const ref = db.collection('messaging').doc(String(json.id))
    const snap = await ref.get()
    if (!snap.exists) return
    await meldVastgelopen(ref, snap.data(), json.fout ?? 'onbekend')
  })

  const herkansing = onSchedule({ region, schedule: 'every 5 minutes' }, async () => {
    // Eén veld, één gelijkheid: geen samengestelde index nodig. Wat te oud,
    // te vroeg of vastgelopen is, valt er in `herkansbaar` en `wachtOpDeBus` uit.
    const nu = Date.now()
    const [fouten, wachtend] = await Promise.all([
      db.collection('messaging').where('verwerking.event.stand', '==', 'fout').limit(100).get(),
      db.collection('messaging').where('bus.stand', '==', 'wacht').limit(100).get(),
    ])
    const opnieuw = fouten.docs.filter((d) => herkansbaar(d.data(), 'event', nu))
    const gemist = wachtend.docs.filter((d) => wachtOpDeBus(d.data(), nu))
    await Promise.all([
      ...opnieuw.map((d) => publiceer(TOPIC_BERICHTEN, busBericht(d.id, d.data(), { verwerker: 'event' }))),
      ...gemist.map(async (d) => {
        const messageId = await publiceer(TOPIC_BERICHTEN, busBericht(d.id, d.data()))
        await d.ref.update({ bus: { stand: 'gepubliceerd', messageId, op: FieldValue.serverTimestamp(), doorHerkansing: true } })
      }),
    ])
    if (opnieuw.length || gemist.length) logger.info('Herkansing messaging', { opnieuw: opnieuw.length, gemist: gemist.length })
  })

  const herspelen = onCall({ region, cors: true }, async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')
    const profiel = (await db.collection('profiles').doc(uid).get()).data()
    if (!profiel || profiel.active === false || !['owner', 'admin'].includes(profiel.role)) {
      throw new HttpsError('permission-denied', 'Alleen een beheerder kan een bericht herspelen.')
    }
    const id = String(request.data?.id ?? '')
    const verwerker = String(request.data?.verwerker ?? 'event')
    if (!id || !VERWERKERS.includes(verwerker)) throw new HttpsError('invalid-argument', 'Onbekend bericht of verwerker.')

    const ref = db.collection('messaging').doc(id)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Dat bericht bestaat niet.')
    const bericht = snap.data()
    const stand = await verwerk(ref, bericht, { gedwongen: true })
    logger.info('Bericht herspeeld', { id, verwerker, door: uid, stand, wasVastgelopen: isVastgelopen(bericht, verwerker) })
    return { ok: true, stand }
  })

  return {
    messagingEvent: relay,
    messagingVerwerkerEvent: verwerkerEvent,
    messagingVastgelopen: vastgelopen,
    messagingHerkansing: herkansing,
    messagingHerspelen: herspelen,
  }
}
