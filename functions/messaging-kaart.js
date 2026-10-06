/**
 * Van een bericht naar een kaart op het bord.
 *
 * Wat een `reservatie.aangevraagd` van Wintermoods op een eventkaart wordt:
 * de titel, de omschrijving die het team leest, en het id van de kaart. Zonder
 * één import, zodat `tests/messaging.test.js` het kan nalopen zonder de
 * functies-SDK op te starten. De trigger zelf staat in
 * `messaging-verwerking.js`.
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

const DAG = /^\d{4}-\d{2}-\d{2}$/
const tekst = (waarde, max) => String(waarde ?? '').trim().slice(0, max)

/**
 * De inhoud van een Wintermoods-aanvraag nagekeken en genormaliseerd. Wat de
 * bron stuurt is al door de envelop gegaan, maar de inhoud zelf is pas hier
 * aan de beurt: de ingang kent de soorten niet, de verwerker wel.
 */
export function leesWintermoods(inhoud, taal = 'nl') {
  const personen = Math.round(Number(inhoud?.personen))
  const datum = tekst(inhoud?.datum, 10)
  return {
    naam: tekst(inhoud?.naam, 120),
    email: tekst(inhoud?.email, 160),
    telefoon: tekst(inhoud?.telefoon, 40),
    // Leeg blijft leeg: "geen datum gekozen" is iets anders dan vandaag.
    datum: DAG.test(datum) ? datum : null,
    moment: tekst(inhoud?.moment, 20) || null,
    personen: Number.isFinite(personen) && personen > 0 ? Math.min(personen, 1000) : null,
    formule: tekst(inhoud?.formule, 40) || null,
    formuleLabel: tekst(inhoud?.formuleLabel, 120) || null,
    gelegenheid: tekst(inhoud?.gelegenheid, 40) || null,
    dieet: tekst(inhoud?.dieet, 120),
    bericht: tekst(inhoud?.bericht, 3000),
    taal,
  }
}

/**
 * De omschrijving die het team leest: alles wat de klant invulde, in volgorde
 * van het formulier. Lege velden vallen weg — een regel "Dieet: —" is ruis.
 */
export function omschrijving(a) {
  const regels = [
    ['Contact', [a.naam, a.email, a.telefoon].filter(Boolean).join(' · ')],
    ['Moment', a.moment === 'middag' ? 'Middag' : a.moment === 'avond' ? 'Avond' : ''],
    ['Formule', FORMULES[a.formule] ?? a.formuleLabel ?? 'Nog niet beslist'],
    ['Gelegenheid', GELEGENHEDEN[a.gelegenheid] ?? a.gelegenheid ?? ''],
    ['Dieet of allergieën', a.dieet],
    ['Bericht', a.bericht],
  ]
    .filter(([, waarde]) => waarde)
    .map(([kop, waarde]) => `${kop}: ${waarde}`)

  return [
    `Aanvraag via wintermoods.jeconcept.be${a.taal && a.taal !== 'nl' ? ` (${a.taal.toUpperCase()})` : ''}.`,
    '',
    ...regels,
  ].join('\n')
}

export const titelVan = (a) => {
  const naam = a.naam || a.email || 'onbekend'
  return `Wintermoods — ${naam}${a.personen ? ` (${a.personen}p)` : ''}`
}

/** Het id van de kaart: één per inzending, afleidbaar uit het bericht. */
export const kaartId = (bericht) => (bericht.bron === 'wintermoods' ? `wm-${bericht.sleutel}` : null)

/**
 * De velden die van een Wintermoods-aanvraag op de kaart komen, náást de
 * lijst- en kolomvelden die de trigger zelf opzoekt. Dezelfde velden als
 * `createEventFromTemplate` in de browser en `maakEvent` in
 * `verhuur-orders.js`: wat daar staat moet hier ook staan, anders is dit het
 * ene event op het bord dat zich anders gedraagt.
 */
export function kaartVelden(bericht) {
  const a = leesWintermoods(bericht.inhoud, bericht.taal)
  const dag = a.datum ? new Date(`${a.datum}T12:00:00`) : null
  return {
    title: titelVan(a),
    description: omschrijving(a),
    eventDate: dag,
    eventEndDate: null,
    dueDate: dag,
    startDate: null,
    customerId: null,
    customerName: a.naam || a.email || null,
    eventType: 'Wintermoods',
    templateId: null,
    priority: null,
    timeEstimateMinutes: null,
    assignees: [],
    pax: a.personen,
    location: a.gelegenheid === 'locatie' ? 'Op locatie, bij de klant' : 'Het Vinne, Zoutleeuw',
    locationPlaceId: null,
    locationLat: null,
    locationLng: null,
    formule: FORMULES[a.formule] ?? null,
    formuleId: null,
    formuleKeuzes: null,
    formulePrijsPerPersoon: null,
    formuleBtw: null,
    formuleInclBtw: null,
    quoteAmount: null,
    budget: null,
    bestellijst: [],
    tags: ['wintermoods'],
    archived: false,
    afgesloten: false,
    afgeslotenJaar: null,
    completedAt: null,
    trackedSeconds: 0,
    commentCount: 0,
    // Waar het vandaan kwam, en hoe we de klant bereiken zonder de omschrijving uit te pluizen.
    bron: 'wintermoods',
    berichtId: `${bericht.bron}-${bericht.sleutel}`,
    contactEmail: a.email || null,
    contactTelefoon: a.telefoon || null,
    createdBy: null,
    updatedBy: null,
  }
}

/** Welke soorten de verwerker "event" een kaart geeft, en in welke kolom. */
export const KAART_VOOR_SOORT = {
  'reservatie.aangevraagd': 'request',
}
