import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { isEventLijst } from './events-bron.js'
import { KAART_VOOR_SOORT, kaartId, kaartVelden } from './messaging-kaart.js'
import { MAX_POGINGEN, VERWERKERS, herkansbaar, isVastgelopen, samenvatting } from './messaging-stand.js'

/**
 * De verwerkers van messaging: wat er in JE Plan gebeurt met een bericht dat
 * in de log `messaging` kwam. Zie `functions-messaging/messaging.js` voor
 * waarom er een log is.
 *
 * Elke verwerker heeft een naam en schrijft zijn eigen stand op het bericht
 * (`verwerking.<naam>`): `klaar` met wat hij maakte, `fout` met de reden en
 * het aantal pogingen, of `overgeslagen` als de soort niet voor hem is. Een
 * trigger kan twee keer vuren voor hetzelfde document, dus elke verwerker
 * kijkt eerst of hij al klaar is.
 *
 * Drie wegen naar dezelfde functie `verwerk`:
 * - de **trigger** bij een nieuw bericht;
 * - de **herkansing**, elk kwartier, voor wat op `fout` staat en nog niet
 *   vastgelopen is (zie `messaging-stand.js`): een eventlijst die even niet
 *   te lezen was, is een kwartier later meestal gewoon terug;
 * - de **herspeelknop** in Instellingen → Messaging, voor een beheerder die
 *   de oorzaak wegnam en niet op het kwartier wil wachten, of een bericht dat
 *   al vastgelopen was.
 *
 * Na MAX_POGINGEN mislukkingen stopt de herkansing en krijgen de beheerders
 * één melding: een bericht dat drie keer faalt, heeft een mens nodig, en een
 * vierde poging zonder mens is dezelfde fout voor de vierde keer.
 *
 * Eerste verwerker: **event**. Een `reservatie.aangevraagd` wordt een kaart
 * in de kolom `request` — geen aanvraagrij, want zo'n aanvraag ís al een
 * datum met een aantal personen en een formule, alleen nog niet bevestigd.
 * Het id van de kaart is afleidbaar uit het bericht, en `create` in plaats
 * van `set`: bestaat de kaart al, dan heeft het team ze misschien al
 * verplaatst, en die springt dan niet terug naar `request`.
 */

async function eventLijst(db) {
  const lijsten = await db.collection('lists').get()
  return lijsten.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => !l.archived)
    .find(isEventLijst)
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
      ...kaartVelden(bericht),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    if (err?.code !== 6) throw err // 6 = ALREADY_EXISTS: de kaart stond er al, laten staan
  }
  return ref.id
}

export function maakMessagingVerwerking({ db, region, verstuur, alleProfielen }) {
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
    if (!KAART_VOOR_SOORT[bericht.soort]) {
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
      if (pogingen === MAX_POGINGEN) await meldVastgelopen(ref, bericht, fout)
      return 'fout'
    }
  }

  const event = onDocumentCreated({ region, document: 'messaging/{id}' }, async (snap) => {
    const bericht = snap.data?.data()
    if (!bericht) return
    await verwerk(snap.data.ref, bericht)
  })

  const herkansing = onSchedule({ region, schedule: 'every 15 minutes' }, async () => {
    // Eén veld, één gelijkheid: geen samengestelde index nodig. Wat te oud of
    // vastgelopen is, valt er in `herkansbaar` uit.
    const snap = await db.collection('messaging').where('verwerking.event.stand', '==', 'fout').limit(50).get()
    const nu = Date.now()
    let geprobeerd = 0
    for (const d of snap.docs) {
      const bericht = d.data()
      if (!herkansbaar(bericht, 'event', nu)) continue
      geprobeerd += 1
      await verwerk(d.ref, bericht)
    }
    if (geprobeerd) logger.info('Herkansing messaging', { geprobeerd, kandidaten: snap.size })
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

  return { messagingEvent: event, messagingHerkansing: herkansing, messagingHerspelen: herspelen }
}
