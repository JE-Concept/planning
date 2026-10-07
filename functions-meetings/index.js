import './runtime.js'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { matchAssignee } from './match.js'
import { summariseTranscript } from './summarise.js'
import { assistantTurn } from './assistant.js'

/**
 * Teamoverleg: van transcript naar een dossier met actiepunten.
 *
 * Deze functies staan bewust in een eigen codebase. Ze hangen aan een geheim
 * (de Claude-sleutel), en een functions-deploy faalt in zijn geheel op een
 * ontbrekend geheim — met alles in één codebase zou dat ook ensureProfile
 * meeslepen, en dan kan niemand meer inloggen. Dat is hier één keer gebeurd.
 *
 * Wat waar landt:
 *   tasks/{id}          het overleg als taak op het takenbord
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

/**
 * Het bord waarop een overleg landt: zijn naam en de status die we willen.
 *
 * De naam komt uit Firestore en staat niet hier hardgecodeerd — het bord is in
 * Instellingen te hernoemen, en een naam op twee plaatsen loopt uiteen.
 */
async function bord(statusNaam) {
  const list = await db.collection('lists').doc(LIST_ID).get()
  const statuses = list.data()?.statuses ?? []
  return {
    naam: list.data()?.name ?? null,
    status: statuses.find((s) => s.name === statusNaam) ?? statuses[0] ?? null,
  }
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
  const { naam: bordNaam, status } = await bord('samengevat')

  const taakRef = db.collection('tasks').doc()
  const batch = db.batch()

  batch.set(taakRef, {
    listId: LIST_ID,
    listName: bordNaam,
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
      listName: bordNaam,
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

/**
 * De assistent in de app: één modelbeurt per aanroep.
 *
 * Voor het team, niet voor personeel. Hoogstens vijftien beurten per minuut
 * per persoon — een tool-lus die blijft draaien, stopt hier en niet op de
 * factuur.
 */
const beurten = new Map()

export const assistant = onCall(
  { region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const { auth, data } = request
    if (!auth) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')

    const profiel = await db.collection('profiles').doc(auth.uid).get()
    const p = profiel.data()
    if (!p || p.active === false || p.role === 'staff') {
      throw new HttpsError('permission-denied', 'De assistent is er voor het planningsteam.')
    }

    // De app vraagt bij het openen na of de assistent er is, zonder het model
    // aan te roepen; zonder antwoord toont ze de knop niet.
    if (data?.ping) return { ok: true }

    const nu = Date.now()
    const recent = (beurten.get(auth.uid) ?? []).filter((t) => nu - t < 60_000)
    if (recent.length >= 15) {
      throw new HttpsError('resource-exhausted', 'Even rustig: probeer het over een minuutje opnieuw.')
    }
    beurten.set(auth.uid, [...recent, nu])

    try {
      return await assistantTurn({
        apiKey: ANTHROPIC_API_KEY.value(),
        system: data?.system,
        messages: data?.messages,
        tools: data?.tools,
      })
    } catch (err) {
      logger.error('Assistent mislukt', { message: err.message })
      throw new HttpsError('internal', 'De assistent kon niet antwoorden.')
    }
  }
)
