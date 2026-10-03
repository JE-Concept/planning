/**
 * Het enige gesprek dat deze site met ons voert.
 *
 * ── Waarom hier geen Firebase-SDK staat ───────────────────────────────────
 * Omdat deze pagina van iedereen is. Een browser leest altijd een héél
 * document, dus zou een directe Firestore-lezing betekenen dat de
 * inkoopwaarde en de leverancier van elk artikel in de netwerkpaneel van elke
 * bezoeker staan — ook met de strengste regels, want die gaan over documenten
 * en niet over velden. Nu stelt deze site twee vragen aan een eigen adres en
 * krijgt ze precies terug wat `functions/verhuur-aanbod.js` doorlaat.
 *
 * Het scheelt bovendien een halve megabyte SDK in de bundel, en een
 * projectsleutel die nergens voor nodig is.
 *
 * ── Waarom alles via `/api` gaat en niet via een functie-URL ──────────────
 * De hosting-site schrijft `/api/**` door naar de functies. Daardoor is alles
 * van dezelfde herkomst: geen voorvlucht, geen CORS-lijst om te onderhouden,
 * en één adres dat in de browser te volgen is.
 */

/**
 * De sessie van een ingelogde klant — vraag 11 en 12.
 *
 * Eén token in localStorage, nergens anders. Het gaat als `Authorization`
 * mee op elk verzoek; de server beslist wat het waard is. Verdwijnt het uit
 * de browser, dan is de klant gewoon uitgelogd — er is geen cookie die
 * stilletjes blijft hangen.
 */
const SESSIE = 'je-verhuur-sessie'

export function sessie() {
  try {
    return localStorage.getItem(SESSIE) || null
  } catch {
    return null
  }
}

export function zetSessie(token) {
  try {
    if (token) localStorage.setItem(SESSIE, token)
    else localStorage.removeItem(SESSIE)
  } catch {
    // Zonder opslag blijft de klant deze pagina ingelogd en daarna niet; dat
    // is wat een privévenster hoort te doen.
  }
}

const haal = async (pad, opties = {}) => {
  const token = sessie()
  const headers = { ...(opties.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const antwoord = await fetch(`/api${pad}`, { ...opties, headers })
  if (!antwoord.ok) {
    const uit = await antwoord.json().catch(() => ({}))
    throw Object.assign(new Error(uit.fout ?? 'mislukt'), { code: uit.fout, status: antwoord.status, uit })
  }
  return antwoord.json()
}

/** Alles wat zonder gesprek te huren is. */
export const aanbod = () => haal('/verhuur/aanbod')

/** Wat er vrij is in een periode, per artikel. */
export const beschikbaar = (van, tot) =>
  haal(`/verhuur/beschikbaar?van=${encodeURIComponent(van)}&tot=${encodeURIComponent(tot)}`)

/**
 * Afrekenen. Stuurt artikelnummers en aantallen, nooit bedragen.
 *
 * Wat hier als prijs op het scherm staat is een berekening van dezelfde
 * motor, maar de server rekent zelf opnieuw. Zou de browser het bedrag mogen
 * meesturen, dan huurt iemand met een ontwikkelaarsconsole een tent voor één
 * euro en heeft hij een geldig betaalbewijs.
 */
export const afrekenen = (bestelling) =>
  haal('/afrekenen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bestelling),
  })

/** Een offerteaanvraag voor wat niet zomaar de deur uit kan. */
export const aanvragen = (aanvraag) =>
  haal('/verhuur/aanvraag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aanvraag),
  })

/** Een inloglink vragen. Altijd "ok" — zie `linkAanvragen` in de functie. */
export const loginVragen = (email) =>
  haal('/verhuur/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })

/** De link uit de mail gebruiken; geeft de sessie terug. */
export const loginGebruiken = (token) => haal(`/verhuur/login/${encodeURIComponent(token)}`)

/** Wat deze klant huurde. 401 wanneer de sessie weg of verlopen is. */
export const mijnHuren = () => haal('/verhuur/mijn')
