import { describe, expect, it } from 'vitest'
import { kort, nieuweReviewer, nieuweToegewezenen } from '../functions/notify.js'

/**
 * Een melding te veel is erger dan een melding te weinig: wie er drie krijgt
 * van zijn eigen kliks, zet ze uit en mist daarna ook de echte.
 */

describe('wie een melding krijgt bij een taak', () => {
  it('alleen wie er nieuw op komt te staan', () => {
    const voor = { assignees: ['u-jasper'] }
    const na = { assignees: ['u-jasper', 'u-elke'] }
    expect(nieuweToegewezenen(voor, na)).toEqual(['u-elke'])
  })

  it('niet wie de wijziging zelf maakte', () => {
    const voor = { assignees: [] }
    const na = { assignees: ['u-elke'] }
    expect(nieuweToegewezenen(voor, na, 'u-elke')).toEqual([])
  })

  it('iedereen op een nieuwe taak, behalve de maker', () => {
    expect(nieuweToegewezenen(null, { assignees: ['u-elke', 'u-jasper'] }, 'u-jasper')).toEqual(['u-elke'])
  })

  it('niemand wanneer er alleen iemand af gaat', () => {
    expect(nieuweToegewezenen({ assignees: ['u-elke', 'u-jasper'] }, { assignees: ['u-jasper'] })).toEqual([])
  })

  it('niemand wanneer er niets aan de toewijzing verandert', () => {
    const zelfde = { assignees: ['u-elke'] }
    expect(nieuweToegewezenen(zelfde, { ...zelfde, title: 'andere titel' })).toEqual([])
  })

  it('valt niet om op een taak zonder toegewezenen', () => {
    expect(nieuweToegewezenen(null, {})).toEqual([])
    expect(nieuweToegewezenen({}, { assignees: null })).toEqual([])
  })
})

describe('wie een melding krijgt bij een review', () => {
  const gevraagd = { reviewState: 'requested', reviewRound: 1, reviewerId: 'u-jasper', reviewRequestedBy: 'u-charish' }

  it('de reviewer, zodra de vraag gesteld wordt', () => {
    expect(nieuweReviewer({ reviewState: 'none' }, gevraagd)).toBe('u-jasper')
  })

  it('niet nog eens bij elke volgende schrijving in dezelfde ronde', () => {
    expect(nieuweReviewer(gevraagd, { ...gevraagd, title: 'nieuwe titel' })).toBe(null)
  })

  it('wel opnieuw bij een tweede ronde', () => {
    expect(nieuweReviewer(gevraagd, { ...gevraagd, reviewRound: 2 })).toBe('u-jasper')
  })

  it('niet wanneer er geen reviewer is aangeduid', () => {
    expect(nieuweReviewer(null, { ...gevraagd, reviewerId: null })).toBe(null)
  })

  it('niet wanneer je het jezelf vraagt', () => {
    expect(nieuweReviewer(null, { ...gevraagd, reviewRequestedBy: 'u-jasper' })).toBe(null)
  })

  it('niet bij een goedkeuring of een afwijzing', () => {
    expect(nieuweReviewer(gevraagd, { ...gevraagd, reviewState: 'approved' })).toBe(null)
    expect(nieuweReviewer(gevraagd, { ...gevraagd, reviewState: 'changes' })).toBe(null)
  })
})

describe('de tekst van een melding', () => {
  it('past op een vergrendelscherm', () => {
    const lang = 'Trouw Niels en Inez — drankenlijst afwerken voor de bestelling naar de leverancier kan'
    expect(kort(lang, 40)).toHaveLength(40)
    expect(kort(lang, 40).endsWith('…')).toBe(true)
  })

  it('laat een korte titel met rust en haalt de regelafbrekingen eruit', () => {
    expect(kort('Offerte\n  Blum  nakijken')).toBe('Offerte Blum nakijken')
  })

  it('valt niet om zonder titel', () => {
    expect(kort(null)).toBe('')
  })
})
