/**
 * Van een bericht naar een kaart op het bord.
 *
 * Elke bron heeft hier een regel: welk merk, welk type event, waar het
 * doorgaat, en welke sleutels van het formulier welke naam hebben. De velden
 * van de kaart zelf zijn voor elke bron dezelfde, zodat een aanvraag van Bar
 * Vue zich op het bord gedraagt als een van Wintermoods.
 *
 * Zonder één import, zodat `tests/messaging.test.js` het kan nalopen zonder
 * de functies-SDK op te starten. De trigger staat in `messaging-verwerking.js`.
 */

/** De naam van de formule zoals het team ze kent. */
export const FORMULES = {
  fondue: 'Fondue & steengrill',
  bbq: 'Winter BBQ',
  bubbels: 'Winter bubbels',
}

/**
 * `locatie` staat er met opzet bij: dat is "niet aan Het Vinne maar bij de
 * klant zelf" (de pagina /op-locatie), en het enige antwoord dat de keuken iets
 * anders laat doen. Dat hoort op het bord te staan.
 */
export const GELEGENHEDEN = {
  vrienden: 'Vrienden of familie',
  bedrijf: 'Bedrijfsfeest',
  verjaardag: 'Verjaardag of jubileum',
  locatie: 'Op locatie, bij de klant',
  anders: 'Iets anders',
}

/**
 * De bronnen die JE Plan kent. `merk` is de naam van het merk in de
 * werkruimte (collectie `brands`), zodat de kaart de juiste kleur krijgt.
 * `kaart: false` betekent: het bericht komt in de log, maar de kaart maakt een
 * andere weg al — de verhuursite heeft haar eigen postvak en haar eigen event
 * na betaling, en twee kaarten voor één huur is precies wat het bord
 * onbetrouwbaar maakt.
 */
export const BRONNEN = {
  wintermoods: { naam: 'Wintermoods', merk: 'Wintermoods', eventType: 'Wintermoods', locatie: 'Het Vinne, Zoutleeuw', site: 'wintermoods.jeconcept.be' },
  feestbeest: { naam: 'Feestbeest', merk: 'Feestbeest', eventType: 'Kinderfeest', locatie: null, site: 'feest-beest.be' },
  jeconcept: { naam: 'JE Concept', merk: 'JE Concept', eventType: null, locatie: null, site: 'jeconcept.be' },
  jebookings: { naam: 'JE Bookings', merk: 'JE Concept', eventType: null, locatie: null, site: 'de boekingsapp' },
  barvue: { naam: 'Bar Vue', merk: 'Bar Vue', eventType: null, locatie: 'Bar Vue', site: 'barvue.be' },
  meer: { naam: 'Meer', merk: 'Meer — Het Vinne', eventType: null, locatie: 'Het Vinne, Zoutleeuw', site: 'de site van Meer' },
  kenjeklanten: { naam: 'Ken je klanten', merk: 'Ken je klanten', eventType: null, locatie: null, site: 'kenjeklanten.be' },
  verhuur: { naam: 'Verhuur', merk: 'JE Concept', eventType: 'Verhuur', locatie: null, site: 'rental.jeconcept.be', kaart: false },
}

/** Welke soorten een kaart worden, en in welke kolom. */
export const KAART_VOOR_SOORT = {
  'reservatie.aangevraagd': 'request',
  'offerte.aangevraagd': 'request',
}

/** Krijgt dit bericht een kaart van de verwerker event? */
export const wordtKaart = (bericht) =>
  Boolean(KAART_VOOR_SOORT[bericht?.soort]) && Boolean(BRONNEN[bericht?.bron]) && BRONNEN[bericht.bron].kaart !== false

const DAG = /^\d{4}-\d{2}-\d{2}$/
const tekst = (waarde, max) => String(waarde ?? '').trim().slice(0, max)

/**
 * Hoe formulieren hun velden noemen. Een webhook van een WordPress-formulier
 * stuurt `your-name`, een Wix-formulier `Naam`, een eigen site `naam`: ze
 * komen allemaal op dezelfde plek van de kaart. Wat hier niet in staat, gaat
 * niet verloren maar komt als regel in de omschrijving.
 */
