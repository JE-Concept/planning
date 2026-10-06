import { createRequire } from 'node:module'
import { connect } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * De Drive-functie, met de echte handler tegen de Firestore-emulator en een
 * nagebootste Drive.
 *
 * `drive-naam.test.js` legt de namen en de rijen vast. Wat daar niet in zit,
 * is wat er misgaat in het echt: wie er mag uploaden, of de map van een event
 * één keer aangemaakt wordt en daarna hergebruikt, of een bestand dat iemand
 * rechtstreeks in Drive zette na een sync in de app staat (en een gewist
 * bestand eruit), en wat het scherm hoort wanneer het serviceaccount geen
 * toegang heeft tot de gedeelde Drive. Dat laatste is de fout die bij het
 * inrichten (stap A4) het vaakst voorkomt.
 *
 * Slaat zichzelf over zonder emulator; in CI draait hij mee in
 * `npm run test:rules`.
 */

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const [host, poort] = HOST.split(':')
const draait = await new Promise((klaar) => {
  const v = connect({ host, port: Number(poort), timeout: 1500 })
  const antwoord = (uit) => {
    v.destroy()
    klaar(uit)
  }
  v.once('connect', () => antwoord(true))
  v.once('error', () => antwoord(false))
  v.once('timeout', () => antwoord(false))
})
const beschrijf = draait ? describe : describe.skip

const MAP = 'application/vnd.google-apps.folder'

/**
 * Een gedeelde Drive in het geheugen: net de aanroepen die functions/drive.js
 * doet. `geenToegang` speelt een serviceaccount dat geen lid is.
 */
function nepDrive() {
  const bestanden = new Map()
  let teller = 0
  const staat = { geenToegang: false, aanroepen: 0 }
  const maak = (velden) => {
    const id = `d${++teller}`
    const b = { id, webViewLink: `https://drive.google.com/x/${id}`, trashed: false, modifiedTime: '2026-10-06T10:00:00Z', ...velden }
    bestanden.set(id, b)
    return b
  }
  const api = async (url, opties = {}) => {
    staat.aanroepen += 1
    if (staat.geenToegang) throw Object.assign(new Error('The user does not have sufficient permissions'), { response: { status: 403 } })
    const u = new URL(url)
    const q = u.searchParams.get('q') ?? ''
    const methode = opties.method ?? 'GET'
    if (methode === 'GET' && u.pathname.endsWith('/files')) {
      const ouder = /'([^']+)' in parents/.exec(q)?.[1]
      const naam = /name = '([^']+)'/.exec(q)?.[1]
      const alleenMappen = q.includes(`mimeType = '${MAP}'`)
      const geenMappen = q.includes(`mimeType != '${MAP}'`)
      const files = [...bestanden.values()].filter(
        (b) =>
          !b.trashed &&
          b.parents?.includes(ouder) &&
          (!naam || b.name === naam) &&
          (!alleenMappen || b.mimeType === MAP) &&
          (!geenMappen || b.mimeType !== MAP)
      )
      return { files }
    }
    if (methode === 'POST' && u.pathname.includes('/upload/')) {
      const tekst = opties.body.toString('utf8')
      const meta = JSON.parse(/\r\n\r\n(\{.*?\})\r\n--/s.exec(tekst)[1])
      const type = /Content-Type: ([^\r]+)\r\n\r\n(?!\{)/.exec(tekst)?.[1]
      return maak({ ...meta, mimeType: type, size: String(opties.body.length) })
    }
    if (methode === 'POST') return maak(opties.data)
    if (methode === 'PATCH') {
      const id = decodeURIComponent(u.pathname.split('/').pop())
      Object.assign(bestanden.get(id), opties.data)
      return bestanden.get(id)
    }
    throw new Error(`Onverwachte Drive-aanroep: ${methode} ${url}`)
  }
  return { api, bestanden, staat, maak }
}

let db = null
let maakDrive = null
let schijf = null
let functie = null

beforeAll(async () => {
  if (!draait) return
  process.env.FIRESTORE_EMULATOR_HOST = HOST
  const vanCodebase = createRequire(new URL('../functions/package.json', import.meta.url))
  const { initializeApp } = vanCodebase('firebase-admin/app')
  const { getFirestore } = vanCodebase('firebase-admin/firestore')
  db = getFirestore(initializeApp({ projectId: 'je-planning-drive-test' }, 'drive'))
  ;({ maakDrive } = await import('../functions/drive.js'))
})

afterAll(async () => {
  await db?.terminate()
})

/** Een token is hier gewoon de uid; de echte verifieer is Firebase Auth. */
const verifieer = async (token) => {
  if (!token.startsWith('uid:')) throw new Error('ongeldig')
  return { uid: token.slice(4) }
}

beforeEach(async () => {
  if (!draait) return
  for (const col of ['tasks', 'customers', 'attachments', 'profiles', 'config']) {
    const rijen = await db.collection(col).get()
    await Promise.all(rijen.docs.map((d) => d.ref.delete()))
  }
  await db.doc('profiles/u-lid').set({ role: 'member', active: true })
  await db.doc('profiles/u-personeel').set({ role: 'staff', active: true })
  await db.doc('config/drive').set({ driveId: 'gedeeld' })
  await db.doc('tasks/t-1').set({ title: 'Trouw Niels en Inez', eventDate: new Date('2027-03-12T12:00:00') })
  schijf = nepDrive()
  functie = maakDrive({ db, region: 'europe-west1', drive: schijf.api, verifieer })
})

