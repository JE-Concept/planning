import { describe, expect, it } from 'vitest'
import { matchAssignee } from '../functions-meetings/match.js'

/**
 * Wie een actiepunt krijgt, bepaalt of het gebeurt. Een verkeerde toewijzing
 * verdwijnt uit het zicht van wie het wél moest doen, dus liever niemand dan
 * de verkeerde.
 */
const TEAM = [
  { id: 'u-jasper', email: 'jasper@kenjeklanten.be', fullName: 'Jasper Hansen' },
  { id: 'u-elke', email: 'elke@kenjeklanten.be', fullName: 'Elke Motmans' },
  { id: 'u-anneleen', email: 'anneleen@kenjeklanten.be', fullName: 'Anneleen Coenen' },
]

describe('matchAssignee', () => {
  it('herkent een e-mailadres', () => {
    expect(matchAssignee('jasper@kenjeklanten.be', TEAM)).toBe('u-jasper')
    expect(matchAssignee('JASPER@KENJEKLANTEN.BE', TEAM)).toBe('u-jasper')
  })

  it('herkent een volledige naam', () => {
    expect(matchAssignee('Elke Motmans', TEAM)).toBe('u-elke')
    expect(matchAssignee('  elke motmans  ', TEAM)).toBe('u-elke')
  })

  it('neemt een voornaam alleen als ze eenduidig is', () => {
    expect(matchAssignee('Anneleen', TEAM)).toBe('u-anneleen')

    const twee = [...TEAM, { id: 'u-elke2', email: 'e2@x.be', fullName: 'Elke Vandeweyer' }]
    expect(matchAssignee('Elke', twee)).toBeNull()
    // De volledige naam blijft wel werken zodra ze gegeven is.
    expect(matchAssignee('Elke Motmans', twee)).toBe('u-elke')
  })

  it('wijst niemand aan bij onbekend of leeg', () => {
    expect(matchAssignee('onbekend', TEAM)).toBeNull()
    expect(matchAssignee('Onbekend', TEAM)).toBeNull()
    expect(matchAssignee('', TEAM)).toBeNull()
    expect(matchAssignee(null, TEAM)).toBeNull()
  })

  it('wijst niemand aan bij een naam die niet in het team zit', () => {
    expect(matchAssignee('Steven Belen', TEAM)).toBeNull()
    expect(matchAssignee('Rupert', TEAM)).toBeNull()
  })
})
