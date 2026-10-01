/**
 * Wat AAPI schrijft, en wat wij ervan maken.
 *
 * De export is rommelig op precies de manieren waarop een invoerveld rommelig
 * wordt: "ANNELEEN COENEN" naast "Herman  Van Ormelingen" naast
 * "Jasper Hansen " met een spatie erachter. Dat is geen fout van AAPI — het is
 * wat mensen typen — maar een lijst waarin dezelfde persoon drie keer anders
 * staat, leest niet.
 *
 * Twee regels die hier door alles heen lopen:
 *
 *  1. **Normaliseren is voor het scherm, nooit om op te matchen.** Wie we zijn
 *     bepalen de GUID's uit AAPI; de naam is een label. Zodra je op namen gaat
 *     matchen, versmelten twee mensen die toevallig hetzelfde heten.
 *  2. **De ruwe waarde blijft bewaard.** Verandert AAPI ooit zijn schrijfwijze,
 *     dan is na te kijken wat er écht stond.
 *
 * Geen imports: dit moet te testen zijn zonder de rest.
 */

/** Spaties opruimen: geen dubbele, niets ervoor of erna. */
export const inEenAdem = (tekst) => String(tekst ?? '').replace(/\s+/g, ' ').trim()

/**
 * Een naam zoals je hem op een kaartje wil zien.
 *
 * Per woord de eerste letter groot, en ook na een koppelteken of een
 * apostrof — "jean-pierre" wordt "Jean-Pierre" en "d'hondt" wordt "D'Hondt".
 *
 * Tussenvoegsels blijven hoofdletter: "Van Ormelingen", niet "van Ormelingen".
 * Dat is de Belgische schrijfwijze van een familienaam die met Van begint, en
 * het is ook hoe het in AAPI staat — en wij zijn hier niet de instantie die
 * beslist hoe iemands naam gespeld wordt.
 */
export function naamNetjes(ruw) {
  return inEenAdem(ruw)
    .toLocaleLowerCase('nl-BE')
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, voor, letter) => voor + letter.toLocaleUpperCase('nl-BE'))
}

/** De afdelingen zoals wij ze noemen. De volgorde is die van de kalender. */
export const AFDELINGEN = ['bar', 'zaal', 'keuken', 'evenementen']

/** De afdeling waar de eventkoppeling voor geldt. */
export const EVENEMENTEN = 'evenementen'

/**
 * `Evenementen 🪩` → `evenementen`.
 *
 * AAPI zet een emoji achter elke afdelingsnaam. Die hoort bij het scherm van
 * AAPI en niet bij de gegevens, dus gaat alles weg wat geen letter is. Een
 * afdeling die we niet kennen houdt zijn eigen naam in kleine letters: hij
 * verschijnt dan gewoon in de kalender in plaats van stilletjes bij een
 * verkeerde groep te belanden.
 */
export function afdelingVan(ruw) {
  const kaal = inEenAdem(String(ruw ?? '').replace(/[^\p{L}\s-]/gu, '')).toLocaleLowerCase('nl-BE')
  return kaal || null
}

/**
 * Het statuut waaronder iemand werkt.
 *
 * `Dimona Type` is leeg bij `Planning Type: EXTERNAL` — dat is iemand zonder
 * Dimona, meestal een zelfstandige die rechtstreeks factureert. Die krijgt
 * `extern` en niet "onbekend": het is een bekend geval, geen gat.
 */
const STATUTEN = {
  OTH: 'vast',
  STU_COT: 'student',
  FLX_DAY: 'flexi',
  INDEPENDENT: 'zelfstandig',
}

export function statuutVan(dimonaType, planningType) {
  const sleutel = inEenAdem(dimonaType).toUpperCase()
  if (STATUTEN[sleutel]) return STATUTEN[sleutel]
  if (inEenAdem(planningType).toUpperCase() === 'EXTERNAL') return 'extern'
  return sleutel ? sleutel.toLowerCase() : 'onbekend'
}

/** `True` / `False` als tekst, zoals AAPI ze schrijft. */
export function booleanVan(ruw) {
  const tekst = inEenAdem(ruw).toLowerCase()
  if (tekst === 'true' || tekst === '1') return true
  if (tekst === 'false' || tekst === '0' || tekst === '') return false
  return null
}

/** Pauze in minuten. Leeg is geen pauze; onzin is geen getal en geen nul. */
export function minutenVan(ruw) {
  const tekst = inEenAdem(ruw)
  if (tekst === '') return 0
  const n = Number(tekst)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}
