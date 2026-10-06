import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { connect } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * De AAPI-import als trigger: een planning die per mail binnenkomt.
 *
 * De mailophaler zet de bijlage in de opslag en een rij in `aapiImportQueue`;
 * deze trigger leest het bestand en importeert. De lezer en de parser hebben
 * hun eigen tests, maar de trigger zelf draaide nergens: of hij de wachtrij
 * bijwerkt, of hij een gewone spreadsheet "afgewezen" noemt en geen storing,
 * of hij iemand stoort wanneer er niets veranderde. Dit draait de echte
 * trigger tegen de Firestore- en de Storage-emulator, met de geanonimiseerde
 * export uit tests/fixtures.
 *
 * JE Plan schrijft in de aapi-collecties alleen via deze server-import; de
 * rules houden elke browser erbuiten (zie rules-collecties.test.js).
 */

const FS = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const ST = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199'
const open = (adres) =>
  new Promise((klaar) => {
    const [host, poort] = adres.split(':')
    const v = connect({ host, port: Number(poort), timeout: 1500 })
    const antwoord = (uit) => {
      v.destroy()
      klaar(uit)
    }
    v.once('connect', () => antwoord(true))
    v.once('error', () => antwoord(false))
    v.once('timeout', () => antwoord(false))
  })
const draait = (await open(FS)) && (await open(ST))
const beschrijf = draait ? describe : describe.skip

const PROJECT = 'je-planning-aapi-test'
const BUCKET = `${PROJECT}.appspot.com`
let db = null
let bucket = null
let trigger = null
const meldingen = []

beforeAll(async () => {
  if (!draait) return
  process.env.FIRESTORE_EMULATOR_HOST = FS
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = ST
  delete process.env.FIREBASE_CONFIG
  process.env.GCLOUD_PROJECT = PROJECT
  const vanCodebase = createRequire(new URL('../functions/package.json', import.meta.url))
  // De standaard-app, want de trigger vraagt getStorage() zonder app.
  vanCodebase('firebase-admin/app').initializeApp({ projectId: PROJECT, storageBucket: BUCKET })
  db = vanCodebase('firebase-admin/firestore').getFirestore()
  bucket = vanCodebase('firebase-admin/storage').getStorage().bucket()
  const { maakAapiFuncties } = await import('../functions/aapi-import.js')
  trigger = maakAapiFuncties({ db, region: 'europe-west1', meld: async (m) => meldingen.push(m) }).aapiMailImport
})

afterAll(async () => {
  await db?.terminate()
})

beforeEach(async () => {
  if (!draait) return
  meldingen.length = 0
  for (const col of ['aapiImportQueue', 'aapiImportRuns', 'aapiShifts', 'aapiEmployees', 'tasks']) {
    const rijen = await db.collection(col).get()
    await Promise.all(rijen.docs.map((d) => d.ref.delete()))
  }
})

/** Een bijlage in de opslag en haar rij in de wachtrij, en de trigger erop. */
async function binnen(id, inhoud, { pad = `mail/${id}.xlsx`, inOpslag = true } = {}) {
  if (inOpslag) await bucket.file(pad).save(inhoud)
  const rij = { status: 'wachtend', storagePath: pad, fileName: 'planning.xlsx', van: 'aapi@example.be' }
  const ref = db.collection('aapiImportQueue').doc(id)
  await ref.set(rij)
  await trigger.run({ params: { id }, data: { data: () => rij, ref } })
  return (await ref.get()).data()
}

beschrijf('een planning per mail', () => {
  it('de echte export wordt geïmporteerd, en de wachtrij zegt wat er gebeurde', async () => {
    const rij = await binnen('q-1', readFileSync(new URL('./fixtures/planning-overview.xlsx', import.meta.url)))
    expect(rij.status).toBe('klaar')
    expect(rij.importRunId).toBeTruthy()
    expect(rij.rapport.shiftsCreated).toBeGreaterThan(0)
    expect((await db.collection('aapiShifts').get()).size).toBe(rij.rapport.shiftsCreated)
    expect((await db.doc(`aapiImportRuns/${rij.importRunId}`).get()).exists).toBe(true)
    expect(meldingen).toHaveLength(1)
    expect(meldingen[0]).toMatchObject({ gelukt: true })
  })

  it('dezelfde mail nog eens verandert niets, en stoort dus niemand', async () => {
    const xlsx = readFileSync(new URL('./fixtures/planning-overview.xlsx', import.meta.url))
    await binnen('q-1', xlsx)
    const voor = (await db.collection('aapiShifts').get()).size
    meldingen.length = 0
    const tweede = await binnen('q-2', xlsx)
    expect(tweede.status).toBe('klaar')
    expect((tweede.rapport.shiftsCreated ?? 0) + (tweede.rapport.shiftsUpdated ?? 0) + (tweede.rapport.shiftsRemoved ?? 0)).toBe(0)
    expect((await db.collection('aapiShifts').get()).size).toBe(voor)
    expect(meldingen).toHaveLength(0)
  })

  it('een bijlage die geen planning is, heet afgewezen en geen storing', async () => {
    const rij = await binnen('q-3', Buffer.from('dit is gewoon tekst'))
    expect(rij.status).toBe('afgewezen')
    expect(rij.fout).toMatch(/xlsx/i)
    expect(meldingen).toHaveLength(0)
    expect((await db.collection('aapiShifts').get()).size).toBe(0)
  })

  it('een bestand dat niet in de opslag staat, geeft mislukt met de reden', async () => {
    const rij = await binnen('q-4', null, { inOpslag: false, pad: 'mail/bestaat-niet.xlsx' })
    expect(rij.status).toBe('mislukt')
    expect(rij.fout).toMatch(/niet gevonden/)
  })

  it('een rij die al verwerkt is, laat de trigger liggen', async () => {
    const ref = db.collection('aapiImportQueue').doc('q-5')
    const rij = { status: 'klaar', storagePath: 'mail/x.xlsx' }
    await ref.set(rij)
    await trigger.run({ params: { id: 'q-5' }, data: { data: () => rij, ref } })
    expect((await ref.get()).data()).toEqual(rij)
  })
})
