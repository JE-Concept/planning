/**
 * Wie er op een event staat, en in welke rol.
 *
 * Er waren twee soorten mensen op één veld beland. "Toegewezen aan" was een
 * rijtje vinkjes waar zowel de verantwoordelijke als de ploeg in stond, en dan
 * weet niemand meer wie het dossier draagt: bij vijf vinkjes is iedereen
 * verantwoordelijk en dus niemand.
 *
 * Nu zijn het twee dingen:
 *
 * - **Verantwoordelijk** — precies één persoon, en wat `assignees` altijd al
 *   was. De naam van het veld blijft, want eraan hangen de meldingen, de
 *   werklast, het logboek en de business rules; die gaan allemaal over wie het
 *   dossier draagt. Alleen staat er voortaan één naam in.
 * - **Medewerkers** — wie er komt werken. Een eigen veld, want het is een
 *   andere vraag: zij krijgen geen meldingen over de offerte en tellen niet mee
 *   in de werklast, ze staan op het rooster.
 *
 * Dat tweede veld wordt sinds de AAPI-koppeling niet meer geschreven. Wie er
 * komt werken staat in AAPI, en twee antwoorden op die vraag lopen uit elkaar
 * zodra iemand er maar één bijwerkt — met loon eraan is dat geen detail. De
 * lezer blijft, want de rijen van vóór die beslissing staan er nog, en het
 * scherm "mijn events" van een medewerker hangt eraan.
 *
 * Dit staat los van de schermen zodat "één verantwoordelijke" een eigenschap
 * van de gegevens is en niet van een keuzelijstje.
 */

/** Wie het dossier draagt, of niemand. */
export function verantwoordelijkeVan(ev) {
  return (ev?.assignees ?? []).filter(Boolean)[0] ?? null
}

/** Wie er komt werken. */
export function medewerkersVan(ev) {
  return (ev?.medewerkers ?? []).filter(Boolean)
}

/**
 * De patch die één verantwoordelijke zet.
 *
 * Een lijst en geen los veld, want dat is wat er in de databank staat en wat
 * alle bestaande vragen erop verwachten. Leeg betekent niemand, en dat mag:
 * een aanvraag die net binnenkomt heeft nog geen eigenaar.
 */
export function zetVerantwoordelijke(id) {
  return { assignees: id ? [id] : [] }
}

/**
 * Wie er op een eventkaart komt te staan.
 *
 * Alleen de verantwoordelijke. De ploeg hoort hier niet: op een kaart van
 * tweehonderd pixels is "wie moet ik hierover aanspreken" de enige vraag die
 * past, en acht gezichtjes beantwoorden die niet.
 */
export function kaartMensen(ev) {
  const wie = verantwoordelijkeVan(ev)
  return wie ? [wie] : []
}
