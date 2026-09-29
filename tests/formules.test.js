import { afterEach, describe, expect, it } from 'vitest'
import { zetHuidigeTaal } from '../src/lib/i18n'
import {
  bestelTekst,
  bestellijstVan,
  bestellijstVoorEvent,
  centen,
  gekozen,
  keuzeSamenvatting,
  naarBoven,
  nodigTekst,
  perCategorie,
  prijsVan,
  standaardKeuzes,
} from '../src/lib/formules'

/**
 * De winter bbq uit de opdracht: 29,90 per persoon, drie vragen, en
 * bestelregels die aan die vragen hangen.
 */
const BBQ = {
  id: 'winter-bbq',
  name: 'Winter BBQ',
  prijsPerPersoon: 29.9,
  prijsVast: 0,
  btwPercent: 12,
  opties: [
    {
      id: 'hapjes',
      label: 'Hapjes vooraf',
      btwPercent: 12,
      keuzes: [
        { id: 'hapjes-geen', label: 'Geen', prijsPerPersoon: 0 },
        { id: 'hapjes-koud', label: 'Koud apero', prijsPerPersoon: 4.5 },
      ],
    },
    {
      id: 'dranken',
      label: 'Drankenformule',
      btwPercent: 21,
      keuzes: [
        { id: 'dranken-geen', label: 'Geen', prijsPerPersoon: 0 },
        { id: 'dranken-avond', label: 'Heel de avond', prijsPerPersoon: 19 },
      ],
    },
    {
      id: 'dessert',
      label: 'Dessert',
      keuzes: [
        { id: 'dessert-geen', label: 'Geen', prijsPerPersoon: 0 },
        { id: 'dessert-bord', label: 'Dessertbord', prijsPerPersoon: 6.5, prijsVast: 45 },
      ],
    },
  ],
  bestelregels: [
    { id: 'vlees', item: 'Gemengd vlees', categorie: 'Keuken', eenheid: 'g', perPersoon: 180, inhoud: 1000, verpakking: 'kg' },
    { id: 'brood', item: 'Broodjes', categorie: 'Keuken', eenheid: 'stuks', perPersoon: 2, inhoud: 1 },
    { id: 'houtskool', item: 'Houtskool', categorie: 'Materiaal', eenheid: 'kg', perPersoon: 0, vast: 10, inhoud: 5, verpakking: 'zak' },
    { id: 'wijn-basis', item: 'Wijn wit', categorie: 'Drank', eenheid: 'flessen', perPersoon: 0.2, inhoud: 1 },
    { id: 'wijn-formule', item: 'Wijn wit', categorie: 'Drank', eenheid: 'flessen', perPersoon: 0.2, inhoud: 1, keuzeId: 'dranken-avond' },
    { id: 'bier', item: 'Pils', categorie: 'Drank', eenheid: 'flesjes', perPersoon: 2.5, inhoud: 24, verpakking: 'bak', keuzeId: 'dranken-avond' },
    { id: 'hapjes-stuks', item: 'Aperohapjes', categorie: 'Keuken', eenheid: 'stuks', perPersoon: 4, inhoud: 1, keuzeId: 'hapjes-koud' },
  ],
}

const kaal = standaardKeuzes(BBQ)
const alles = { hapjes: 'hapjes-koud', dranken: 'dranken-avond', dessert: 'dessert-bord' }

const regel = (lijst, item) => lijst.find((r) => r.item === item)

describe('naarBoven', () => {
  it('rondt een halve eenheid naar boven: je bestelt geen 14,8 flessen', () => {
    expect(naarBoven(14.8)).toBe(15)
    expect(naarBoven(0.1)).toBe(1)
    expect(naarBoven(7)).toBe(7)
  })

  it('maakt van rekenruis geen extra verpakking', () => {
    // 0,07 × 100 is in drijvende komma 7.000000000000001. Botweg Math.ceil
    // maakt daar 8 van — een hele verpakking te veel, elke keer opnieuw.
    expect(0.07 * 100).toBeGreaterThan(7)
    expect(naarBoven(0.07 * 100)).toBe(7)
    expect(naarBoven(0.1 * 3)).toBe(1)
  })

  it('geeft nul terug voor onzin in plaats van NaN op de bestelbon', () => {
    expect(naarBoven(undefined)).toBe(0)
    expect(naarBoven(Number.NaN)).toBe(0)
  })
})

