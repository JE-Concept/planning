import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
  De regel uit CLAUDE.md, als test: een `defineSecret` hoort nooit in de
  standaardcodebase, want een functions-uitrol faalt in zijn geheel op één
  ontbrekend geheim. Alles wat aan een geheim hangt krijgt een eigen codebase,
  en die staat in beide workflows achter `scripts/ci/geheim.sh` met een
  waarschuwing in plaats van een fout.
*/
const wortel = new URL('../', import.meta.url)
const lees = (pad) => readFileSync(new URL(pad, wortel), 'utf8')
const firebase = JSON.parse(lees('firebase.json'))

describe('de functies-codebases', () => {
  it('houden het geheim uit de standaardcodebase', () => {
    for (const naam of readdirSync(new URL('functions/', wortel)).filter((n) => n.endsWith('.js'))) {
      expect(lees(`functions/${naam}`), `functions/${naam} definieert een geheim`).not.toMatch(/defineSecret\(/)
    }
  })

  it('staan allemaal in firebase.json, en elke map in firebase.json bestaat', () => {
    const inConfig = firebase.functions.map((f) => f.source).sort()
    const opSchijf = readdirSync(wortel).filter((n) => /^functions(-[a-z]+)?$/.test(n)).sort()
    expect(inConfig).toEqual(opSchijf)
  })

  it('met een geheim staan in ci.yml én go-live.yml achter geheim.sh, met een waarschuwing', () => {
    const ci = lees('.github/workflows/ci.yml')
    const goLive = lees('.github/workflows/go-live.yml')
    for (const { source, codebase } of firebase.functions) {
      if (codebase === 'default') continue
      const bestanden = readdirSync(new URL(`${source}/`, wortel)).filter((n) => n.endsWith('.js'))
      const metGeheim = bestanden.some((n) => /defineSecret\(/.test(lees(`${source}/${n}`)))
      if (!metGeheim) continue
      for (const [naam, src] of [['ci.yml', ci], ['go-live.yml', goLive]]) {
        const uitrol = src.indexOf(`--only functions:${codebase}`)
        expect(uitrol, `${naam} rolt ${codebase} niet uit`).toBeGreaterThan(-1)
        const ervoor = src.slice(Math.max(0, uitrol - 1200), uitrol)
        expect(ervoor, `${naam}: ${codebase} staat niet achter geheim.sh`).toMatch(/scripts\/ci\/geheim\.sh [A-Z_]+/)
        const erna = src.slice(uitrol, uitrol + 400)
        expect(erna, `${naam}: een mislukte uitrol van ${codebase} breekt de hele uitrol`).toMatch(/\|\| echo "::warning::/)
      }
    }
  })

  it('hebben voor elke rewrite naar een functie ook die functie', () => {
    // Een rewrite naar een functie die niet bestaat, geeft een 404 die op een
    // kapotte site lijkt. De functie-id staat als `export const <id>` in de
    // index van een van de codebases.
    const exports = firebase.functions
      .map((f) => lees(`${f.source}/index.js`))
      .flatMap((src) => [...src.matchAll(/export const (\w+) =/g)].map((m) => m[1]))
    for (const site of firebase.hosting) {
      for (const rw of site.rewrites ?? []) {
        if (!rw.function) continue
        expect(exports, `${site.target}: rewrite ${rw.source} wijst naar een onbekende functie`).toContain(rw.function.functionId)
      }
    }
    expect(existsSync(new URL('functions-wintermoods/index.js', wortel))).toBe(true)
  })
})
