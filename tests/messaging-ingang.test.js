import { createRequire } from 'node:module'
import { connect } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * De ingang van messaging, met de echte handler tegen de Firestore-emulator.
 *
 * `messaging.test.js` legt de envelop en de tokens vast, de bedradingstest de
 * verwerkers. Wat daartussen ligt is dit: komt een verzoek met een foute
 * token er echt niet in, geeft dezelfde inzending twee keer echt één rij, en
 * wordt een plat formulier echt een envelop in de database. Dat kan alleen
 * tegen een database die `create` weigert zoals de echte, dus de emulator.
 *
 * Slaat zichzelf over zonder emulator, net als `rules.test.js`; in CI draait
 * hij mee in `npm run test:rules`.
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

const WM = 'w'.repeat(32)
const BARVUE_OUD = 'o'.repeat(32)
const BARVUE_NIEUW = 'n'.repeat(32)

let db = null
let messaging = null
let maak = null

beforeAll(async () => {
  if (!draait) return
  process.env.FIRESTORE_EMULATOR_HOST = HOST
  process.env.GCLOUD_PROJECT = 'je-planning-ingang-test'
  // Het geheim zoals de functie het leest: defineSecret valt terug op de omgeving.
  process.env.MESSAGING_TOKENS = JSON.stringify({ wintermoods: WM, barvue: [BARVUE_OUD, BARVUE_NIEUW] })
  // De firebase-admin van de codebase zelf, zodat FieldValue en de database
  // uit dezelfde bibliotheek komen als in productie.
  const vanCodebase = createRequire(new URL('../functions-messaging/package.json', import.meta.url))
  const { initializeApp } = vanCodebase('firebase-admin/app')
  const { getFirestore } = vanCodebase('firebase-admin/firestore')
  db = getFirestore(initializeApp({ projectId: 'je-planning-ingang-test' }, 'ingang'))
  const { maakMessaging } = await import('../functions-messaging/messaging.js')
  maak = (perMinuut) => maakMessaging({ db, region: 'europe-west1', perMinuut })
  messaging = maak(1000)
})

afterAll(async () => {
  await db?.terminate()
})

beforeEach(async () => {
  if (!draait) return
  const rijen = await db.collection('messaging').get()
  await Promise.all(rijen.docs.map((d) => d.ref.delete()))
})

/** Een verzoek zoals Express het aan de functie geeft, en het antwoord dat terugkomt. */
async function stuur({ token, body, pad = '/api/messaging', header = 'authorization', methode = 'POST', functie = messaging }) {
  const headers = token ? { [header]: header === 'authorization' ? `Bearer ${token}` : token } : {}
  const verzoek = {
    method: methode,
    path: pad,
    url: pad,
    body,
    headers: { 'content-type': 'application/json', ...headers },
    get: (naam) => headers[naam.toLowerCase()],
    header: (naam) => headers[naam.toLowerCase()],
  }
  return new Promise((klaar) => {
    const antwoord = {
      statusCode: 200,
      kop: {},
      set(k, v) {
        this.kop[k.toLowerCase()] = v
        return this
      },
      setHeader(k, v) {
        this.kop[k.toLowerCase()] = v
      },
      getHeader(k) {
        return this.kop[k.toLowerCase()]
      },
      status(code) {
        this.statusCode = code
        return this
      },
      json(data) {
        klaar({ status: this.statusCode, data, kop: this.kop })
        return this
      },
      send(data) {
        klaar({ status: this.statusCode, data, kop: this.kop })
        return this
      },
      end() {
        klaar({ status: this.statusCode, data: null, kop: this.kop })
        return this
      },
      on() {},
      once() {},
    }
    functie(verzoek, antwoord)
  })
}

const AANVRAAG = { soort: 'offerte.aangevraagd', sleutel: 'a-1', inhoud: { naam: 'An', email: 'an@example.be', personen: 40 } }

