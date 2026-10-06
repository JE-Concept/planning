/**
 * De stand van een bericht per verwerker, en wanneer er herkanst wordt.
 *
 * Zonder één import, zodat `tests/messaging.test.js` deze regels kan
 * nalopen. De verwerker op de bus, de geplande herkansing en de herspeelknop
 * in `messaging-verwerking.js` lezen allemaal hier wat ze mogen doen, zodat er
 * één antwoord is op "wordt dit bericht nog eens geprobeerd".
 */

/** Na zoveel mislukte pogingen stopt de herkansing en krijgen de beheerders het te horen. */
export const MAX_POGINGEN = 3
/** Ouder dan dit wordt niet meer herkanst; wie het dan nog wil, herspeelt met de hand. */
export const HERKANSING_DAGEN = 7
/**
 * Hoe lang de herkansing wacht na de zoveelste mislukking: 5 minuten, dan 15.
 * Exponentieel, zodat een storing die even duurt niet drie pogingen in één
 * minuut opslorpt, en een hapering van een minuut toch snel opgelost is.
 */
export const WACHTTIJD_MINUTEN = (pogingen) => 5 * 3 ** Math.max(0, (pogingen ?? 1) - 1)
/** Een rij die de relay na zoveel minuten nog niet op de bus zette, zet de herkansing er zelf op. */
export const RELAY_MINUTEN = 2
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
 * Mag de geplande herkansing dit bericht nog eens op de bus zetten? Alleen wat
 * op `fout` staat, nog niet vastgelopen is, jong genoeg is en lang genoeg
 * gewacht heeft (WACHTTIJD_MINUTEN). Een bericht zonder stand is nog nooit
 * bekeken; dat is voor de relay, niet voor de herkansing.
 */
export function herkansbaar(bericht, verwerker, nu = Date.now()) {
  const s = standVan(bericht, verwerker)
  if (!s || s.stand !== 'fout') return false
  if ((s.pogingen ?? 0) >= MAX_POGINGEN) return false
  const ontvangen = ms(bericht.ontvangen)
  if (ontvangen !== null && nu - ontvangen > HERKANSING_DAGEN * 86400000) return false
  // Nog niet lang genoeg gewacht sinds de vorige mislukking.
  const vorige = ms(s.op)
  if (vorige !== null && nu - vorige < WACHTTIJD_MINUTEN(s.pogingen) * 60000) return false
  return true
}

/**
 * Moet de herkansing deze rij zelf op de bus zetten? Alleen als ze nog op
 * `wacht` staat en de relay ruim de tijd had: anders publiceren die twee
 * hetzelfde bericht om het even.
 */
export function wachtOpDeBus(rij, nu = Date.now()) {
  if (rij?.bus?.stand !== 'wacht') return false
  const ontvangen = ms(rij.ontvangen)
  if (ontvangen === null) return true
  if (nu - ontvangen > HERKANSING_DAGEN * 86400000) return false
  return nu - ontvangen >= RELAY_MINUTEN * 60000
}

/** Eén regel over het bericht, voor een melding of een logregel. */
export function samenvatting(bericht) {
  const wie = bericht?.inhoud?.naam || bericht?.inhoud?.email || ''
  return `${bericht?.bron ?? '?'} · ${bericht?.soort ?? '?'} · ${bericht?.sleutel ?? '?'}${wie ? ` · ${wie}` : ''}`
}
