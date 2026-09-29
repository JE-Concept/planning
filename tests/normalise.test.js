import { describe, expect, it } from 'vitest'
import { normalise, toDate } from '../src/lib/normalise'

/** Wat Firestore teruggeeft voor een tijdstip. */
const stamp = (iso) => ({
  seconds: Math.floor(new Date(iso).getTime() / 1000),
  nanoseconds: 0,
  toDate: () => new Date(iso),
})

describe('toDate', () => {
  it('laat een Date staan', () => {
    const d = new Date('2026-09-29T10:00:00Z')
    expect(toDate(d)).toBe(d)
  })

  it('zet een Timestamp om', () => {
    expect(toDate(stamp('2026-09-29T10:00:00Z')).toISOString()).toBe('2026-09-29T10:00:00.000Z')
  })

  it('geeft null op onzin in plaats van een Invalid Date', () => {
    expect(toDate('geen datum')).toBeNull()
    expect(toDate(null)).toBeNull()
  })
})

describe('normalise', () => {
  it('zet tijdstippen om die niet op de namenlijst staan', () => {
    const uit = normalise({ id: 'x', closedAt: stamp('2026-09-28T20:00:00Z') })
    expect(uit.closedAt).toBeInstanceOf(Date)
  })

  // De fout die dit bestand opleverde: de afvinktijd van een punt zit genest,
  // bleef een Timestamp, en liet de dagelijkse lijst van gisteren crashen.
  it('zet ook genestte tijdstippen om', () => {
    const uit = normalise({
      id: 'openen_2026-09-28',
      items: { sleutel: { done: true, at: stamp('2026-09-28T06:12:00Z') } },
    })
    expect(uit.items.sleutel.at).toBeInstanceOf(Date)
    expect(uit.items.sleutel.done).toBe(true)
  })

  it('zet tijdstippen in een lijst om', () => {
    const uit = normalise({ logs: [{ at: stamp('2026-09-28T06:12:00Z') }] })
    expect(uit.logs[0].at).toBeInstanceOf(Date)
  })

  it('laat gewone waarden ongemoeid', () => {
    const uit = normalise({ name: 'Openen', position: 3, tags: ['a', 'b'], leeg: null })
    expect(uit).toEqual({ name: 'Openen', position: 3, tags: ['a', 'b'], leeg: null })
  })

  it('zet een datum-in-tekst om als de naam dat zegt', () => {
    expect(normalise({ dueDate: '2026-09-30T09:00:00Z' }).dueDate).toBeInstanceOf(Date)
    expect(normalise({ note: '2026-09-30T09:00:00Z' }).note).toBe('2026-09-30T09:00:00Z')
  })
})
