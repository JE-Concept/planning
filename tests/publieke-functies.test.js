import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Functies die zonder login bereikbaar moeten blijven, ook na de volgende uitrol.
 *
 * Een functie met `invoker: 'private'` zet elke uitrol terug op "Require
 * authentication". Voor `verhuur` zette de workflow ze daarna niet opnieuw
 * publiek, en rental.jeconcept.be kreeg een 403 op /api/verhuur/aanbod: een
 * lege etalage, zonder dat er één test rood werd. Deze test legt vast dat elke
 * publieke functie ofwel zelf `public` is, ofwel in beide workflows weer
 * publiek gezet wordt.
 */

const lees = (pad) => readFileSync(new URL(`../${pad}`, import.meta.url), 'utf8')
const ci = lees('.github/workflows/ci.yml')
const goLive = lees('.github/workflows/go-live.yml')

// De Cloud Run-dienst heet zoals de functie, in kleine letters.
const PUBLIEK = {
  verhuur: 'functions/verhuur.js',
  agenda: 'functions/agenda.js',
  portaal: 'functions/portaal.js',
}

describe('publieke functies blijven publiek', () => {
  it('verhuur staat in de code op public', () => {
    expect(lees('functions/verhuur.js')).toMatch(/invoker: 'public'/)
  })

  for (const [dienst, bestand] of Object.entries(PUBLIEK)) {
    it(`${dienst}: public in de code, of na elke uitrol opnieuw publiek gezet`, () => {
      const inCode = /invoker: 'public'/.test(lees(bestand))
      const inCi = new RegExp(`add-iam-policy-binding ${dienst} `).test(ci)
      const inGoLive = new RegExp(`for dienst in [^;]*\\b${dienst}\\b`).test(goLive)
      expect(inCode || (inCi && inGoLive), `${dienst}: code=${inCode} ci=${inCi} go-live=${inGoLive}`).toBe(true)
      // Het vangnet staat er voor elke publieke functie, ook als de code al public is.
      expect(inCi, `${dienst} ontbreekt in ci.yml`).toBe(true)
      expect(inGoLive, `${dienst} ontbreekt in go-live.yml`).toBe(true)
    })
  }

  it('de betaalfuncties zijn public in de code', () => {
    const betaling = lees('functions-betaling/index.js')
    expect(betaling.match(/invoker: 'public'/g)).toHaveLength(2)
  })
})
