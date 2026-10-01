import { describe, expect, it } from 'vitest'
import { werkKeuzes, werkVan } from '../src/lib/werkkeuze'

const EVENTS = [
  { id: 'e1', name: 'Trouw Niels en Inez', concept: 'JE Concept', open: true },
  { id: 'e2', name: 'Kerstborrel 2025', concept: 'Bar Vue', open: true },
  { id: 'e3', name: 'Afgesloten dossier', concept: 'JE Concept', open: false },
]
const TAKEN = [
  { id: 't1', title: 'Drankenlijst finaliseren', parentId: 'e1', open: true },
  { id: 't2', title: 'Offerte nasturen', parentId: 'e2', open: true },
  { id: 't3', title: 'Oude taak', parentId: 'e1', open: false },
]

describe('waar je tijd op kunt boeken', () => {
  // Een event is in de gegevens ook een taak; op het scherm zijn het twee
  // soorten, en je moet uit dezelfde lijst kunnen kiezen.
  it('zet events en taken in één lijst', () => {
    const keuzes = werkKeuzes({ events: EVENTS, tasks: TAKEN })
    expect(keuzes.map((k) => k.id)).toEqual(['e1', 'e2', 't1', 't2'])
    expect(keuzes.find((k) => k.id === 'e1').soort).toBe('event')
    expect(keuzes.find((k) => k.id === 't1').soort).toBe('taak')
  })

  // Waar een taak onder hangt, want "Drankenlijst finaliseren" staat er twee
  // keer als er twee trouwfeesten lopen.
  it('zet bij een taak het event waar ze onder hangt', () => {
    const keuzes = werkKeuzes({ events: EVENTS, tasks: TAKEN })
    expect(keuzes.find((k) => k.id === 't1').sub).toBe('Trouw Niels en Inez')
  })

  it('laat wat af is weg', () => {
    const ids = werkKeuzes({ events: EVENTS, tasks: TAKEN }).map((k) => k.id)
    expect(ids).not.toContain('e3')
    expect(ids).not.toContain('t3')
  })

  // Anders wist het aanpassen van een oude boeking stilletjes haar taak.
  it('houdt de taak van een bestaande boeking erbij, ook als die af is', () => {
    const ids = werkKeuzes({ events: EVENTS, tasks: TAKEN, behoud: 't3' }).map((k) => k.id)
    expect(ids).toContain('t3')
  })

  it('zoekt op de titel en op waar het onder hangt', () => {
    expect(werkKeuzes({ events: EVENTS, tasks: TAKEN, zoek: 'niels' }).map((k) => k.id))
      .toEqual(['e1', 't1'])
    expect(werkKeuzes({ events: EVENTS, tasks: TAKEN, zoek: 'DRANK' }).map((k) => k.id))
      .toEqual(['t1'])
  })

  // Een keuzelijst die haar eigen waarde niet toont, lijkt leeg.
  it('kapt nooit de behouden keuze weg', () => {
    const veel = Array.from({ length: 80 }, (_, i) => ({ id: `x${i}`, name: `Event ${i}`, open: true }))
    const keuzes = werkKeuzes({ events: veel, tasks: TAKEN, behoud: 't2', max: 10 })
    expect(keuzes).toHaveLength(10)
    expect(keuzes[0].id).toBe('t2')
  })

  it('vindt het echte event of de echte taak terug', () => {
    expect(werkVan('e2', { events: EVENTS, tasks: TAKEN }).name).toBe('Kerstborrel 2025')
    expect(werkVan('t1', { events: EVENTS, tasks: TAKEN }).title).toBe('Drankenlijst finaliseren')
    expect(werkVan('', { events: EVENTS, tasks: TAKEN })).toBeNull()
    expect(werkVan('bestaat-niet', { events: EVENTS, tasks: TAKEN })).toBeNull()
  })
})
