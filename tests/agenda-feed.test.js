import { describe, expect, it } from 'vitest'
import { eventsVoorFeed, isEventLijst } from '../functions/events-bron.js'
import { isPipelineList } from '../src/lib/pipeline'
import { agendaVan, eventRegels } from '../src/lib/ical'

/**
 * De agendafeed haalde zijn events uit `db.collection('events')`.
 *
 * Die collectie bestaat niet: een event is een taak op het hoofdniveau van de
 * eventlijst. De feed gaf dus altijd een agenda zonder één item terug, met een
 * nette 200 erbij — de fout waar niemand een foutmelding van ziet. Deze test
 * houdt vast dat er nu echte events uit komen.
 */

const STATUSSEN = [
  { id: 's1', name: 'request', kind: 'open', position: 1 },
  { id: 's2', name: 'ready to invoice', kind: 'active', position: 2 },
  { id: 's3', name: 'invoiced', kind: 'active', position: 3 },
]

/** Zo weinig Firestore als nodig: `collection(...).where(...).get()`. */
function nepDb(data) {
  const docsVan = (naam) =>
    Object.entries(data[naam] ?? {}).map(([id, d]) => ({ id, data: () => d }))

  const bouw = (naam, filters) => ({
    where: (veld, _op, waarde) => bouw(naam, [...filters, [veld, waarde]]),
    get: async () => {
      const docs = docsVan(naam).filter((d) =>
        filters.every(([veld, waarde]) => d.data()[veld] === waarde)
      )
      return { docs, size: docs.length, empty: docs.length === 0 }
    },
  })

  return { collection: (naam) => bouw(naam, []) }
}

const DATA = {
  lists: {
    'oud-events': { name: 'Events 2024', statuses: STATUSSEN, archived: true },
    events: { name: 'Events', statuses: STATUSSEN },
    taken: { name: 'Taken', statuses: [{ id: 't1', name: 'to do' }] },
  },
  tasks: {
    trouw: {
      listId: 'events',
      archived: false,
      parentId: null,
      title: 'Trouw Niels en Inez',
      eventDate: new Date('2026-10-17T12:00:00'),
      location: 'Kasteel van Ordingen',
      customerName: 'Familie Vanhees',
      statusName: 'invoiced',
      pax: 120,
    },
    // Een ouder dossier: enkel een deadline, geen eventdatum.
    bbq: {
      listId: 'events',
      archived: false,
      parentId: null,
      title: 'Zomer-bbq Blum',
      dueDate: new Date('2026-07-04T12:00:00'),
    },
    'trouw-tent': {
      listId: 'events',
      archived: false,
      parentId: 'trouw',
      title: 'Tent bestellen',
      dueDate: new Date('2026-09-01T12:00:00'),
    },
    'oud-event': {
      listId: 'events',
      archived: true,
      parentId: null,
      title: 'Feest 2019',
      eventDate: new Date('2019-05-05T12:00:00'),
    },
    'gewone-taak': {
      listId: 'taken',
      archived: false,
      parentId: null,
      title: 'Offerte nakijken',
      dueDate: new Date('2026-10-01T12:00:00'),
    },
  },
}

