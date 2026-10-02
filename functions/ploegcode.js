/**
 * Aanmelden met een cijfercode, voor wie geen Google-account heeft.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * Het bureau meldt zich aan met Google. De ploeg niet: dat zijn studenten en
 * flexi's die één zaterdag per maand komen werken, vaak op een tablet achter
 * de bar, en een Google-account aanmaken om te zien hoe laat je moet beginnen
 * is een drempel waar de helft op afhaakt. Naam kiezen, vier cijfers, binnen.
 *
 * ── Wat een code wél en niet is ───────────────────────────────────────────
 * Vier cijfers zijn tienduizend mogelijkheden. Dat is genoeg om te weten wie
 * er voor je staat en te weinig om iets te beschermen wat geld waard is — en
 * dat hoeft ook niet: wie binnenkomt ziet zijn eigen uren en de events waarop
 * hij staat, geen bedragen en niemands gegevens. Wat er wél omheen moet:
 *
 *  - **Een slot na vijf misse pogingen.** Zonder dat zijn tienduizend
 *    mogelijkheden in een uur door te lopen met een script.
 *  - **Geen code die iedereen eerst probeert.** 1234, 0000, 1111 en de
 *    omgekeerde reeksen dekken samen een groot deel van wat mensen kiezen, en
 *    zijn ook het eerste wat een ander probeert.
 *
 * Alles hier is rekenwerk zonder imports, zodat de tests het kunnen nakijken
 * zonder firebase-admin — dat staat in CI voor deze codebase niet
 * geïnstalleerd. Zie `herhaling-datum.js` voor hetzelfde patroon.
 */

/** Hoeveel keer je ernaast mag zitten voor het slot dichtvalt. */
export const MAX_POGINGEN = 5

/** Hoe lang het slot dicht blijft. Lang genoeg om raden zinloos te maken. */
export const SLOT_MINUTEN = 15

/*
  Codes die niet mogen.

  Niet omdat ze zwakker zijn dan een andere vier cijfers — elke code is even
  waarschijnlijk — maar omdat ze dat juist níét zijn: dit is wat mensen kiezen
  en dus wat een ander eerst probeert. Een handvol verbieden haalt een groot
  stuk van de gokkans weg voor de prijs van één foutmelding.
*/
export const TE_VOOR_DE_HAND = [
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '2345', '3456', '4567', '5678', '6789', '0123',
  '9876', '8765', '7654', '6543', '5432', '4321', '3210',
  '1212', '2121', '1122', '1010', '2020', '6969', '1004', '2000',
]

/** Vier cijfers, en niets anders. */
export function codeVorm(code) {
  return typeof code === 'string' && /^\d{4}$/.test(code)
}

/**
 * Mag deze code gekozen worden?
 *
 * Geeft een sleutel terug voor de melding, of `null` als ze deugt. Een sleutel
 * en geen zin: het scherm staat in twee talen.
 */
export function keurCode(code) {
  if (!codeVorm(code)) return 'ploeg.code.vorm'
  if (TE_VOOR_DE_HAND.includes(code)) return 'ploeg.code.te_simpel'
  return null
}

/**
 * Het account waarmee iemand uit AAPI zich aanmeldt.
 *
 * Afgeleid van zijn Employee Id en niet willekeurig, zodat het al bestaat
 * voordat hij zich één keer aangemeld heeft. Dat is wat de import toelaat om
 * hem nu al op een event te zetten: `medewerkers` draagt dit id, en de regels
 * laten hem daarmee precies die events zien zodra hij binnenkomt.
 */
export function uidVan(aapiEmployeeId) {
  const schoon = String(aapiEmployeeId ?? '').trim()
  return schoon ? `ploeg-${schoon}` : null
}

/** Hoort dit account bij de ploeg, en bij welke medewerker? */
export function medewerkerUitUid(uid) {
  const m = /^ploeg-(.+)$/.exec(String(uid ?? ''))
  return m ? m[1] : null
}

/** Zit het slot dicht, en tot wanneer? */
export function isGeblokkeerd(stand, nu = new Date()) {
  const tot = stand?.geblokkeerdTot?.toDate?.() ?? (stand?.geblokkeerdTot ? new Date(stand.geblokkeerdTot) : null)
  if (!tot || Number.isNaN(tot.getTime())) return { dicht: false, tot: null }
  return tot.getTime() > nu.getTime() ? { dicht: true, tot } : { dicht: false, tot: null }
}

/**
 * De stand na een misse poging.
 *
 * De teller loopt door tot het slot dichtvalt en gaat dan weer op nul: na het
 * slot heb je opnieuw vijf pogingen. Zonder dat zou één vergissing na een slot
 * meteen een nieuw slot opleveren, en dan sluit iemand zichzelf een avond
 * buiten omdat hij zich één keer vergist heeft.
 */
export function naMisseBeurt(stand, nu = new Date()) {
  const mislukt = (Number(stand?.mislukt) || 0) + 1
  if (mislukt < MAX_POGINGEN) return { mislukt, geblokkeerdTot: null }
  return { mislukt: 0, geblokkeerdTot: new Date(nu.getTime() + SLOT_MINUTEN * 60_000) }
}

/** De stand na een geslaagde poging. */
export function naGoedeBeurt(nu = new Date()) {
  return { mislukt: 0, geblokkeerdTot: null, laatsteAanmelding: nu }
}

/**
 * Vergelijken zonder te verraden hoe ver je zat.
 *
 * Een gewone vergelijking stopt bij het eerste verschil, en hoe lang dat duurt
 * is te meten. Bij vier cijfers over het internet is dat theorie, maar het is
 * één regel om het goed te doen en dan hoeft niemand erover na te denken.
 */
export function codesGelijk(a, b) {
  const x = String(a ?? '')
  const y = String(b ?? '')
  if (x.length !== y.length) return false
  let verschil = 0
  for (let i = 0; i < x.length; i += 1) verschil |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return verschil === 0
}
