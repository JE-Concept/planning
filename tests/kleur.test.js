import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BREEKPUNTEN } from '../src/lib/schermmaat'
import {
  DREMPEL,
  PALET,
  badgeKleuren,
  contrast,
  inktOp,
  meng,
  ontleed,
  verdiep,
} from '../src/lib/kleur'

const ds = readFileSync(new URL('../src/styles/je-ds.css', import.meta.url), 'utf8')

/** Een token uit je-ds.css lezen, zodat de test de echte waarde toetst. */
function token(naam) {
  const m = new RegExp(`--${naam}\\s*:\\s*([^;]+);`).exec(ds)
  return m ? m[1].trim() : null
}

describe('de rekenkunde', () => {
  it('kent de twee uitersten', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('geeft niets terug bij een kleur die ze niet leest', () => {
    // Niet 1 en niet 21: een onbekende kleur is geen slecht contrast maar geen
    // antwoord. Wie dat wegmoffelt, krijgt een test die groen staat op een fout.
    expect(contrast('rood', '#ffffff')).toBeNull()
    expect(contrast('var(--accent)', '#ffffff')).toBeNull()
    expect(ontleed('#abc')).toEqual([170, 187, 204])
  })

  it('mengt een kleur met zijn ondergrond', () => {
    expect(meng('#000000', 0.5, '#ffffff')).toBe('#808080')
    expect(meng('#ffffff', 0, '#003060')).toBe('#003060')
  })
})

describe('de inkt die op een vlak leest', () => {
  it('neemt wit op donker en de donkere inkt op licht', () => {
    expect(inktOp('#003060')).toBe('#ffffff')
    expect(inktOp('#dce4f0')).toBe('#00172e')
  })

  it('kiest bij een middentint de beste van de twee, niet de gewoonte', () => {
    // Hier ging het altijd mis: wit op #f59e0b haalde 2,15. De donkere inkt
    // haalt er ruim 4,5, dus die hoort het te worden.
    const oranje = '#f59e0b'
    expect(contrast('#ffffff', oranje)).toBeLessThan(DREMPEL.tekst)
    expect(inktOp(oranje)).toBe('#00172e')
    expect(contrast(inktOp(oranje), oranje)).toBeGreaterThanOrEqual(DREMPEL.tekst)
  })
})

describe('een kleur verdiepen tot ze leest', () => {
  it('laat een kleur die het al haalt met rust', () => {
    expect(verdiep('#1b3a6b', '#ffffff')).toBe('#1b3a6b')
  })

  it('verdiept tot de drempel en niet verder', () => {
    const uit = verdiep('#f59e0b', '#ffffff')
    expect(contrast(uit, '#ffffff')).toBeGreaterThanOrEqual(DREMPEL.tekst)
    // Nog altijd oranje: het rode kanaal blijft het hoogste.
    const [r, g, b] = ontleed(uit)
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
  })
})

describe('een badge met een zelfgekozen kleur', () => {
  // Precies de kleuren die vóór deze opkuis in de database stonden. Ze blijven
  // staan; ze horen alleen leesbaar getoond te worden.
  const OUD_PALET = ['#8593a9', '#3377ff', '#7c3aed', '#b660e0', '#1090e0', '#f59e0b', '#3db88b', '#008844', '#dc2626']

  it.each(OUD_PALET)('toont %s leesbaar, vol én stil', (kleur) => {
    const { vol, stil } = badgeKleuren(kleur)
    expect(contrast(vol.color, vol.background)).toBeGreaterThanOrEqual(DREMPEL.tekst)
    expect(contrast(stil.color, stil.background)).toBeGreaterThanOrEqual(DREMPEL.tekst)
  })

  it('geeft niets terug voor iets dat geen kleur is', () => {
    expect(badgeKleuren('')).toBeNull()
    expect(badgeKleuren('blauw')).toBeNull()
  })
})

describe('het palet dat het team te kiezen krijgt', () => {
  it('heeft negen kleuren en geen dubbels', () => {
    expect(PALET).toHaveLength(9)
    expect(new Set(PALET).size).toBe(9)
  })

  it.each(PALET)('%s haalt 4,5:1 als tekst, als vulling en op zijn eigen waas', (kleur) => {
    expect(contrast(kleur, '#ffffff')).toBeGreaterThanOrEqual(DREMPEL.tekst)
    const { vol, stil } = badgeKleuren(kleur)
    expect(contrast(vol.color, vol.background)).toBeGreaterThanOrEqual(DREMPEL.tekst)
    expect(contrast(stil.color, stil.background)).toBeGreaterThanOrEqual(DREMPEL.tekst)
  })

  it('draagt geen kleur meer uit het oude ClickUp-palet', () => {
    for (const weg of ['#3377ff', '#f59e0b', '#3db88b', '#b660e0', '#1090e0', '#dc2626']) {
      expect(PALET).not.toContain(weg)
    }
  })
})

/*
  De tripwire op het design system zelf.

  Deze twee tokens zakten door de drempel en zijn hiervoor aangepast. Zet
  iemand ze terug, dan valt deze test om in plaats van dat het pas opvalt
  wanneer een klant zegt dat hij iets niet kan lezen.
*/
describe('de tokens van het design system halen hun drempel', () => {
  const CANVAS = '#f8f9fb'
  const SURFACE = '#ffffff'

  it('warning leest als tekst op papier en op zijn eigen badgevulling', () => {
    const warning = token('amber-600')
    expect(warning).toBe('#946115')
    expect(contrast(warning, CANVAS)).toBeGreaterThanOrEqual(DREMPEL.tekst)
    expect(contrast(warning, meng(warning, 0.07, SURFACE))).toBeGreaterThanOrEqual(DREMPEL.tekst)
  })

  it('border-strong haalt 3:1, want het is de rand van een vinkje', () => {
    const m = /--border-strong\s*:\s*rgba\(0,48,96,([\d.]+)\)/.exec(ds)
    expect(m).not.toBeNull()
    const rand = meng('#003060', Number(m[1]), CANVAS)
    expect(contrast(rand, CANVAS)).toBeGreaterThanOrEqual(DREMPEL.groot)
  })

  it('success, danger en info halen 4,5:1 op papier', () => {
    for (const naam of ['green-600', 'red-600', 'navy-600']) {
      expect(contrast(token(naam), CANVAS)).toBeGreaterThanOrEqual(DREMPEL.tekst)
    }
  })
})

/*
  De breekpunten staan twee keer — in `schermmaat.js` voor JavaScript en als
  `--bp-*` in je-ds.css, want een media query leest geen CSS-variabele. Lopen
  ze uit elkaar, dan springt de zijkolom op een andere breedte weg dan het
  rooster, en dat was precies de toestand vóór deze opkuis.
*/
describe('de breekpunten zijn het eens met elkaar', () => {
  it.each(Object.entries(BREEKPUNTEN))('%s staat op dezelfde waarde in de CSS', (naam, waarde) => {
    expect(token(`bp-${naam}`)).toBe(`${waarde}px`)
  })

  it('en de stylesheets gebruiken geen andere', () => {
    const toegestaan = new Set(Object.values(BREEKPUNTEN).map((px) => `${px - 1}px`))
    const bestanden = ['app.css', 'je-ds.css', 'offerte.css'].map((n) =>
      readFileSync(new URL(`../src/styles/${n}`, import.meta.url), 'utf8')
    )
    const gevonden = bestanden.flatMap((css) => [...css.matchAll(/@media \(max-width: (\d+px)\)/g)].map((m) => m[1]))
    expect(gevonden.length).toBeGreaterThan(0)
    expect([...new Set(gevonden)].filter((px) => !toegestaan.has(px))).toEqual([])
  })
})
