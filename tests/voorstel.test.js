import { describe, expect, it } from 'vitest'
import {
  maakOnderdeel,
  ontbreektInVoorstel,
  overzicht,
  paginas,
  perPersoonTotaal,
  prijsVan,
  sorteer,
  voorstelVanOfferte,
} from '../src/lib/voorstel'
import { maakRegel } from '../src/lib/offerte'

/**
 * Het conceptvoorstel: de offerte zoals de klant ze leest.
 *
 * Wat hier getest wordt is de koppeling tussen de twee lezingen van dezelfde
 * offerte. Een voorstelpagina die een andere prijs toont dan de tabel, is
 * precies de fout die in Canva keer op keer gemaakt werd.
 */

const regels = [
  maakRegel({ rubriek: 'catering', omschrijving: 'BBQ', eenheidExcl: 29.5, aantal: 40, eenheid: 'pp' }),
  maakRegel({ rubriek: 'dranken', omschrijving: 'Drank 2u', eenheidExcl: 14.5, aantal: 40, eenheid: 'pp' }),
  maakRegel({ rubriek: 'personeel', omschrijving: 'Bediening', eenheidExcl: 28, aantal: 12, eenheid: 'u' }),
]

describe('de prijs van een onderdeel', () => {
  it('komt uit de offerteregels van dezelfde rubriek', () => {
    const dranken = maakOnderdeel({ soort: 'dranken' })
    expect(prijsVan(dranken, regels)).toBe(14.5)
  })

  it('telt meerdere regels van dezelfde rubriek op', () => {
    const extra = [...regels, maakRegel({ rubriek: 'catering', eenheidExcl: 8, aantal: 40, eenheid: 'pp' })]
    expect(prijsVan(maakOnderdeel({ soort: 'hoofd' }), extra)).toBe(37.5)
  })

  it('telt een vaste kost niet mee als prijs per persoon', () => {
    // Personeel loopt per uur, niet per gast; dat hoort niet op een
    // persoonsprijs terecht te komen.
    expect(prijsVan(maakOnderdeel({ soort: 'hoofd' }), regels)).toBe(29.5)
  })

  it('laat een eigen prijs op het onderdeel voorgaan', () => {
    const eigen = maakOnderdeel({ soort: 'dranken', perPersoon: 19 })
    expect(prijsVan(eigen, regels)).toBe(19)
  })

  it('geeft niets terug wanneer er geen regel bij past', () => {
    expect(prijsVan(maakOnderdeel({ soort: 'dranken' }), [])).toBeNull()
  })
})

describe('de volgorde en de nummering', () => {
  it('zet de onderdelen in de vaste volgorde van het sjabloon', () => {
    const uit = sorteer([
      maakOnderdeel({ soort: 'dessert', titel: 'D' }),
      maakOnderdeel({ soort: 'locatie', titel: 'L' }),
      maakOnderdeel({ soort: 'ontvangst', titel: 'O' }),
    ])
    expect(uit.map((o) => o.titel)).toEqual(['L', 'O', 'D'])
  })

  it('nummert alleen de formules, niet de locatie of de opties', () => {
    const reeks = overzicht(
      [
        maakOnderdeel({ soort: 'locatie', titel: 'Het Vinne' }),
        maakOnderdeel({ soort: 'ontvangst', titel: 'Ontvangst', accent: 'hapjes' }),
        maakOnderdeel({ soort: 'dranken', titel: 'Dranken' }),
        maakOnderdeel({ soort: 'optie', titel: 'Ofyr' }),
      ],
      regels
    )
    expect(reeks.map((r) => r.nummer)).toEqual(['01', '02'])
    expect(reeks[0].titel).toBe('Ontvangst hapjes')
  })
})

describe('de pagina-indeling', () => {
  it('zet er twee op een blad', () => {
    const vier = ['a', 'b', 'c', 'd'].map((titel) => maakOnderdeel({ soort: 'extra', titel, tekst: 'kort' }))
    expect(paginas(vier).map((p) => p.length)).toEqual([2, 2])
  })

  it('geeft een lang onderdeel het blad alleen', () => {
    const lang = maakOnderdeel({
      soort: 'hoofd',
      titel: 'lang',
      punten: ['a', 'b', 'c', 'd', 'e'],
    })
    const kort = maakOnderdeel({ soort: 'dessert', titel: 'kort', tekst: 'kort' })
    expect(paginas([lang, kort]).map((p) => p.map((o) => o.titel))).toEqual([['lang'], ['kort']])
  })
})

describe('een voorstel uit een offerte', () => {
  it('maakt een drankenpagina alleen wanneer er een drankenlijn is', () => {
    const met = voorstelVanOfferte({ regels })
    expect(met.some((o) => o.soort === 'dranken')).toBe(true)

    const zonder = voorstelVanOfferte({ regels: regels.filter((r) => r.rubriek !== 'dranken') })
    expect(zonder.some((o) => o.soort === 'dranken')).toBe(false)
  })

  it('zet de locatie vooraan wanneer het event er een heeft', () => {
    const uit = voorstelVanOfferte({ regels }, { locatie: 'Het Vinne' })
    expect(uit[0].soort).toBe('locatie')
    expect(uit[0].tekst).toContain('Het Vinne')
  })
})

describe('wat er nog mist', () => {
  it('klaagt over een leeg voorstel', () => {
    expect(ontbreektInVoorstel([], regels)).toEqual(['voorstel.mist_onderdelen'])
  })

  it('klaagt over een onderdeel zonder tekst', () => {
    const uit = ontbreektInVoorstel([maakOnderdeel({ soort: 'dranken', titel: 'Dranken' })], regels)
    expect(uit).toContain('voorstel.mist_tekst')
  })

  it('zwijgt wanneer alles ingevuld is', () => {
    const goed = [
      maakOnderdeel({ soort: 'hoofd', titel: 'BBQ', tekst: 'Een gevarieerd aanbod.' }),
      maakOnderdeel({ soort: 'dranken', titel: 'Dranken', tekst: 'Twee uur lang.' }),
    ]
    expect(ontbreektInVoorstel(goed, regels)).toEqual([])
  })
})

describe('het totaal per persoon', () => {
  it('telt op wat de genummerde onderdelen kosten', () => {
    const onderdelen = [
      maakOnderdeel({ soort: 'hoofd', perPersoon: 29.5 }),
      maakOnderdeel({ soort: 'dranken', perPersoon: 14.5 }),
    ]
    expect(perPersoonTotaal(onderdelen, regels)).toBe(44)
  })
})
