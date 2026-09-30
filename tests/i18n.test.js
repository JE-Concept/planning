// Ook de teksten van het instellingenscherm, die pas met dat scherm mee
// komen: zonder deze regel zou deze test er vijfhonderd minder nakijken
// en dat stilletjes goedkeuren.
import '../src/lib/instellingen-teksten'
import { afterEach, describe, expect, it } from 'vitest'
import {
  STANDAARDTAAL,
  TALEN,
  alleTeksten,
  dubbeleSleutels,
  geldigeTaal,
  localeVan,
  ontbrekendeVertalingen,
  vertaal,
} from '../src/lib/i18n'
import { formatDay, formatMonth, zetLocale } from '../src/lib/dates'

const teksten = alleTeksten()

describe('de catalogi', () => {
  // Deze test is de reden dat de Engelse versie niet stilletjes half af kan
  // raken: wie een Nederlandse tekst toevoegt en de Engelse vergeet, ziet het
  // hier en niet pas wanneer er iemand voor staat.
  it('kent elke Nederlandse sleutel ook in het Engels', () => {
    expect(ontbrekendeVertalingen('en')).toEqual([])
  })

  // Twee bestanden met dezelfde sleutel: één wint, en dan verandert er een
  // tekst op een scherm waar niemand aan gewerkt heeft.
  it('claimt geen sleutel twee keer', () => {
    expect(dubbeleSleutels()).toEqual([])
  })

  // Een tekst die een plek openlaat die in de andere taal niet bestaat, zet
  // straks `{tijd}` op het scherm.
  it('gebruikt in beide talen dezelfde invulplekken', () => {
    const plekken = (tekst) => [...String(tekst).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const [sleutel, talen] of Object.entries(teksten)) {
      expect({ sleutel, plekken: plekken(talen.en) }).toEqual({ sleutel, plekken: plekken(talen.nl) })
    }
  })

  it('laat geen lege tekst staan', () => {
    for (const [sleutel, talen] of Object.entries(teksten)) {
      for (const [taal, tekst] of Object.entries(talen)) expect(`${sleutel}.${taal}: ${tekst}`).not.toMatch(/: *$/)
    }
  })
})

describe('vertaal', () => {
  it('geeft de tekst van de gevraagde taal', () => {
    expect(vertaal('nl', 'alg.opslaan')).toBe('Bewaren')
    expect(vertaal('en', 'alg.opslaan')).toBe('Save')
  })

  it('vult de plekken in', () => {
    expect(vertaal('en', 'timer.gestopt', { tijd: '1u30' })).toBe('Stopped — 1u30 logged.')
  })

  it('laat een plek staan waarvoor niets meegegeven is', () => {
    expect(vertaal('nl', 'timer.week_geboekt', { iets: 'anders' })).toContain('{tijd}')
  })

  it('kiest tussen enkelvoud en meervoud', () => {
    expect(vertaal('nl', 'alg.taak', { aantal: 1 })).toBe('1 taak')
    expect(vertaal('nl', 'alg.taak', { aantal: 3 })).toBe('3 taken')
    expect(vertaal('en', 'alg.persoon', { aantal: 2 })).toBe('2 people')
  })

  it('valt terug op het Nederlands in plaats van op niets', () => {
    expect(vertaal('en', 'alg.opslaan')).toBe('Save')
    expect(vertaal('xx', 'alg.opslaan')).toBe('Bewaren')
  })

  it('toont de sleutel wanneer de tekst nergens bestaat', () => {
    expect(vertaal('en', 'bestaat.niet')).toBe('bestaat.niet')
  })
})

describe('welke taal', () => {
  // De taal van de zaak, tot iemand zelf iets anders kiest. Een browser die op
  // Engels staat, zegt niets over de taal waarin iemand wil werken.
  it('is standaard Nederlands', () => {
    expect(STANDAARDTAAL).toBe('nl')
  })

  it('weigert een taal die niet bestaat', () => {
    expect(geldigeTaal('en')).toBe('en')
    expect(geldigeTaal('de')).toBe(STANDAARDTAAL)
    expect(geldigeTaal(undefined)).toBe(STANDAARDTAAL)
  })

  it('kent bij elke taal een opmaaktaal', () => {
    expect(TALEN.map((t) => t.code)).toEqual(['nl', 'en'])
    expect(localeVan('en')).toBe('en-GB')
    expect(localeVan('onzin')).toBe('nl-BE')
  })
})

describe('de datums volgen de taal', () => {
  afterEach(() => zetLocale('nl-BE'))

  // Een Engelse pagina met "1 oktober" erop is geen halve vertaling maar een
  // fout: dan staat er een woord dat de lezer niet kent.
  it('schrijft de maand in de gekozen taal', () => {
    const dag = new Date('2026-10-01T12:00:00')
    expect(formatMonth(dag)).toMatch(/oktober/i)
    zetLocale('en-GB')
    expect(formatMonth(dag)).toMatch(/october/i)
    expect(formatDay(dag)).toMatch(/oct/i)
  })
})
