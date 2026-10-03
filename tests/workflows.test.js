import { readFileSync, readdirSync } from 'node:fs'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

/**
 * De workflows zelf.
 *
 * ── Waarom dit een test is ────────────────────────────────────────────────
 * `go-live.yml` stond een commit lang kapot: een stap was midden in het
 * `env:`-blok van een andere stap beland. Niemand merkte het, want dat
 * workflow draait alleen met de hand — tot de dag dat iemand het nodig had.
 * Een workflow die niet eens inleest, is een uitrolknop die niet werkt op
 * het moment dat je hem indrukt.
 *
 * En één regel over de uitrol die we niet nog eens willen leren: de twee
 * hosting-sites gaan los van elkaar. Eén `--only hosting` nam de backoffice
 * mee toen de verhuursite nog niet bestond.
 */

const MAP = new URL('../.github/workflows/', import.meta.url)
const bestanden = readdirSync(MAP).filter((n) => /\.ya?ml$/.test(n))

describe('de workflows', () => {
  it('zijn er', () => {
    expect(bestanden.length).toBeGreaterThan(2)
  })

  for (const naam of bestanden) {
    it(`${naam} is geldige YAML met stappen`, () => {
      const doc = load(readFileSync(new URL(naam, MAP), 'utf8'))
      expect(doc).toBeTypeOf('object')
      expect(doc.jobs).toBeTypeOf('object')
      for (const [job, def] of Object.entries(doc.jobs)) {
        expect(Array.isArray(def.steps), `${naam} → ${job} heeft geen stappenlijst`).toBe(true)
        for (const stap of def.steps) {
          // Elke stap doet iets: een stap zonder run én zonder uses is een
          // teken dat er iets in het verkeerde blok terechtkwam.
          expect(Boolean(stap.run || stap.uses), `${naam} → ${job}: stap zonder run of uses: ${JSON.stringify(stap).slice(0, 80)}`).toBe(true)
        }
      }
    })
  }

  it('rollen de backoffice en de verhuursite los van elkaar uit', () => {
    for (const naam of ['ci.yml', 'go-live.yml']) {
      const src = readFileSync(new URL(naam, MAP), 'utf8')
      expect(src, `${naam} rolt nog alles in één keer uit`).not.toMatch(/--only hosting\s*$/m)
      expect(src).toMatch(/--only hosting:app/)
      expect(src).toMatch(/--only hosting:verhuur[^\n]*\\\n\s*\|\| echo "::warning::/)
    }
  })
})
