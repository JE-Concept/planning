/**
 * De stand van een bericht per verwerker, en wanneer er herkanst wordt.
 *
 * Zonder één import, zodat `tests/messaging.test.js` deze regels kan
 * nalopen. De trigger, de geplande herkansing en de herspeelknop in
 * `messaging-verwerking.js` lezen allemaal hier wat ze mogen doen, zodat er
 * één antwoord is op "wordt dit bericht nog eens geprobeerd".
 */

/** Na zoveel mislukte pogingen stopt de herkansing en krijgen de beheerders het te horen. */
export const MAX_POGINGEN = 3
/** Ouder dan dit wordt niet meer herkanst; wie het dan nog wil, herspeelt met de hand. */
export const HERKANSING_DAGEN = 7
/** De verwerkers die er zijn, in de volgorde waarin het scherm ze toont. */
export const VERWERKERS = ['event']

const ms = (t) => (t?.toDate ? t.toDate().getTime() : t instanceof Date ? t.getTime() : typeof t === 'number' ? t : null)

export const standVan = (bericht, verwerker) => bericht?.verwerking?.[verwerker] ?? null

/** Mislukt, en al zo vaak dat we het opgeven tot iemand ernaar kijkt. */
export function isVastgelopen(bericht, verwerker) {
  const s = standVan(bericht, verwerker)
  return s?.stand === 'fout' && (s.pogingen ?? 0) >= MAX_POGINGEN
}

/**
 * Mag de geplande herkansing dit bericht nog eens proberen? Alleen wat op
 * `fout` staat, nog niet vastgelopen is en jong genoeg is. Een bericht
 * zonder stand is nog nooit bekeken; dat is voor de trigger, niet voor de
 * herkansing — anders raken die twee elkaar op hetzelfde document.
 */
export function herkansbaar(bericht, verwerker, nu = Date.now()) {
  const s = standVan(bericht, verwerker)
  if (!s || s.stand !== 'fout') return false
  if ((s.pogingen ?? 0) >= MAX_POGINGEN) return false
  const ontvangen = ms(bericht.ontvangen)
  if (ontvangen !== null && nu - ontvangen > HERKANSING_DAGEN * 86400000) return false
  return true
}

/** Eén regel over het bericht, voor een melding of een logregel. */
export function samenvatting(bericht) {
  const wie = bericht?.inhoud?.naam || bericht?.inhoud?.email || ''
  return `${bericht?.bron ?? '?'} · ${bericht?.soort ?? '?'} · ${bericht?.sleutel ?? '?'}${wie ? ` · ${wie}` : ''}`
}
