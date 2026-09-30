/**
 * De locatie van een event, gekozen op Google Maps.
 *
 * ── Waarom niet de Maps-JavaScript-SDK ────────────────────────────────────
 * Een adres kiezen is één veld in één dialoog. De SDK laadt daarvoor een paar
 * honderd kilobyte script en zet een eigen widget in de pagina die niets van
 * onze eigen invoervelden weet. De Places API (New) antwoordt gewoon op een
 * `fetch` met CORS, dus vragen we het adres zelf op en tekenen we de lijst met
 * dezelfde bouwstenen als de rest van de tool.
 *
 * ── Waarom het zonder sleutel ook werkt ───────────────────────────────────
 * Zolang `VITE_GOOGLE_MAPS_API_KEY` niet bij de build zit, is het locatieveld
 * een gewoon tekstveld — precies wat het vandaag al is. Zo kan de tool blijven
 * draaien terwijl de sleutel er nog niet is, en gaat er geen enkel bestaand
 * adres verloren.
 *
 * ── Wat er bewaard wordt ──────────────────────────────────────────────────
 * `location` is en blijft de tekst: dat is wat op de offerte komt, in de
 * agenda-uitnodiging staat en waar de zoekbalk op zoekt. De `placeId` en de
 * coördinaten staan ernaast, zodat een kaartlink de juiste plek opent en niet
 * de eerste de beste "Zaal De Kring" van het land. Typt iemand de tekst
 * daarna met de hand over, dan gaan die drie mee weg: coördinaten die niet
 * meer bij de tekst horen, zijn erger dan geen coördinaten.
 */

const BASIS = 'https://places.googleapis.com/v1'

// Lui gelezen en niet in een constante: zo kan een test de sleutel zetten
// zonder de module opnieuw te moeten laden.
const sleutel = () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

/*
  Een sleutel die geweigerd wordt (verkeerd gekopieerd, Places API niet aan,
  quotum op), blijft geweigerd. Eén duidelijk antwoord van Google is genoeg om
  te stoppen met vragen: daarna is het veld weer een tekstveld. Een netwerk dat
  even wegvalt telt niet mee — dat is geen antwoord, dat is geen verbinding.
*/
let uitgevallen = false

/** Alleen voor tests: doet alsof er nog nooit iets misging. */
export function vergeetKaartstoring() {
  uitgevallen = false
}

/** Of er met een kaart gewerkt kan worden. Zo niet: gewoon tekst. */
export const kaartIngesteld = () => Boolean(sleutel()) && !uitgevallen

/** Een leeg adres — alle vier de velden, zodat er niets blijft hangen. */
export const leegLocatie = () => ({
  location: null,
  locationPlaceId: null,
  locationLat: null,
  locationLng: null,
})

/** Het adres zoals het op het event staat, zonder de koppeling aan een plek. */
export const vrijeLocatie = (tekst) => ({
  ...leegLocatie(),
  location: tekst?.trim() ? tekst.trim() : null,
})

async function vraag(pad, opties) {
  const res = await fetch(`${BASIS}${pad}`, {
    ...opties,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': sleutel(),
      ...(opties?.headers ?? {}),
    },
  })
  if (!res.ok) {
    // 4xx is een oordeel over de sleutel of het verzoek; 5xx is Google die het
    // even niet doet. Alleen het eerste zet het veld terug op tekst.
    if (res.status >= 400 && res.status < 500) uitgevallen = true
    throw new Error(`Places ${res.status}`)
  }
  return res.json()
}

/**
 * Adressen die bij wat iemand typt passen.
 *
 * De landen staan vast op waar JE Concept werkt. Dat scheelt een scherm vol
 * gelijknamige zalen aan de andere kant van de wereld; een adres daarbuiten
 * typ je gewoon voluit, het veld blijft vrij.
 */
export async function zoekLocaties(invoer, { signal = undefined, taal = 'nl' } = {}) {
  const tekst = (invoer ?? '').trim()
  if (!kaartIngesteld() || tekst.length < 3) return []

  const data = await vraag('/places:autocomplete', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      input: tekst,
      includedRegionCodes: ['be', 'nl', 'fr', 'lu', 'de'],
      languageCode: taal,
    }),
  })

  return (data?.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p) => p?.placeId)
    .map((p) => ({
      id: p.placeId,
      tekst: p.text?.text ?? '',
      hoofd: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      onder: p.structuredFormat?.secondaryText?.text ?? '',
    }))
}

/**
 * De gekozen plek, klaar om op het event te zetten.
 *
 * De naam gaat vóór het adres wanneer Google er een heeft ("Zaal De Kring,
 * Dorpsstraat 1, ..."): zo staat op de offerte hoe het team de plek noemt.
 */
export async function locatieDetails(placeId, { taal = 'nl' } = {}) {
  if (!kaartIngesteld() || !placeId) return null

  const velden = 'id,formattedAddress,displayName,location'
  const data = await vraag(`/places/${encodeURIComponent(placeId)}?languageCode=${taal}`, {
    method: 'GET',
    headers: { 'X-Goog-FieldMask': velden },
  })
  if (!data?.id) return null

  const naam = data.displayName?.text ?? ''
  const adres = data.formattedAddress ?? ''
  return {
    location: [naam, adres].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || null,
    locationPlaceId: data.id,
    locationLat: typeof data.location?.latitude === 'number' ? data.location.latitude : null,
    locationLng: typeof data.location?.longitude === 'number' ? data.location.longitude : null,
  }
}

/**
 * De link die de plek op Google Maps opent.
 *
 * Werkt ook zonder sleutel: een adres als zoekterm is altijd beter dan geen
 * knop. Met een `placeId` opent exact de juiste plek, met coördinaten de
 * juiste plek op de kaart, en anders wat er getypt staat.
 */
export function kaartLink(ev) {
  if (!ev) return null
  const tekst = (ev.location ?? '').trim()
  const lat = ev.locationLat
  const lng = ev.locationLng
  const heeftPunt = typeof lat === 'number' && typeof lng === 'number'

  if (!tekst && !heeftPunt) return null

  const zoek = tekst || `${lat},${lng}`
  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', heeftPunt && !tekst ? `${lat},${lng}` : zoek)
  // Google wil een zoekterm naast de plek-id; de id bepaalt het antwoord.
  if (ev.locationPlaceId) url.searchParams.set('query_place_id', ev.locationPlaceId)
  return url.toString()
}
