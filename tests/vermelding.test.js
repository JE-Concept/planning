import { describe, expect, it } from 'vitest'
import {
  kandidaten,
  leesbaar,
  metMarkering,
  ruweStukken,
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

/*
  In het tekstvak staat gewone tekst. De markering kwam hier vroeger meteen in
  te staan, en dan zag wie Maxine aansprak
  `@[Maxine Vanbrabant](spdwOygRumebHfPZAQ2pxXCFlVN2)` in zijn eigen zin staan.
*/
describe('de naam in de tekst zetten', () => {
  it('zet er leesbare tekst neer en zegt wie er bedoeld is', () => {
    const tekst = 'Hey @elk'
    const uit = zetVermelding(tekst, tekst.length, TEAM[1])
    expect(uit.tekst).toBe('Hey @Elke Vandeput ')
    expect(uit.cursor).toBe(uit.tekst.length)
    expect(uit.vermelding).toEqual({ uid: 'u-elke', naam: 'Elke Vandeput' })
  })

  it('houdt wat er achter de cursor stond', () => {
    const tekst = 'Hey @elk, lukt dat?'
    const uit = zetVermelding(tekst, 8, TEAM[1])
    expect(uit.tekst).toBe('Hey @Elke Vandeput , lukt dat?')
  })

  // Blokhaken in een naam zouden de markering van binnenuit breken.
  it('haalt blokhaken uit de naam', () => {
    const uit = zetVermelding('@x', 2, { id: 'u-raar', fullName: 'Piet [de] Brouwer' })
    expect(uit.tekst).toBe('@Piet de Brouwer ')
    expect(metMarkering(uit.tekst, [uit.vermelding])).toBe('@[Piet de Brouwer](u-raar) ')
  })

  it('doet niets wanneer er niets te vervangen valt', () => {
    expect(zetVermelding('gewoon tekst', 12, TEAM[0])).toEqual({ tekst: 'gewoon tekst', cursor: 12, vermelding: null })
  })
})

describe('de markering erbij zetten vlak voor het bewaren', () => {
  const elke = { uid: 'u-elke', naam: 'Elke Vandeput' }
  const anneleen = { uid: 'u-anneleen', naam: 'Anneleen Van Loon' }

  it('zet de markering rond wat er getypt staat', () => {
    expect(metMarkering('Hey @Elke Vandeput, lukt dat?', [elke]))
      .toBe('Hey @[Elke Vandeput](u-elke), lukt dat?')
  })

  it('doet dat voor elke keer dat de naam er staat', () => {
    expect(metMarkering('@Elke Vandeput en nog eens @Elke Vandeput', [elke]))
      .toBe('@[Elke Vandeput](u-elke) en nog eens @[Elke Vandeput](u-elke)')
  })

  it('laat een naam die weer weggeveegd is gewoon weg', () => {
    expect(metMarkering('toch maar niet', [elke])).toBe('toch maar niet')
    expect(vermeldingenIn(metMarkering('toch maar niet', [elke]))).toEqual([])
  })

  // "Elke" is een begin van "Elke Vandeput": de kortste eerst proberen knipt
  // de langste doormidden.
  it('neemt de langste naam en niet de kortste', () => {
    const kort = { uid: 'u-kort', naam: 'Elke' }
    expect(metMarkering('@Elke Vandeput', [kort, elke])).toBe('@[Elke Vandeput](u-elke)')
    expect(metMarkering('@Elke', [kort, elke])).toBe('@[Elke](u-kort)')
  })

  it('laat een naam die in een woord doorloopt met rust', () => {
    const kort = { uid: 'u-kort', naam: 'Elke' }
    expect(metMarkering('@Elkeen weet dat', [kort])).toBe('@Elkeen weet dat')
  })

  it('raakt een e-mailadres niet aan', () => {
    expect(metMarkering('mail naar info@jeconcept.be', [elke])).toBe('mail naar info@jeconcept.be')
  })

  it('verdraagt twee namen in één zin', () => {
    expect(metMarkering('@Elke Vandeput en @Anneleen Van Loon', [elke, anneleen]))
      .toBe('@[Elke Vandeput](u-elke) en @[Anneleen Van Loon](u-anneleen)')
  })

  it('zonder vermeldingen verandert er niets', () => {
    expect(metMarkering('gewoon een zin', [])).toBe('gewoon een zin')
    expect(metMarkering('', [elke])).toBe('')
  })

  // Wat bewaard wordt, moet terug te lezen zijn: anders stuurt de trigger
  // geen melding of de verkeerde.
  it('levert iets op dat de lezer weer herkent', () => {
    const bewaard = metMarkering('Hey @Elke Vandeput en @Anneleen Van Loon', [elke, anneleen])
    expect(vermeldingenIn(bewaard)).toEqual(['u-elke', 'u-anneleen'])
    expect(leesbaar(bewaard)).toBe('Hey @Elke Vandeput en @Anneleen Van Loon')
  })
})

describe('de stukken voor de spiegel onder het tekstvak', () => {
  const elke = { uid: 'u-elke', naam: 'Elke Vandeput' }

  it('knipt de tekst langs de namen', () => {
    expect(ruweStukken('Hey @Elke Vandeput!', [elke])).toEqual([
      { soort: 'tekst', tekst: 'Hey ' },
      { soort: 'naam', naam: 'Elke Vandeput', uid: 'u-elke' },
      { soort: 'tekst', tekst: '!' },
    ])
  })

  /*
    De som van de stukken is de tekst zelf. Zonder dat staat de pil niet meer
    boven de naam: de spiegel tekent dan andere letters dan het veld.
  */
  it('laat geen letter vallen en voegt er geen toe', () => {
    for (const bron of ['', 'gewoon', 'Hey @Elke Vandeput!', '@Elke Vandeput @Elke Vandeput', 'a@b.c']) {
      const terug = ruweStukken(bron, [elke])
        .map((s) => (s.soort === 'naam' ? `@${s.naam}` : s.tekst))
        .join('')
      expect(terug).toBe(bron)
    }
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
