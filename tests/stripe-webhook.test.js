import { createRequire } from 'node:module'
import { connect } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * De Stripe-webhook, met de echte handler tegen de Firestore-emulator.
 *
 * Dit adres is openbaar en zet een order op betaald. Drie dingen moeten dus
 * echt kloppen, niet alleen op papier: zonder geldige handtekening gebeurt er
 * niets, een bedrag dat afwijkt zet de order op nakijken in plaats van op
 * betaald, en hetzelfde bericht twee keer (Stripe doet dat gerust) geeft één
 * betaling, één klantfiche en één bevestigingsmail.
 *
 * De handtekening wordt gezet met Stripe's eigen testhelper, met hetzelfde
 * geheim dat de functie leest: precies wat Stripe zelf doet. Slaat zichzelf
 * over zonder emulator; in CI draait hij mee in `npm run test:rules`.
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

const WEBHOOK_GEHEIM = 'whsec_test_' + 'x'.repeat(32)
let db = null
let webhook = null
let stripe = null

beforeAll(async () => {
  if (!draait) return
  process.env.FIRESTORE_EMULATOR_HOST = HOST
  // Een eigen project in de emulator. `emulators:exec` zet FIREBASE_CONFIG op
  // het project van de regeltest, en initializeApp() leest dat eerst; zonder
  // dit wist de ene test de gegevens van de andere terwijl ze lopen.
  delete process.env.FIREBASE_CONFIG
  process.env.GCLOUD_PROJECT = 'je-planning-webhook-test'
  process.env.GOOGLE_CLOUD_PROJECT = 'je-planning-webhook-test'
  process.env.STRIPE_SECRET = 'sk_test_' + 'y'.repeat(32)
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_GEHEIM
  const vanCodebase = createRequire(new URL('../functions-betaling/package.json', import.meta.url))
  const Stripe = vanCodebase('stripe')
  stripe = new Stripe(process.env.STRIPE_SECRET)
  // De codebase start haar eigen standaard-app; die gebruiken we ook.
  const mod = await import('../functions-betaling/index.js')
  webhook = mod.verhuurWebhook
  const { getFirestore } = vanCodebase('firebase-admin/firestore')
  db = getFirestore()
})

afterAll(async () => {
  await db?.terminate()
})

const ORDER = {
  status: 'wacht_op_betaling',
  teBetalenCent: 21335,
  teBetalen: 213.35,
  waarborg: 100,
  van: '2027-02-12',
  tot: '2027-02-14',
  regels: [{ naam: 'Koelkast', aantal: 2, netto: 113.35 }],
  reservatieIds: ['r-1', 'r-2'],
  klant: { naam: 'Lies', email: 'Lies@Voorbeeld.be', telefoon: '0470 00 00 00' },
}

beforeEach(async () => {
  if (!draait) return
  for (const col of ['huurorders', 'reservaties', 'customers', 'mailQueue', 'profiles']) {
    const rijen = await db.collection(col).get()
    await Promise.all(rijen.docs.map((d) => d.ref.delete()))
  }
  await db.doc('huurorders/ho-1').set(ORDER)
  await db.doc('reservaties/r-1').set({ status: 'optie', optieVervalt: new Date('2030-01-01') })
  await db.doc('reservaties/r-2').set({ status: 'optie', optieVervalt: new Date('2030-01-01') })
  await db.doc('profiles/u-eigenaar').set({ role: 'owner', active: true, email: 'beheer@example.be' })
})

/** Een gebeurtenis zoals Stripe ze stuurt, ondertekend met het geheim of niet. */
function gebeurtenis({ type = 'checkout.session.completed', bedrag = 21335, betaald = 'paid', geheim = WEBHOOK_GEHEIM, orderId = 'ho-1' } = {}) {
  const payload = JSON.stringify({
    id: `evt_${type}_${bedrag}`,
    object: 'event',
    type,
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        amount_total: bedrag,
        payment_status: betaald,
        payment_intent: 'pi_test_1',
        client_reference_id: orderId,
        metadata: { orderId },
      },
    },
  })
  const handtekening = stripe.webhooks.generateTestHeaderString({ payload, secret: geheim })
  return { payload, handtekening }
}

