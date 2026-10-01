/**
 * De import van de AAPI-planning, als functie.
 *
 * ── Waarom server-side ────────────────────────────────────────────────────
 * De browser mag `aapiShifts` en `aapiEmployees` niet schrijven (zie
 * `firestore.rules`): wat uit AAPI komt, komt uit AAPI, en een tabblad hoort
 * daar niet tussen te kunnen. Alleen een koppeling is van een mens, en die
 * loopt via `aapiKoppel` hieronder — zo staat op één plek wat een geldige
 * koppeling is, en kan `linkedBy` niet gelogen worden.
 *
 * ── Waarom een callable en geen trigger op opslag ─────────────────────────
 * Omdat de uploadpagina een antwoord wil: eerst een voorbeeld van wat erin zit
 * (`dryRun`), dan het echte werk. Een trigger op een bestand dat ergens landt,
 * geeft dat antwoord pas achteraf en via een omweg.
 *
 * ── Waarom `db` van buiten komt ───────────────────────────────────────────
 * `initializeApp()` staat onderaan de imports van `index.js`, en een module die
 * bovenaan al `getFirestore()` roept, draait daarvóór. Dat valt niet op in een
 * test en wél bij de uitrol. `maakAgendaFeed` en `maakPortaal` doen het om
 * dezelfde reden zo.
 *
 * Het rekenwerk zelf staat in `aapi/` en weet van niets van dit alles.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { XlsxBron } from './aapi/bron.js'
import { planImport } from './aapi/import.js'
import { ImportFout } from './aapi/parser.js'
import { brusselseDag } from './aapi/tijd.js'
import { komtInAanmerking } from './aapi/matcher.js'

/** Hoe groot een exportbestand hoogstens mag zijn. Oktober was 15 kB. */
const MAX_BYTES = 8 * 1024 * 1024

/** Firestore schrijft hoogstens 500 bewerkingen per batch. */
const PER_BATCH = 450

