/**
 * Wat er uit het reservatieformulier van wintermoods.jeconcept.be binnenkomt,
 * en hoe dat op een kaart komt te staan.
 *
 * Zonder één import, zodat `tests/wintermoods.test.js` dit kan nalopen zonder
 * de functies-SDK op te starten — dezelfde lijn als `order.js` in
 * `functions-betaling/`. Het sleutelwerk (token, Firestore) staat in
 * `wintermoods.js`.
 */

const DAG = /^\d{4}-\d{2}-\d{2}$/

/** De naam van de formule zoals het team ze kent, voor de titel van de kaart. */
export const FORMULES = {
  fondue: 'Fondue & steengrill',
  bbq: 'Winter BBQ',
  bubbels: 'Winter bubbels',
}

/**
 * `locatie` staat er met opzet bij: dat is "niet aan Het Vinne maar bij de
 * klant zelf" (de pagina /op-locatie), en het enige antwoord dat de keuken
 * iets anders laat doen. Dat hoort op het bord te staan, niet in een sleutel
 * die niemand vertaalt.
 */
export const GELEGENHEDEN = {
  vrienden: 'Vrienden of familie',
  bedrijf: 'Bedrijfsfeest',
  verjaardag: 'Verjaardag of jubileum',
  locatie: 'Op locatie, bij de klant',
  anders: 'Iets anders',
}

export const tekst = (waarde, max) => String(waarde ?? '').trim().slice(0, max)

/**
 * De omschrijving die het team leest: alles wat de klant invulde, in volgorde
 * van het formulier. Lege velden vallen weg — een regel "Dieet: —" is ruis.
 */
export function omschrijving(aanvraag) {
  const regels = [
    ['Contact', [aanvraag.naam, aanvraag.email, aanvraag.telefoon].filter(Boolean).join(' · ')],
    ['Moment', aanvraag.moment === 'middag' ? 'Middag' : aanvraag.moment === 'avond' ? 'Avond' : ''],
    ['Formule', FORMULES[aanvraag.formule] ?? aanvraag.formuleLabel ?? 'Nog niet beslist'],
    ['Gelegenheid', GELEGENHEDEN[aanvraag.gelegenheid] ?? aanvraag.gelegenheid ?? ''],
    ['Dieet of allergieën', aanvraag.dieet],
    ['Bericht', aanvraag.bericht],
  ]
    .filter(([, waarde]) => waarde)
    .map(([kop, waarde]) => `${kop}: ${waarde}`)

  return [
    `Aanvraag via wintermoods.jeconcept.be${aanvraag.taal && aanvraag.taal !== 'nl' ? ` (${aanvraag.taal.toUpperCase()})` : ''}.`,
    '',
    ...regels,
  ].join('\n')
}

/** Wat er uit het formulier binnenkwam, nagekeken. Dezelfde lijn als `verhuur-aanvraag.js`. */
export function leesAanvraag(body) {
  const email = tekst(body?.email, 160)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { fout: 'geen_email' }

  const personen = Math.round(Number(body?.personen))
  const datum = tekst(body?.datum, 10)

  return {
    velden: {
      aanvraagId: tekst(body?.aanvraagId, 64) || null,
      naam: tekst(body?.naam, 120),
      email,
      telefoon: tekst(body?.telefoon, 40),
      // Leeg blijft leeg: "geen datum gekozen" is iets anders dan vandaag.
      datum: DAG.test(datum) ? datum : null,
      moment: tekst(body?.moment, 20) || null,
      personen: Number.isFinite(personen) && personen > 0 ? Math.min(personen, 1000) : null,
      formule: tekst(body?.formule, 40) || null,
      formuleLabel: tekst(body?.formuleLabel, 120) || null,
      gelegenheid: tekst(body?.gelegenheid, 40) || null,
      dieet: tekst(body?.dieet, 120),
      bericht: tekst(body?.bericht, 3000),
      taal: ['nl', 'fr', 'en'].includes(body?.taal) ? body.taal : 'nl',
    },
  }
}

/** De titel van de kaart: wie, en voor hoeveel. */
export const titelVan = (aanvraag) => {
  const naam = aanvraag.naam || aanvraag.email
  return `Wintermoods — ${naam}${aanvraag.personen ? ` (${aanvraag.personen}p)` : ''}`
}

/** Het document-id: één kaart per inzending, ook als ze twee keer aankomt. */
export const kaartId = (aanvraag) => (aanvraag.aanvraagId ? `wm-${aanvraag.aanvraagId}` : null)
