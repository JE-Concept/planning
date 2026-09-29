import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { isAfgerond, isTeLaat } from '../src/lib/laat'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-29T10:00:00'))
})
afterEach(() => vi.useRealTimers())

const gisteren = '2026-09-28T12:00:00'
const morgen = '2026-09-30T12:00:00'

describe('isTeLaat', () => {
  it('noemt een openstaande taak met een datum van gisteren te laat', () => {
    expect(isTeLaat({ dueDate: gisteren, open: true })).toBe(true)
  })

  it('noemt niets te laat zonder datum', () => {
    expect(isTeLaat({ open: true })).toBe(false)
  })

  it('noemt morgen niet te laat', () => {
    expect(isTeLaat({ dueDate: morgen, open: true })).toBe(false)
  })

  it('noemt een afgeronde taak niet te laat', () => {
    expect(isTeLaat({ dueDate: gisteren, open: false })).toBe(false)
  })

  // Dit was de fout: het feest is geweest, alleen de factuur loopt nog.
  it('noemt een event dat klaar is om te factureren niet te laat', () => {
    expect(isTeLaat({ dueDate: gisteren, open: true, statusName: 'ready to invoice' })).toBe(false)
    expect(isTeLaat({ dueDate: gisteren, open: true, statusName: 'invoiced' })).toBe(false)
    expect(isTeLaat({ dueDate: gisteren, open: true, statusName: 'complete' })).toBe(false)
  })

  it('kijkt ook naar de soort van de kolom, niet alleen naar de naam', () => {
    expect(isTeLaat({ dueDate: gisteren, open: true, statusKind: 'closed' })).toBe(false)
  })

  it('laat een event dat nog in de planning zit wél rood staan', () => {
    expect(isTeLaat({ dueDate: gisteren, open: true, statusName: 'planning ongoing' })).toBe(true)
  })

  it('kijkt niet naar hoofdletters', () => {
    expect(isTeLaat({ dueDate: gisteren, open: true, statusName: 'Ready To Invoice' })).toBe(false)
  })
})

describe('isAfgerond', () => {
  it('leest een gesloten taak als afgerond', () => {
    expect(isAfgerond({ open: false })).toBe(true)
  })
  it('leest een openstaande taak niet als afgerond', () => {
    expect(isAfgerond({ open: true, statusName: 'on going' })).toBe(false)
  })
  it('gaat om met niets', () => {
    expect(isAfgerond(null)).toBe(false)
  })
})
