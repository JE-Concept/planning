import { describe, expect, it } from 'vitest'
import { afdelingVan, booleanVan, minutenVan, naamNetjes, statuutVan } from '../functions/aapi/normaliseer'

describe('een naam uit AAPI', () => {
  // Precies de namen uit het voorbeeldbestand, met hun eigen rommel.
  it('maakt van geschreeuw en dubbele spaties een leesbare naam', () => {
    expect(naamNetjes('ANNELEEN COENEN')).toBe('Anneleen Coenen')
    expect(naamNetjes('Ulrike  Zabel')).toBe('Ulrike Zabel')
    expect(naamNetjes('Jasper Hansen ')).toBe('Jasper Hansen')
    expect(naamNetjes('  Roeland Kempeneers  ')).toBe('Roeland Kempeneers')
  })

  // De gevallen uit de briefing: tussenvoegsels en samengestelde namen.
  it('laat tussenvoegsels en samengestelde namen heel', () => {
    expect(naamNetjes('Herman  Van Ormelingen')).toBe('Herman Van Ormelingen')
    expect(naamNetjes('Faycal  El Amraoui')).toBe('Faycal El Amraoui')
    expect(naamNetjes('LORE LELIÈVRE')).toBe('Lore Lelièvre')
  })

  it('zet ook na een koppelteken of apostrof een hoofdletter', () => {
    expect(naamNetjes('JEAN-PIERRE D\'HONDT')).toBe('Jean-Pierre D\'Hondt')
    expect(naamNetjes('anne-marie o’brien')).toBe('Anne-Marie O’Brien')
  })

  it('geeft een lege naam leeg terug in plaats van iets te verzinnen', () => {
    expect(naamNetjes('')).toBe('')
    expect(naamNetjes(null)).toBe('')
  })
})

describe('de afdeling', () => {
  it('haalt de emoji eraf', () => {
    expect(afdelingVan('Bar ☕')).toBe('bar')
    expect(afdelingVan('Zaal 🍽️')).toBe('zaal')
    expect(afdelingVan('Keuken 🍳')).toBe('keuken')
    expect(afdelingVan('Evenementen 🪩')).toBe('evenementen')
  })

  // Een afdeling die erbij komt hoort zichtbaar te zijn, niet stilletjes bij
  // een verkeerde groep te belanden.
  it('houdt een onbekende afdeling bij zijn eigen naam', () => {
    expect(afdelingVan('Terras ☀️')).toBe('terras')
    expect(afdelingVan('')).toBeNull()
  })
})

describe('het statuut', () => {
  it('vertaalt de Dimona-codes', () => {
    expect(statuutVan('OTH', 'PLANNING')).toBe('vast')
    expect(statuutVan('STU_COT', 'PLANNING')).toBe('student')
    expect(statuutVan('FLX_DAY', 'PLANNING')).toBe('flexi')
    expect(statuutVan('INDEPENDENT', 'PLANNING')).toBe('zelfstandig')
  })

  // Leeg bij EXTERNAL is geen gat maar een bekend geval.
  it('noemt iemand zonder Dimona extern', () => {
    expect(statuutVan('', 'EXTERNAL')).toBe('extern')
    expect(statuutVan(undefined, 'EXTERNAL')).toBe('extern')
  })

  it('houdt een onbekende code zichtbaar', () => {
    expect(statuutVan('IETS_NIEUWS', 'PLANNING')).toBe('iets_nieuws')
    expect(statuutVan('', 'PLANNING')).toBe('onbekend')
  })
})

describe('booleans en minuten', () => {
  it('leest True en False als tekst', () => {
    expect(booleanVan('True')).toBe(true)
    expect(booleanVan('FALSE')).toBe(false)
    expect(booleanVan('')).toBe(false)
  })

  // Onzin geeft null en geen false: dan ziet de rij-controle het.
  it('geeft null bij iets dat geen boolean is', () => {
    expect(booleanVan('misschien')).toBeNull()
  })

  it('leest pauzeminuten', () => {
    expect(minutenVan('30')).toBe(30)
    expect(minutenVan('')).toBe(0)
    expect(minutenVan('0')).toBe(0)
    expect(minutenVan('-5')).toBeNull()
    expect(minutenVan('half uur')).toBeNull()
  })
})
