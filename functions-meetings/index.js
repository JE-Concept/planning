import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { matchAssignee, summariseTranscript } from './summarise.js'

/**
 * Teamoverleg: van transcript naar een dossier met actiepunten.
 *
 * Deze functies staan bewust in een eigen codebase. Ze hangen aan een geheim
 * (de Claude-sleutel), en een functions-deploy faalt in zijn geheel op een
 * ontbrekend geheim — met alles in één codebase zou dat ook ensureProfile
 * meeslepen, en dan kan niemand meer inloggen. Dat is hier één keer gebeurd.
 *
 * Wat waar landt:
 *   tasks/{id}          het overleg als taak op het bord Overleg
 *   tasks/{id} (sub)    elk actiepunt, met verantwoordelijke → staat in Mijn werk
 *   meetings/{taskId}   de samenvatting zelf, alleen leesbaar voor wie erin staat
 *
 * Die splitsing is het antwoord op "wie mag dit zien": de titel van een overleg
 * staat op het bord voor het hele team, de inhoud niet.
 */

initializeApp()
const db = getFirestore()

const REGION = 'europe-west1'
const LIST_ID = 'overleg'

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

/** De vier die de samenvattingen mogen lezen, op adres uit config/access. */
async function viewerIds() {
  const [access, profiles] = await Promise.all([
    db.collection('config').doc('access').get(),
    db.collection('profiles').get(),
  ])

  const adressen = (access.data()?.meetingViewers ?? []).map((e) => e.toLowerCase())
  const ids = profiles.docs
    .filter((d) => adressen.includes((d.data().email ?? '').toLowerCase()))
    .map((d) => d.id)

  // Liever niemand dan iedereen: staat de lijst er niet, dan blijft het bij de
  // beheerders in plaats van open te vallen voor de hele ploeg.
  if (ids.length > 0) return ids
  return profiles.docs.filter((d) => ['owner', 'admin'].includes(d.data().role)).map((d) => d.id)
}

async function listStatus(naam) {
  const list = await db.collection('lists').doc(LIST_ID).get()
  const statuses = list.data()?.statuses ?? []
  return statuses.find((s) => s.name === naam) ?? statuses[0] ?? null
}

/**
 * Schrijft één overleg weg: het dossier, de samenvatting en de actiepunten.
 * Alles in één batch, zodat er nooit een overleg zonder zijn actiepunten
 * blijft staan als het halverwege misloopt.
 */
async function bewaarOverleg({ samenvatting, datum, bron, aangemaaktDoor }) {
  const profiles = (await db.collection('profiles').get()).docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }))
  const kijkers = await viewerIds()
  const status = await listStatus('Samengevat')

  const taakRef = db.collection('tasks').doc()
  const batch = db.batch()

  batch.set(taakRef, {
    listId: LIST_ID,
    listName: 'Overleg',
    spaceId: 'je-concept',
    brandId: null,
    parentId: null,
    title: `${samenvatting.titel} — ${datum}`,
    description: '',
    statusId: status?.id ?? null,
    statusName: status?.name ?? null,
    statusColor: status?.color ?? null,
    statusKind: status?.kind ?? 'active',
    open: true,
    priority: null,
    startDate: null,
    dueDate: null,
    assignees: [],
    tags: [],
    position: Date.now(),
    archived: false,
    completedAt: null,
    trackedSeconds: 0,
    commentCount: 0,
    meetingDate: datum,
    createdBy: aangemaaktDoor ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  batch.set(db.collection('meetings').doc(taakRef.id), {
    taskId: taakRef.id,
    titel: samenvatting.titel,
    datum,
    deelnemers: samenvatting.deelnemers ?? [],
    samenvatting: samenvatting.samenvatting ?? [],
    bron: bron ?? null,
    viewerIds: kijkers,
    createdAt: FieldValue.serverTimestamp(),
  })

  let metVerantwoordelijke = 0
  ;(samenvatting.actiepunten ?? []).forEach((punt, i) => {
    const uid = matchAssignee(punt.verantwoordelijke, profiles)
    if (uid) metVerantwoordelijke += 1

    batch.set(db.collection('tasks').doc(), {
      listId: LIST_ID,
      listName: 'Overleg',
      spaceId: 'je-concept',
      brandId: null,
      parentId: taakRef.id,
      title: punt.taak,
      description: '',
      statusId: status?.id ?? null,
      statusName: status?.name ?? null,
      statusColor: status?.color ?? null,
      statusKind: status?.kind ?? 'active',
      open: true,
      priority: null,
      startDate: null,
      dueDate: punt.vervaldatum ? new Date(punt.vervaldatum) : null,
      // Toegewezen betekent zichtbaar in Mijn werk; dat is de hele reden dat
      // actiepunten taken worden en geen regels in een tekst.
      assignees: uid ? [uid] : [],
      tags: [],
      position: Date.now() + i,
      archived: false,
      completedAt: null,
      trackedSeconds: 0,
      commentCount: 0,
      meetingId: taakRef.id,
      voorgesteldeVerantwoordelijke: uid ? null : (punt.verantwoordelijke ?? null),
      createdBy: aangemaaktDoor ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  await batch.commit()

  return {
    taskId: taakRef.id,
    actiepunten: (samenvatting.actiepunten ?? []).length,
    toegewezen: metVerantwoordelijke,
    kijkers: kijkers.length,
  }
}

/**
 * Een transcript samenvatten en wegschrijven.
 *
 * Wordt aangeroepen vanuit de app (transcript plakken) en straks vanuit de
 * Drive-koppeling. Alleen beheerders: een overleg is niet voor iedereen.
 */
export const summariseMeeting = onCall(
  { region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    const { auth, data } = request
    if (!auth) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')

    const profiel = await db.collection('profiles').doc(auth.uid).get()
    if (!['owner', 'admin'].includes(profiel.data()?.role)) {
      throw new HttpsError('permission-denied', 'Alleen beheerders kunnen een overleg toevoegen.')
    }

    const transcript = (data?.transcript ?? '').trim()
    if (transcript.length < 200) {
      throw new HttpsError('invalid-argument', 'Dit transcript is te kort om samen te vatten.')
    }

    const datum = data?.datum ?? new Date().toISOString().slice(0, 10)

    let samenvatting
    try {
      samenvatting = await summariseTranscript({
        apiKey: ANTHROPIC_API_KEY.value(),
        transcript,
        datum,
      })
    } catch (err) {
      logger.error('Samenvatten mislukt', { message: err.message })
      throw new HttpsError('internal', `Samenvatten mislukt: ${err.message}`)
    }

    const resultaat = await bewaarOverleg({
      samenvatting,
      datum,
      bron: data?.bron ?? null,
      aangemaaktDoor: auth.uid,
    })

    logger.info('Overleg toegevoegd', resultaat)
    return resultaat
  }
)
