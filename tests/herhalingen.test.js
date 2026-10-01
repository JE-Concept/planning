import { describe, expect, it } from 'vitest'
import { dagSleutel, isVervaldag, maakHerhaling, omschrijf, sleutelVan, volgendeKeer } from '../src/lib/herhaling'
/*
  Uit `herhaling-datum.js` en niet uit `herhalingen.js`: dat tweede bestand
  importeert `firebase-functions`, en dat staat alleen in
  `functions/node_modules` — dat CI niet installeert. Deze test draaide
  daardoor lokaal wel en in CI niet.
*/
import {
  isVervaldag as isVervaldagServer,
  sleutelVan as sleutelVanServer,
  vandaagInBrussel,
} from '../functions/herhaling-datum.js'

/**
 * Werk dat vanzelf terugkomt.
 *
 * De belangrijkste test staat onderaan: de browser en de server rekenen
 * allebei uit wanneer een herhaling valt, uit twee bestanden, omdat de
 * functies niet uit `src/` kunnen importeren. Die twee worden hier een jaar
 * lang naast elkaar gelegd. Loopt er één uit de pas, dan valt deze test om in
 * plaats van iemands weekplanning.
 */

const maandag = new Date('2026-10-05T12:00:00+02:00')
const dinsdag = new Date('2026-10-06T12:00:00+02:00')

describe('wanneer een herhaling valt', () => {
  it('wekelijks: op de gekozen dag, en niet de dag erna', () => {
    const h = maakHerhaling({ soort: 'wekelijks', dagen: [1] })
    expect(isVervaldag(h, maandag)).toBe(true)
    expect(isVervaldag(h, dinsdag)).toBe(false)
  })

  it('maandelijks: op de gekozen dag van de maand', () => {
    const h = maakHerhaling({ soort: 'maandelijks', dagVanMaand: 6 })
    expect(isVervaldag(h, dinsdag)).toBe(true)
    expect(isVervaldag(h, maandag)).toBe(false)
  })

  it('dagelijks: altijd', () => {
    expect(isVervaldag(maakHerhaling({ soort: 'dagelijks' }), maandag)).toBe(true)
  })

  it('nooit wanneer ze uitstaat', () => {
    const h = maakHerhaling({ soort: 'dagelijks', actief: false })
    expect(isVervaldag(h, maandag)).toBe(false)
  })
})

describe('het opschonen van een herhaling', () => {
  it('haalt dubbele en onmogelijke dagen eruit en sorteert', () => {
    expect(maakHerhaling({ dagen: [5, 1, 1, 9, 0] }).dagen).toEqual([1, 5])
  })

  it('laat de dag van de maand nooit boven de 28 uitkomen', () => {
    // Een herhaling op de 31e slaat februari over en vier maanden per jaar;
    // dan is het geen maandelijkse herhaling meer.
    expect(maakHerhaling({ dagVanMaand: 31 }).dagVanMaand).toBe(28)
    expect(maakHerhaling({ dagVanMaand: 0 }).dagVanMaand).toBe(1)
  })

  it('valt terug op wekelijks bij een onbekende soort', () => {
    expect(maakHerhaling({ soort: 'per kwartaal' }).soort).toBe('wekelijks')
  })
})

describe('de eerstvolgende keer', () => {
  it('is vandaag wanneer het vandaag valt', () => {
    const h = maakHerhaling({ soort: 'wekelijks', dagen: [1] })
    expect(dagSleutel(volgendeKeer(h, maandag))).toBe('2026-10-05')
  })

  it('springt naar de volgende week wanneer de dag net voorbij is', () => {
    const h = maakHerhaling({ soort: 'wekelijks', dagen: [1] })
    expect(dagSleutel(volgendeKeer(h, dinsdag))).toBe('2026-10-12')
  })

  it('vindt de 1e van de volgende maand', () => {
    const h = maakHerhaling({ soort: 'maandelijks', dagVanMaand: 1 })
    expect(dagSleutel(volgendeKeer(h, dinsdag))).toBe('2026-11-01')
  })

  it('geeft niets terug voor een herhaling die uitstaat', () => {
    expect(volgendeKeer(maakHerhaling({ actief: false }), maandag)).toBeNull()
  })

  it('geeft niets terug wanneer er geen dag gekozen is', () => {
    expect(volgendeKeer(maakHerhaling({ soort: 'wekelijks', dagen: [] }), maandag)).toBeNull()
  })
})

describe('het adres van de taak die eruit volgt', () => {
  it('is vast, zodat een tweede poging dezelfde taak schrijft', () => {
    expect(sleutelVan('ebox-controle', maandag)).toBe('h-ebox-controle-2026-10-05')
  })
})

describe('de browser en de server rekenen hetzelfde', () => {
  const gevallen = [
    maakHerhaling({ soort: 'wekelijks', dagen: [1] }),
    maakHerhaling({ soort: 'wekelijks', dagen: [2, 5] }),
    maakHerhaling({ soort: 'maandelijks', dagVanMaand: 1 }),
    maakHerhaling({ soort: 'maandelijks', dagVanMaand: 24 }),
    maakHerhaling({ soort: 'dagelijks' }),
  ]

  it('over een heel jaar, inclusief de zomertijdwissels', () => {
    const dag = new Date('2026-01-01T12:00:00+01:00')
    for (let i = 0; i < 366; i += 1) {
      for (const h of gevallen) {
        expect(isVervaldagServer(h, dag)).toBe(isVervaldag(h, dag))
      }
      expect(sleutelVanServer('x', dag)).toBe(sleutelVan('x', dag))
      dag.setDate(dag.getDate() + 1)
    }
  })
})

describe('de dag zoals Borgloon hem telt', () => {
  it('leest de Belgische datum en niet die van de server', () => {
    // 23:30 UTC op 31 oktober is in Brussel al 1 november. Een maandelijkse
    // herhaling op de 1e hoort dan te vallen, ook al staat de machine op UTC.
    const nacht = new Date('2026-10-31T23:30:00Z')
    expect(dagSleutel(vandaagInBrussel(nacht))).toBe('2026-11-01')
  })
})

describe('hoe het leest in het scherm', () => {
  it('zegt welke dagen het zijn', () => {
    expect(omschrijf(maakHerhaling({ soort: 'wekelijks', dagen: [1] }))).toContain('maandag')
  })

  it('waarschuwt wanneer er geen dag gekozen is', () => {
    expect(omschrijf(maakHerhaling({ soort: 'wekelijks', dagen: [] }))).toMatch(/geen dag/i)
  })
})
