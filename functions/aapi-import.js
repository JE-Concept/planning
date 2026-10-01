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
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import { XlsxBron } from './aapi/bron.js'
import { planImport } from './aapi/import.js'
import { herkenBlad, planPersoneel } from './aapi/personeel.js'
import { ImportFout } from './aapi/parser.js'
import { brusselseDag } from './aapi/tijd.js'
import { komtInAanmerking } from './aapi/matcher.js'

/** Hoe groot een exportbestand hoogstens mag zijn. Oktober was 15 kB. */
const MAX_BYTES = 8 * 1024 * 1024

/** Firestore schrijft hoogstens 500 bewerkingen per batch. */
const PER_BATCH = 450

export function maakAapiFuncties({ db, region, meld = null }) {
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

  /**
   * Eén bestand erin, en alles wat daaruit volgt.
   *
   * Dit is wat de knop en de mail delen. Zonder deze functie zou de mailweg
   * een tweede, bijna-gelijke import worden — en dan is het een kwestie van
   * tijd tot er één van de twee een regel mist.
   */
  async function voerUit({ buffer, bron, bestandsnaam, dryRun = false, door = null }) {
    let rijen
    try {
      rijen = await new XlsxBron(buffer, { naam: bron, bestandsnaam }).rijen()
    } catch (err) {
      throw new ImportFout(err.message)
    }

    /*
      Eén uploadvak en één mailadres voor beide bestanden: de tool kijkt zelf
      wat ze gekregen heeft. Dat scheelt een keuzelijst waarin iemand zich
      vergist, en het maakt de mailweg vanzelf geschikt voor allebei.
    */
    const soort = herkenBlad(rijen)
    if (!soort) {
      throw new ImportFout(
        'Dit blad is geen planningsexport en geen personeelslijst. '
        + 'Een planning heeft de kolommen Planning Id en Start Datetime; een personeelslijst Naam en Dimona type.'
      )
    }
    if (soort === 'personeel') return voerPersoneelUit({ rijen, bron, bestandsnaam, dryRun, door })

    const nu = new Date()
    const loopId = db.collection('aapiImportRuns').doc().id

    // Eerst het venster leren kennen, dan pas ophalen wat erbinnen valt.
    const verkenning = planImport({ rijen, nu, importRunId: loopId, bron, bestandsnaam })
    const [bestaandeShifts, events, medewerkers] = await Promise.all([
      bestaandeShiftsIn(verkenning.venster),
      eventsIn(verkenning.venster),
      db.collection('aapiEmployees').get(),
    ])

    const plan = planImport({
      rijen,
      bestaandeShifts,
      bestaandeMedewerkers: medewerkers.docs.map((d) => ({ id: d.id, ...d.data() })),
      events,
      nu,
      importRunId: loopId,
      bron,
      bestandsnaam,
    })

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
      byId: door?.id ?? null,
      byName: door?.naam ?? null,
    })

    logger.info('AAPI-planning geïmporteerd', {
      loopId,
      bron,
      aangemaakt: plan.rapport.shiftsCreated,
      bijgewerkt: plan.rapport.shiftsUpdated,
      ongewijzigd: plan.rapport.shiftsUnchanged,
    })

    return { dryRun: false, importRunId: loopId, rapport: plan.rapport }
  }

  /**
   * De personeelslijst: wie er werkt, niet wanneer.
   *
   * Dezelfde vorm als hierboven — een pure som en daaromheen het wegschrijven —
   * maar met een eigen rekenkern, want het is een ander bestand met een andere
   * sleutel. Wat er wél en níét uit overgenomen wordt, en waarom, staat in
   * `aapi/personeel.js`.
   */
  async function voerPersoneelUit({ rijen, bron, bestandsnaam, dryRun, door }) {
    const nu = new Date()
    const loopId = db.collection('aapiImportRuns').doc().id
    const bestaand = await db.collection('aapiEmployees').get()

    const plan = planPersoneel({
      rijen,
      bestaandeMedewerkers: bestaand.docs.map((d) => ({ id: d.id, ...d.data() })),
      nu,
      importRunId: loopId,
      bron,
      bestandsnaam,
    })

    if (dryRun) return { dryRun: true, soort: 'personeel', rapport: { ...plan.rapport, status: 'voorbeeld' } }

    await schrijfInBatches(
      plan.mutaties.map((m) => (batch) =>
        batch.set(
          db.collection('aapiEmployees').doc(m.id),
          { ...m.patch, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        )
      )
    )

    await db.collection('aapiImportRuns').doc(loopId).set({
      ...plan.rapport,
      startedAt: nu,
      finishedAt: FieldValue.serverTimestamp(),
      byId: door?.id ?? null,
      byName: door?.naam ?? null,
    })

    logger.info('AAPI-personeelslijst geïmporteerd', {
      loopId,
      bron,
      aangemaakt: plan.rapport.employeesCreated,
      bijgewerkt: plan.rapport.employeesUpdated,
      ongewijzigd: plan.rapport.employeesUnchanged,
    })

    return { dryRun: false, soort: 'personeel', importRunId: loopId, rapport: plan.rapport }
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

      try {
        return await voerUit({
          buffer,
          bron,
          bestandsnaam,
          dryRun,
          door: { id: request.auth.uid, naam: profiel.fullName ?? profiel.email ?? null },
        })
      } catch (err) {
        if (err instanceof ImportFout) throw new HttpsError('invalid-argument', err.message)
        throw err
      }
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

  /**
   * De wachtrij die de mailophaler vult.
   *
   * ── Waarom via een wachtrij en niet rechtstreeks ──────────────────────
   * `functions-mail` kan niets uit deze codebase importeren — aparte
   * verpakking, aparte uitrol. Daar weten ze dus niet wat een planningsexport
   * is; ze zien een xlsx en zetten hem neer. Hier staat de lezer, dus hier
   * wordt pas beslist of het er een is.
   *
   * ── Waarom een afwijzing geen fout is ─────────────────────────────────
   * Er komt van alles binnen op info@. Een xlsx die geen planning blijkt,
   * krijgt `afgewezen` met de reden erbij en verder niets: geen melding, geen
   * rood. De mail zelf staat gewoon in het postvak, zoals elke andere.
   *
   * Een planning die wél herkend wordt maar stukloopt, is wél een melding —
   * dan was er iets te importeren en is het niet gebeurd.
   */
  const aapiMailImport = onDocumentCreated(
    { region, document: 'aapiImportQueue/{id}', memory: '512MiB', timeoutSeconds: 300 },
    async (event) => {
      const rij = event.data?.data()
      const ref = event.data?.ref
      if (!rij || rij.status !== 'wachtend' || !rij.storagePath) return

      let buffer
      try {
        ;[buffer] = await getStorage().bucket().file(rij.storagePath).download()
      } catch (err) {
        await ref.set({ status: 'mislukt', fout: `Bestand niet gevonden: ${err.message}` }, { merge: true })
        return
      }

      try {
        const { importRunId, rapport } = await voerUit({
          buffer,
          bron: 'xlsx-mail',
          bestandsnaam: rij.fileName ?? null,
          door: { id: null, naam: rij.van || 'mail' },
        })
        await ref.set({ status: 'klaar', importRunId, rapport, verwerktOp: FieldValue.serverTimestamp() }, { merge: true })

        // Alleen melden wanneer er iets te melden valt. Een dagelijkse mail die
        // niets veranderde, hoeft niemands telefoon te laten trillen.
        const iets = (rapport.shiftsCreated ?? 0) + (rapport.shiftsUpdated ?? 0) + (rapport.shiftsRemoved ?? 0)
        if (meld && rapport.soort !== 'personeel' && (iets > 0 || rapport.linksAmbiguous > 0)) {
          await meld({ gelukt: true, rapport, bestandsnaam: rij.fileName ?? '' })
        }
      } catch (err) {
        const herkend = !(err instanceof ImportFout)
        await ref.set(
          {
            // Niet herkend als planning is geen storing maar een gewone mail
            // met een bijlage. Een echte fout tijdens het importeren wél.
            status: herkend ? 'mislukt' : 'afgewezen',
            fout: err.message,
            verwerktOp: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        logger.warn('Planningsbijlage niet geïmporteerd', { pad: rij.storagePath, reden: err.message })
        if (meld && herkend) await meld({ gelukt: false, fout: err.message, bestandsnaam: rij.fileName ?? '' })
      }
    }
  )

  return { aapiImport, aapiKoppel, aapiMailImport }
}
