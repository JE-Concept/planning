import { describe, expect, it } from 'vitest'
import { clickupDag, herstelClickupDatums } from '../src/lib/clickupdatum'
import { normalise } from '../src/lib/normalise'
import { dayKey } from '../src/lib/dates'

describe('datums zonder uur uit ClickUp', () => {
  it('Manila 04:00 is de dag erna hier, en die dag hoort het te zijn', () => {
    // "Ruben Theuwen – 25 april 2027", zo in ClickUp, aangemaakt door Charish.
    expect(clickupDag(new Date(1808596800000))).toBe('2027-04-25')
    // In de winter: 21:00 hier, de avond ervoor.
    expect(clickupDag(new Date('2026-11-14T20:00:00.000Z'))).toBe('2026-11-15')
  })

  it('Brussel 04:00 is dezelfde dag', () => {
    expect(clickupDag(new Date('2026-10-25T03:00:00.000Z'))).toBe('2026-10-25') // wintertijd
    expect(clickupDag(new Date('2026-08-30T02:00:00.000Z'))).toBe('2026-08-30') // zomertijd
  })

  it('laat echte tijdstippen staan', () => {
    expect(clickupDag(new Date('2026-10-10T09:20:00.000Z'))).toBeNull()
    expect(clickupDag(new Date('2026-08-30T02:00:00.123Z'))).toBeNull()
    expect(clickupDag(null)).toBeNull()
  })

  it('raakt alleen gemigreerde documenten', () => {
    const datum = new Date(1808596800000)
    expect(herstelClickupDatums({ eventDate: datum }).eventDate).toBe(datum)
    const uit = herstelClickupDatums({ clickupId: '86cbh9v0p', startDate: datum, dueDate: datum, title: 'x' })
    expect(dayKey(uit.startDate)).toBe('2027-04-25')
    expect(dayKey(uit.dueDate)).toBe('2027-04-25')
    expect(uit.dueDate.getHours()).toBe(12)
    expect(uit.title).toBe('x')
  })

  it('herkent een gemigreerd document ook aan zijn id of ClickUp-link', () => {
    const datum = new Date(1808596800000)
    expect(dayKey(herstelClickupDatums({ id: 'cu-task-86cbh9v0p', dueDate: datum }).dueDate)).toBe('2027-04-25')
    expect(dayKey(herstelClickupDatums({ clickupUrl: 'https://app.clickup.com/t/86cbh9v0p', dueDate: datum }).dueDate)).toBe('2027-04-25')
    expect(herstelClickupDatums({ id: 'abc', dueDate: datum }).dueDate).toBe(datum)
  })

  it('zit in normalise, dus elk scherm leest de juiste dag', () => {
    const ts = { toDate: () => new Date(1808596800000) }
    const uit = normalise({ id: 't', clickupId: '86cbh9v0p', dueDate: ts, createdAt: ts })
    expect(dayKey(uit.dueDate)).toBe('2027-04-25')
    // Een aanmaakmoment is geen datum zonder uur en blijft wat het was.
    expect(uit.createdAt.toISOString()).toBe('2027-04-24T20:00:00.000Z')
  })
})
