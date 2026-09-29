import { afterEach, describe, expect, it } from 'vitest'
import { zetHuidigeTaal } from '../src/lib/i18n'
import { zetLocale } from '../src/lib/dates'
import { herhalingProbleem, herhalingUitleg, herhalingVoor, volgendeKeer } from '../src/lib/checklist-herhaling'
import { dueOn } from '../src/lib/checklist-templates'

// 29 september 2026 is een dinsdag.
const DINSDAG = new Date(2026, 8, 29)

describe('herhalingVoor', () => {
  it('maakt van een dagelijks punt geen zondagspunt', () => {
    // Dit was de fout: de terugval droeg `days: [0, 6]` mee, en "één keer per
    // week" las daar dag 0 uit. Een wekelijkse poetsbeurt stond dan op zondag.
    const herhaling = herhalingVoor('wekelijks', { kind: 'dagelijks', days: [0, 6] })
    expect(herhaling).toEqual({ kind: 'wekelijks', days: [1] })
  })

  it('houdt de dag vast die al voor een wekelijkse herhaling gekozen was', () => {
    expect(herhalingVoor('wekelijks', { kind: 'wekelijks', days: [4] })).toEqual({
      kind: 'wekelijks',
      days: [4],
    })
  })

  it('schrijft de velden die het nieuwe soort nodig heeft ook echt weg', () => {
    // De editor tóónde "de 1e van de maand" omdat het invoerveld terugvalt op 1,
    // maar er stond niets in de database.
    expect(herhalingVoor('maandelijks', { kind: 'dagelijks' })).toEqual({
      kind: 'maandelijks',
      dayOfMonth: 1,
    })
    expect(herhalingVoor('jaarlijks', { kind: 'dagelijks' })).toEqual({
      kind: 'jaarlijks',
      month: 0,
      dayOfMonth: 1,
    })
  })

  it('laat geen resten van het vorige soort achter', () => {
    const herhaling = herhalingVoor('kwartaal', { kind: 'weekdag', days: [0, 6], month: 5 })
    expect(herhaling).toEqual({ kind: 'kwartaal', dayOfMonth: 1 })
  })

  it('geeft "op bepaalde dagen" de werkweek als er nog niets gekozen was', () => {
    expect(herhalingVoor('weekdag', { kind: 'dagelijks' })).toEqual({
      kind: 'weekdag',
      days: [1, 2, 3, 4, 5],
    })
    expect(herhalingVoor('weekdag', { weekendOnly: true })).toEqual({ kind: 'weekdag', days: [0, 6] })
  })

  it('houdt een dag van de maand binnen de maand', () => {
    expect(herhalingVoor('maandelijks', { dayOfMonth: 99 }).dayOfMonth).toBe(31)
    expect(herhalingVoor('maandelijks', { dayOfMonth: 0 }).dayOfMonth).toBe(1)
    expect(herhalingVoor('jaarlijks', { month: 40 }).month).toBe(11)
  })

  it('valt terug op dagelijks bij een soort dat niet bestaat', () => {
    expect(herhalingVoor('af en toe', {})).toEqual({ kind: 'dagelijks' })
    expect(herhalingVoor('dagelijks', { days: [3] })).toEqual({ kind: 'dagelijks' })
  })
})

describe('volgendeKeer', () => {
  it('vindt de eerstvolgende maandag voor een wekelijks punt', () => {
    expect(volgendeKeer({ kind: 'wekelijks', days: [1] }, DINSDAG)).toEqual(new Date(2026, 9, 5))
  })

  it('geeft vandaag terug als het vandaag moet', () => {
    expect(volgendeKeer({ kind: 'dagelijks' }, DINSDAG)).toEqual(new Date(2026, 8, 29))
  })

  it('springt naar de eerste maand van het volgende kwartaal', () => {
    expect(volgendeKeer({ kind: 'kwartaal', dayOfMonth: 1 }, DINSDAG)).toEqual(new Date(2026, 9, 1))
  })

  it('kent geen volgende keer als er geen dag gekozen is', () => {
    expect(volgendeKeer({ kind: 'weekdag', days: [] }, DINSDAG)).toBe(null)
  })

  it('gebruikt dezelfde regels als de werkvloer', () => {
    const herhaling = herhalingVoor('jaarlijks', { month: 2, dayOfMonth: 31 })
    const dag = volgendeKeer(herhaling, DINSDAG)
    expect(dueOn({ repeat: herhaling }, dag)).toBe(true)
  })
})

describe('herhalingProbleem', () => {
  it('waarschuwt voor een punt dat nooit meer terugkomt', () => {
    expect(herhalingProbleem({ kind: 'weekdag', days: [] })).toMatch(/nooit/)
  })

  it('zwijgt als de herhaling gewoon klopt', () => {
    expect(herhalingProbleem({ kind: 'maandelijks', dayOfMonth: 15 })).toBe(null)
    expect(herhalingProbleem({ kind: 'dagelijks' })).toBe(null)
  })
})

describe('herhalingUitleg', () => {
  it('zet de eerstvolgende keer naast de omschrijving', () => {
    expect(herhalingUitleg({ kind: 'wekelijks', days: [1] }, DINSDAG)).toBe(
      'elke maandag · eerstvolgend 05/10/2026'
    )
  })

  it('laat dat weg bij een punt dat elke dag moet', () => {
    expect(herhalingUitleg({ kind: 'dagelijks' }, DINSDAG)).toBe('elke dag')
  })
})

describe('in het Engels', () => {
  afterEach(() => {
    zetHuidigeTaal('nl')
    zetLocale('nl-BE')
  })

  it('zet de eerstvolgende keer in het Engels naast de omschrijving', () => {
    zetHuidigeTaal('en')
    zetLocale('en-GB')
    expect(herhalingUitleg({ kind: 'wekelijks', days: [1] }, DINSDAG)).toBe(
      'every Monday · next on 05/10/2026'
    )
    expect(herhalingUitleg({ kind: 'dagelijks' }, DINSDAG)).toBe('every day')
  })

  it('waarschuwt in het Engels over een punt dat nooit meer terugkomt', () => {
    zetHuidigeTaal('en')
    expect(herhalingProbleem({ kind: 'weekdag', days: [] })).toMatch(/never/)
  })
})
