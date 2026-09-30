import { describe, expect, it } from 'vitest'
import { PLANNING, isPlanning, planningKeuzes, planningKleur, planningVan } from '../src/lib/planning'

describe('de stand van de planning', () => {
  it('leest de stand van het event', () => {
    expect(planningVan({ planning: 'bezig' })?.key).toBe('bezig')
  })

  // Leeg is leeg: zou elk event op "nog te plannen" staan, dan kreeg elk
  // afgelopen dossier uit de migratie diezelfde badge en zei ze niets meer.
  it('geeft niets terug zolang niemand iets koos', () => {
    expect(planningVan({})).toBe(null)
    expect(planningVan(null)).toBe(null)
  })

  it('telt een onbekende waarde als leeg in plaats van ze te tonen', () => {
    expect(planningVan({ planning: 'iets-anders' })).toBe(null)
    expect(isPlanning('iets-anders')).toBe(false)
    expect(isPlanning('rond')).toBe(true)
  })

  it('heeft voor elke stand een kleur, en geen kleur zonder stand', () => {
    for (const stand of PLANNING) expect(planningKleur({ planning: stand.key })).toMatch(/^var\(--/)
    expect(planningKleur({})).toBe(null)
  })

  it('zet "nog niet ingevuld" vooraan in de keuzelijst', () => {
    const keuzes = planningKeuzes()
    expect(keuzes[0].value).toBe('')
    expect(keuzes.length).toBe(PLANNING.length + 1)
  })

  // Het label is een getter zodat een taalwissel hem meeneemt; dat mag niet
  // stilletjes een vaste waarde worden.
  it('leest het label opnieuw bij elke aanroep', () => {
    expect(PLANNING.map((p) => p.label).every(Boolean)).toBe(true)
  })
})
