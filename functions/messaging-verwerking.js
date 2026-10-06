import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { isEventLijst } from './events-bron.js'
import { KAART_VOOR_SOORT, kaartId, kaartVelden } from './messaging-kaart.js'

/**
 * De verwerkers van messaging: wat er in JE Plan gebeurt met een bericht dat
 * in de log `messaging` kwam. Zie `functions-messaging/messaging.js` voor
 * waarom er een log is.
 *
 * Elke verwerker heeft een naam en schrijft zijn eigen stand op het bericht
 * (`verwerking.<naam>`): `klaar` met wat hij maakte, of `fout` met de reden en
 * het aantal pogingen. Een trigger kan twee keer vuren voor hetzelfde
 * document, dus elke verwerker kijkt eerst of hij al klaar is. Herspelen is
 * dan: zijn stand wissen.
 *
 * Eerste verwerker: **event**. Een `reservatie.aangevraagd` wordt een kaart in
 * de kolom `request` — geen aanvraagrij, want zo'n aanvraag ís al een datum
 * met een aantal personen en een formule, alleen nog niet bevestigd. Het id
 * van de kaart is afleidbaar uit het bericht, en `create` in plaats van
 * `set`: bestaat de kaart al, dan heeft het team ze misschien al verplaatst,
 * en die springt dan niet terug naar `request`.
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

export function maakMessagingVerwerking({ db, region }) {
  const event = onDocumentCreated({ region, document: 'messaging/{id}' }, async (snap) => {
    const bericht = snap.data?.data()
    if (!bericht) return
    const ref = snap.data.ref

    if (!KAART_VOOR_SOORT[bericht.soort]) {
      // Niet voor deze verwerker; dat is geen fout, wel een stand.
      await ref.update({ 'verwerking.event': { stand: 'overgeslagen', op: FieldValue.serverTimestamp() } })
      return
    }
    if (bericht.verwerking?.event?.stand === 'klaar') return

    try {
      const taskId = await maakKaart(db, bericht)
      await ref.update({ 'verwerking.event': { stand: 'klaar', taskId, op: FieldValue.serverTimestamp() } })
    } catch (err) {
      const pogingen = (bericht.verwerking?.event?.pogingen ?? 0) + 1
      logger.warn('Verwerker event kon geen kaart maken', { id: ref.id, fout: String(err?.message ?? err), pogingen })
      await ref.update({
        'verwerking.event': { stand: 'fout', fout: String(err?.message ?? err).slice(0, 200), pogingen, op: FieldValue.serverTimestamp() },
      })
    }
  })

  return { messagingEvent: event }
}
