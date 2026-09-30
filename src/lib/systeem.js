/**
 * Doet de tool nog wat ze hoort te doen?
 *
 * Het oordeel staat hier en niet bij het scherm, om dezelfde reden als al het
 * andere rekenwerk in deze map: zo is het na te rekenen zonder browser en
 * zonder database, en staat er één plek waar "hoe lang is te lang" gedefinieerd
 * is. Het scherm hangt er alleen een kleur aan.
 */

/** Hoe lang de ophaler van de post mag zwijgen voor het een probleem is. */
export const STIL_NA_UREN = 6

/**
 * Wat er aan de hand is, in woorden waar een scherm iets mee kan.
 *
 * `nooit` is met opzet iets anders dan `stil`: nog nooit gedraaid betekent dat
 * de sleutel er nog niet is, en dat is een taak en geen storing. Daar hoort
 * geen alarm bij, wel een zin die zegt wat er nog moet gebeuren.
 */
export function oordeel({ postvak = null, mislukt = [], nu = new Date() } = {}) {
  const laatste = postvak?.laatsteKeer?.toDate?.() ?? (postvak?.laatsteKeer ? new Date(postvak.laatsteKeer) : null)
  const urenStil = laatste ? (nu - laatste) / 3600000 : null
  const postStaat = laatste == null ? 'nooit' : urenStil > STIL_NA_UREN ? 'stil' : 'goed'

  return {
    postStaat,
    urenStil: urenStil == null ? null : Math.floor(urenStil),
    mislukteMails: mislukt.length,
    // Eén woord voor het geheel: dat is wat er als badge op het scherm komt.
    stand: postStaat === 'stil' || mislukt.length > 0 ? 'let_op' : postStaat === 'nooit' ? 'onbekend' : 'goed',
  }
}
