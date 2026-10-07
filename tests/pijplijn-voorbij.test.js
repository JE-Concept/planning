import { describe, expect, it } from 'vitest'
import { voorbijNietAfgerond } from '../src/lib/pipeline'

// Live stond een etentje van 4 oktober dagen later nog op "planning ready".
describe('voorbij, maar nog niet aan de facturatie toe', () => {
  it('een voorbij event vóór ready to invoice valt op', () => {
    expect(voorbijNietAfgerond('planning ready', '2026-10-04', '2026-10-07')).toBe(true)
    expect(voorbijNietAfgerond('request', '2026-10-06', '2026-10-07')).toBe(true)
  })
  it('vandaag, later, of al bij de facturatie: niets', () => {
    expect(voorbijNietAfgerond('planning ready', '2026-10-07', '2026-10-07')).toBe(false)
    expect(voorbijNietAfgerond('ready to invoice', '2026-10-01', '2026-10-07')).toBe(false)
    expect(voorbijNietAfgerond('complete', '2026-10-01', '2026-10-07')).toBe(false)
  })
  it('zonder datum of met een onbekende status zegt het niets', () => {
    expect(voorbijNietAfgerond('planning ready', null, '2026-10-07')).toBe(false)
    expect(voorbijNietAfgerond('iets anders', '2026-10-01', '2026-10-07')).toBe(false)
  })
})
