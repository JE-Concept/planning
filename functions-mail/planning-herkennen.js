/**
 * Is deze bijlage misschien de planningsexport uit AAPI?
 *
 * ── Waarom dit apart staat ────────────────────────────────────────────────
 * Zonder imports, zodat een test het kan nakijken zonder firebase-admin — die
 * staat in CI niet geïnstalleerd voor deze codebase. Dezelfde reden waarom
 * `functions/herhaling-datum.js` apart staat; zie daar.
 *
 * ── Waarom "misschien" ────────────────────────────────────────────────────
 * Meer dan dit kan deze kant niet weten. De lezer die kan zien of het blad
 * "Data" erin zit met de juiste kolommen, staat in `functions/` en is van
 * hieruit niet te bereiken. Dus kijkt dit alleen of het een spreadsheet is van
 * een redelijke omvang; de andere kant beslist of het er echt een is.
 *
 * Op bestandsnaam of onderwerp filteren zou raden zijn, en dan importeert de
 * tool niets omdat iemand het bestand anders genoemd heeft.
 */

/** Groter dan dit is geen planningsexport maar iets anders. De maand oktober was 15 kB. */
export const MAX_BYTES = 8 * 1024 * 1024

export function lijktOpPlanning(bijlage) {
  const grootte = bijlage?.content?.length ?? bijlage?.size ?? 0
  if (!grootte || grootte > MAX_BYTES) return false

  const naam = String(bijlage?.filename ?? '').toLowerCase()
  const type = String(bijlage?.contentType ?? '').toLowerCase()
  return naam.endsWith('.xlsx') || type.includes('spreadsheetml')
}
