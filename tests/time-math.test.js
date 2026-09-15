import { describe, expect, it } from 'vitest'
import { durationOf, periodKeys } from '../src/lib/time-math'
import { formatDuration, toDecimalHours } from '../src/lib/format'

describe('durationOf', () => {
  it('measures a finished entry', () => {
    const entry = {
      startedAt: new Date('2026-09-15T09:00:00Z'),
      endedAt: new Date('2026-09-15T11:30:00Z'),
    }
    expect(durationOf(entry)).toBe(9000)
  })

  it('measures a running entry against now', () => {
    const now = new Date('2026-09-15T10:00:00Z').getTime()
    const entry = { startedAt: new Date('2026-09-15T09:00:00Z'), endedAt: null }
    expect(durationOf(entry, now)).toBe(3600)
  })

  it('never returns a negative duration', () => {
    const entry = {
      startedAt: new Date('2026-09-15T11:00:00Z'),
      endedAt: new Date('2026-09-15T09:00:00Z'),
    }
    expect(durationOf(entry)).toBe(0)
  })

  it('is zero without a start', () => {
    expect(durationOf(null)).toBe(0)
    expect(durationOf({})).toBe(0)
  })
})

describe('periodKeys', () => {
  it('buckets a date into day, month and ISO week', () => {
    const keys = periodKeys(new Date(2026, 8, 15, 12, 0)) // dinsdag 15 september 2026
    expect(keys.day).toBe('2026-09-15')
    expect(keys.month).toBe('2026-09')
    expect(keys.week).toMatch(/^2026-W\d{2}$/)
  })

  it('gives a whole Monday-to-Sunday week the same week key', () => {
    const week = [14, 15, 16, 17, 18, 19, 20].map((d) => periodKeys(new Date(2026, 8, d, 12)).week)
    expect(new Set(week).size).toBe(1)
  })

  it('puts the next Monday in the next week', () => {
    expect(periodKeys(new Date(2026, 8, 21, 12)).week).not.toBe(
      periodKeys(new Date(2026, 8, 20, 12)).week
    )
  })

  it('keeps a year-straddling week on the year of its Thursday', () => {
    // 1 January 2027 is a Friday, so its week belongs to 2026.
    expect(periodKeys(new Date(2027, 0, 1, 12)).week.startsWith('2026-W')).toBe(true)
  })
})

describe('formatDuration', () => {
  it('reads like a timesheet, not like a decimal', () => {
    expect(formatDuration(9000)).toBe('2u 30m')
    expect(formatDuration(3600)).toBe('1u')
    expect(formatDuration(120)).toBe('2m')
    expect(formatDuration(0)).toBe('0m')
  })

  it('switches to a clock while a timer runs', () => {
    expect(formatDuration(9045, { withSeconds: true })).toBe('02:30:45')
  })
})

describe('toDecimalHours', () => {
  it('rounds to two decimals for invoicing', () => {
    expect(toDecimalHours(9045)).toBe(2.51)
    expect(toDecimalHours(3600)).toBe(1)
  })
})