describe('centen', () => {
  it('houdt bedragen op de cent', () => {
    expect(centen(29.9 * 3)).toBe(89.7)
    expect(centen(1716.8 * 0.12)).toBe(206.02)
    expect(centen(0.1 + 0.2)).toBe(0.3)
  })
})

describe('bestellijstVan', () => {
  /**
   * De tabel uit de opdracht, voor 37 personen. Wat er in de laatste kolom
   * staat is wat er bij de leverancier besteld wordt — nooit minder dan nodig.
   *
   * | artikel      | p.p.  | vast | eenheid | per verpakking | nodig | bestellen |
   * | Gemengd vlees| 180   |  0   | g       | 1000           | 6660  | 7 × 1000  |
   * | Broodjes     | 2     |  0   | stuks   | 1              | 74    | 74        |
   * | Houtskool    | 0     | 10   | kg      | 5              | 10    | 2 × 5     |
   * | Wijn wit     | 0,2   |  0   | flessen | 1              | 7,4   | 8         |
   */
  const lijst = bestellijstVan(BBQ, kaal, 37)

  it('rekent per persoon en rondt af per verpakking', () => {
    expect(regel(lijst, 'Gemengd vlees')).toMatchObject({ nodig: 6660, verpakkingen: 7, bestellen: 7000 })
    expect(regel(lijst, 'Broodjes')).toMatchObject({ nodig: 74, verpakkingen: 74, bestellen: 74 })
  })

  it('telt een vaste hoeveelheid mee die niets met het aantal personen te maken heeft', () => {
    expect(regel(lijst, 'Houtskool')).toMatchObject({ nodig: 10, verpakkingen: 2, bestellen: 10 })
  })

  it('laat de regels van een niet-gekozen optie weg', () => {
    expect(regel(lijst, 'Pils')).toBeUndefined()
    expect(regel(lijst, 'Aperohapjes')).toBeUndefined()
    expect(regel(lijst, 'Wijn wit')).toMatchObject({ nodig: 7.4, bestellen: 8 })
  })

  it('neemt de regels van een gekozen optie erbij, met de vraag als bron', () => {
    const met = bestellijstVan(BBQ, alles, 37)
    expect(regel(met, 'Aperohapjes')).toMatchObject({ bestellen: 148 })
    // 2,5 flesjes × 37 = 92,5 → vier bakken van 24, dus 96 flesjes.
    expect(regel(met, 'Pils')).toMatchObject({ nodig: 92.5, verpakkingen: 4, bestellen: 96 })
    expect(regel(met, 'Pils').bron).toEqual(['Drankenformule'])
  })

  it('telt hetzelfde artikel eerst op en rondt daarna pas af', () => {
    // 0,2 uit de formule plus 0,2 uit de drankenformule is 0,4 per persoon:
    // vijftien flessen. Elk apart afgerond zouden het er zestien zijn — een
    // bak te veel, elke keer dat deze formule verkocht wordt.
    const met = bestellijstVan(BBQ, alles, 37)
    expect(regel(met, 'Wijn wit')).toMatchObject({ perPersoon: 0.4, nodig: 14.8, bestellen: 15 })
    expect(met.filter((r) => r.item === 'Wijn wit')).toHaveLength(1)
  })

  it('geeft een lege lijst bij nul personen in plaats van een bestelling', () => {
    // Nul personen laat enkel de vaste hoeveelheden staan: de houtskool is
    // nodig zodra er gebarbecued wordt, het vlees pas als er gasten zijn.
    const leeg = bestellijstVan(BBQ, kaal, 0)
    expect(leeg.map((r) => r.item)).toEqual(['Houtskool'])
  })

  it('rondt een half persoon weg in plaats van een halve portie te bestellen', () => {
    expect(bestellijstVan(BBQ, kaal, 36.4).find((r) => r.item === 'Broodjes').bestellen).toBe(72)
  })
})

