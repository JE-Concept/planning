import { describe, expect, it } from 'vitest'
import {
  kandidaten,
  leesbaar,
  stukken,
  vermeldingenIn,
  zetVermelding,
  zoekopdrachtVan,
} from '../src/lib/vermelding'

const TEAM = [
  { id: 'u-jasper', fullName: 'Jasper Engelen', email: 'jasper@kenjeklanten.be' },
  { id: 'u-elke', fullName: 'Elke Vandeput', email: 'elke@example.be' },
  { id: 'u-anneleen', fullName: 'Anneleen Van Loon', email: 'anneleen@example.be' },
]

describe('wie er vermeld is', () => {
  it('leest de accounts uit de tekst', () => {
    expect(vermeldingenIn('@[Elke Vandeput](u-elke) kun jij dit bekijken?')).toEqual(['u-elke'])
  })

  it('noemt iemand één keer, ook al staat hij er twee keer in', () => {
    expect(vermeldingenIn('@[Elke](u-elke) en nog eens @[Elke](u-elke)')).toEqual(['u-elke'])
  })

  it('houdt de volgorde van de tekst aan', () => {
    expect(vermeldingenIn('@[Elke](u-elke) @[Jasper](u-jasper)')).toEqual(['u-elke', 'u-jasper'])
  })

  it('ziet een e-mailadres niet aan voor een vermelding', () => {
    expect(vermeldingenIn('mail naar elke@example.be')).toEqual([])
  })

  it('geeft niets terug voor niets', () => {
    expect(vermeldingenIn('')).toEqual([])
    expect(vermeldingenIn(null)).toEqual([])
  })
})

describe('de tekst voor een mens', () => {
  // Een pushbericht heeft geen scherm dat markering kan tekenen; daar hoort
  // gewoon "@Elke" te staan.
  it('laat alleen de naam staan', () => {
    expect(leesbaar('@[Elke Vandeput](u-elke) kun jij dit bekijken?')).toBe(
      '@Elke Vandeput kun jij dit bekijken?'
    )
  })

  it('laat gewone tekst met rust', () => {
    expect(leesbaar('gewoon een notitie met een e-mail: elke@example.be')).toBe(
      'gewoon een notitie met een e-mail: elke@example.be'
    )
  })
})

describe('de tekst opknippen voor het scherm', () => {
  it('splitst tekst en namen uit elkaar', () => {
    expect(stukken('Hey @[Elke](u-elke), lukt dat?')).toEqual([
      { soort: 'tekst', tekst: 'Hey ' },
      { soort: 'naam', tekst: '@Elke', uid: 'u-elke' },
      { soort: 'tekst', tekst: ', lukt dat?' },
    ])
  })

  // Een lijst die soms leeg is, moet elke aanroeper apart afhandelen.
  it('geeft ook voor een lege tekst één stuk terug', () => {
    expect(stukken('')).toEqual([{ soort: 'tekst', tekst: '' }])
  })

  it('werkt als de vermelding vooraan of achteraan staat', () => {
    expect(stukken('@[Elke](u-elke)')).toEqual([{ soort: 'naam', tekst: '@Elke', uid: 'u-elke' }])
  })
})

describe('waar iemand aan het typen is', () => {
  it('vindt de naam achter de @', () => {
    const tekst = 'Hey @elk'
    expect(zoekopdrachtVan(tekst, tekst.length)).toEqual({ begin: 4, vraag: 'elk' })
  })

  it('laat voor- en achternaam toe', () => {
    const tekst = 'Hey @elke van'
    expect(zoekopdrachtVan(tekst, tekst.length)?.vraag).toBe('elke van')
  })

  it('stopt na twee spaties: dan is het een zin geworden', () => {
    const tekst = 'Hey @elke van de'
    expect(zoekopdrachtVan(tekst, tekst.length)).toBe(null)
  })

  it('ziet een e-mailadres niet als een begin van een vermelding', () => {
    const tekst = 'mail elke@exa'
    expect(zoekopdrachtVan(tekst, tekst.length)).toBe(null)
  })

  it('kijkt alleen naar wat vóór de cursor staat', () => {
    const tekst = 'Hey @elk, en verder niets'
    expect(zoekopdrachtVan(tekst, 8)).toEqual({ begin: 4, vraag: 'elk' })
  })

  it('geeft niets terug zonder @', () => {
    expect(zoekopdrachtVan('gewoon tekst', 12)).toBe(null)
  })
})

describe('de naam in de tekst zetten', () => {
  it('vervangt wat er getypt was en zet de cursor erachter', () => {
    const tekst = 'Hey @elk'
    const uit = zetVermelding(tekst, tekst.length, TEAM[1])
    expect(uit.tekst).toBe('Hey @[Elke Vandeput](u-elke) ')
    expect(uit.cursor).toBe(uit.tekst.length)
  })

  it('houdt wat er achter de cursor stond', () => {
    const tekst = 'Hey @elk, lukt dat?'
    const uit = zetVermelding(tekst, 8, TEAM[1])
    expect(uit.tekst).toBe('Hey @[Elke Vandeput](u-elke) , lukt dat?')
  })

  // Blokhaken in een naam zouden de markering van binnenuit breken.
  it('haalt blokhaken uit de naam', () => {
    const uit = zetVermelding('@x', 2, { id: 'u-raar', fullName: 'Piet [de] Brouwer' })
    expect(uit.tekst).toBe('@[Piet de Brouwer](u-raar) ')
  })

  it('doet niets wanneer er niets te vervangen valt', () => {
    expect(zetVermelding('gewoon tekst', 12, TEAM[0])).toEqual({ tekst: 'gewoon tekst', cursor: 12 })
  })
})

describe('wie er voorgesteld wordt', () => {
  it('zoekt op elk woord apart', () => {
    expect(kandidaten(TEAM, 'van').map((p) => p.id)).toEqual(['u-elke', 'u-anneleen'])
    expect(kandidaten(TEAM, 'anneleen van').map((p) => p.id)).toEqual(['u-anneleen'])
  })

  it('zoekt ook op het e-mailadres', () => {
    expect(kandidaten(TEAM, 'kenjeklanten').map((p) => p.id)).toEqual(['u-jasper'])
  })

  it('toont bij een lege vraag gewoon het team', () => {
    expect(kandidaten(TEAM, '').length).toBe(3)
  })

  it('houdt de lijst kort genoeg om te overzien', () => {
    const veel = Array.from({ length: 20 }, (_, i) => ({ id: `u-${i}`, fullName: `Naam ${i}` }))
    expect(kandidaten(veel, '').length).toBe(6)
  })
})
