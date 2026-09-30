import { describe, expect, it } from 'vitest'
import { contrastColor, formatCurrency, formatNumber, initials } from '../src/lib/format'

/*
  Deze twee staan op elke klantenfiche, elk urenrapport en elk goal. Wat er
  binnenkomt is niet altijd een getal: een bedrag dat ooit met een komma is
  ingetypt of overgenomen uit een oude lijst blijft in Firestore een tekst
  staan, en `Number('12,50')` is NaN. `Intl` schreef dat uit als "€ NaN" —
  leesbaar als een bedrag, en dus erger dan geen bedrag.
*/
describe('formatCurrency', () => {
  it('writes an amount the Belgian way', () => {
    expect(formatCurrency(1234.5)).toContain('1.234,50')
    expect(formatCurrency(0)).toContain('0,00')
  })

  it('says nothing is known instead of "€ NaN"', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency(undefined)).toBe('—')
    expect(formatCurrency('')).toBe('—')
    expect(formatCurrency('12,50')).toBe('—')
    expect(formatCurrency('rommel')).toBe('—')
    expect(formatCurrency(NaN)).toBe('—')
    expect(formatCurrency(Infinity)).toBe('—')
  })

  it('still reads a number that happens to be a string', () => {
    expect(formatCurrency('12.50')).toContain('12,50')
  })
})

describe('formatNumber', () => {
  it('says nothing is known instead of "NaN"', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber('12,5')).toBe('—')
    expect(formatNumber(NaN)).toBe('—')
  })

  it('formats a real number', () => {
    expect(formatNumber(1234.56)).toBe('1.234,56')
  })
})

describe('initials', () => {
  it('falls back rather than crashing on nothing', () => {
    expect(initials(null, null)).toBe('?')
    expect(initials('', '')).toBe('?')
    expect(initials('Jasper')).toBe('JA')
    expect(initials('Jasper Erkens')).toBe('JE')
    expect(initials(null, 'jasper@kenjeklanten.be')).toBe('JK')
  })
})

describe('contrastColor', () => {
  it('falls back on a colour it cannot read', () => {
    expect(contrastColor(null)).toBe('#161a22')
    expect(contrastColor('#abc')).toBe('#161a22')
    expect(contrastColor('rommel')).toBe('#161a22')
  })

  it('picks readable text over dark and light backgrounds', () => {
    expect(contrastColor('#ffffff')).toBe('#161a22')
    expect(contrastColor('#161a22')).toBe('#ffffff')
  })
})
