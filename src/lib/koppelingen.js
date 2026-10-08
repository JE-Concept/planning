/**
 * Waar een notitie aan kan hangen.
 *
 * Een notitie stond vroeger altijd ergens ín: in het verslag van een overleg,
 * in het notitieveld van een klant, in de draad van een event. Dan vind je ze
 * alleen terug als je weet waar je moet kijken — en "wat weten we over die
 * klant" staat dan verspreid over drie schermen. Daarom staat de notitie nu op
 * zichzelf en draagt ze een lijst van wat ze raakt: een klant, een event, een
 * stuk materiaal, een urenboeking. Eén notitie kan er meerdere raken; het
 * verslag waarin de trouw van Niels en de tent van Blum besproken werd, hoort
 * bij allebei.
 *
 * Elke koppeling staat twee keer op de notitie:
 *  - `koppelingen`: `{ soort, id, label }`, om te tonen zonder het object zelf
 *    op te halen — Firestore heeft geen joins;
 *  - `koppelsleutels`: `'klant:abc'`, want Firestore kan met `array-contains`
 *    wél zoeken op een tekst in een lijst, maar niet op een veld van een object
 *    in een lijst.
 * Die tweede wordt nooit met de hand gezet maar altijd uit de eerste gerekend
 * (`zetKoppelingen`), zodat ze niet uit elkaar kunnen lopen.
 *
 * Het label is een kopie van toen er gekoppeld werd. Wordt de klant
 * hernoemd, dan staat de oude naam nog op de notitie tot iemand ze opnieuw
 * bewaart; het id blijft kloppen en de link werkt. Dat is goedkoper dan bij
 * elke hernoeming alle notities nalopen.
 *
 * Puur en zonder imports, zodat `tests/notities.test.js` het zonder browser
 * kan draaien.
 */

/**
 * De soorten, in de volgorde waarin de kiezer ze toont.
 *
 * `route` geeft het adres waar je het object opent. Waar een scherm geen
 * eigen adres per object heeft (klanten, materiaal), gaat de link naar het
 * scherm met het id in de zoekbalk; dat scherm opent dan zelf de fiche.
 */
export const KOPPELSOORTEN = [
  { soort: 'klant', icon: 'building', sleutel: 'koppeling.klant', route: (id) => `/klanten?klant=${id}` },
  { soort: 'event', icon: 'calendar-days', sleutel: 'koppeling.event', route: (id) => `/events/${id}` },
  { soort: 'taak', icon: 'check-circle', sleutel: 'koppeling.taak', route: (id, k) => (k?.eventId ? `/events/${k.eventId}?taak=${id}` : '/tasks') },
  { soort: 'materiaal', icon: 'package', sleutel: 'koppeling.materiaal', route: (id) => `/materiaal?artikel=${id}` },
  { soort: 'uren', icon: 'timer', sleutel: 'koppeling.uren', route: () => '/uren' },
  { soort: 'offerte', icon: 'euro', sleutel: 'koppeling.offerte', route: (id, k) => (k?.eventId ? `/events/${k.eventId}?tab=offerte` : '/') },
]

export const SOORT = Object.fromEntries(KOPPELSOORTEN.map((s) => [s.soort, s]))

/** `'klant:abc'` — de vorm waarop Firestore zoekt. */
export const koppelsleutel = (k) => (k?.soort && k?.id ? `${k.soort}:${k.id}` : null)

/**
 * Eén koppeling zoals ze op de notitie komt.
 *
 * Alleen de velden die erop horen: wat de kiezer meegeeft (score, icoon,
 * onderschrift) is van het scherm en hoort niet in de database. `eventId` mag
 * mee, want een taak en een offerte openen onder hun event.
 */
export function schoneKoppeling(k) {
  if (!k?.soort || !k?.id || !SOORT[k.soort]) return null
  const uit = { soort: k.soort, id: String(k.id), label: (k.label ?? k.titel ?? '').toString().trim() }
  if (k.eventId) uit.eventId = String(k.eventId)
  return uit
}

/**
 * De twee velden die een notitie over haar koppelingen draagt.
 *
 * Dubbels gaan eruit: dezelfde klant twee keer kiezen is geen tweede
 * koppeling, en zou bij het ontkoppelen een spook laten staan.
 */
export function zetKoppelingen(lijst = []) {
  const gezien = new Set()
  const koppelingen = []
  for (const ruw of lijst ?? []) {
    const k = schoneKoppeling(ruw)
    const sleutel = koppelsleutel(k)
    if (!sleutel || gezien.has(sleutel)) continue
    gezien.add(sleutel)
    koppelingen.push(k)
  }
  return { koppelingen, koppelsleutels: [...gezien] }
}

/** Hangt deze notitie aan dit object? Voor de privénotities, die in de browser gefilterd worden. */
export const raakt = (notitie, k) => {
  const sleutel = koppelsleutel(k)
  return !!sleutel && (notitie?.koppelsleutels ?? []).includes(sleutel)
}

/** Het adres van een gekoppeld object, of `null` voor een soort die we niet kennen. */
export const routeVan = (k) => SOORT[k?.soort]?.route(k.id, k) ?? null

/**
 * Twee stapels notities samen: de open en de private.
 *
 * Ze komen uit twee vragen (zie `src/data/notities.js`) en een notitie kan in
 * theorie in allebei zitten. Nieuwste eerst, op de datum van de notitie en
 * daarna op wanneer ze geschreven is — twee notities van dezelfde dag staan
 * dan in de volgorde waarin ze ontstonden.
 */
export function voegSamen(...stapels) {
  const perId = new Map()
  for (const stapel of stapels) for (const n of stapel ?? []) perId.set(n.id, n)
  const tijd = (v) => (v ? new Date(v).getTime() || 0 : 0)
  return [...perId.values()].sort(
    (a, b) =>
      (b.datum ?? '').localeCompare(a.datum ?? '') || tijd(b.createdAt) - tijd(a.createdAt)
  )
}