const ALIASSEN = {
  naam: ['naam', 'name', 'your-name', 'volledige naam', 'full name', 'contactpersoon', 'nom'],
  voornaam: ['voornaam', 'first name', 'firstname', 'first_name', 'prénom', 'prenom'],
  achternaam: ['achternaam', 'familienaam', 'last name', 'lastname', 'last_name', 'nom de famille'],
  email: ['email', 'e-mail', 'mail', 'your-email', 'emailadres', 'e-mailadres', 'courriel'],
  telefoon: ['telefoon', 'phone', 'tel', 'gsm', 'your-phone', 'telefoonnummer', 'téléphone', 'telephone'],
  datum: ['datum', 'date', 'event date', 'gewenste datum', 'datum event', 'eventdatum'],
  personen: ['personen', 'aantal personen', 'aantal', 'pax', 'guests', 'gasten', 'persons', 'aantal kinderen', 'kinderen', 'personnes'],
  bericht: ['bericht', 'message', 'your-message', 'opmerking', 'opmerkingen', 'vraag', 'comments'],
  moment: ['moment', 'tijdstip', 'uur', 'time'],
  formule: ['formule', 'formula', 'pakket', 'package'],
  formuleLabel: ['formulelabel'],
  gelegenheid: ['gelegenheid', 'occasion', 'type', 'soort feest', 'type event', 'event type'],
  dieet: ['dieet', 'diet', 'allergieën', 'allergieen', 'dieetwensen'],
  locatie: ['locatie', 'location', 'adres', 'plaats', 'lieu'],
}

const norm = (k) => String(k).trim().toLowerCase().replace(/[_\s]+/g, ' ')

/** Zoek de waarde van een veld onder al zijn namen; geeft ook de gebruikte sleutel terug. */
function zoek(inhoud, veld) {
  const namen = ALIASSEN[veld].map(norm)
  for (const [k, v] of Object.entries(inhoud ?? {})) {
    if (namen.includes(norm(k)) && v !== null && v !== undefined && String(v).trim() !== '') return [k, v]
  }
  return [null, null]
}

/** Een datum in welke vorm een formulier ze ook stuurt, als YYYY-MM-DD, of null. */
export function leesDatum(waarde) {
  const t = tekst(waarde, 40)
  if (DAG.test(t)) return t
  const be = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  if (be) return `${be[3]}-${be[2].padStart(2, '0')}-${be[1].padStart(2, '0')}`
  const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(t)
  return iso ? iso[1] : null
}

/**
 * De inhoud van een aanvraag, nagekeken en genormaliseerd, voor elke bron.
 * `extra` zijn de velden die geen vaste plek hebben, in de volgorde van het
 * formulier, zodat niets wat de klant invulde verloren gaat.
 */
export function leesAanvraag(inhoud, taal = 'nl') {
  const gebruikt = new Set()
  const neem = (veld, max) => {
    const [k, v] = zoek(inhoud, veld)
    if (k) gebruikt.add(k)
    return v === null ? '' : tekst(v, max)
  }
  const voornaam = neem('voornaam', 60)
  const achternaam = neem('achternaam', 60)
  const naam = neem('naam', 120) || [voornaam, achternaam].filter(Boolean).join(' ')
  const personen = Math.round(Number(String(neem('personen', 12)).replace(/[^\d.]/g, '')))
  const datum = leesDatum(neem('datum', 40))
  const velden = {
    naam,
    email: neem('email', 160),
    telefoon: neem('telefoon', 40),
    // Leeg blijft leeg: "geen datum gekozen" is iets anders dan vandaag.
    datum,
    moment: neem('moment', 20) || null,
    personen: Number.isFinite(personen) && personen > 0 ? Math.min(personen, 1000) : null,
    formule: neem('formule', 40) || null,
    formuleLabel: neem('formuleLabel', 120) || null,
    gelegenheid: neem('gelegenheid', 60) || null,
    dieet: neem('dieet', 120),
    locatie: neem('locatie', 160) || null,
    bericht: neem('bericht', 3000),
    taal,
  }
  const extra = Object.entries(inhoud ?? {})
    .filter(([k, v]) => !gebruikt.has(k) && v !== null && v !== undefined && typeof v !== 'object' && String(v).trim() !== '')
    .slice(0, 30)
    .map(([k, v]) => [tekst(k, 60), tekst(v, 500)])
  return { ...velden, extra }
}

/** Voor de bestaande tests en de Wintermoods-site: dezelfde lezing, Wintermoods-vorm. */
export const leesWintermoods = (inhoud, taal = 'nl') => leesAanvraag(inhoud, taal)

const momentTekst = (m) => (m === 'middag' ? 'Middag' : m === 'avond' ? 'Avond' : m || '')

