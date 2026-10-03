import { describe, expect, it } from 'vitest'
import {
  INTERNE_VELDEN,
  beschikbaarheidVan,
  catalogusVan,
  categorieenVan,
  hoortInDeCatalogus,
  publiekArtikel,
  vrijInPeriode,
} from '../functions/verhuur-aanbod'
import { isLosTeHuren } from '../src/lib/huurprijs'

/**
 * Wat het pand verlaat.
 *
 * Dit is de enige plek waar bepaald wordt welke velden op een openbare pagina
 * terechtkomen. Een fout hier is niet een scheef scherm maar een
 * inkoopprijs die bij een klant op tafel ligt.
 */

const statafel = {
  id: 'm-statafel',
  naam: 'Statafel zwart Ø 80',
  omschrijving: 'Met hoes.',
  categorie: 'Meubilair',
  aantal: 40,
  uitloopDagen: 1,
  prijsPerDag: 9,
  prijsWeekend: 14,
  prijsWeek: 32,
  waarborg: null,
  minDagen: 1,
  directTeHuren: true,
  archived: false,
  // Alles hieronder is van ons en van niemand anders.
  inkoopwaarde: 42,
  leverancier: 'Rentex Hasselt',
  vervangwaarde: 75,
  createdBy: 'u-jasper',
  position: 3072,
}

describe('wat een bezoeker van een artikel ziet', () => {
  /*
    De belangrijkste test van dit bestand. Hij staat er niet om een lijstje na
    te lopen maar omdat de fout die hij tegenhoudt stil is: een nieuw veld op
    het artikel staat morgen op een openbare pagina zonder dat iemand iets
    merkt. Daarom is de lijst wit en niet zwart — zie de kop van de module.
  */
  it('draagt geen enkel veld dat van de inkoop is', () => {
    const uit = publiekArtikel(statafel)
    for (const veld of INTERNE_VELDEN) expect(uit).not.toHaveProperty(veld)
    expect(JSON.stringify(uit)).not.toContain('Rentex')
  })

  it('draagt wel wat er nodig is om te kiezen en te rekenen', () => {
    const uit = publiekArtikel(statafel)
    expect(uit).toMatchObject({
      id: 'm-statafel',
      naam: 'Statafel zwart Ø 80',
      categorie: 'Meubilair',
      prijsPerDag: 9,
      prijsWeekend: 14,
      prijsWeek: 32,
      voorraad: 40,
      uitloopDagen: 1,
    })
  })

  /*
    Een veld dat nog nooit ingevuld is, hoort niet als `undefined` of als nul
    mee te gaan: `null` is "geen waarborg gevraagd", en dat is iets anders dan
    "nul euro waarborg". Dezelfde regel als in de prijsmotor.
  */
  it('laat een leeg bedrag leeg', () => {
    expect(publiekArtikel({ id: 'x', naam: 'Iets', prijsPerDag: 5 })).not.toHaveProperty('waarborg')
    expect(publiekArtikel(statafel).waarborg).toBe(null)
  })

  it('maakt van een ontbrekend aantal een nul en niet een NaN', () => {
    expect(publiekArtikel({ id: 'x', naam: 'Iets' }).voorraad).toBe(0)
  })
})

describe('wie er in de catalogus komt', () => {
  const tent = { ...statafel, id: 'm-tent', naam: 'Partytent', directTeHuren: false }
  const weg = { ...statafel, id: 'm-weg', naam: 'Oude bar', archived: true }
  const gratis = { ...statafel, id: 'm-gratis', naam: 'Zonder prijs', prijsPerDag: null }

  it('neemt alleen wat uitdrukkelijk los te huren is én een prijs heeft', () => {
    expect(hoortInDeCatalogus(statafel)).toBe(true)
    expect(hoortInDeCatalogus(tent)).toBe(false)
    expect(hoortInDeCatalogus(weg)).toBe(false)
    expect(hoortInDeCatalogus(gratis)).toBe(false)
  })

  /*
    Tonen en verkopen moeten hetzelfde antwoord geven. Lopen ze uiteen, dan
    staat er een artikel op de site dat de kassa weigert — of, veel erger,
    staat er iets níét op de site dat wel afgerekend kan worden. Twee
    implementaties met opzet (de kassa mag niets uit `functions/` halen), dus
    hier de vergelijking.
  */
  it('is het eens met de kassa over wat los te huren is', () => {
    for (const stuk of [statafel, tent, weg, gratis, {}, { directTeHuren: true }]) {
      if (stuk.archived) continue
      expect(hoortInDeCatalogus(stuk)).toBe(isLosTeHuren(stuk))
    }
  })

  it('sorteert op categorie en dan op naam', () => {
    const uit = catalogusVan([
      { ...statafel, id: 'b', naam: 'Zwaan', categorie: 'Meubilair' },
      { ...statafel, id: 'a', naam: 'Aambeeld', categorie: 'Meubilair' },
      { ...statafel, id: 'c', naam: 'Koelkast', categorie: 'Koeling' },
      tent,
    ])
    expect(uit.map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })

  it('noemt alleen categorieën die iets bevatten', () => {
    expect(categorieenVan(catalogusVan([statafel, tent]))).toEqual(['Meubilair'])
  })
})

describe('wat er vrij is in een periode', () => {
  const dagen = ['2027-03-12', '2027-03-13', '2027-03-14']
  const artikel = { id: 'm-statafel', voorraad: 10 }

  it('is alles wanneer er niets bezet is', () => {
    expect(vrijInPeriode(artikel, dagen, new Map())).toBe(10)
  })

  /*
    De regel die een module als deze stilletjes verkeerd doet. Vier vrij op
    maandag en nul op dinsdag is niet "gemiddeld twee" — het is niet
    beschikbaar.
  */
  it('is het minimum over de dagen en niet het gemiddelde', () => {
    const bezet = new Map([['2027-03-12', 1], ['2027-03-13', 9], ['2027-03-14', 0]])
    expect(vrijInPeriode(artikel, dagen, bezet)).toBe(1)
  })

  it('wordt nooit negatief, ook niet bij een overboeking', () => {
    expect(vrijInPeriode(artikel, dagen, new Map([['2027-03-13', 14]]))).toBe(0)
  })

  /*
    Een vol artikel blijft in de lijst staan met nul. Zou het verdwijnen, dan
    denkt de bezoeker dat we het niet hébben, en dan belt hij ook niet.
  */
  it('laat een vol artikel in de lijst staan met nul', () => {
    const uit = beschikbaarheidVan([artikel], dagen, new Map([['m-statafel', new Map([['2027-03-13', 10]])]]))
    expect(uit).toEqual([{ id: 'm-statafel', vrij: 0, voorraad: 10 }])
  })
})
