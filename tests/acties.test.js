import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Het call-to-action-kader, als test.
 *
 * Elke regel hieronder staat er omdat ze gebroken werd voor er een test was:
 * een hoofdactie die via de oude laag ongemerkt secundair werd, "Annuleren" in
 * drie verschillende gedaanten, verwijderen dat soms rood en soms grijs was,
 * een knop binnen een link. Zie `src/components/ds/acties.jsx` voor het kader
 * en `docs/design-je-concept.md` (Call to action) voor de regels in woorden.
 */

const WORTEL = new URL('../src/', import.meta.url).pathname
const DS = join(WORTEL, 'components/ds')

function bestanden(map) {
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam)
    if (statSync(pad).isDirectory()) return pad === DS ? [] : bestanden(pad)
    return /\.jsx?$/.test(naam) ? [pad] : []
  })
}

const BRONNEN = bestanden(WORTEL).map((pad) => ({ pad: pad.slice(WORTEL.length), tekst: readFileSync(pad, 'utf8') }))

/** De openingstag van elk element `<naam …>`, met haakjes-matching voor `{…}` erin. */
function tags(tekst, naam) {
  const uit = []
  const re = new RegExp(`<${naam}(?=[\\s/>])`, 'g')
  let m
  while ((m = re.exec(tekst))) {
    let i = m.index + m[0].length
    let diepte = 0
    let str = null
    for (; i < tekst.length; i += 1) {
      const c = tekst[i]
      if (str) {
        if (c === '\\') i += 1
        else if (c === str) str = null
      } else if (diepte > 0) {
        if (c === '"' || c === "'" || c === '`') str = c
        else if (c === '{') diepte += 1
        else if (c === '}') diepte -= 1
      } else if (c === '"' || c === "'") str = c
      else if (c === '{') diepte += 1
      else if (c === '>') break
    }
    uit.push({ tag: tekst.slice(m.index, i + 1), regel: tekst.slice(0, m.index).split('\n').length })
  }
  return uit
}

/** Wat er na `prop={` staat, zonder witruimte en commentaar ervoor. */
const waardeNa = (tekst, prop) =>
  [...tekst.matchAll(new RegExp(`\\b${prop}=\\{`, 'g'))].map((m) => ({
    begin: tekst
      .slice(m.index + m[0].length)
      .replace(/^\s*(\/\*[\s\S]*?\*\/\s*|\{\/\*[\s\S]*?\*\/\}\s*)*/, '')
      .slice(0, 12),
    regel: tekst.slice(0, m.index).split('\n').length,
  }))

describe('het actiekader', () => {
  it('rangschikt elke knop buiten het kader als tweede of stil', () => {
    // Een hoofdactie of een gevaarlijke actie gaat altijd door Acties (of
    // GevaarKnop): daar beslist de plek over het uiterlijk, niet de schrijver.
    // Geen variant is ook fout: Button valt dan terug op primary.
    const fout = []
    for (const { pad, tekst } of BRONNEN) {
      for (const { tag, regel } of tags(tekst, 'Button')) {
        const v = /\svariant="([a-z-]+)"/.exec(tag)?.[1]
        if (v !== 'secondary' && v !== 'ghost') fout.push(`${pad}:${regel} ${v ?? '(geen variant)'}`)
      }
    }
    expect(fout).toEqual([])
  })

  it('zet elke voet van een dialoog of lade in Acties', () => {
    const fout = []
    for (const { pad, tekst } of BRONNEN) {
      for (const { begin, regel } of waardeNa(tekst, 'footer')) {
        if (!begin.startsWith('<Acties')) fout.push(`${pad}:${regel} ${begin}`)
      }
    }
    expect(fout).toEqual([])
  })

  it('geeft een paginakop bediening en acties, nooit losse knoppen', () => {
    const fout = []
    for (const { pad, tekst } of BRONNEN) {
      for (const { tag, regel } of tags(tekst, 'PageHeader')) {
        if (/\sactions=/.test(tag)) fout.push(`${pad}:${regel}`)
      }
    }
    expect(fout).toEqual([])
  })

  it('geeft een lege toestand één actie als object', () => {
    const fout = []
    for (const { pad, tekst } of BRONNEN) {
      for (const { tag, regel } of tags(tekst, 'EmptyState')) {
        if (/\saction=/.test(tag)) fout.push(`${pad}:${regel}`)
      }
    }
    expect(fout).toEqual([])
  })

  it('vraagt bevestiging op één plek', () => {
    const fout = BRONNEN.filter(({ tekst }) => /window\.confirm\(/.test(tekst)).map(({ pad }) => pad)
    expect(fout).toEqual([])
  })

  it('laat een gevaarlijke knop zijn kleur niet overschrijven', () => {
    const fout = []
    for (const { pad, tekst } of BRONNEN) {
      for (const { tag, regel } of tags(tekst, 'GevaarKnop')) {
        if (/\svariant=/.test(tag) || /className="[^"]*\btext-(ink|red)-\d+/.test(tag)) fout.push(`${pad}:${regel}`)
      }
    }
    expect(fout).toEqual([])
  })

  it('heeft één laag componenten: het design system', () => {
    const fout = BRONNEN.filter(({ tekst }) => /from '@ui\//.test(tekst)).map(({ pad }) => pad)
    expect(fout).toEqual([])
  })
})
