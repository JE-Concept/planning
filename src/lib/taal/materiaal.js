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

  // ─── Een artikel beheren ──────────────────────────────────────────────────
  'materiaal.los': { nl: 'Los te huren', en: 'Instant rental' },
  'materiaal.los_uitleg': {
    nl: 'Dit stuk kan een klant zelf op de verhuursite reserveren en afrekenen.',
    en: 'A customer can reserve and pay for this item themselves on the rental site.',
  },

  'artikel.nieuw': { nl: 'Nieuw artikel', en: 'New item' },
  'artikel.wijzigen': { nl: 'Artikel wijzigen', en: 'Edit item' },
  'artikel.naam': { nl: 'Naam', en: 'Name' },
  'artikel.categorie': { nl: 'Categorie', en: 'Category' },
  'artikel.categorie_plaats': { nl: 'Tenten, meubilair, koeling…', en: 'Tents, furniture, cooling…' },
  'artikel.omschrijving': { nl: 'Omschrijving', en: 'Description' },
  'artikel.aantal': { nl: 'Aantal in huis', en: 'Owned' },
  'artikel.aantal_hint': { nl: 'Hoeveel stuks we er werkelijk hebben.', en: 'How many we actually own.' },
  'artikel.per_dag': { nl: 'Per dag (€)', en: 'Per day (€)' },
  'artikel.weekend': { nl: 'Weekend (€)', en: 'Weekend (€)' },
  'artikel.weekend_hint': { nl: 'Vrijdag tot maandag.', en: 'Friday to Monday.' },
  'artikel.week': { nl: 'Per week (€)', en: 'Per week (€)' },
  'artikel.waarborg': { nl: 'Waarborg (€)', en: 'Deposit (€)' },
  'artikel.waarborg_hint': {
    nl: 'Wordt vooruitbetaald en teruggestort. Staat buiten de btw.',
    en: 'Paid up front and refunded. Outside VAT.',
  },
  'artikel.leeg_is_geen_prijs': {
    nl: 'Leeg laten betekent "geen tarief", niet "gratis".',
    en: 'Leaving this empty means "no rate", not "free".',
  },
  'artikel.uitloop': { nl: 'Uitloopdagen', en: 'Turnaround days' },
  'artikel.uitloop_hint': {
    nl: 'Dagen na de huur waarop het stuk nog niet opnieuw kan: wassen, nakijken, terugrijden.',
    en: 'Days after the hire when the item is not yet available again: washing, checking, return transport.',
  },
  'artikel.min_dagen': { nl: 'Minstens … dagen', en: 'Minimum days' },
  'artikel.min_dagen_hint': {
    nl: 'Korter verhuren kost meer aan behandeling dan het opbrengt.',
    en: 'A shorter hire costs more in handling than it brings in.',
  },
  'artikel.vervangwaarde': { nl: 'Vervangwaarde (€)', en: 'Replacement value (€)' },
  'artikel.vervangwaarde_hint': {
    nl: 'Wat een nieuw stuk kost. Nodig bij schade en voor de verzekering.',
    en: 'What a new one costs. Needed for damage and insurance.',
  },
  'artikel.direct': { nl: 'Mag zonder offerte gehuurd worden', en: 'Can be rented without a quote' },
  'artikel.direct_uitleg': {
    nl: 'Het stuk komt op de verhuursite te staan en een klant kan het zelf reserveren en betalen. Zet dit alleen aan voor wat iemand zelf kan komen halen.',
    en: 'The item appears on the rental site and a customer can reserve and pay for it themselves. Only switch this on for what someone can collect themselves.',
  },
  'artikel.direct_geen_prijs': {
    nl: 'Kan pas met een dagprijs: zonder tarief valt er niets af te rekenen.',
    en: 'Needs a daily rate first: without one there is nothing to charge.',
  },
  'artikel.voorbeeld': { nl: 'Wat een klant zou betalen —', en: 'What a customer would pay —' },
  'artikel.voorbeeld_dagen': { nl: '{aantal} d.', en: '{aantal} d.' },
  'artikel.mislukt': { nl: 'Het artikel is niet bewaard.', en: 'The item was not saved.' },

  // ─── Online afgerekende verhuur ───────────────────────────────────────────
  'huurorder.titel': { nl: 'Online afgerekend', en: 'Paid online' },
  'huurorder.uitleg': { nl: 'De laatste huren van de verhuursite', en: 'The latest hires from the rental site' },
  'huurorder.onbekend': { nl: 'Zonder naam', en: 'No name' },
  'huurorder.regel': { nl: '{stuks} · {van} tot {tot}', en: '{stuks} · {van} to {tot}' },
  'huurorder.stand.wacht_op_betaling': { nl: 'Wacht op betaling', en: 'Awaiting payment' },
  'huurorder.stand.betaald': { nl: 'Betaald', en: 'Paid' },
  'huurorder.stand.vervallen': { nl: 'Vervallen', en: 'Expired' },
  'huurorder.stand.nakijken': { nl: 'Nakijken', en: 'Needs checking' },
}
