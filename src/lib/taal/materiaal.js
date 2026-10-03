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

  /* Het materiaalblok op de eventfiche. */
  'eventmat.tab': { nl: 'Materiaal', en: 'Equipment' },
  'eventmat.tab_een': { nl: 'Materiaal · {aantal}', en: 'Equipment · {aantal}' },
  'eventmat.tab_meer': { nl: 'Materiaal · {aantal}', en: 'Equipment · {aantal}' },
  'eventmat.titel': { nl: 'Vastgelegd voor dit event', en: 'Reserved for this event' },
  'eventmat.periode_een': { nl: 'over {dagen} dag', en: 'across {dagen} day' },
  'eventmat.periode_meer': { nl: 'over {dagen} dagen', en: 'across {dagen} days' },
  'eventmat.stuks_een': { nl: '{aantal} stuk', en: '{aantal} item' },
  'eventmat.stuks_meer': { nl: '{aantal} stuks', en: '{aantal} items' },
  'eventmat.nog_niets': {
    nl: 'Er ligt nog niets vast. Wat je hieronder kiest, staat meteen in de kalender van het magazijn.',
    en: 'Nothing is reserved yet. What you pick below goes straight into the warehouse calendar.',
  },
  'eventmat.van_tot': { nl: 'van {van} tot {tot}', en: 'from {van} to {tot}' },
  'eventmat.terug_op': { nl: 'terug op {dag}', en: 'back on {dag}' },
  'eventmat.erbij': { nl: 'Materiaal erbij', en: 'Add equipment' },
  'eventmat.welk_stuk': { nl: 'Welk stuk', en: 'Which item' },
  'eventmat.kies': { nl: 'Kies…', en: 'Choose…' },
  'eventmat.hoeveel': { nl: 'Hoeveel', en: 'How many' },
  'eventmat.vastleggen': { nl: 'Vastleggen', en: 'Reserve' },
  'eventmat.uit': { nl: 'Is buiten', en: 'Out' },
  'eventmat.terug': { nl: 'Is terug', en: 'Back' },
  'eventmat.mislukt': { nl: 'Het is niet vastgelegd.', en: 'It was not reserved.' },
  'eventmat.past': { nl: 'Past: er zijn er {vrij} vrij in deze periode.', en: 'Fits: {vrij} free in this period.' },
  'eventmat.te_weinig': {
    nl: 'Er zijn er maar {vrij} vrij en je vraagt er {gevraagd}. Vastleggen mag — bijhuren of de andere klant bellen is dan aan jou.',
    en: 'Only {vrij} are free and you are asking for {gevraagd}. You may reserve anyway — hiring in or calling the other customer is then up to you.',
  },
  'eventmat.geen_datum': { nl: 'Eerst een datum', en: 'A date first' },
  'eventmat.geen_datum_uitleg': {
    nl: 'Materiaal wordt per dag vastgelegd, dus dit event heeft eerst een datum nodig.',
    en: 'Equipment is reserved by the day, so this event needs a date first.',
  },

  'eventmat.stand.optie': { nl: 'In optie', en: 'On option' },
  'eventmat.stand.vast': { nl: 'Vast', en: 'Booked' },
  'eventmat.stand.uit': { nl: 'Uit', en: 'Out' },
  'eventmat.stand.terug': { nl: 'Terug', en: 'Back' },
  'eventmat.stand.geannuleerd': { nl: 'Afgezegd', en: 'Cancelled' },
}
