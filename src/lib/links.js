/**
 * Links in een stuk tekst herkennen.
 *
 * ── Waarom niet één grote reguliere expressie ─────────────────────────────
 * Omdat het einde van een link niet in een patroon te vangen is. Een punt kan
 * bij de link horen (`jeconcept.be/offerte.pdf`) of bij de zin ("kijk eens op
 * jeconcept.be."). Een haakje ook: Wikipedia-adressen dragen er een, en een
 * link tussen haakjes in een zin niet. Dus: eerst ruim pakken, dan de staart
 * terugknippen volgens wat mensen schrijven.
 *
 * ── Waarom alleen http en https ───────────────────────────────────────────
 * Een notitie is tekst die iemand anders aanklikt. `javascript:` en `data:`
 * horen daar niet bij en zijn precies de twee die je niet wil, en `mailto:`
 * maakt van elk e-mailadres in een zin een knop. Wie een adres wil mailen,
 * kopieert het.
 */

// Ruim: tot aan de eerste witruimte. Het terugknippen gebeurt hieronder.
const RUIM = /\bhttps?:\/\/[^\s<>"']+/gi

// Leestekens die vaker bij de zin horen dan bij de link.
const STAART = /[.,;:!?]+$/

const PAREN = [['(', ')'], ['[', ']'], ['{', '}']]
const telt = (tekst, teken) => tekst.split(teken).length - 1

/**
 * De staart die bij de zin hoort en niet bij de link.
 *
 * Leestekens eraf, en een sluithaakje alleen wanneer er geen openend haakje
 * tegenover staat: `…_(film)` hoort erbij, `(zie https://…)` niet. Daarna nog
 * eens de leestekens, want "…)." laat er twee achter.
 */
function knipStaart(ruw) {
  let uit = ruw.replace(STAART, '')
  let korter = true
  while (korter) {
    korter = false
    for (const [open, dicht] of PAREN) {
      if (uit.endsWith(dicht) && telt(uit, dicht) > telt(uit, open)) {
        uit = uit.slice(0, -1).replace(STAART, '')
        korter = true
      }
    }
  }
  return uit
}

/** Elke link in de tekst, in volgorde en zonder dubbels. */
export function linksIn(tekst) {
  const uit = []
  for (const [ruw] of (tekst ?? '').matchAll(RUIM)) {
    const link = knipStaart(ruw)
    if (link.length > 'https://'.length && !uit.includes(link)) uit.push(link)
  }
  return uit
}

/**
 * De tekst opgeknipt langs de links, zodat het scherm ze anders kan tekenen.
 *
 * Dezelfde vorm als `stukken` in `@lib/vermelding`, zodat de twee na elkaar
 * gedraaid kunnen worden zonder dat de oproeper twee soorten lijsten kent.
 */
export function stukkenMetLinks(tekst) {
  const bron = tekst ?? ''
  const uit = []
  let vorige = 0

  for (const match of bron.matchAll(RUIM)) {
    const link = knipStaart(match[0])
    if (link.length <= 'https://'.length) continue
    if (match.index > vorige) uit.push({ soort: 'tekst', tekst: bron.slice(vorige, match.index) })
    uit.push({ soort: 'link', tekst: link, href: link })
    vorige = match.index + link.length
  }
  if (vorige < bron.length) uit.push({ soort: 'tekst', tekst: bron.slice(vorige) })
  return uit
}

/**
 * Een adres zoals het op een kaartje staat: zonder schema en zonder `www.`.
 *
 * Een voorbeeldkaartje toont waar je terechtkomt, niet het volledige adres —
 * dat is vaak honderd tekens lang en zegt niets.
 */
export function hostNetjes(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
