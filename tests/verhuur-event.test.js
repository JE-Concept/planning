import { createRequire } from 'node:module'
import { connect } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * Een betaalde huur wordt één event, ook als de trigger twee keer vuurt.
 *
 * Firestore levert een trigger "minstens één keer" af, en de tweede
 * aflevering draagt dezelfde momentopname als de eerste: daarin is `eventId`
 * nog leeg. Een controle op dat veld hield dus niets tegen, en een dubbele
 * aflevering gaf twee events voor één huur. Dit draait de echte trigger twee
 * keer tegelijk tegen de emulator, die `create` weigert zoals productie.
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

let db = null
let trigger = null
const meldingen = []

beforeAll(async () => {
  if (!draait) return
  process.env.FIRESTORE_EMULATOR_HOST = HOST
  const vanCodebase = createRequire(new URL('../functions/package.json', import.meta.url))
  const { initializeApp } = vanCodebase('firebase-admin/app')
  const { getFirestore } = vanCodebase('firebase-admin/firestore')
  db = getFirestore(initializeApp({ projectId: 'je-planning-verhuur-test' }, 'verhuur-event'))
  const { maakVerhuurOrders } = await import('../functions/verhuur-orders.js')
  trigger = maakVerhuurOrders({
    db,
    region: 'europe-west1',
    verstuur: async (m) => meldingen.push(m),
    alleProfielen: async () => [{ id: 'jasper', role: 'owner' }],
  }).verhuurOrderBetaald
})

afterAll(async () => {
  await db?.terminate()
})

const ORDER = {
  status: 'betaald',
  eventId: null,
  teBetalen: 213.35,
  exclBtw: 93.68,
  van: '2027-02-12',
  tot: '2027-02-14',
  regels: [{ naam: 'Koelkast', aantal: 2 }],
  reservatieIds: ['r-1'],
  klant: { naam: 'Lies', email: 'lies@voorbeeld.be' },
}

beforeEach(async () => {
  if (!draait) return
  meldingen.length = 0
  for (const col of ['tasks', 'huurorders', 'reservaties', 'lists', 'messaging']) {
    const rijen = await db.collection(col).get()
    await Promise.all(rijen.docs.map((d) => d.ref.delete()))
  }
  await db.doc('lists/ev').set({
    kind: 'tasks',
    archived: false,
    name: 'Events',
    statuses: [
      { id: 's1', name: 'request', kind: 'active', color: '#aaa' },
      { id: 's2', name: 'planning ongoing', kind: 'active', color: '#bbb' },
    ],
  })
  await db.doc('huurorders/ho-1').set(ORDER)
  await db.doc('reservaties/r-1').set({ status: 'vast' })
})

/** De gebeurtenis zoals Firestore ze aflevert: voor en na de wijziging. */
const aflevering = () => ({
  params: { id: 'ho-1' },
  data: {
    before: { data: () => ({ ...ORDER, status: 'wacht_op_betaling' }) },
    after: { data: () => ORDER, ref: db.doc('huurorders/ho-1') },
  },
})

beschrijf('een betaalde huur op het bord', () => {
  it('wordt een event in "planning ongoing", met de reservaties eraan', async () => {
    await trigger.run(aflevering())
    const events = await db.collection('tasks').get()
    expect(events.size).toBe(1)
    expect(events.docs[0].data()).toMatchObject({ title: 'Verhuur — Lies', statusName: 'planning ongoing', huurorderId: 'ho-1' })
    expect((await db.doc('huurorders/ho-1').get()).data().eventId).toBe(events.docs[0].id)
    expect((await db.doc('reservaties/r-1').get()).data()).toMatchObject({ eventId: events.docs[0].id, soort: 'event' })
  })

  it('geeft één event, ook als de trigger twee keer tegelijk vuurt', async () => {
    await Promise.all([trigger.run(aflevering()), trigger.run(aflevering())])
    expect((await db.collection('tasks').get()).size).toBe(1)
  })

  it('en ook als hij later nog eens vuurt', async () => {
    await trigger.run(aflevering())
    await trigger.run(aflevering())
    expect((await db.collection('tasks').get()).size).toBe(1)
    // De spiegel in de messaging-log blijft ook één rij.
    expect((await db.collection('messaging').get()).size).toBe(1)
  })

  it('een order op nakijken wordt geen event, wel een melding', async () => {
    const nakijken = { ...ORDER, status: 'nakijken' }
    await trigger.run({
      params: { id: 'ho-1' },
      data: {
        before: { data: () => ({ ...ORDER, status: 'wacht_op_betaling' }) },
        after: { data: () => nakijken, ref: db.doc('huurorders/ho-1') },
      },
    })
    expect((await db.collection('tasks').get()).size).toBe(0)
    expect(meldingen).toHaveLength(1)
  })
})
