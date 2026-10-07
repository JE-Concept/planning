/**
 * Wat er per zaak anders is, op één plek.
 *
 * Alles hieronder is een beslissing van Jasper en geen eigenschap van de
 * code. Het staat daarom bij elkaar, met de vraag ernaast uit
 * `docs/vragen-productie.md`, zodat het antwoord één regel kost en geen
 * zoektocht door zes bestanden.
 *
 * De plaatshouders zijn met opzet zichtbaar fout — `011 00 00 00` is geen
 * nummer dat iemand per ongeluk laat staan omdat het er geloofwaardig uitziet.
 */

/**
 * Vraag 10 — beantwoord: het mailadres is `info@jeconcept.be`, het
 * telefoonnummer komt later. Tot dan is het `null`, en de site toont dan géén
 * nummer en verwijst naar mail. Een plaatshouder die eruitziet als een
 * nummer, belt iemand een keer.
 */
export const CONTACT = {
  telefoon: null,
  telefoonLink: null,
  email: 'info@jeconcept.be',
  plaats: 'Sint-Truiden',
  // Wanneer iemand materiaal kan komen halen en terugbrengen.
  afhaaluren: 'op afspraak, meestal tussen 9u en 17u',
}

/**
 * De centrale pagina's van JE Concept: één privacybeleid, één set voorwaarden
 * en één klantendienst voor elk merk, ook voor deze site. Ze staan niet hier
 * maar op jeconcept.be (de repo feestbeest, map jeconcept/), zodat zes sites
 * niet zes versies van dezelfde tekst bijhouden. Op www, want het kale
 * jeconcept.be heeft nog geen DNS-record.
 */
export const CENTRAAL = {
  voorwaarden: 'https://www.jeconcept.be/terms-of-conditions?lang=nl',
  privacy: 'https://www.jeconcept.be/privacy-policy?lang=nl',
  klantendienst: 'https://www.jeconcept.be/contact?lang=nl',
}

/**
 * Vraag 7 en 8: het boekingsvenster.
 *
 * Niet voor morgen: iemand die om 23u voor de volgende ochtend boekt, komt
 * voor een gesloten magazijn te staan omdat niemand het gezien heeft. En niet
 * verder dan een jaar: prijzen veranderen, en een huur van over twee jaar is
 * een gesprek, geen klik.
 *
 * Dezelfde twee getallen staan server-side in `functions-betaling/index.js`;
 * de server beslist, dit is wat het formulier alvast tegenhoudt.
 */
export const MIN_DAGEN_VOORAF = 2
export const MAX_DAGEN_VOORAF = 365

const sleutel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** De vroegste en laatste dag die het formulier aanbiedt. */
export function boekingsvenster(nu = new Date()) {
  const vroegst = new Date(nu)
  vroegst.setDate(vroegst.getDate() + MIN_DAGEN_VOORAF)
  const laatst = new Date(nu)
  laatst.setDate(laatst.getDate() + MAX_DAGEN_VOORAF)
  return { vroegst: sleutel(vroegst), laatst: sleutel(laatst) }
}