describe('prijsVan', () => {
  it('rekent de kale formule zonder opties', () => {
    const prijs = prijsVan(BBQ, kaal, 37)
    expect(prijs.perPersoon).toBe(29.9)
    expect(prijs.exclBtw).toBe(1106.3)
    expect(prijs.btw).toBe(132.76)
    expect(prijs.inclBtw).toBe(1239.06)
  })

  it('telt de meerprijs van elke gekozen optie erbij', () => {
    const prijs = prijsVan(BBQ, alles, 37)
    // 29,90 + 4,50 + 19,00 + 6,50 = 59,90 p.p. × 37 = 2216,30, plus 45 vast.
    expect(prijs.perPersoon).toBe(59.9)
    expect(prijs.vast).toBe(45)
    expect(prijs.exclBtw).toBe(2261.3)
  })

  it('belast drank apart van eten, want dat zijn twee Belgische tarieven', () => {
    const prijs = prijsVan(BBQ, alles, 37)
    const tarieven = Object.fromEntries(prijs.btwRegels.map((r) => [r.percent, r]))
    // Eten aan 12%: formule 1106,30 + hapjes 166,50 + dessert 285,50 = 1558,30.
    expect(tarieven[12]).toMatchObject({ basis: 1558.3, btw: 187 })
    // Drank aan 21%: 19,00 × 37 = 703,00.
    expect(tarieven[21]).toMatchObject({ basis: 703, btw: 147.63 })
    expect(prijs.inclBtw).toBe(centen(prijs.exclBtw + prijs.btw))
  })

  it('is nul voor nul personen maar houdt de vaste kosten', () => {
    expect(prijsVan(BBQ, kaal, 0).exclBtw).toBe(0)
    expect(prijsVan(BBQ, alles, 0).exclBtw).toBe(45)
  })

  it('valt niet om zonder formule', () => {
    expect(prijsVan(null, {}, 20).exclBtw).toBe(0)
    expect(bestellijstVan(null, {}, 20)).toEqual([])
  })
})

describe('keuzes', () => {
  it('kiest standaard de eerste — de goedkoopste — keuze per vraag', () => {
    expect(standaardKeuzes(BBQ)).toEqual({ hapjes: 'hapjes-geen', dranken: 'dranken-geen', dessert: 'dessert-geen' })
  })

  it('negeert een antwoord dat niet bij de vraag hoort', () => {
    expect(gekozen(BBQ, { hapjes: 'bestaat-niet' })).toEqual([])
  })

  it('vat de antwoorden samen voor op de fiche', () => {
    expect(keuzeSamenvatting(BBQ, alles)).toBe(
      'Hapjes vooraf: Koud apero · Drankenformule: Heel de avond · Dessert: Dessertbord'
    )
  })
})

describe('de lijst zoals ze op het event terechtkomt', () => {
  it('is een platte kopie met een vinkje per regel', () => {
    const lijst = bestellijstVoorEvent(BBQ, alles, 37)
    expect(lijst.every((r) => r.besteld === false)).toBe(true)
    expect(regel(lijst, 'Wijn wit').bestellen).toBe(15)
  })

  it('groepeert per categorie, in de volgorde van de lijst', () => {
    const groepen = perCategorie(bestellijstVoorEvent(BBQ, alles, 37))
    expect(groepen.map((g) => g.categorie)).toEqual(['Keuken', 'Materiaal', 'Drank'])
  })
})

describe('de tekst op de bestelbon', () => {
  const lijst = bestellijstVan(BBQ, alles, 37)

  it('zet het aantal verpakkingen vooraan, want dat bestel je', () => {
    expect(bestelTekst(regel(lijst, 'Pils'))).toBe('4 × bak van 24 flesjes')
    expect(bestelTekst(regel(lijst, 'Gemengd vlees'))).toBe('7 × kg van 1.000 g')
  })

  it('laat de verpakking weg als er niets te verpakken valt', () => {
    expect(bestelTekst(regel(lijst, 'Broodjes'))).toBe('74 stuks')
  })

  it('zegt wat er nodig was zodra het afronden iets overhoudt', () => {
    expect(nodigTekst(regel(lijst, 'Pils'))).toBe('92,5 flesjes nodig')
    expect(nodigTekst(regel(lijst, 'Broodjes'))).toBe(null)
  })

  describe('in het Engels', () => {
    afterEach(() => zetHuidigeTaal('nl'))

    // De eenheid en de naam van de verpakking komen uit de formule en blijven
    // dus staan zoals ze ingevuld zijn; alleen het woord ertussen gaat mee.
    it('schrijft de bestelbon in de taal van de gebruiker', () => {
      zetHuidigeTaal('en')
      expect(bestelTekst(regel(lijst, 'Pils'))).toBe('4 × bak of 24 flesjes')
      expect(bestelTekst(regel(lijst, 'Broodjes'))).toBe('74 stuks')
      expect(nodigTekst(regel(lijst, 'Pils'))).toBe('92,5 flesjes needed')
    })
  })
})
