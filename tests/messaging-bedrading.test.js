import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maakMessagingVerwerking } from '../functions/messaging-verwerking.js'
import { MAX_POGINGEN } from '../functions/messaging-stand.js'
import { TOPIC_BERICHTEN, TOPIC_VASTGELOPEN, busBericht } from '../functions/messaging-bus.js'

/**
 * De bedrading van messaging: de echte handlers van de relay, de verwerker op
 * de bus, de dead-letter-topic en de herkansing, met een Firestore en een
 * publisher in het geheugen. `messaging.test.js` legt de regels vast; dit legt
 * vast dat de functies ze ook zo gebruiken.
 */

/** Een Firestore in het geheugen, net genoeg voor messaging-verwerking.js. */
function nepDb(start = {}) {
  const rijen = new Map(Object.entries(start).map(([pad, v]) => [pad, structuredClone(v)]))
  let teller = 0
  const zet = (doel, pad, waarde) => {
    const delen = pad.split('.')
    let o = doel
    for (const d of delen.slice(0, -1)) o = o[d] ??= {}
    o[delen.at(-1)] = waarde
  }
  const lees = (o, pad) => pad.split('.').reduce((x, d) => x?.[d], o)
  const doc = (col, id) => ({
    id,
    async get() {
      const d = rijen.get(`${col}/${id}`)
      return { exists: Boolean(d), id, data: () => d, ref: doc(col, id) }
    },
    async update(velden) {
      const d = rijen.get(`${col}/${id}`)
      if (!d) throw Object.assign(new Error('niet gevonden'), { code: 5 })
      for (const [k, v] of Object.entries(velden)) zet(d, k, v)
    },
    async create(v) {
      if (rijen.has(`${col}/${id}`)) throw Object.assign(new Error('bestaat'), { code: 6 })
      rijen.set(`${col}/${id}`, structuredClone(v))
    },
  })
  const snaps = (col, filter = () => true) =>
    [...rijen.entries()]
      .filter(([pad, d]) => pad.startsWith(`${col}/`) && filter(d))
      .map(([pad]) => pad.slice(col.length + 1))
      .map((id) => ({ id, ref: doc(col, id), data: () => rijen.get(`${col}/${id}`) }))
  const query = (col, filter) => ({
    limit: () => query(col, filter),
    where: (veld, _op, waarde) => query(col, (d) => filter(d) && lees(d, veld) === waarde),
    async get() {
      const docs = snaps(col, filter)
      return { docs, empty: docs.length === 0, size: docs.length }
    },
  })
  return {
    rijen,
    collection: (col) => ({
      doc: (id) => doc(col, id ?? `auto${++teller}`),
      ...query(col, () => true),
    }),
  }
}

const EVENTLIJST = {
  name: 'Events',
  statuses: [
    { id: 's1', name: 'request', kind: 'active', color: '#aaa' },
    { id: 's2', name: 'ready to invoice', kind: 'active', color: '#bbb' },
    { id: 's3', name: 'invoiced', kind: 'done', color: '#ccc' },
  ],
}
const RIJ = {
  bron: 'barvue',
  soort: 'offerte.aangevraagd',
  sleutel: 'h1',
  taal: 'nl',
  inhoud: { naam: 'An', email: 'an@example.be', personen: 40 },
  verwerking: {},
  bus: { stand: 'wacht' },
}

function opzet(start) {
  const db = nepDb(start)
  const gepubliceerd = []
  const meldingen = []
  const publiceer = vi.fn(async (topic, bericht) => {
    gepubliceerd.push({ topic, ...bericht })
    return `m${gepubliceerd.length}`
  })
  const f = maakMessagingVerwerking({
    db,
    region: 'europe-west1',
    publiceer,
    verstuur: async (melding) => meldingen.push(melding),
    alleProfielen: async () => [{ id: 'jasper', role: 'owner' }],
  })
  const viaDeBus = (json) => f.messagingVerwerkerEvent.run({ data: { message: { json } } })
  return { db, f, gepubliceerd, meldingen, viaDeBus }
}

