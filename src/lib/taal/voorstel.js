/**
 * De teksten van het conceptvoorstel.
 *
 * Wat hier staat is de vaste omlijsting: de eyebrows, de titels, "kostprijs",
 * "per persoon". De inhoud van een voorstel staat niet hier maar op de
 * offerte zelf — die wordt per event getypt en is van dat event.
 *
 * De tekst "wie zijn wij" is een uitzondering en staat er wél in. Hij is van
 * Jasper en Elke en staat in elk voorstel letterlijk hetzelfde; zou hij per
 * event bewerkbaar zijn, dan lopen er na een jaar vijf versies rond van een
 * verhaal dat juist altijd hetzelfde hoort te zijn.
 */
export default {
  'voorstel.cover_eyebrow': { nl: 'Voorstel op maat', en: 'A tailored proposal' },
  'voorstel.leus': { nl: 'jij geniet, wij regisseren', en: 'you enjoy, we direct' },

  'voorstel.over_eyebrow': { nl: 'Over JE Concept', en: 'About JE Concept' },
  'voorstel.wie_titel': { nl: 'Wie zijn', en: 'Who we' },
  'voorstel.wie_accent': { nl: 'wij', en: 'are' },
  'voorstel.wie_tekst': {
    nl:
      'Het klinkt cliché, maar we doen het met twee.|' +
      'Vanuit onze horeca-ervaring in zowel vaste horeca als pop-upconcepten zijn we, op vraag van ' +
      'klanten, gestart met JE Concept. Hierbij combineren we bestaande samenwerkingen met leveranciers ' +
      'en eigen materialen om events op maat aan te bieden, voor ieders budget.',
    en:
      'It sounds like a cliché, but there are just the two of us.|' +
      'Coming from hospitality — both permanent venues and pop-up concepts — we started JE Concept at ' +
      'our customers’ request. We combine our existing supplier partnerships with our own equipment ' +
      'to build events to measure, for every budget.',
  },
  'voorstel.wie_ondertekening': { nl: 'Jasper & Elke', en: 'Jasper & Elke' },

  'voorstel.oogopslag': { nl: 'Dit voorstel in één oogopslag', en: 'This proposal at a glance' },
  'voorstel.pp': { nl: '{bedrag} pp', en: '{bedrag} pp' },
  'voorstel.kostprijs': { nl: 'Kostprijs', en: 'Price' },
  'voorstel.per_persoon': { nl: 'per persoon, excl. btw', en: 'per person, excl. VAT' },

  // ── De soorten onderdelen ──────────────────────────────────────────────
  'voorstel.soort.locatie': { nl: 'De locatie', en: 'The venue' },
  'voorstel.soort.ontvangst': { nl: 'Onthaal', en: 'Reception' },
  'voorstel.soort.hoofd': { nl: 'Hoofdgerecht', en: 'Main course' },
  'voorstel.soort.dranken': { nl: 'Dranken', en: 'Drinks' },
  'voorstel.soort.dessert': { nl: 'Dessert', en: 'Dessert' },
  'voorstel.soort.extra': { nl: 'Extra', en: 'Extra' },
  'voorstel.soort.optie': { nl: 'Optie', en: 'Option' },

  // ── Het werkblad in de tool ────────────────────────────────────────────
  'voorstel.kop': { nl: 'Conceptvoorstel', en: 'Concept proposal' },
  'voorstel.uitleg': {
    nl: 'Dit is wat de klant leest. De prijzen komen uit de offerteregels hieronder.',
    en: 'This is what the customer reads. Prices come from the quote lines below.',
  },
  'voorstel.onderdeel_erbij': { nl: 'Onderdeel', en: 'Section' },
  'voorstel.onderdeel_weg': { nl: 'Onderdeel verwijderen', en: 'Delete section' },
  'voorstel.opnieuw': { nl: 'Opnieuw voorstellen', en: 'Suggest again' },
  'voorstel.opnieuw_uitleg': {
    nl: 'Vervangt de onderdelen door een nieuw voorstel uit de offerteregels.',
    en: 'Replaces the sections with a fresh suggestion from the quote lines.',
  },
  'voorstel.veld.soort': { nl: 'Soort', en: 'Kind' },
  'voorstel.veld.titel': { nl: 'Titel', en: 'Title' },
  'voorstel.veld.accent': { nl: 'Accentwoord', en: 'Accent word' },
  'voorstel.veld.accent_hulp': {
    nl: 'Het laatste woord van de titel, in het schrift.',
    en: 'The last word of the title, set in the script face.',
  },
  'voorstel.veld.tekst': { nl: 'Tekst', en: 'Body' },
  'voorstel.veld.punten': { nl: 'Opsomming', en: 'Bullets' },
  'voorstel.veld.punten_hulp': { nl: 'Eén per regel.', en: 'One per line.' },
  'voorstel.veld.prijs': { nl: 'Prijs p.p.', en: 'Price pp' },
  'voorstel.veld.prijs_hulp': {
    nl: 'Leeg laten: dan komt de prijs uit de offerteregels van dezelfde rubriek.',
    en: 'Leave empty to take the price from the quote lines of the same section.',
  },
  'voorstel.leeg': {
    nl: 'Er staat nog geen voorstel. Voeg een onderdeel toe of laat er een voorstellen.',
    en: 'No proposal yet. Add a section, or have one suggested.',
  },

  // ── Wat er nog mist ────────────────────────────────────────────────────
  'voorstel.mist_onderdelen': {
    nl: 'Het voorstel heeft nog geen onderdelen; de klant krijgt alleen een tabel.',
    en: 'The proposal has no sections yet; the customer only gets a table.',
  },
  'voorstel.mist_tekst': {
    nl: 'Eén onderdeel heeft nog geen tekst.',
    en: 'One section has no body text yet.',
  },
  'voorstel.mist_prijs': {
    nl: 'Eén onderdeel heeft nog geen prijs per persoon.',
    en: 'One section has no price per person yet.',
  },
}
