import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Het merk staat op drie plekken: in `public/brand/je-concept-logo.svg` (het
 * volledige logo, zoals het aangeleverd is), in `public/favicon.svg` (de
 * verkleining, zonder letters en met een zwaardere lijn) en in
 * `src/components/ds/index.jsx` (dezelfde verkleining, inline, zodat ze
 * `currentColor` volgt en geen aanvraag kost).
 *
 * Die drie mogen niet uit elkaar lopen. Deze test legt de zeshoeken naast
 * elkaar: dezelfde zes hoekpunten, uit hetzelfde bestand.
 */

const lees = (pad) => readFileSync(new URL(`../${pad}`, import.meta.url), 'utf8')

/**
 * De zes hoekpunten van een pad, als getallen.
 *
 * Afgerond op twee decimalen: de verkleining is met zes significante cijfers
 * geschreven en het origineel met acht (`303.469` tegen `303.46875`). Op een
 * tekening van 375 eenheden is dat verschil kleiner dan een duizendste van een
 * pixel bij elk formaat — het is dezelfde hoek, anders opgeschreven.
 */
const punten = (d) =>
  [...d.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)].map(([, x, y]) => [
    Math.round(Number(x) * 100) / 100,
    Math.round(Number(y) * 100) / 100,
  ])

describe('het merk is overal hetzelfde', () => {
  const logo = lees('public/brand/je-concept-logo.svg')
  const favicon = lees('public/favicon.svg')
  const component = lees('src/components/ds/index.jsx')

  /* Uit het aangeleverde logo: de twee zeshoeken zijn de enige paden die kort
     genoeg zijn om geen letter te zijn. */
  const uitLogo = [...logo.matchAll(/<path[^>]*fill="(#[0-9a-fA-F]{6})"[^>]*d="([^"]*)"/g)]
    .map((m) => m[2])
    .filter((d) => d.length < 600)
    .map((d) => punten(d.split('Z')[0]))

  it('het aangeleverde logo draagt twee zeshoeken van zes punten', () => {
    expect(uitLogo).toHaveLength(2)
    for (const zeshoek of uitLogo) expect(zeshoek).toHaveLength(6)
  })

  it('de favicon tekent dezelfde twee zeshoeken', () => {
    const uitFavicon = [...favicon.matchAll(/<path d="([^"]*)"/g)].map((m) => punten(m[1]))
    expect(uitFavicon).toHaveLength(2)
    // Dezelfde punten, in dezelfde volgorde — alleen de volgorde van de twee
    // zeshoeken onderling mag verschillen (spook eerst, want hij ligt achter).
    expect(uitFavicon.map((p) => JSON.stringify(p)).sort()).toEqual(
      uitLogo.map((p) => JSON.stringify(p)).sort()
    )
  })

  it('en de component draagt dezelfde, inline', () => {
    const uitComponent = [...component.matchAll(/(hoofd|spook): '([^']*)'/g)].map((m) => punten(m[2]))
    expect(uitComponent).toHaveLength(2)
    expect(uitComponent.map((p) => JSON.stringify(p)).sort()).toEqual(
      uitLogo.map((p) => JSON.stringify(p)).sort()
    )
  })
})

describe('de kleuren van het merk', () => {
  const logo = lees('public/brand/je-concept-logo.svg')
  const ds = lees('src/styles/je-ds.css')

  it('het systeem draagt de inkt die in het logo staat', () => {
    expect(logo).toContain('#003366')
    expect(/--navy-800:\s*#003366/i.test(ds)).toBe(true)
  })

  it('en het bleke blauw van de tweede zeshoek', () => {
    expect(logo).toContain('#d5e2f1')
    expect(/--navy-100:\s*#D5E2F1/i.test(ds)).toBe(true)
  })

  it('de haarlijnen zijn diezelfde inkt, als getallen', () => {
    // #003366 = 0, 51, 102. Stond op 0,48,96 — dat is #003060, de kleur die
    // ernaast geschat was toen het logo nog niet in de repo zat.
    expect(ds).toContain('rgba(0,51,102,')
    expect(ds).not.toContain('rgba(0,48,96,')
  })
})