describe('messaging over de bus', () => {
  // De verwerker onthoudt de eventlijst een minuut per instantie; elke test
  // begint een kwartier later, zodat niets van de vorige blijft hangen.
  let klok = Date.parse('2026-10-06T12:00:00Z')
  beforeEach(() => {
    klok += 15 * 60000
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(klok)
  })
  afterEach(() => vi.useRealTimers())

  it('de relay zet een nieuwe rij op de bus, zonder de inhoud, en noteert dat', async () => {
    const { db, f, gepubliceerd } = opzet({ 'messaging/barvue-h1': RIJ })
    const ref = db.collection('messaging').doc('barvue-h1')
    await f.messagingEvent.run({ params: { id: 'barvue-h1' }, data: { data: () => RIJ, ref } })
    expect(gepubliceerd).toHaveLength(1)
    expect(gepubliceerd[0].topic).toBe(TOPIC_BERICHTEN)
    expect(gepubliceerd[0].json).toMatchObject({ id: 'barvue-h1', bron: 'barvue', soort: 'offerte.aangevraagd' })
    expect(JSON.stringify(gepubliceerd[0])).not.toContain('an@example.be')
    expect(db.rijen.get('messaging/barvue-h1').bus).toMatchObject({ stand: 'gepubliceerd', messageId: 'm1' })
  })

  it('de verwerker maakt één kaart, ook als het bericht twee keer langskomt', async () => {
    const { db, viaDeBus } = opzet({ 'messaging/barvue-h1': RIJ, 'lists/ev': EVENTLIJST })
    const json = busBericht('barvue-h1', RIJ).json
    await viaDeBus(json)
    await viaDeBus(json)
    const kaarten = [...db.rijen.keys()].filter((p) => p.startsWith('tasks/'))
    expect(kaarten).toHaveLength(1)
    expect(db.rijen.get(kaarten[0])).toMatchObject({ statusName: 'request', listId: 'ev' })
    expect(db.rijen.get('messaging/barvue-h1').verwerking.event).toMatchObject({ stand: 'klaar' })
  })

  it('laat een herkansing voor een andere verwerker liggen', async () => {
    const { db, viaDeBus } = opzet({ 'messaging/barvue-h1': RIJ, 'lists/ev': EVENTLIJST })
    await viaDeBus(busBericht('barvue-h1', RIJ, { verwerker: 'boekhouding' }).json)
    expect([...db.rijen.keys()].some((p) => p.startsWith('tasks/'))).toBe(false)
  })

  it('stuurt na MAX_POGINGEN mislukkingen precies één keer naar de dead-letter-topic', async () => {
    // Geen eventlijst: de verwerker kan geen kaart maken.
    const { db, gepubliceerd, viaDeBus } = opzet({ 'messaging/barvue-h1': RIJ })
    const json = busBericht('barvue-h1', RIJ).json
    for (let i = 0; i < MAX_POGINGEN + 1; i += 1) await viaDeBus(json)
    const stand = db.rijen.get('messaging/barvue-h1').verwerking.event
    expect(stand).toMatchObject({ stand: 'fout', fout: 'geen_eventlijst' })
    const dood = gepubliceerd.filter((g) => g.topic === TOPIC_VASTGELOPEN)
    expect(dood).toHaveLength(1)
    expect(dood[0].json).toMatchObject({ id: 'barvue-h1', verwerker: 'event', fout: 'geen_eventlijst' })
  })

  it('de dead-letter-topic laat de beheerders het weten', async () => {
    const { f, meldingen } = opzet({ 'messaging/barvue-h1': RIJ })
    await f.messagingVastgelopen.run({ data: { message: { json: { id: 'barvue-h1', verwerker: 'event', fout: 'geen_eventlijst' } } } })
    expect(meldingen).toHaveLength(1)
    expect(meldingen[0]).toMatchObject({ soort: 'messaging', kandidaten: ['jasper'] })
    expect(meldingen[0].mail().tekst).toContain('geen_eventlijst')
  })

  it('de herkansing zet terug op de bus wat faalde en wat de relay miste', async () => {
    const lang = new Date(Date.now() - 60 * 60000)
    const { db, f, gepubliceerd } = opzet({
      'messaging/barvue-fout': { ...RIJ, sleutel: 'fout', ontvangen: lang, bus: { stand: 'gepubliceerd' }, verwerking: { event: { stand: 'fout', pogingen: 1, op: lang } } },
      'messaging/barvue-gemist': { ...RIJ, sleutel: 'gemist', ontvangen: lang },
      'messaging/barvue-vers': { ...RIJ, sleutel: 'vers', ontvangen: new Date() },
      'messaging/barvue-klaar': { ...RIJ, sleutel: 'klaar', ontvangen: lang, bus: { stand: 'gepubliceerd' }, verwerking: { event: { stand: 'klaar' } } },
    })
    await f.messagingHerkansing.run({})
    const ids = gepubliceerd.map((g) => g.json.id).sort()
    expect(ids).toEqual(['barvue-fout', 'barvue-gemist'])
    expect(gepubliceerd.find((g) => g.json.id === 'barvue-fout').attributes.verwerker).toBe('event')
    expect(gepubliceerd.find((g) => g.json.id === 'barvue-gemist').attributes.verwerker).toBeUndefined()
    expect(db.rijen.get('messaging/barvue-gemist').bus).toMatchObject({ stand: 'gepubliceerd', doorHerkansing: true })
    expect(db.rijen.get('messaging/barvue-vers').bus.stand).toBe('wacht')
  })
})