beschrijf('de ingang van messaging', () => {
  it('een foute token krijgt 401 en schrijft niets', async () => {
    const r = await stuur({ token: 'x'.repeat(32), body: AANVRAAG })
    expect(r.status).toBe(401)
    expect((await db.collection('messaging').get()).size).toBe(0)
  })

  it('zonder token ook', async () => {
    const r = await stuur({ body: AANVRAAG })
    expect(r.status).toBe(401)
  })

  it('alleen POST', async () => {
    const r = await stuur({ token: WM, body: AANVRAAG, methode: 'GET' })
    expect(r.status).toBe(405)
  })

  it('een goede token schrijft één rij, met de bron van de token en niet die uit het bericht', async () => {
    const r = await stuur({ token: BARVUE_NIEUW, body: { ...AANVRAAG, bron: 'wintermoods' } })
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({ ok: true, berichtId: 'barvue-a-1', herhaald: false })
    const rij = (await db.doc('messaging/barvue-a-1').get()).data()
    expect(rij).toMatchObject({ bron: 'barvue', soort: 'offerte.aangevraagd', bus: { stand: 'wacht' }, verwerking: {} })
    expect(rij.ontvangen).toBeTruthy()
    // Twee jaar bewaren, dan wist Firestore de rij zelf.
    const jaren = (rij.bewaarTot.toDate() - rij.ontvangen.toDate()) / (365.25 * 86400000)
    expect(jaren).toBeGreaterThan(1.99)
    expect(jaren).toBeLessThan(2.01)
  })

  it('de oude token van een bron werkt nog tijdens een wissel', async () => {
    const r = await stuur({ token: BARVUE_OUD, body: AANVRAAG })
    expect(r.data).toMatchObject({ ok: true, berichtId: 'barvue-a-1' })
  })

  it('dezelfde inzending twee keer geeft één rij, en de tweede hoort dat ze herhaald is', async () => {
    const eerste = await stuur({ token: WM, body: AANVRAAG })
    const tweede = await stuur({ token: WM, body: { ...AANVRAAG, inhoud: { naam: 'Iemand anders' } } })
    expect(eerste.data.herhaald).toBe(false)
    expect(tweede.data.herhaald).toBe(true)
    const rij = (await db.doc('messaging/wintermoods-a-1').get()).data()
    // De eerste blijft staan: een rij in de log is onveranderlijk.
    expect(rij.inhoud.naam).toBe('An')
  })

  it('een plat formulier wordt een envelop, met een kenmerk uit de inhoud', async () => {
    const formulier = { naam: 'Bo', email: 'bo@example.be', datum: '2026-12-19', bericht: 'Feest' }
    const r = await stuur({ token: WM, body: formulier, header: 'x-messaging-token' })
    expect(r.status).toBe(200)
    const rij = (await db.doc(`messaging/${r.data.berichtId}`).get()).data()
    expect(rij).toMatchObject({ bron: 'wintermoods', soort: 'offerte.aangevraagd', inhoud: formulier })
    // Hetzelfde formulier nog eens: zelfde kenmerk, dus geen tweede rij.
    const nog = await stuur({ token: WM, body: formulier, header: 'x-messaging-token' })
    expect(nog.data).toMatchObject({ berichtId: r.data.berichtId, herhaald: true })
  })

  it('een kapotte envelop krijgt 400 en schrijft niets', async () => {
    const r = await stuur({ token: WM, body: { soort: 'Geen Soort', inhoud: { a: 1 } } })
    expect(r.status).toBe(400)
    expect((await db.collection('messaging').get()).size).toBe(0)
  })

  it('boven de limiet per bron komt 429 met Retry-After, en de andere bron merkt niets', async () => {
    // Een eigen instantie met een lage limiet: de teller leeft per instantie.
    const krap = maak(2)
    const wm = []
    for (let i = 0; i < 3; i += 1) wm.push(await stuur({ functie: krap, token: WM, body: { ...AANVRAAG, sleutel: `l-${i}` } }))
    expect(wm.map((r) => r.status)).toEqual([200, 200, 429])
    expect(wm[2].kop['retry-after']).toBe('60')
    expect(wm[2].data).toEqual({ fout: 'te_veel' })
    expect((await db.doc('messaging/wintermoods-l-2').get()).exists).toBe(false)
    const barvue = await stuur({ functie: krap, token: BARVUE_NIEUW, body: AANVRAAG })
    expect(barvue.status).toBe(200)
  })
})
