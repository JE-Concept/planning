import { describe, expect, it } from 'vitest'
import { dayKey } from '../src/lib/dates'
import { agendaDagen, dagenInBeeld, eventsPerDag, inHokje, verschuif } from '../src/lib/kalender'

/*
  De eventkalender heeft drie gedaanten — maand, week en de agenda op een
  telefoon — en ze moeten het over dezelfde dagen eens zijn. Zie
  `src/lib/kalender.js`.
*/

const dag = (s) => new Date(`${s}T12:00:00`)
const sleutels = (dagen) => dagen.map(dayKey)

describe('de dagen in beeld', () => {
  it('toont een maand in hele weken, maandag eerst', () => {
    const dagen = dagenInBeeld(dag('2026-10-14'), 'maand')
    // Oktober 2026 begint op een donderdag en eindigt op een zaterdag.
    expect(dayKey(dagen[0])).toBe('2026-09-28')
    expect(dayKey(dagen[dagen.length - 1])).toBe('2026-11-01')
    expect(dagen.length % 7).toBe(0)
  })

  it('toont een week van maandag tot zondag rond het anker', () => {
    expect(sleutels(dagenInBeeld(dag('2026-10-25'), 'week'))).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
    ])
  })

  it('bladert per week of per maand', () => {
    expect(dayKey(verschuif(dag('2026-10-25'), 'week', 1))).toBe('2026-10-26')
    expect(dayKey(verschuif(dag('2026-10-25'), 'week', -1))).toBe('2026-10-12')
    expect(dayKey(verschuif(dag('2026-10-25'), 'maand', 1))).toBe('2026-11-01')
  })
})

describe('wat er in een maandhokje past', () => {
  // Zo 25 oktober: drie events, en het derde viel live gewoon weg.
  it('toont drie events zonder teller', () => {
    expect(inHokje(['a', 'b', 'c'])).toEqual({ getoond: ['a', 'b', 'c'], meer: 0 })
  })

  // Bij vier geen "+1 meer": die regel neemt even veel plaats als het event.
  it('toont er twee en een teller zodra het er meer zijn', () => {
    expect(inHokje(['a', 'b', 'c', 'd'])).toEqual({ getoond: ['a', 'b'], meer: 2 })
  })

  it('valt niet om op een lege dag', () => {
    expect(inHokje(undefined)).toEqual({ getoond: [], meer: 0 })
  })
})

describe('de events per dag', () => {
  it('zet een meerdaags event op elk van zijn dagen', () => {
    const feest = { id: 'f', eventDate: dag('2026-10-23'), eventEndDate: dag('2026-10-25') }
    const perDag = eventsPerDag([feest])
    expect(Object.keys(perDag).sort()).toEqual(['2026-10-23', '2026-10-24', '2026-10-25'])
  })
})

describe('de agenda op een telefoon', () => {
  const week = dagenInBeeld(dag('2026-10-25'), 'week')

  it('toont alleen de dagen waarop iets valt', () => {
    const perDag = { '2026-10-21': [{ id: 'a' }], '2026-10-25': [{ id: 'b' }] }
    expect(agendaDagen(week, perDag, '2026-01-01').map((d) => d.sleutel)).toEqual(['2026-10-21', '2026-10-25'])
  })

  // "Vandaag niets" is ook een antwoord, en zonder die regel weet je niet
  // waar je in de lijst staat.
  it('toont vandaag ook als er niets valt', () => {
    expect(agendaDagen(week, {}, '2026-10-22').map((d) => d.sleutel)).toEqual(['2026-10-22'])
  })
})