export function maakAapiFuncties({ db, region }) {
  async function profielVan(uid, toegestaan) {
    if (!uid) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')
    const snap = await db.collection('profiles').doc(uid).get()
    const profiel = snap.data()
    if (!snap.exists || profiel.active !== true || !toegestaan(profiel.role)) {
      throw new HttpsError('permission-denied', 'Je hebt hier geen toegang toe.')
    }
    return profiel
  }

  /**
   * De events waar een shift aan kan hangen.
   *
   * Alleen uit het venster van dit bestand, met een dag speling aan beide
   * kanten — een shift die om 23:00 begint raakt de dag erna. Meer ophalen is
   * de hele eventlijst ophalen voor niets.
   */
  async function eventsIn(venster) {
    if (!venster) return []
    const van = new Date(venster.van.getTime() - 24 * 3600 * 1000)
    const tot = new Date(venster.tot.getTime() + 24 * 3600 * 1000)

    const snap = await db.collection('tasks')
      .where('eventDate', '>=', van)
      .where('eventDate', '<=', tot)
      .get()

    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) => !t.parentId)
      .map((t) => ({ ...t, dag: t.eventDate?.toDate ? brusselseDag(t.eventDate.toDate()) : null }))
      .filter(komtInAanmerking)
  }

  async function bestaandeShiftsIn(venster) {
    if (!venster) return []
    const snap = await db.collection('aapiShifts')
      .where('start', '>=', venster.van)
      .where('start', '<=', venster.tot)
      .get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  async function schrijfInBatches(bewerkingen) {
    for (let i = 0; i < bewerkingen.length; i += PER_BATCH) {
      const batch = db.batch()
      for (const doeHet of bewerkingen.slice(i, i + PER_BATCH)) doeHet(batch)
      await batch.commit()
    }
  }

  const aapiImport = onCall(
    { region, memory: '512MiB', timeoutSeconds: 300 },
    async (request) => {
      const profiel = await profielVan(request.auth?.uid, (rol) => ['owner', 'admin'].includes(rol))

      const { bestandBase64, bestandsnaam = null, dryRun = false, bron = 'xlsx-upload' } = request.data ?? {}
      if (typeof bestandBase64 !== 'string' || !bestandBase64) {
        throw new HttpsError('invalid-argument', 'Er zat geen bestand bij.')
      }

      const buffer = Buffer.from(bestandBase64, 'base64')
      if (buffer.length > MAX_BYTES) {
        throw new HttpsError('invalid-argument', 'Dit bestand is groter dan 8 MB; dat is geen planningsexport.')
      }

      let rijen
      try {
        rijen = await new XlsxBron(buffer, { naam: bron, bestandsnaam }).rijen()
      } catch (err) {
        throw new HttpsError('invalid-argument', err.message)
      }

      const nu = new Date()
      const loopId = db.collection('aapiImportRuns').doc().id

      let plan
      try {
        // Eerst het venster leren kennen, dan pas ophalen wat erbinnen valt.
        const verkenning = planImport({ rijen, nu, importRunId: loopId, bron, bestandsnaam })
        const [bestaandeShifts, events, medewerkers] = await Promise.all([
          bestaandeShiftsIn(verkenning.venster),
          eventsIn(verkenning.venster),
          db.collection('aapiEmployees').get(),
        ])

        plan = planImport({
          rijen,
          bestaandeShifts,
          bestaandeMedewerkers: medewerkers.docs.map((d) => ({ id: d.id, ...d.data() })),
          events,
          nu,
          importRunId: loopId,
          bron,
          bestandsnaam,
        })
      } catch (err) {
        if (err instanceof ImportFout) throw new HttpsError('invalid-argument', err.message)
        throw err
      }

      if (dryRun) return { dryRun: true, rapport: { ...plan.rapport, status: 'voorbeeld' } }

      const bewerkingen = []
      for (const m of plan.medewerkers) {
        const ref = db.collection('aapiEmployees').doc(m.aapiEmployeeId)
        bewerkingen.push((batch) => batch.set(ref, { ...m.patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true }))
      }
      for (const s of [...plan.shifts, ...plan.verdwenen]) {
        const ref = db.collection('aapiShifts').doc(s.aapiPlanningId)
        bewerkingen.push((batch) => batch.set(ref, { ...s.patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true }))
      }
      await schrijfInBatches(bewerkingen)

      await db.collection('aapiImportRuns').doc(loopId).set({
        ...plan.rapport,
        startedAt: nu,
        finishedAt: FieldValue.serverTimestamp(),
        byId: request.auth.uid,
        byName: profiel.fullName ?? profiel.email ?? null,
      })

      logger.info('AAPI-planning geïmporteerd', {
        loopId,
        aangemaakt: plan.rapport.shiftsCreated,
        bijgewerkt: plan.rapport.shiftsUpdated,
        ongewijzigd: plan.rapport.shiftsUnchanged,
      })

      return { dryRun: false, importRunId: loopId, rapport: plan.rapport }
    }
  )

  const aapiKoppel = onCall({ region }, async (request) => {
    const uid = request.auth?.uid
    await profielVan(uid, (rol) => !['staff', 'social'].includes(rol))

    const { planningId, eventId = null, status } = request.data ?? {}
    if (!planningId) throw new HttpsError('invalid-argument', 'Welke shift?')
    if (!['manual', 'none', 'unlinked'].includes(status)) {
      throw new HttpsError('invalid-argument', 'Dat is geen geldige koppeling.')
    }
    if (status === 'manual' && !eventId) throw new HttpsError('invalid-argument', 'Kies een event.')

    const ref = db.collection('aapiShifts').doc(planningId)
    if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Die shift bestaat niet.')

    await ref.set(
      {
        linkStatus: status,
        eventRef: status === 'manual' ? eventId : null,
        // Een handmatige koppeling heeft geen score: er is niets berekend, er
        // is beslist. Een score van 1 zou doen alsof de machine het eens was.
        linkScore: null,
        linkCandidates: [],
        // `unlinked` laat de volgende import opnieuw matchen; `linkedAt` leeg
        // maken is wat dat in gang zet.
        linkedAt: status === 'unlinked' ? null : FieldValue.serverTimestamp(),
        linkedBy: status === 'unlinked' ? null : uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return { ok: true }
  })

  return { aapiImport, aapiKoppel }
}
