import { describe, expect, it } from 'vitest'
import { groepeer, normaliseer, rangschik, scoreKandidaat, scoreTekst, woorden } from '../src/lib/zoeken'

const kandidaat = (soort, titel, extra = [], gewicht = 0) => ({ soort, titel, extra, gewicht })

describe('normaliseer', () => {
  it('haalt accenten en hoofdletters weg', () => {
    expect(normaliseer('Anneleen Coënen')).toBe('anneleen coenen')
    expect(normaliseer('  BLUM België  ')).toBe('blum belgie')
  })

  it('overleeft niets', () => {
    expect(normaliseer(null)).toBe('')
    expect(normaliseer(undefined)).toBe('')
  })
})

describe('woorden', () => {
  it('splitst op spaties en laat leegte weg', () => {
    expect(woorden('  blum   kerst ')).toEqual(['blum', 'kerst'])
    expect(woorden('')).toEqual([])
  })
})

describe('scoreTekst', () => {
  it('zet een treffer vooraan boven een treffer in het midden', () => {
    expect(scoreTekst('Blum België', 'blum')).toBeGreaterThan(scoreTekst('Tafelschikking Blum', 'blum'))
  })

  it('telt een woordgrens als vooraan', () => {
    // "Niels" in "Trouw Niels en Inez" is waar iemand naar zoekt, niet een
    // toevallige letterreeks ergens in een woord.
    expect(scoreTekst('Trouw Niels en Inez', 'niels')).toBeGreaterThan(scoreTekst('Personeelsfeest', 'eels'))
  })

  it('geeft een exacte treffer de volle score', () => {
    expect(scoreTekst('Blum', 'blum')).toBe(1)
  })

  it('geeft nul als het woord er niet in staat', () => {
    expect(scoreTekst('Trouw Niels en Inez', 'blum')).toBe(0)
    expect(scoreTekst('', 'blum')).toBe(0)
  })

  // Een zoekopdracht met een punt of een haakje erin mag de reguliere
  // expressie hieronder niet laten ontsporen.
  it('behandelt leestekens als letters', () => {
    expect(() => scoreTekst('Blum (BE)', '(be)')).not.toThrow()
    expect(scoreTekst('BE 0456.789.133', '0456.789')).toBeGreaterThan(0)
  })
})

describe('scoreKandidaat', () => {
  const trouw = kandidaat('Events', 'Trouw Niels en Inez', ['Meer — aan het meer', 'k-niels'])

  it('vindt via een veld onder de titel, maar lager', () => {
    const viaTitel = scoreKandidaat(kandidaat('Events', 'Meer'), ['meer'])
    const viaExtra = scoreKandidaat(trouw, ['meer'])
    expect(viaExtra).toBeGreaterThan(0)
    expect(viaExtra).toBeLessThan(viaTitel)
  })

  it('eist dat elk getypt woord ergens terechtkomt', () => {
    expect(scoreKandidaat(trouw, ['trouw', 'inez'])).toBeGreaterThan(0)
    expect(scoreKandidaat(trouw, ['trouw', 'blum'])).toBe(0)
  })

  it('geeft nul zonder zoekwoorden', () => {
    expect(scoreKandidaat(trouw, [])).toBe(0)
  })
})

describe('rangschik', () => {
  it('geeft niets terug op een lege vraag', () => {
    expect(rangschik([kandidaat('Taken', 'Drankenlijst')], '   ')).toEqual([])
  })

  it('zet de beste treffer bovenaan, over de soorten heen', () => {
    const uitslag = rangschik(
      [
        kandidaat('Taken', 'Tafelschikking Blum doorgeven'),
        kandidaat('Klanten', 'Blum België'),
        kandidaat('Events', 'Blum personeelsfeest'),
      ],
      'blum'
    )
    expect(uitslag[0].titel).toBe('Blum België')
  })

  /**
   * Waar deze module om bestaat: honderden taken mogen de handvol verslagen
   * niet uit beeld duwen. Zonder plafond stond er twintig keer "Blum" uit
   * dezelfde stapel en leek het verslag niet te bestaan.
   */
  it('houdt per soort een plafond aan', () => {
    const veelTaken = Array.from({ length: 20 }, (_, i) => kandidaat('Taken', `Blum taak ${i}`))
    const uitslag = rangschik([...veelTaken, kandidaat('Verslagen', 'Weekstart Blum')], 'blum', { perSoort: 3 })
    expect(uitslag.filter((r) => r.soort === 'Taken')).toHaveLength(3)
    expect(uitslag.some((r) => r.soort === 'Verslagen')).toBe(true)
  })

  it('laat een soort die iets vond nooit helemaal wegvallen', () => {
    // Acht sterke treffers in twee stapels, een zwakke in een derde, en maar
    // zes plaatsen: de derde stapel hoort er toch bij te staan.
    const taken = Array.from({ length: 4 }, (_, i) => kandidaat('Taken', `Blum ${i}`))
    const events = Array.from({ length: 4 }, (_, i) => kandidaat('Events', `Blum event ${i}`))
    const verslag = kandidaat('Verslagen', 'Weekstart events', ['Terugkoppeling over blum'])

    const uitslag = rangschik([...taken, ...events, verslag], 'blum', { perSoort: 4, totaal: 6 })
    expect(uitslag.some((r) => r.soort === 'Verslagen')).toBe(true)
    expect(uitslag.length).toBeLessThanOrEqual(7)
  })

  it('geeft bij gelijke score altijd dezelfde volgorde', () => {
    const invoer = [kandidaat('Taken', 'Blum b'), kandidaat('Taken', 'Blum a'), kandidaat('Taken', 'Blum c')]
    const eerste = rangschik(invoer, 'blum').map((r) => r.titel)
    const tweede = rangschik([...invoer].reverse(), 'blum').map((r) => r.titel)
    expect(eerste).toEqual(tweede)
    expect(eerste).toEqual(['Blum a', 'Blum b', 'Blum c'])
  })

  it('gebruikt het gewicht van de soort als tiebreaker', () => {
    const uitslag = rangschik(
      [kandidaat('Verslagen', 'Blum', [], 0), kandidaat('Klanten', 'Blum', [], 2)],
      'blum'
    )
    expect(uitslag[0].soort).toBe('Klanten')
  })
})

describe('groepeer', () => {
  it('houdt de opgegeven volgorde van de kopjes aan', () => {
    const resultaten = [
      { soort: 'Taken', titel: 'a' },
      { soort: 'Klanten', titel: 'b' },
      { soort: 'Taken', titel: 'c' },
    ]
    expect(groepeer(resultaten, ['Klanten', 'Taken']).map(([soort]) => soort)).toEqual(['Klanten', 'Taken'])
  })

  it('zet een onbekende soort achteraan in plaats van hem te laten vallen', () => {
    const resultaten = [{ soort: 'Nieuw', titel: 'a' }, { soort: 'Taken', titel: 'b' }]
    expect(groepeer(resultaten, ['Taken']).map(([soort]) => soort)).toEqual(['Taken', 'Nieuw'])
  })
})
