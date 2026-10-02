/**
 * Wanneer een event van het bord af mag — de serverkant.
 *
 * ── Waarom dit er twee keer staat ─────────────────────────────────────────
 * Dezelfde regel staat in `src/lib/archief.js`, want het scherm moet hem ook
 * kennen. Importeren kan niet: `functions/` wordt apart verpakt en uitgerold
 * en kan niets uit `src/` halen. Dus staan ze naast elkaar, en bewaakt
 * `tests/archief.test.js` dat ze hetzelfde zeggen — zoals de rollentabel en
 * `demo/regels.js` dat ook doen.
 *
 * Geen imports, zodat die test kan draaien zonder firebase-admin; dat staat in
 * CI voor deze codebase niet geïnstalleerd. Zie `herhaling-datum.js`.
 *
 * ── Waarom de server dit nu beslist en niet de browser ────────────────────
 * Het stond alleen in de browser, en dus moest die eerst élk event ophalen —
 * ook het trouwfeest van twee jaar geleden — om er daarna de helft van te
 * verbergen. Dat werkt bij tachtig events en niet bij vijfhonderd: een tragere
 * start, meer geheugen op een telefoon, en Firestore rekent per gelezen
 * document, elke keer dat iemand de app opent.
 *
 * Nu schrijft de server het antwoord op het document (`afgesloten`), en vraagt
 * de app alleen nog wat er níét op staat.
 */

export const ARCHIEF_NA_DAGEN = 60

const DAG = 86400000

const alsDatum = (waarde) => {
  if (!waarde) return null
  const d = waarde.toDate?.() ?? (waarde instanceof Date ? waarde : new Date(waarde))
  return d && !Number.isNaN(d.getTime()) ? d : null
}

/** De datum waarop dit event "voorbij" is: de laatste eventdag, anders de deadline. */
export function afsluitDatum(event) {
  const begin = alsDatum(event?.eventDate)
  const einde = alsDatum(event?.eventEndDate)
  // De láátste dag: een festival van drie dagen is niet voorbij omdat het
  // begonnen is. Een einddatum vóór de begindag is onzin en telt niet mee.
  const dag = begin && einde ? (einde < begin ? begin : einde) : (begin ?? einde)
  return dag ?? alsDatum(event?.completedAt) ?? alsDatum(event?.dueDate) ?? null
}

/**
 * Hoort dit event in het archief?
 *
 * Twee manieren, want "klaar" gebeurt op twee manieren: iemand sluit het
 * bewust af (`complete`), of er is gefactureerd en daarna kijkt niemand er nog
 * naar (`invoiced`, en de factuur is oud). `ready to invoice` staat er niet
 * tussen: daar moet nog iemand iets doen, hoe lang het er ook staat.
 */
export function isGearchiveerd(event, { nu = new Date(), naDagen = ARCHIEF_NA_DAGEN } = {}) {
  const status = (event?.statusName ?? '').toString().trim().toLowerCase()
  if (status === 'complete') return true
  if (status !== 'invoiced') return false

  const datum = afsluitDatum(event)
  // Een gefactureerd event zonder enige datum blijft staan. Liever een kaart
  // te veel op het bord dan een dossier dat wegvalt omdat er een veld leeg was.
  if (!datum) return false
  return nu.getTime() - datum.getTime() > naDagen * DAG
}

/** Het jaar waaronder een event in het archief terug te vinden is. */
export function jaarVan(event) {
  const datum = afsluitDatum(event) ?? alsDatum(event?.createdAt)
  return datum ? datum.getFullYear() : null
}

/**
 * Wat er op het document hoort te staan.
 *
 * `afgeslotenJaar` staat er alleen wanneer het event ook echt afgesloten is:
 * zo is één vraag genoeg om een jaar uit het archief te halen, zonder dat er
 * ook actieve events in dat antwoord zitten.
 */
export function archiefVelden(event, opties = {}) {
  const dicht = isGearchiveerd(event, opties)
  return { afgesloten: dicht, afgeslotenJaar: dicht ? jaarVan(event) : null }
}

/** Verschilt wat er op het document staat van wat erop hoort te staan? */
export function moetBijgewerkt(event, opties = {}) {
  const hoort = archiefVelden(event, opties)
  return (
    (event?.afgesloten ?? null) !== hoort.afgesloten
    || (event?.afgeslotenJaar ?? null) !== hoort.afgeslotenJaar
  )
}
