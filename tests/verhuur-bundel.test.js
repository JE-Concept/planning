import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * De verhuursite is van iedereen. De backoffice niet.
 *
 * ── Waarom dit een test is en geen afspraak ──────────────────────────────
 * Omdat de fout die hij tegenhoudt onzichtbaar is. Niemand importeert ooit
 * met opzet `@data/events` in de publieke site; het gebeurt via een handige
 * helper die zelf weer iets ophaalt, drie bestanden verderop. De bundel wordt
 * dan vijf keer zo groot en draagt de logica van onze marges, loonkosten en
 * leveranciers mee — niet als gegevens, wel als code, en dat is genoeg om er
 * conclusies uit te trekken.
 *
 * Eén repository met twee builds is de goedkope manier om een design system
 * en een prijsmotor te delen zonder kopieën die verlopen. Deze test is wat
 * die keuze verantwoord maakt.
 */

const wortel = new URL('../', import.meta.url).pathname
const verhuur = join(wortel, 'verhuur')

function alleBestanden(map) {
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam)
    return statSync(pad).isDirectory() ? alleBestanden(pad) : [pad]
  })
}

const bronnen = alleBestanden(verhuur).filter((p) => /\.(jsx?|css)$/.test(p))

const importsVan = (inhoud) =>
  [...inhoud.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g)].map((m) => m[1])

describe('wat de publieke site mag binnenhalen', () => {
  it('heeft bestanden om na te kijken', () => {
    expect(bronnen.length).toBeGreaterThan(5)
  })

  /*
    Alleen deze twee gedeelde mappen. `@lib` is de prijsmotor en wat daarbij
    hoort; `@styles` is het design system. Allebei bewust gedeeld, want een
    kopie ervan zou verlopen — en dat is precies wat we bij
    `functions-betaling/` met een spiegeltest moeten afdwingen omdat het daar
    niet anders kán.
  */
  const TOEGESTAAN = ['@lib/', '@styles/']
  const VERBODEN = ['@data/', '@components/', '@context/', '@ui/', '@pages/', '@hooks/']

  it('haalt niets uit de backoffice', () => {
    const overtredingen = []
    for (const pad of bronnen) {
      for (const bron of importsVan(readFileSync(pad, 'utf8'))) {
        if (VERBODEN.some((v) => bron.startsWith(v))) {
          overtredingen.push(`${pad.replace(wortel, '')} → ${bron}`)
        }
        // Een pad dat uit de verhuurmap klimt, komt in de backoffice uit.
        if (bron.startsWith('../../src/')) overtredingen.push(`${pad.replace(wortel, '')} → ${bron}`)
      }
    }
    expect(overtredingen).toEqual([])
  })

  /*
    Geen Firebase-SDK. Een browser leest altijd een héél document, dus zou een
    directe Firestore-lezing de inkoopwaarde en de leverancier van elk artikel
    in het netwerkpaneel van elke bezoeker zetten — ook met de strengste
    regels, want die gaan over documenten en niet over velden. Alles loopt via
    `functions/verhuur-aanbod.js`, dat een witte lijst hanteert.
  */
  it('draagt geen Firebase-SDK en geen projectsleutel', () => {
    const overtredingen = []
    for (const pad of bronnen) {
      const inhoud = readFileSync(pad, 'utf8')
      for (const bron of importsVan(inhoud)) {
        if (bron === 'firebase' || bron.startsWith('firebase/')) {
          overtredingen.push(`${pad.replace(wortel, '')} → ${bron}`)
        }
      }
      if (/VITE_FIREBASE/.test(inhoud)) overtredingen.push(`${pad.replace(wortel, '')} noemt VITE_FIREBASE`)
    }
    expect(overtredingen).toEqual([])
  })

  it('deelt alleen wat uitdrukkelijk gedeeld mag worden', () => {
    const gedeeld = new Set()
    for (const pad of bronnen) {
      for (const bron of importsVan(readFileSync(pad, 'utf8'))) {
        if (bron.startsWith('@')) gedeeld.add(bron)
      }
    }
    for (const bron of gedeeld) {
      expect(TOEGESTAAN.some((t) => bron.startsWith(t)), `onverwachte gedeelde import: ${bron}`).toBe(true)
    }
  })
})

describe('wat de pagina van buiten haalt', () => {
  /*
    Niets. Een verwijzing naar fonts.googleapis.com is een extra verbinding
    vóór er één letter staat, en elke bezoeker die zich bij Google meldt is in
    Europa een privacyvraag. De lettertypes staan in `verhuur/public/fonts/`.
  */
  it('laadt geen lettertypes of scripts van een ander domein', () => {
    const html = readFileSync(join(verhuur, 'index.html'), 'utf8')
    const extern = [...html.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
    expect(extern).toEqual([])
  })

  /*
    Vraag 17 in `docs/vragen-productie.md` — beantwoord: meteen vindbaar. Een
    `noindex` die per ongeluk terugkomt (uit een kopie, uit een sjabloon) zou
    de site stil uit Google halen, en dat merk je pas aan de stilte.
  */
  it('is vindbaar voor zoekmachines (vraag 17)', () => {
    const html = readFileSync(join(verhuur, 'index.html'), 'utf8')
    expect(html).not.toMatch(/noindex/)
    expect(readFileSync(join(verhuur, 'public/robots.txt'), 'utf8')).toMatch(/Allow: \//)
  })

  it('heeft de lettertypes die de stijl vraagt', () => {
    for (const bestand of ['Oswald-500.woff2', 'SourceSans3-400.woff2', 'SourceSans3-600.woff2']) {
      expect(statSync(join(verhuur, 'public/fonts', bestand)).size).toBeGreaterThan(1000)
    }
  })
})

describe('de bouwinstelling', () => {
  const config = readFileSync(join(wortel, 'vite.verhuur.config.js'), 'utf8')

  it('zet de verhuursite in een eigen uitgang', () => {
    expect(config).toContain('dist-verhuur')
  })

  /*
    Twee builds en niet één met twee ingangen: een gedeelde
    afhankelijkheidsgraaf levert gedeelde brokken op, en dan komt er via
    `vendor` alsnog backofficecode in de publieke bundel terecht.
  */
  it('bouwt los van de backoffice', () => {
    const hoofd = readFileSync(join(wortel, 'vite.config.js'), 'utf8')
    expect(hoofd).not.toContain('verhuur/')
  })
})