describe('de events voor de agendafeed', () => {
  it('haalt ze uit de eventlijst en niet uit een collectie die niet bestaat', async () => {
    const events = await eventsVoorFeed(nepDb(DATA))
    expect(events.map((e) => e.name).sort()).toEqual(['Trouw Niels en Inez', 'Zomer-bbq Blum'])
  })

  it('vertaalt een taak naar wat de agenda verwacht, pax inbegrepen', async () => {
    const events = await eventsVoorFeed(nepDb(DATA))
    const trouw = events.find((e) => e.id === 'trouw')

    expect(trouw).toMatchObject({
      name: 'Trouw Niels en Inez',
      location: 'Kasteel van Ordingen',
      customerName: 'Familie Vanhees',
      statusName: 'invoiced',
      guests: 120,
    })
    expect(trouw.date).toEqual(new Date('2026-10-17T12:00:00'))
  })

  // Oudere dossiers hebben geen `eventDate`; die hoorden ook in de agenda, met
  // hun deadline als dag. Dezelfde terugval als `eventDateOf` in de app.
  it('valt terug op de deadline wanneer er geen eventdatum is', async () => {
    const events = await eventsVoorFeed(nepDb(DATA))
    expect(events.find((e) => e.id === 'bbq').date).toEqual(new Date('2026-07-04T12:00:00'))
  })

  it('laat subtaken, archief en de andere lijsten eruit', async () => {
    const ids = (await eventsVoorFeed(nepDb(DATA))).map((e) => e.id)
    expect(ids).not.toContain('trouw-tent')
    expect(ids).not.toContain('oud-event')
    expect(ids).not.toContain('gewone-taak')
  })

  it('geeft een lege agenda in plaats van een fout wanneer er geen eventlijst is', async () => {
    const events = await eventsVoorFeed(nepDb({ lists: { taken: DATA.lists.taken }, tasks: {} }))
    expect(events).toEqual([])
  })

  it('levert een agenda op waar de events echt in staan', async () => {
    const tekst = agendaVan(await eventsVoorFeed(nepDb(DATA)), { naam: 'JE Plan — events' })
    expect(tekst.split('\r\n').filter((r) => r === 'BEGIN:VEVENT')).toHaveLength(2)
    expect(tekst).toContain('SUMMARY:Trouw Niels en Inez')
  })
})

describe('de kopie van de eventlijst-herkenning', () => {
  // `functions/` wordt apart verpakt en kan niets uit `src/` importeren, dus
  // staat de herkenning er twee keer. Twee kopieën die uit elkaar lopen zijn
  // erger dan één op een lelijke plek: dan staan er events in de agenda die op
  // het scherm geen events zijn, of omgekeerd.
  it('geeft hetzelfde antwoord als `isPipelineList`', () => {
    const gevallen = [
      { statuses: STATUSSEN },
      { statuses: STATUSSEN.slice(0, 2) },
      { statuses: [{ name: 'to do' }] },
      { statuses: [] },
      {},
      null,
    ]

    for (const lijst of gevallen) {
      expect(isEventLijst(lijst)).toBe(isPipelineList(lijst))
    }
  })
})

/*
  Een meerdaags event is één agenda-item dat doorloopt, en geen reeks losse
  items. `DTEND` is bij een dagvullend item exclusief — daarom staat er de dag
  ná de laatste dag.
*/
describe('een meerdaags event in de agenda', () => {
  const regels = (event) => eventRegels(event, { nu: new Date('2026-10-01T08:00:00Z') })

  it('loopt van de eerste tot en met de laatste dag', () => {
    const uit = regels({ id: 'e1', name: 'Festival', date: '2026-10-12', endDate: '2026-10-14' })
    expect(uit).toContain('DTSTART;VALUE=DATE:20261012')
    expect(uit).toContain('DTEND;VALUE=DATE:20261015')
  })

  it('blijft één dag wanneer er geen einddatum staat', () => {
    const uit = regels({ id: 'e2', name: 'Trouw', date: '2026-10-12' })
    expect(uit).toContain('DTSTART;VALUE=DATE:20261012')
    expect(uit).toContain('DTEND;VALUE=DATE:20261013')
  })

  it('negeert een einddatum die voor de begindag ligt', () => {
    const uit = regels({ id: 'e3', name: 'Tikfout', date: '2026-10-12', endDate: '2026-10-09' })
    expect(uit).toContain('DTEND;VALUE=DATE:20261013')
  })

  it('en blijft één item, ook over drie dagen', () => {
    const uit = regels({ id: 'e4', name: 'Beurs', date: '2026-10-12', endDate: '2026-10-14' })
    expect(uit.filter((r) => r === 'BEGIN:VEVENT')).toHaveLength(1)
  })
})
