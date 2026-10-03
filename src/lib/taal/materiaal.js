/**
 * De teksten van het magazijn.
 *
 * "Materiaal" en niet "voorraad": het gaat om tenten, bars en statafels die
 * terugkomen, niet om wat opgaat. Dat verschil zit ook in het datamodel —
 * zie `lib/voorraad.js`.
 */
export default {
  'materiaal.eyebrow': { nl: 'Verhuur', en: 'Rental' },
  'materiaal.titel': { nl: 'Materiaal', en: 'Equipment' },
  'materiaal.toevoegen': { nl: 'Stuk toevoegen', en: 'Add item' },
  'materiaal.leeg': { nl: 'Nog geen materiaal', en: 'No equipment yet' },
  'materiaal.leeg_uitleg': {
    nl: 'Zodra er stukken in staan, zie je hier per dag wat er vrij is en wat er uit is.',
    en: 'Once items are listed, you see here day by day what is free and what is out.',
  },

  'materiaal.stuks': { nl: 'Stuks in voorraad', en: 'Items owned' },
  'materiaal.soorten_een': { nl: 'over {aantal} soort', en: 'across {aantal} type' },
  'materiaal.soorten_meer': { nl: 'over {aantal} soorten', en: 'across {aantal} types' },
  'materiaal.uit': { nl: 'Uit op deze dag', en: 'Out on this day' },
  'materiaal.uit_onder': { nl: 'bij klanten en op events', en: 'with customers and at events' },
  'materiaal.conflicten_kort': { nl: 'Conflicten', en: 'Conflicts' },
  'materiaal.vragen_beslissing': { nl: 'vragen een beslissing', en: 'need a decision' },
  'materiaal.alles_past': { nl: 'alles past', en: 'everything fits' },

  'materiaal.conflicten_een': { nl: '{aantal} dag waarop er meer beloofd is dan er staat', en: '{aantal} day promising more than is in stock' },
  'materiaal.conflicten_meer': { nl: '{aantal} dagen waarop er meer beloofd is dan er staat', en: '{aantal} days promising more than is in stock' },
  'materiaal.conflict_regel': {
    nl: '{naam} op {dag}: {tekort} te weinig — er staan er {aantal}.',
    en: '{naam} on {dag}: {tekort} short — there are {aantal}.',
  },

  'materiaal.kalender': { nl: 'Beschikbaarheid', en: 'Availability' },
  'materiaal.vanaf': { nl: 'Vanaf', en: 'From' },
  'materiaal.venster': { nl: 'Hoeveel dagen tonen', en: 'How many days to show' },
  'materiaal.dagen': { nl: '{aantal} dagen', en: '{aantal} days' },
  'materiaal.categorie': { nl: 'Categorie', en: 'Category' },
  'materiaal.alle_categorieen': { nl: 'Alle categorieën', en: 'All categories' },
  'materiaal.legenda.event': { nl: 'Vastgelegd', en: 'Booked' },
  'materiaal.legenda.optie': { nl: 'In optie', en: 'On option' },
  'materiaal.legenda.over': { nl: 'Te veel geboekt', en: 'Overbooked' },
  'materiaal.cel': {
    nl: '{naam} op {dag}: {vrij} van {aantal} vrij',
    en: '{naam} on {dag}: {vrij} of {aantal} free',
  },
  'materiaal.schuif_uitleg': {
    nl: 'Schuif de balk opzij om verder in de tijd te kijken.',
    en: 'Slide the bar sideways to look further ahead.',
  },
}
