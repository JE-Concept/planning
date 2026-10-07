import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
  Elke letterlijke sleutel in de code bestaat ook in een woordenlijst.

  Een ontbrekende sleutel geeft geen fout maar staat gewoon op het scherm: zo
  stond er live "ALG.BEWAREN" op een knop (de sleutel heet alg.opslaan) en
  "eventmat.periode" boven een tabel. Dat laatste was een meervoud: de lijst
  kent alleen _een en _meer, en die kiest vertaal() pas als er een `aantal`
  meegegeven wordt. Beide vallen hier op, vóór iemand het ziet.
*/

const WORTEL = new URL('../src', import.meta.url).pathname
const TAALMAP = join(WORTEL, 'lib/taal')

const sleutels = new Set()
for (const naam of readdirSync(TAALMAP)) {
  for (const m of readFileSync(join(TAALMAP, naam), 'utf8').matchAll(/^\s*'([^']+)':\s*\{/gm)) sleutels.add(m[1])
}

function bestanden(map) {
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam)
    if (statSync(pad).isDirectory()) return pad === TAALMAP ? [] : bestanden(pad)
    return /\.(jsx?|mjs)$/.test(naam) && !/\.test\./.test(naam) ? [pad] : []
  })
}

// t('a.b') of t('a.b', { … }) — ook tt, vertaal(taal, 'a.b'); alleen letterlijke sleutels.
const AANROEP = /\b(?:t|vertaal\([^,()]+,)\s*\(?\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'\s*(,\s*\{[^}]*\})?/gi

describe('taalsleutels', () => {
  const fouten = []
  for (const bestand of bestanden(WORTEL)) {
    const src = readFileSync(bestand, 'utf8')
    for (const m of src.matchAll(AANROEP)) {
      const [, sleutel, waarden = ''] = m
      if (sleutels.has(sleutel)) continue
      const meervoud = sleutels.has(`${sleutel}_een`) && sleutels.has(`${sleutel}_meer`)
      if (meervoud && /\baantal\b/.test(waarden)) continue
      const waar = `${bestand.slice(WORTEL.length + 1)}: ${sleutel}`
      fouten.push(meervoud ? `${waar} (meervoud zonder aantal)` : waar)
    }
  }

  it('vindt elke letterlijke sleutel terug in src/lib/taal', () => {
    expect(fouten).toEqual([])
  })
})
