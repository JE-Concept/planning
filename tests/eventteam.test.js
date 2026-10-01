import { describe, expect, it } from 'vitest'
import {
  kaartMensen,
  medewerkersVan,
  verantwoordelijkeVan,
  zetVerantwoordelijke,
} from '../src/lib/eventteam'

describe('wie het dossier draagt', () => {
  it('is de eerste en enige in assignees', () => {
    expect(verantwoordelijkeVan({ assignees: ['u-elke'] })).toBe('u-elke')
  })

  // Live staan er events met meerdere namen in `assignees` — die zijn er zo
  // ingekomen toen het nog een rijtje vinkjes was. Eén ervan tonen is beter dan
  // omvallen; het onderhoudsscript zet ze recht.
  it('kiest er één als er nog meerdere in staan', () => {
    expect(verantwoordelijkeVan({ assignees: ['u-elke', 'u-jasper'] })).toBe('u-elke')
  })

  it('mag niemand zijn', () => {
    expect(verantwoordelijkeVan({ assignees: [] })).toBeNull()
    expect(verantwoordelijkeVan({})).toBeNull()
    expect(verantwoordelijkeVan(null)).toBeNull()
    expect(verantwoordelijkeVan({ assignees: [null, undefined] })).toBeNull()
  })

  it('schrijft als lijst weg, want dat is wat er in de databank staat', () => {
    expect(zetVerantwoordelijke('u-elke')).toEqual({ assignees: ['u-elke'] })
    expect(zetVerantwoordelijke('')).toEqual({ assignees: [] })
    expect(zetVerantwoordelijke(null)).toEqual({ assignees: [] })
  })
})

/*
  Dit veld wordt niet meer geschreven: wie er komt werken staat in AAPI. De
  lezer blijft wel, want de rijen van vóór die beslissing staan er nog en het
  scherm "mijn events" van een medewerker hangt eraan.
*/
describe('wie er komt werken (oude gegevens)', () => {
  it('staat in een eigen veld', () => {
    expect(medewerkersVan({ medewerkers: ['u-lotte', 'u-sam'] })).toEqual(['u-lotte', 'u-sam'])
    expect(medewerkersVan({ assignees: ['u-elke'] })).toEqual([])
  })

  // De verantwoordelijke kan zelf ook meewerken; dat is geen tegenspraak.
  it('staat los van wie verantwoordelijk is', () => {
    const ev = { assignees: ['u-elke'], medewerkers: ['u-elke', 'u-lotte'] }
    expect(verantwoordelijkeVan(ev)).toBe('u-elke')
    expect(medewerkersVan(ev)).toEqual(['u-elke', 'u-lotte'])
  })
})

describe('de kaart', () => {
  // Op tweehonderd pixels past één vraag: wie spreek ik hierover aan.
  it('toont alleen de verantwoordelijke', () => {
    expect(kaartMensen({ assignees: ['u-elke'], medewerkers: ['u-lotte', 'u-sam'] })).toEqual(['u-elke'])
  })

  it('toont niemand als er niemand is', () => {
    expect(kaartMensen({ medewerkers: ['u-lotte'] })).toEqual([])
  })
})