/**
 * De omschrijving die het team leest: alles wat de klant invulde, in volgorde
 * van het formulier. Lege velden vallen weg — een regel "Dieet: —" is ruis.
 */
export function omschrijving(a, bron = 'wintermoods') {
  const b = BRONNEN[bron] ?? { site: bron }
  const regels = [
    ['Contact', [a.naam, a.email, a.telefoon].filter(Boolean).join(' · ')],
    ['Moment', momentTekst(a.moment)],
    ['Formule', FORMULES[a.formule] ?? a.formuleLabel ?? a.formule ?? (bron === 'wintermoods' ? 'Nog niet beslist' : '')],
    ['Gelegenheid', GELEGENHEDEN[a.gelegenheid] ?? a.gelegenheid ?? ''],
    ['Locatie', a.locatie ?? ''],
    ['Dieet of allergieën', a.dieet],
    ['Bericht', a.bericht],
    ...(a.extra ?? []),
  ]
    .filter(([, waarde]) => waarde)
    .map(([kop, waarde]) => `${kop}: ${waarde}`)

  return [`Aanvraag via ${b.site}${a.taal && a.taal !== 'nl' ? ` (${a.taal.toUpperCase()})` : ''}.`, '', ...regels].join('\n')
}

export const titelVan = (a, bron = 'wintermoods') => {
  const merk = BRONNEN[bron]?.naam ?? bron
  const naam = a.naam || a.email || 'onbekend'
  return `${merk} — ${naam}${a.personen ? ` (${a.personen}p)` : ''}`
}

/**
 * Het id van de kaart: één per inzending, afleidbaar uit het bericht. Een
 * dubbele inzending of een herspeelde verwerker vindt zo de kaart terug in
 * plaats van een tweede te maken. Wintermoods houdt haar oude vorm, want de
 * site toont die id al aan wie test.
 */
export const kaartId = (bericht) => {
  if (!bericht?.bron || !bericht?.sleutel) return null
  return bericht.bron === 'wintermoods' ? `wm-${bericht.sleutel}` : `msg-${bericht.bron}-${bericht.sleutel}`
}

/**
 * De velden die van een aanvraag op de kaart komen, náást de lijst- en
 * kolomvelden die de trigger zelf opzoekt. Dezelfde velden als
 * `createEventFromTemplate` in de browser en `maakEvent` in
 * `verhuur-orders.js`: wat daar staat moet hier ook staan, anders is dit het
 * ene event op het bord dat zich anders gedraagt.
 */
export function kaartVelden(bericht, { brandId = null } = {}) {
  const bron = BRONNEN[bericht.bron] ?? { naam: bericht.bron, eventType: null, locatie: null }
  const a = leesAanvraag(bericht.inhoud, bericht.taal)
  const dag = a.datum ? new Date(`${a.datum}T12:00:00`) : null
  const locatie = a.gelegenheid === 'locatie' ? 'Op locatie, bij de klant' : a.locatie || bron.locatie || null
  return {
    title: titelVan(a, bericht.bron),
    description: omschrijving(a, bericht.bron),
    eventDate: dag,
    eventEndDate: null,
    dueDate: dag,
    startDate: null,
    customerId: null,
    customerName: a.naam || a.email || null,
    eventType: bron.eventType ?? null,
    templateId: null,
    priority: null,
    timeEstimateMinutes: null,
    assignees: [],
    pax: a.personen,
    location: locatie,
    locationPlaceId: null,
    locationLat: null,
    locationLng: null,
    formule: FORMULES[a.formule] ?? a.formuleLabel ?? null,
    formuleId: null,
    formuleKeuzes: null,
    formulePrijsPerPersoon: null,
    formuleBtw: null,
    formuleInclBtw: null,
    quoteAmount: null,
    budget: null,
    bestellijst: [],
    tags: [bericht.bron],
    archived: false,
    afgesloten: false,
    afgeslotenJaar: null,
    completedAt: null,
    trackedSeconds: 0,
    commentCount: 0,
    // Waar het vandaan kwam, en hoe we de klant bereiken zonder de omschrijving uit te pluizen.
    bron: bericht.bron,
    berichtId: `${bericht.bron}-${bericht.sleutel}`,
    contactEmail: a.email || null,
    contactTelefoon: a.telefoon || null,
    ...(brandId ? { brandId } : {}),
    createdBy: null,
    updatedBy: null,
  }
}
