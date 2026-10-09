import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { deadlineGroep, filter, groepeer, perDag, sorteer, vervaldag } from '../src/lib/task-view'
import { laadCatalogus } from '../src/lib/i18n'

/*
  De woordenlijst van dit scherm komt pas met dat scherm mee; zie de
  routetabel in `src/AppPrive.jsx`. Deze test leest de teksten, dus haalt ze
  ze hier zelf op.
*/
await laadCatalogus('tasks')


// Een donderdag, zodat "deze week" en "volgende week" echt verschillen.
const DONDERDAG = new Date('2026-10-01T09:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(DONDERDAG)
})
afterEach(() => vi.useRealTimers())

const taak = (over) => ({ id: 'x', title: 'Taak', assignees: [], tags: [], ...over })

describe('sorteer', () => {
  // Dit was bug 4: "te laat" kwam in de volgorde van de database, dus iets van
  // vorige maand stond onder iets van gisteren.
  it('zet de vroegste deadline bovenaan', () => {
    const uit = sorteer(
      [taak({ id: 'b', dueDate: '2026-09-28' }), taak({ id: 'a', dueDate: '2026-09-10' })],
      'deadline'
    )
    expect(uit.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('zet wat geen deadline heeft achteraan, niet vooraan', () => {
    const uit = sorteer([taak({ id: 'geen' }), taak({ id: 'wel', dueDate: '2026-12-31' })], 'deadline')
    expect(uit.map((t) => t.id)).toEqual(['wel', 'geen'])
  })

  // De prioriteit is een getal waarin 1 het dringendst is; dat leest andersom
  // dan je verwacht en is precies het soort ding dat stil omgekeerd gaat.
  it('sorteert op prioriteit met urgent eerst', () => {
    const uit = sorteer(
      [taak({ id: 'laag', priority: 4 }), taak({ id: 'urgent', priority: 1 }), taak({ id: 'geen' })],
      'prioriteit'
    )
    expect(uit.map((t) => t.id)).toEqual(['urgent', 'laag', 'geen'])
  })

  it('geeft bij gelijke waarden altijd dezelfde volgorde', () => {
    const invoer = [taak({ id: 'b', title: 'Bertha' }), taak({ id: 'a', title: 'Anna' })]
    expect(sorteer(invoer, 'deadline').map((t) => t.id)).toEqual(sorteer(invoer, 'deadline').map((t) => t.id))
  })
})

describe('deadlineGroep', () => {
  it('noemt gisteren te laat', () => {
    expect(deadlineGroep(taak({ dueDate: '2026-09-30T12:00:00' }))).toBe('telaat')
  })

  it('noemt vandaag vandaag', () => {
    expect(deadlineGroep(taak({ dueDate: '2026-10-01T18:00:00' }))).toBe('vandaag')
  })

  // Het punt van de groep: op donderdag gaat "deze week" tot en met zondag.
  it('rekent tot en met zondag als deze week', () => {
    expect(deadlineGroep(taak({ dueDate: '2026-10-04T12:00:00' }))).toBe('dezeweek')
  })

  it('zet maandag in volgende week, niet in deze', () => {
    expect(deadlineGroep(taak({ dueDate: '2026-10-05T12:00:00' }))).toBe('volgendeweek')
  })

  it('zet wat verder weg ligt onder later', () => {
    expect(deadlineGroep(taak({ dueDate: '2026-11-20T12:00:00' }))).toBe('later')
  })

  it('zet wat geen deadline heeft apart', () => {
    expect(deadlineGroep(taak({}))).toBe('zonder')
  })
})

describe('filter', () => {
  const taken = [
    taak({ id: 'a', title: 'Offerte Blum', listId: 'l1', tags: ['je concept'], priority: 2 }),
    taak({ id: 'b', title: 'Personeel zoeken', listId: 'l2', tags: [], priority: 4 }),
  ]

  it('zoekt in titel en omschrijving', () => {
    expect(filter(taken, { zoek: 'blum' }).map((t) => t.id)).toEqual(['a'])
    expect(filter([taak({ id: 'c', description: 'met de koelcel' })], { zoek: 'koelcel' })).toHaveLength(1)
  })

  it('filtert op lijst, label en prioriteit', () => {
    expect(filter(taken, { lijstId: 'l2' }).map((t) => t.id)).toEqual(['b'])
    expect(filter(taken, { label: 'je concept' }).map((t) => t.id)).toEqual(['a'])
    expect(filter(taken, { prioriteit: 2 }).map((t) => t.id)).toEqual(['a'])
  })

  it('sluit niets uit wanneer er niets gekozen is', () => {
    expect(filter(taken, {})).toHaveLength(2)
  })
})

describe('groepeer', () => {
  it('geeft de deadlinegroepen in de volgorde van het scherm', () => {
    const groepen = groepeer([
      taak({ id: 'later', dueDate: '2026-11-20' }),
      taak({ id: 'telaat', dueDate: '2026-09-01' }),
      taak({ id: 'vandaag', dueDate: '2026-10-01T15:00:00' }),
    ])
    expect(groepen.map((g) => g.key)).toEqual(['telaat', 'vandaag', 'later'])
  })

  it('laat lege groepen weg', () => {
    const groepen = groepeer([taak({ id: 'a', dueDate: '2026-10-01T15:00:00' })])
    expect(groepen).toHaveLength(1)
    expect(groepen[0].label).toBe('Vandaag')
  })

  it('sorteert binnen een groep', () => {
    const groepen = groepeer([
      taak({ id: 'gisteren', dueDate: '2026-09-30' }),
      taak({ id: 'vorigemaand', dueDate: '2026-09-02' }),
    ])
    expect(groepen[0].tasks.map((t) => t.id)).toEqual(['vorigemaand', 'gisteren'])
  })

  // Een taak van twee mensen hoort bij beiden: anders mis je hem precies op het
  // moment dat je naar jouw eigen naam kijkt.
  it('zet een taak met twee uitvoerders in beide groepen', () => {
    const groepen = groepeer([taak({ id: 'a', assignees: ['u1', 'u2'] })], {
      groep: 'persoon',
      profileById: { u1: { fullName: 'Anneleen' }, u2: { fullName: 'Bart' } },
    })
    expect(groepen.map((g) => g.label)).toEqual(['Anneleen', 'Bart'])
  })

  it('zet niemand-toegewezen achteraan', () => {
    const groepen = groepeer(
      [taak({ id: 'a', assignees: [] }), taak({ id: 'b', assignees: ['u1'] })],
      { groep: 'persoon', profileById: { u1: { fullName: 'Anneleen' } } }
    )
    expect(groepen.at(-1).label).toBe('Niemand toegewezen')
  })

  it('groepeert op status', () => {
    const groepen = groepeer([taak({ statusName: 'open' }), taak({ statusName: 'closed' })], { groep: 'status' })
    expect(groepen.map((g) => g.label).sort()).toEqual(['closed', 'open'])
  })

  it('geeft bij niet groeperen één groep met alles', () => {
    const groepen = groepeer([taak({ id: 'a' }), taak({ id: 'b' })], { groep: 'geen' })
    expect(groepen).toHaveLength(1)
    expect(groepen[0].tasks).toHaveLength(2)
  })
})

describe('perDag', () => {
  it('bundelt op vervaldag en laat wat geen datum heeft weg', () => {
    const map = perDag([
      taak({ id: 'a', dueDate: '2026-10-01T09:00:00' }),
      taak({ id: 'b', dueDate: '2026-10-01T18:00:00' }),
      taak({ id: 'c' }),
    ])
    expect(Object.keys(map)).toEqual(['2026-10-01'])
    expect(map['2026-10-01']).toHaveLength(2)
  })
})

describe('de vervaldag in woorden', () => {
  // Een `t` die de sleutel en het aantal teruggeeft: hier telt welke zin er
  // gekozen wordt, niet hoe hij vertaald is.
  const t = (sleutel, { aantal } = {}) => (aantal == null ? sleutel : `${sleutel}:${aantal}`)

  it('zegt te laat over wat nog openstaat', () => {
    expect(vervaldag(t, new Date('2026-09-09T12:00:00'))).toBe('tasks.verval.telaat:22')
  })

  it('zegt de datum over wat afgerond is', () => {
    const tekst = vervaldag(t, new Date('2026-09-09T12:00:00'), { afgerond: true })
    expect(tekst).not.toMatch(/telaat/)
    expect(tekst).toMatch(/9/)
  })
})
