import { readFileSync } from 'node:fs'

/**
 * De Content-Security-Policy van een hosting-target, zoals ze in firebase.json
 * staat, voor de browsertests.
 *
 * De tests serveren de bouw met een eigen servertje, en dat stuurde geen
 * enkele header mee. Een CSP die een script of een lettertype weigert, bleef
 * daardoor onzichtbaar tot ze live stond. Nu zetten de tests precies de policy
 * uit firebase.json, en een weigering valt als fout in de console, waar elke
 * test al op let.
 *
 * Staat ze live nog als `Report-Only` (de backoffice, tot een week zonder
 * meldingen bewezen heeft dat ze klopt), dan dwingen de tests ze tóch af: een
 * test die alleen rapporteert, merkt niemand.
 */
export function cspVoor(target) {
  const firebase = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'))
  const hosting = firebase.hosting.find((h) => h.target === target)
  const kop = hosting?.headers
    ?.flatMap((h) => h.headers)
    .find((h) => h.key === 'Content-Security-Policy' || h.key === 'Content-Security-Policy-Report-Only')
  if (!kop) throw new Error(`Geen Content-Security-Policy voor hosting-target ${target} in firebase.json`)
  return kop.value
}
