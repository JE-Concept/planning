import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Elke codebase kan onder een eigen serviceaccount draaien (functions/runtime.js
 * en de vier zussen). Dat werkt alleen als `runtime.js` de eerste import van
 * index.js is: een functie die vóór setGlobalOptions gedefinieerd wordt, draait
 * stilletjes nog als het standaard compute-account, met Editor op alles. En
 * elke codebase moet haar eigen variabele lezen, die de uitrol ook zet.
 */

const CODEBASES = {
  functions: 'JEPLAN_SA_DEFAULT',
  'functions-mail': 'JEPLAN_SA_MAIL',
  'functions-meetings': 'JEPLAN_SA_MEETINGS',
  'functions-betaling': 'JEPLAN_SA_BETALING',
  'functions-messaging': 'JEPLAN_SA_MESSAGING',
}
const lees = (pad) => readFileSync(new URL(`../${pad}`, import.meta.url), 'utf8')

describe('een eigen serviceaccount per codebase', () => {
  for (const [map, variabele] of Object.entries(CODEBASES)) {
    it(`${map}: runtime.js is de eerste import en leest ${variabele}`, () => {
      const eersteImport = lees(`${map}/index.js`).split('\n').find((r) => r.startsWith('import '))
      expect(eersteImport).toBe("import './runtime.js'")
      expect(lees(`${map}/runtime.js`)).toContain(`process.env.${variabele}`)
    })
  }

  it('de uitrol zet elke variabele, in beide workflows', () => {
    for (const workflow of ['.github/workflows/ci.yml', '.github/workflows/go-live.yml']) {
      const tekst = lees(workflow)
      for (const variabele of Object.values(CODEBASES)) {
        expect(tekst, `${variabele} in ${workflow}`).toContain(`${variabele}: \${{ vars.${variabele} }}`)
      }
    }
  })
})
