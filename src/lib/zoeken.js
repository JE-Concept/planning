/**
 * Het rangschikken van zoekresultaten over verschillende soorten.
 *
 * De zoekbalk kijkt in taken, events, klanten, mensen en de verslagen van het
 * teamoverleg. Dat zijn ongelijke stapels: er zijn honderden taken en een
 * handvol verslagen. Sorteer je die op één hoop, dan duwen de taken de rest
 * eruit en lijkt het alsof er geen verslag over "Blum" bestaat — terwijl het er
 * wel is. Dat is het soort fout dat stil blijft: niemand meldt een resultaat
 * dat hij niet gezien heeft.
 *
 * Vandaar de twee regels hieronder die de hele module dragen:
 *  - per soort een plafond, zodat één stapel de lijst niet overneemt;
 *  - elke soort die iets vond, houdt minstens één plaats, ook als de lijst vol is.
 *
 * Het staat hier en niet in het component omdat het te testen moet zijn zonder
 * browser: zie tests/zoeken.test.js.
 */

/** Zonder accenten en hoofdletters — "Coenen" moet "coënen" vinden en omgekeerd. */
export function normaliseer(tekst) {
  return (tekst ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** De woorden waarop gezocht wordt; lege invoer geeft een lege lijst. */
export function woorden(vraag) {
  return normaliseer(vraag).split(/\s+/).filter(Boolean)
}

/**
 * Hoe goed één woord in één stuk tekst past, van 0 (niet) tot 1 (precies dat).
 *
 * De trap is grof met opzet. Wie "blum" typt, bedoelt de klant Blum en niet de
 * taak "Tafelschikking Blum doorgeven" — een treffer vooraan telt daarom
 * zwaarder dan een treffer ergens in het midden. Verder onderscheid (hoeveel
 * letters ertussen staan, hoe kort de tekst is) maakt de volgorde grilliger in
 * plaats van beter.
 */
export function scoreTekst(tekst, woord) {
  const t = normaliseer(tekst)
  if (!t || !woord) return 0
  if (t === woord) return 1
  if (t.startsWith(woord)) return 0.85
  // Op een woordgrens: "niels" in "Trouw Niels en Inez" telt als vooraan.
  if (new RegExp(`(^|[\\s\\-—·/(,.])${woord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return 0.7
  if (t.includes(woord)) return 0.45
  return 0
}

/** De titel weegt het zwaarst; wat eronder staat helpt vinden, niet ordenen. */
const GEWICHT_EXTRA = 0.6

/**
 * De score van één kandidaat: `{ titel, extra: [...], soort, gewicht }`.
 *
 * Elk getypt woord moet érgens terechtkomen — "blum kerst" hoort alleen de
 * kerstborrel van Blum te geven, niet alles van Blum en alles met kerst. De
 * uiteindelijke score is de zwakste schakel, want dat woord bepaalt hoe goed
 * het geheel past.
 */
export function scoreKandidaat(kandidaat, vraagwoorden) {
  if (!vraagwoorden.length) return 0

  let zwakste = 1
  for (const woord of vraagwoorden) {
    const inTitel = scoreTekst(kandidaat.titel, woord)
    let beste = inTitel
    for (const stuk of kandidaat.extra ?? []) {
      beste = Math.max(beste, scoreTekst(stuk, woord) * GEWICHT_EXTRA)
    }
    if (beste === 0) return 0
    zwakste = Math.min(zwakste, beste)
  }
  return zwakste
}

/**
 * Sorteren op score, met een vaste tiebreaker.
 *
 * Zonder die tiebreaker wisselt de volgorde van gelijk scorende resultaten met
 * de volgorde waarin Firestore ze toevallig teruggaf, en dan springt de
 * selectie onder je vinger weg terwijl je met de pijltjes naar beneden gaat.
 */
function vergelijk(a, b) {
  if (b.score !== a.score) return b.score - a.score
  if ((b.gewicht ?? 0) !== (a.gewicht ?? 0)) return (b.gewicht ?? 0) - (a.gewicht ?? 0)
  return normaliseer(a.titel).localeCompare(normaliseer(b.titel), 'nl')
}

/**
 * De ranglijst over alle soorten heen.
 *
 * `perSoort` is het plafond per stapel, `totaal` dat van de hele lijst. Snijdt
 * `totaal` een soort er helemaal af terwijl ze wél iets vond, dan krijgt haar
 * beste treffer alsnog een plaats: liever één regel te veel dan een gebruiker
 * die denkt dat het verslag niet bestaat.
 */
export function rangschik(kandidaten, vraag, { perSoort = 4, totaal = 14 } = {}) {
  const vraagwoorden = woorden(vraag)
  if (!vraagwoorden.length) return []

  const gescoord = []
  for (const kandidaat of kandidaten) {
    const score = scoreKandidaat(kandidaat, vraagwoorden)
    if (score > 0) gescoord.push({ ...kandidaat, score })
  }
  gescoord.sort(vergelijk)

  const perStapel = new Map()
  const gekozen = []
  for (const resultaat of gescoord) {
    const n = perStapel.get(resultaat.soort) ?? 0
    if (n >= perSoort) continue
    perStapel.set(resultaat.soort, n + 1)
    gekozen.push(resultaat)
  }

  if (gekozen.length <= totaal) return gekozen

  const binnen = gekozen.slice(0, totaal)
  const getoond = new Set(binnen.map((r) => r.soort))
  for (const resultaat of gekozen.slice(totaal)) {
    if (getoond.has(resultaat.soort)) continue
    getoond.add(resultaat.soort)
    binnen.push(resultaat)
  }
  return binnen.sort(vergelijk)
}

/**
 * De ranglijst in kopjes, in een vaste volgorde.
 *
 * Vast, want de kopjes mogen niet van plek wisselen terwijl iemand typt — dan
 * klikt hij op "Klanten" en staat daar ineens een verslag.
 */
export function groepeer(resultaten, volgorde = []) {
  const per = new Map()
  for (const resultaat of resultaten) {
    if (!per.has(resultaat.soort)) per.set(resultaat.soort, [])
    per.get(resultaat.soort).push(resultaat)
  }

  const soorten = [...volgorde.filter((s) => per.has(s)), ...[...per.keys()].filter((s) => !volgorde.includes(s))]
  return soorten.map((soort) => [soort, per.get(soort)])
}
