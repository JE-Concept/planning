import { describe, expect, it } from 'vitest'
import { addDays, dayKey, monthGrid, startOfWeek, toLocalInput } from '../src/lib/dates'
import { designIdFromUrl } from '../src/lib/canva-url'
import { contrastColor, initials } from '../src/lib/format'

describe('startOfWeek', () => {
  it('starts on Monday, the way the team reads a week', () => {
    // 20 September 2026 is a Sunday.
    expect(dayKey(startOfWeek(new Date(2026, 8, 20)))).toBe('2026-09-14')
  })

  it('leaves a Monday where it is', () => {
    expect(dayKey(startOfWeek(new Date(2026, 8, 14)))).toBe('2026-09-14')
  })
})

describe('monthGrid', () => {
  it('returns whole weeks of seven days', () => {
    const weeks = monthGrid(new Date(2026, 8, 15))
    expect(weeks.length).toBeGreaterThanOrEqual(5)
    weeks.forEach((week) => expect(week).toHaveLength(7))
  })

  it('opens on a Monday and contains every day of the month', () => {
    const weeks = monthGrid(new Date(2026, 8, 15))
    expect(weeks[0][0].getDay()).toBe(1)

    const keys = new Set(weeks.flat().map(dayKey))
    for (let day = 1; day <= 30; day += 1) {
      expect(keys.has(dayKey(new Date(2026, 8, day)))).toBe(true)
    }
  })
})

describe('dayKey', () => {
  it('keys on local time, so a late-evening post stays on its own day', () => {
    expect(dayKey(new Date(2026, 8, 15, 23, 30))).toBe('2026-09-15')
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(dayKey(addDays(new Date(2026, 8, 30), 1))).toBe('2026-10-01')
  })
})

describe('toLocalInput', () => {
  it('formats for datetime-local without a timezone suffix', () => {
    expect(toLocalInput(new Date(2026, 8, 15, 9, 5))).toBe('2026-09-15T09:05')
  })

  it('is empty for nothing', () => {
    expect(toLocalInput(null)).toBe('')
  })
})

describe('designIdFromUrl', () => {
  it('finds the id in an edit link', () => {
    expect(designIdFromUrl('https://www.canva.com/design/DAFxYz-123/edit')).toBe('DAFxYz-123')
  })

  it('finds it in a view link with query parameters', () => {
    expect(designIdFromUrl('https://www.canva.com/design/DAF999/view?utm=1')).toBe('DAF999')
  })

  it('returns nothing for anything else', () => {
    expect(designIdFromUrl('https://example.com/design/DAF999')).toBeNull()
    expect(designIdFromUrl('')).toBeNull()
    expect(designIdFromUrl(null)).toBeNull()
  })
})

describe('contrastColor', () => {
  it('puts dark text on a light badge and light text on a dark one', () => {
    expect(contrastColor('#ffffff')).toBe('#161a22')
    expect(contrastColor('#161a22')).toBe('#ffffff')
  })

  it('falls back to dark text for a malformed colour', () => {
    expect(contrastColor('nonsense')).toBe('#161a22')
  })
})

describe('initials', () => {
  it('uses the first letter of both names', () => {
    expect(initials('Jasper Hansen')).toBe('JH')
  })

  it('falls back to the e-mail address', () => {
    expect(initials(null, 'elke@kenjeklanten.be')).toBe('EK')
  })

  it('never returns an empty label', () => {
    expect(initials(null, null)).toBe('?')
  })
})
