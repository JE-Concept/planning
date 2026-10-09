import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { geplakteMail } from './mail-koppeling.js'

/**
 * Een geplakte aanvraag in de draad van haar event zetten.
 *
 * De browser mag niet in `mails` schrijven (zie `firestore.rules`): de draad
 * is bewijs van wat er gezegd is. Een mail die iemand in "Nieuw event › Uit
 * een mail" plakt, hoort wel in die draad — anders staat ze als omschrijving
 * tussen de notities en is het tabblad Mail leeg. Dus schrijft de server ze,
 * na drie controles: het is iemand van het bureau, het event bestaat en is
 * een event, en er staat iets in. Wie het deed, staat op de rij zelf
 * (`geplaktDoor`) en in de log.
 *
 * Wat er precies op de rij komt, staat in `geplakteMail` in
 * `mail-koppeling.js`, zonder imports en met tests erop.
 */
export function maakMailPlakken({ db, region }) {
  const mailPlakken = onCall({ region, cors: true }, async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')

    // Dezelfde kring als `isTeam()` in de regels: wie de draad mag lezen.
    const mij = (await db.collection('profiles').doc(uid).get()).data()
    if (!mij || mij.active === false || !['owner', 'admin', 'member', 'guest'].includes(mij.role)) {
      throw new HttpsError('permission-denied', 'Alleen het bureau kan een mail bij een event zetten.')
    }

    const eventId = String(request.data?.eventId ?? '').trim()
    const event = eventId ? await db.collection('tasks').doc(eventId).get() : null
    if (!event?.exists || event.data().parentId) {
      throw new HttpsError('not-found', 'Dat event bestaat niet.')
    }

    const rij = geplakteMail({
      tekst: request.data?.tekst,
      onderwerp: request.data?.onderwerp,
      van: request.data?.van,
      eventId,
      customerId: event.data().customerId ?? null,
      door: uid,
    })
    if (!rij) throw new HttpsError('invalid-argument', 'Er staat geen mail in.')

    // `create` en niet `set`: een tweede keer dezelfde tekst bij hetzelfde
    // event is dezelfde rij, en die laten we staan zoals ze er al stond.
    const ref = db.collection('mails').doc(rij.id)
    await ref.create(rij.data).catch((err) => {
      if (err?.code !== 6) throw err // 6 = ALREADY_EXISTS
    })
    logger.info('Mail geplakt bij event', { id: rij.id, eventId, door: uid })
    return { id: rij.id }
  })

  return { mailPlakken }
}
