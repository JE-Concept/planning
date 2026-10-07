import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * HTTP-functies blijven publiek, ook na de volgende uitrol.
 *
 * Een functie met `invoker: 'private'` zet elke uitrol terug op "Require
 * authentication". Voor `verhuur` zette de workflow ze daarna niet opnieuw
 * publiek, en rental.jeconcept.be kreeg een 403 op /api/verhuur/aanbod: een
 * lege etalage, zonder dat er één test rood werd. Voor `drive` gold hetzelfde.
 *
 * Elke `onRequest` in elke codebase wordt van buiten aangeroepen (Hosting, een
 * agenda-app, Stripe, een andere site): geen enkele heeft een Google-identiteit
 * bij zich. Dus: elke `onRequest` zegt zelf `invoker: 'public'`, en wie toegang
 * krijgt, beslist de functie (token, sleutel in het adres, handtekening).
 * Daarbovenop zet de workflow de functies uit de standaardcodebase nog eens
 * publiek, als vangnet.
 */

const lees = (pad) => readFileSync(new URL(`../${pad}`, import.meta.url), 'utf8')
const CODEBASES = ['functions', 'functions-mail', 'functions-meetings', 'functions-betaling', 'functions-messaging']

/** Elke onRequest( … ) met zijn optieblok, per bestand. */
function httpFuncties() {
  const uit = []
  for (const map of CODEBASES) {
    for (const naam of readdirSync(new URL(`../${map}`, import.meta.url))) {
      if (!naam.endsWith('.js')) continue
      const tekst = lees(`${map}/${naam}`)
      // Alles tussen `onRequest(` en de handler: daar staan de opties.
      for (const m of tekst.matchAll(/onRequest\(([\s\S]*?)\basync\b/g)) {
        // Commentaar weg: daarin mag het woord private gerust nog staan.
        const opties = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
        uit.push({ plek: `${map}/${naam}`, opties })
      }
    }
  }
  return uit
}

const ci = lees('.github/workflows/ci.yml')
const goLive = lees('.github/workflows/go-live.yml')
// De Cloud Run-diensten uit de standaardcodebase die van buiten komen.
const VANGNET = ['verhuur', 'agenda', 'portaal', 'drive']

describe('publieke HTTP-functies', () => {
  const functies = httpFuncties()

  it('vindt de HTTP-functies (anders test dit niets)', () => {
    expect(functies.length).toBeGreaterThanOrEqual(7)
  })

  for (const { plek, opties } of httpFuncties()) {
    it(`${plek}: zegt zelf invoker: 'public'`, () => {
      expect(opties).toMatch(/invoker:\s*'public'/)
      expect(opties).not.toMatch(/invoker:\s*'private'/)
    })
  }

  for (const dienst of VANGNET) {
    it(`${dienst}: de uitrol zet ze daarna nog eens publiek, in beide workflows`, () => {
      expect(ci, `${dienst} ontbreekt in ci.yml`).toMatch(new RegExp(`add-iam-policy-binding ${dienst} `))
      expect(goLive, `${dienst} ontbreekt in go-live.yml`).toMatch(new RegExp(`for dienst in [^;]*\\b${dienst}\\b`))
    })
  }
})