function stuur({ methode = 'POST', pad, wie = 'u-lid', query = {}, kop = {}, rawBody }) {
  const koppen = { ...(wie ? { authorization: `Bearer uid:${wie}` } : {}), ...kop }
  const verzoek = {
    method: methode,
    path: `/api/drive/${pad}`,
    url: `/api/drive/${pad}`,
    query,
    body: {},
    rawBody,
    headers: koppen,
    get: (naam) => koppen[naam.toLowerCase()],
    header: (naam) => koppen[naam.toLowerCase()],
  }
  return new Promise((klaar) => {
    const antwoord = {
      statusCode: 200,
      set() {
        return this
      },
      setHeader() {},
      getHeader() {},
      status(code) {
        this.statusCode = code
        return this
      },
      json(data) {
        klaar({ status: this.statusCode, data })
        return this
      },
      send(data) {
        klaar({ status: this.statusCode, data })
        return this
      },
      end() {
        klaar({ status: this.statusCode })
        return this
      },
      on() {},
      once() {},
    }
    functie(verzoek, antwoord)
  })
}

const upload = (naam = 'plan.pdf', inhoud = 'pdf-inhoud', wie = 'u-lid') =>
  stuur({
    pad: 'upload',
    wie,
    query: { taskId: 't-1' },
    kop: { 'x-bestandsnaam': encodeURIComponent(naam), 'content-type': 'application/pdf' },
    rawBody: Buffer.from(inhoud),
  })

const mappen = () => [...schijf.bestanden.values()].filter((b) => b.mimeType === MAP)

beschrijf('de Drive-functie', () => {
  it('zonder aanmelding, of als personeel: 401, en Drive wordt niet aangeraakt', async () => {
    expect((await upload('x.pdf', 'x', null)).status).toBe(401)
    expect((await upload('x.pdf', 'x', 'u-personeel')).status).toBe(401)
    expect(schijf.staat.aanroepen).toBe(0)
  })

  it('zonder ingestelde gedeelde Drive: 409, zodat het scherm "nog in te richten" kan zeggen', async () => {
    await db.doc('config/drive').delete()
    const r = await upload()
    expect(r).toMatchObject({ status: 409, data: { fout: 'geen_drive' } })
  })

  it('een upload maakt Events/ en de map van het event, en zet de rij in Firestore', async () => {
    const r = await upload()
    expect(r.status).toBe(200)
    expect(mappen().map((m) => m.name).sort()).toEqual(['2027-03-12 — Trouw Niels en Inez', 'Events'])
    const event = (await db.doc('tasks/t-1').get()).data()
    expect(event.driveFolderId).toBeTruthy()
    const rijen = (await db.collection('attachments').where('taskId', '==', 't-1').get()).docs.map((d) => d.data())
    expect(rijen).toHaveLength(1)
    expect(rijen[0]).toMatchObject({ bron: 'drive', name: 'plan.pdf', soort: 'pdf', uploadedBy: 'u-lid' })
  })

  it('een tweede upload hergebruikt de map: geen tweede Events/, geen tweede eventmap', async () => {
    await upload('een.pdf')
    await upload('twee.pdf')
    expect(mappen()).toHaveLength(2)
    expect((await db.collection('attachments').get()).size).toBe(2)
  })

  it('een sync haalt erbij wat in Drive kwam en haalt weg wat er niet meer is', async () => {
    await upload('blijft.pdf')
    await upload('weg.pdf')
    const mapId = (await db.doc('tasks/t-1').get()).data().driveFolderId
    // Iemand zet een foto rechtstreeks in de map, en gooit weg.pdf in de prullenbak.
    schijf.maak({ name: 'foto.jpg', mimeType: 'image/jpeg', parents: [mapId], size: '1200' })
    for (const b of schijf.bestanden.values()) if (b.name === 'weg.pdf') b.trashed = true

    const r = await stuur({ pad: 'sync', query: { taskId: 't-1' } })
    expect(r.data).toMatchObject({ aantal: 2, erbij: 1, weg: 1 })
    const namen = (await db.collection('attachments').get()).docs.map((d) => d.data().name).sort()
    expect(namen).toEqual(['blijft.pdf', 'foto.jpg'])
  })

  it('weghalen zet het bestand in de prullenbak van Drive, niet definitief', async () => {
    const { data } = await upload()
    const r = await stuur({ methode: 'DELETE', pad: `bestand/${data.id}`, query: { taskId: 't-1' } })
    expect(r.status).toBe(200)
    expect((await db.doc(`attachments/${data.id}`).get()).exists).toBe(false)
    const inDrive = [...schijf.bestanden.values()].find((b) => b.name === 'plan.pdf')
    expect(inDrive.trashed).toBe(true)
  })

  it('zonder toegang tot de gedeelde Drive: 502 met drive_geen_toegang, en geen halve rij', async () => {
    schijf.staat.geenToegang = true
    const r = await upload()
    expect(r).toMatchObject({ status: 502, data: { fout: 'drive_geen_toegang' } })
    expect((await db.collection('attachments').get()).size).toBe(0)
  })

  it('een leeg bestand of een van meer dan 25 MB komt er niet in', async () => {
    expect((await upload('leeg.pdf', '')).status).toBe(400)
    const groot = await stuur({
      pad: 'upload',
      query: { taskId: 't-1' },
      kop: { 'x-bestandsnaam': 'groot.pdf', 'content-type': 'application/pdf' },
      rawBody: Buffer.alloc(25 * 1024 * 1024 + 1),
    })
    expect(groot.status).toBe(413)
  })
})