function stuur({ payload, handtekening }) {
  const kop = { 'stripe-signature': handtekening, 'content-type': 'application/json' }
  const verzoek = {
    method: 'POST',
    path: '/',
    url: '/',
    headers: kop,
    rawBody: Buffer.from(payload),
    body: JSON.parse(payload),
    get: (naam) => kop[naam.toLowerCase()],
    header: (naam) => kop[naam.toLowerCase()],
  }
  return new Promise((klaar) => {
    const antwoord = {
      statusCode: 200,
      status(code) {
        this.statusCode = code
        return this
      },
      send(data) {
        klaar({ status: this.statusCode, data })
        return this
      },
      json(data) {
        klaar({ status: this.statusCode, data })
        return this
      },
      set() {
        return this
      },
      setHeader() {},
      getHeader() {},
      end() {
        klaar({ status: this.statusCode })
        return this
      },
      on() {},
      once() {},
    }
    webhook(verzoek, antwoord)
  })
}

const order = async () => (await db.doc('huurorders/ho-1').get()).data()
const aantal = async (col) => (await db.collection(col).get()).size

beschrijf('de Stripe-webhook', () => {
  it('een vervalste handtekening krijgt 400, en de order blijft wachten', async () => {
    const r = await stuur(gebeurtenis({ geheim: 'whsec_niet_het_onze_' + 'z'.repeat(20) }))
    expect(r.status).toBe(400)
    expect((await order()).status).toBe('wacht_op_betaling')
    expect(await aantal('mailQueue')).toBe(0)
  })

  it('een geldige betaling zet de order op betaald en de reservaties vast', async () => {
    const r = await stuur(gebeurtenis())
    expect(r.status).toBe(200)
    const o = await order()
    expect(o).toMatchObject({ status: 'betaald', betaaldCent: 21335, paymentIntentId: 'pi_test_1', optieVervalt: null })
    expect((await db.doc('reservaties/r-1').get()).data()).toMatchObject({ status: 'vast', optieVervalt: null })
    // Een klantfiche op het e-mailadres in kleine letters, en een mail aan klant en beheerder.
    const klanten = await db.collection('customers').where('email', '==', 'lies@voorbeeld.be').get()
    expect(klanten.size).toBe(1)
    expect(o.customerId).toBe(klanten.docs[0].id)
    const mails = (await db.collection('mailQueue').get()).docs.map((d) => d.data())
    expect(mails.map((m) => m.soort).sort()).toEqual(['verhuur-bevestiging', 'verhuur-order'])
  })

  it('hetzelfde bericht twee keer geeft één betaling, één klant en één keer mail', async () => {
    const e = gebeurtenis()
    await stuur(e)
    const tweede = await stuur(e)
    expect(tweede.status).toBe(200)
    expect(await aantal('customers')).toBe(1)
    expect(await aantal('mailQueue')).toBe(2)
  })

  it('een bedrag dat afwijkt zet de order op nakijken, en de reservaties blijven een optie', async () => {
    await stuur(gebeurtenis({ bedrag: 100 }))
    const o = await order()
    expect(o).toMatchObject({ status: 'nakijken', betaaldCent: 100 })
    expect((await db.doc('reservaties/r-1').get()).data().status).toBe('optie')
  })

  it('een betaling die nog niet rond is, verandert niets', async () => {
    await stuur(gebeurtenis({ betaald: 'unpaid' }))
    expect((await order()).status).toBe('wacht_op_betaling')
  })

  it('een verlopen sessie geeft de voorraad terug', async () => {
    await stuur(gebeurtenis({ type: 'checkout.session.expired', betaald: 'unpaid' }))
    expect((await order()).status).toBe('vervallen')
    expect((await db.doc('reservaties/r-1').get()).exists).toBe(false)
  })

  it('na betaald kan een verlopen sessie niets meer terugdraaien', async () => {
    await stuur(gebeurtenis())
    await stuur(gebeurtenis({ type: 'checkout.session.expired', betaald: 'unpaid' }))
    expect((await order()).status).toBe('betaald')
    expect((await db.doc('reservaties/r-1').get()).exists).toBe(true)
  })
})
