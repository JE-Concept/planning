/**
 * De teksten van de eventschermen en de klanten.
 *
 * Wat hier met opzet níét in staat:
 *
 * - De statusnamen van de pijplijn ("aanvraag", "offerte verstuurd", "ready to
 *   invoice", …). Die komen uit de lijst in de database en zijn daar door een
 *   beheerder te hernoemen; ze hier nog eens vertalen zou twee bronnen maken
 *   die uit elkaar lopen.
 * - Namen van formules, klanten en events, en de categorieën van een
 *   bestellijst: gegevens, geen schermtekst.
 * - "pax", "billable", "Formule", "Concept": zo praat het team, in beide talen.
 *
 * De sleutel zegt waar de tekst staat, niet wat er staat.
 */
export default {

  // ── Events: de weergaven ───────────────────────────────────────────────
  'events.weergave.lijst': { nl: 'Lijst', en: 'List' },
  'events.weergave.bord': { nl: 'Bord', en: 'Board' },
  'events.weergave.kalender': { nl: 'Kalender', en: 'Calendar' },
  'events.weergave.archief': { nl: 'Archief', en: 'Archive' },
  'events.laden': { nl: 'Events laden…', en: 'Loading events…' },
  'events.lopend': { nl: '{aantal} lopend', en: '{aantal} ongoing' },
  'events.los_event': { nl: 'Los event', en: 'Standalone event' },
  'events.klant_onbekend': { nl: 'Klant onbekend', en: 'Customer unknown' },
  'events.aantal_een': { nl: '{aantal} event', en: '{aantal} event' },
  'events.aantal_meer': { nl: '{aantal} events', en: '{aantal} events' },
  'events.over_dagen_een': { nl: 'over {aantal} dag', en: 'in {aantal} day' },
  'events.over_dagen_meer': { nl: 'over {aantal} dagen', en: 'in {aantal} days' },
  'events.voortgang': { nl: '{gedaan}/{totaal} taken', en: '{gedaan}/{totaal} tasks' },
  'events.geen_taken': { nl: 'Geen taken', en: 'No tasks' },

  // ── Events: de cijfers boven de lijst ──────────────────────────────────
  'events.stat.lopend': { nl: 'Lopend', en: 'Ongoing' },
  'events.stat.gasten': { nl: '{aantal} gasten in totaal', en: '{aantal} guests in total' },
  'events.stat.eerste': { nl: 'Eerste: {dag}', en: 'First: {dag}' },
  'events.stat.niets_gepland': { nl: 'Nog niets gepland', en: 'Nothing planned yet' },
  'events.stat.factureren': { nl: 'Te factureren', en: 'To invoice' },
  'events.stat.wacht_een': { nl: '{aantal} event wacht op factuur', en: '{aantal} event awaiting its invoice' },
  'events.stat.wacht_meer': { nl: '{aantal} events wachten op factuur', en: '{aantal} events awaiting their invoice' },
  'events.leeg': { nl: 'Geen lopende events voor deze selectie.', en: 'No ongoing events for this selection.' },

  // ── Events: de drie fasen van de lijstweergave ─────────────────────────
  // De fasen zelf staan in @lib/pipeline; hier staat alleen hoe ze heten.
  'events.fase.verkoop': { nl: 'Verkoop', en: 'Sales' },
  'events.fase.verkoop_sub': { nl: 'Aanvraag tot offerte', en: 'Request to quote' },
  'events.fase.voorbereiding': { nl: 'Voorbereiding', en: 'Preparation' },
  'events.fase.voorbereiding_sub': { nl: 'Akkoord tot draaiboek', en: 'Accepted to run sheet' },
  'events.fase.facturatie': { nl: 'Facturatie', en: 'Invoicing' },
  'events.fase.facturatie_sub': { nl: 'Event voorbij', en: 'Event has passed' },

  // ── Events: het archief ────────────────────────────────────────────────
  'events.archief.titel': { nl: 'Archief', en: 'Archive' },
  'events.archief.jaar': { nl: 'Jaar', en: 'Year' },
  'events.archief.alle_jaren': { nl: 'Alle jaren', en: 'All years' },
  'events.archief.nieuwste': { nl: 'Nieuwste eerst', en: 'Newest first' },
  'events.archief.uitleg': {
    nl: 'Hier staat wat afgesloten is: alles op “Afgerond”, plus wat langer dan {dagen} dagen geleden gefactureerd werd. Er wordt niets verwijderd — de offertes, facturen en documenten blijven bij het event staan.',
    en: 'This is what has been closed off: everything marked done, plus anything invoiced more than {dagen} days ago. Nothing is deleted — the quotes, invoices and documents stay with the event.',
  },
  'events.archief.leeg': {
    nl: 'Nog geen afgesloten events voor deze selectie.',
    en: 'No closed events for this selection yet.',
  },
  'events.archief.link_een': {
    nl: '{aantal} afgesloten event staat in het archief',
    en: '{aantal} closed event is in the archive',
  },
  'events.archief.link_meer': {
    nl: '{aantal} afgesloten events staan in het archief',
    en: '{aantal} closed events are in the archive',
  },

  // ── Een maand doorbladeren ─────────────────────────────────────────────
  'events.maand.vorige': { nl: 'Vorige maand', en: 'Previous month' },
  'events.maand.volgende': { nl: 'Volgende maand', en: 'Next month' },
  'events.maand.meer': { nl: '+{aantal} meer', en: '+{aantal} more' },

  // ── De fiche van een event ─────────────────────────────────────────────
  'events.fiche.klant': { nl: 'Klant', en: 'Customer' },
  'events.fiche.datum': { nl: 'Datum', en: 'Date' },
  'events.fiche.gasten': { nl: 'Gasten', en: 'Guests' },
  'events.fiche.kinderen_een': { nl: '{aantal} kind', en: '{aantal} child' },
  'events.fiche.kinderen_meer': { nl: '{aantal} kinderen', en: '{aantal} children' },
  'events.fiche.locatie': { nl: 'Locatie', en: 'Venue' },
  'events.locatie.hint': {
    nl: 'Kies een adres om de kaart te koppelen, of typ gewoon wat je kwijt wil.',
    en: 'Pick an address to attach the map, or just type whatever you need.',
  },
  'events.locatie.plaatshouder': { nl: 'Zoek een zaal of adres', en: 'Search a venue or address' },
  'events.locatie.lijst': { nl: 'Adressen', en: 'Addresses' },
  'events.locatie.openen': { nl: 'Op de kaart', en: 'On the map' },
  'events.fiche.formule': { nl: 'Formule', en: 'Formule' },
  'events.fiche.pp': { nl: '{bedrag} p.p.', en: '{bedrag} pp' },
  'events.fiche.offerte': { nl: 'Offerte', en: 'Quote' },
  'events.fiche.voorschot': { nl: 'Voorschot 40%', en: 'Deposit 40%' },
  'events.fiche.voorschot_van': { nl: 'voorschot {bedrag}', en: 'deposit {bedrag}' },
  'events.fiche.titel': { nl: 'Fiche', en: 'Details' },
  'events.fiche.geen_datum': { nl: 'nog geen datum', en: 'no date yet' },
  'events.fiche.verantwoordelijk': { nl: 'Verantwoordelijk', en: 'Owner' },
  'events.fiche.niemand': { nl: 'Nog niemand', en: 'Nobody yet' },
  'events.fiche.meerdaags': { nl: 'Meerdaags', en: 'Multi-day' },
  'events.fiche.meerdaags_hint': {
    nl: 'Duurt dit event meer dan één dag, vink dit aan.',
    en: 'Tick this if the event runs for more than one day.',
  },
  'events.fiche.tot_en_met': { nl: 'Tot en met', en: 'Until' },
  'events.fiche.duurt_dagen': { nl: '{aantal} dagen', en: '{aantal} days' },
  'events.fiche.medewerkers': { nl: 'Medewerkers', en: 'Crew' },
  'events.fiche.medewerkers_hint': {
    nl: 'Wie er die dag komt werken. Zij zien het event en de lijsten, geen prijzen.',
    en: 'Who is working that day. They see the event and the lists, not the prices.',
  },

  // ── Eén event ──────────────────────────────────────────────────────────
  'events.detail.laden': { nl: 'Event laden…', en: 'Loading event…' },
  'events.detail.bestaat_niet': { nl: 'Dit event bestaat niet (meer).', en: 'This event does not exist (any more).' },
  'events.detail.alle_events': { nl: 'Alle events', en: 'All events' },
  'events.detail.naar_alle': { nl: 'Naar alle events', en: 'Go to all events' },
  'events.detail.naar_stap': { nl: 'Naar {stap}', en: 'To {stap}' },
  'events.detail.terug_stap': { nl: 'Terug naar {stap}', en: 'Back to {stap}' },
  'events.detail.verwijderd': { nl: '{naam} is verwijderd.', en: '{naam} has been deleted.' },

  // ── De tabbladen van een event ─────────────────────────────────────────
  'events.tab.overzicht': { nl: 'Overzicht', en: 'Overview' },
  'events.tab.taken': { nl: 'Taken · {aantal}', en: 'Tasks · {aantal}' },
  'events.tab.bestellijst': { nl: 'Bestellijst · {aantal}', en: 'Order list · {aantal}' },
  'events.tab.draaiboek': { nl: 'Draaiboek', en: 'Run sheet' },
  'events.tab.bijlagen': { nl: 'Bijlagen', en: 'Attachments' },
  // ── Het klantenportaal ─────────────────────────────────────────────────
  'klant.portaal.titel': { nl: 'Klantenpagina', en: 'Customer page' },
  'klant.portaal.nog_niet': {
    nl: 'Nog geen link gemaakt.',
    en: 'No link created yet.',
  },
  'klant.portaal.maken': { nl: 'Link maken', en: 'Create link' },
  'klant.portaal.kopieren': { nl: 'Link kopiëren', en: 'Copy link' },
  'klant.portaal.gekopieerd': {
    nl: 'De link staat op je klembord. Daar volgt de klant al zijn dossiers.',
    en: 'The link is on your clipboard. The customer follows all their files there.',
  },
  'klant.portaal.gemaakt': {
    nl: 'De link staat er; selecteer hem hierboven om te kopiëren.',
    en: 'The link is there; select it above to copy it.',
  },

  'events.omschrijving.titel': { nl: 'Omschrijving', en: 'Description' },
  'events.omschrijving.plaatshouder': {
    nl: 'Waar gaat dit event over? Opbouw, plan B, afspraken met de klant — alles wat niet in een veld past.',
    en: 'What is this event about? Set-up, plan B, what was agreed with the customer — everything that does not fit a field.',
  },
  'events.notities.titel': { nl: 'Notities', en: 'Notes' },
  'events.notities.aantal_een': { nl: '{aantal} bericht', en: '{aantal} message' },
  'events.notities.aantal_meer': { nl: '{aantal} berichten', en: '{aantal} messages' },
  'events.notities.nog_niets': {
    nl: 'Nog niets gezegd over dit event. Wat je hier schrijft, komt bij de mensen die eraan werken.',
    en: 'Nothing said about this event yet. What you write here reaches the people working on it.',
  },
  'events.tab.tijd': { nl: 'Tijd · {tijd}', en: 'Time · {tijd}' },

  // ── De taken van een event ─────────────────────────────────────────────
  'events.taken.leeg': {
    nl: 'Nog geen taken. Typ er hieronder een en druk Enter.',
    en: 'No tasks yet. Type one below and press Enter.',
  },
  'events.taken.toevoegen': { nl: 'Taak toevoegen', en: 'Add a task' },
  'events.taken.toevoegen_hint': { nl: 'Taak toevoegen en Enter', en: 'Add a task and press Enter' },

  // ── Het draaiboek ──────────────────────────────────────────────────────
  'events.draaiboek.leeg': {
    nl: 'Nog geen draaiboek. Het wordt opgebouwd zodra de planning loopt.',
    en: 'No run sheet yet. It gets built up once the planning starts.',
  },
  'events.draaiboek.tijd': { nl: 'Tijd', en: 'Time' },
  'events.draaiboek.wat': { nl: 'Wat', en: 'What' },
  'events.draaiboek.wat_hint': { nl: 'Wat gebeurt er', en: 'What happens' },
  'events.draaiboek.wie': { nl: 'Wie', en: 'Who' },
  'events.draaiboek.regel': { nl: 'Regel', en: 'Line' },
  'events.draaiboek.regel_weg': { nl: 'Regel verwijderen', en: 'Delete line' },

  // ── Notities en het dossier ────────────────────────────────────────────
  'events.notities.toevoegen': { nl: 'Notitie toevoegen', en: 'Add a note' },
  'events.notities.plaatshouder': {
    nl: 'Iets doorgeven… typ @ om iemand aan te spreken.',
    en: 'Say something… type @ to reach someone.',
  },
  'events.notities.vermelden': { nl: 'Iemand vermelden', en: 'Mention someone' },
  'events.notities.vermeld_hint': { nl: '@ spreekt iemand aan', en: '@ reaches someone' },
  'events.notities.bewaren': { nl: 'Notitie bewaren', en: 'Save note' },
  'events.notities.notitie_weg': { nl: 'Notitie verwijderen', en: 'Delete note' },
  'events.notities.notitie_weg_vraag': { nl: 'Deze notitie verwijderen?', en: 'Delete this note?' },

  // ── Bijlagen en documenten ─────────────────────────────────────────────
  'events.bijlagen.titel': { nl: 'Bijlagen', en: 'Attachments' },
  'events.bijlagen.bezig': { nl: 'Bezig met opladen…', en: 'Uploading…' },
  'events.bijlagen.sleep': { nl: 'Sleep een bestand hierheen', en: 'Drag a file here' },
  'events.doc.titel': { nl: 'Documenten', en: 'Documents' },
  'events.doc.toevoegen': { nl: '+ Bestand', en: '+ File' },
  'events.doc.bezig': { nl: 'Bezig…', en: 'Working…' },
  'events.doc.kiezen': { nl: 'Bestand kiezen', en: 'Choose a file' },
  'events.doc.leeg': {
    nl: 'Nog niets. Logo’s, huisstijl, contracten, plannen — alles wat je later terug wil vinden.',
    en: 'Nothing yet. Logos, branding, contracts, floor plans — anything you will want to find again later.',
  },
  'events.doc.weg': { nl: 'Weg', en: 'Remove' },
  'events.doc.weg_vraag': { nl: '"{naam}" verwijderen?', en: 'Delete "{naam}"?' },
  'events.doc.toegevoegd_een': { nl: 'Bestand toegevoegd.', en: 'File added.' },
  'events.doc.toegevoegd_meer': { nl: '{aantal} bestanden toegevoegd.', en: '{aantal} files added.' },

  // ── De tijd op een event ───────────────────────────────────────────────
  'events.tijd.totaal': { nl: 'Totaal geboekt', en: 'Total logged' },
  'events.tijd.tot_event': { nl: 'Tot het event', en: 'Until the event' },
  'events.tijd.voorbij': { nl: 'Voorbij', en: 'Passed' },
  'events.tijd.leeg': {
    nl: 'Nog geen tijd geboekt op dit event. Start een timer vanaf een taak.',
    en: 'No time logged on this event yet. Start a timer from a task.',
  },
  'events.tijd.losse': { nl: 'Tijd', en: 'Time' },
  'events.tijd.intern': { nl: 'Intern', en: 'Internal' },

  // ── Eén taak in de lijst ───────────────────────────────────────────────
  'events.taak.afvinken': { nl: 'Afvinken', en: 'Tick off' },
  'events.taak.afgerond': { nl: 'Afgerond', en: 'Done' },
  'events.taak.geen_deadline': { nl: 'Geen deadline', en: 'No deadline' },
  'events.taak.te_laat_een': { nl: '1 dag te laat', en: '1 day late' },
  'events.taak.te_laat_meer': { nl: '{aantal} dagen te laat', en: '{aantal} days late' },
  'events.taak.geweest': { nl: 'geweest', en: 'passed' },
  'events.taak.tijd_geboekt': { nl: 'Tijd geboekt.', en: 'Time logged.' },
  'events.taak.checklist_toevoegen': { nl: 'Checklistpunt toevoegen', en: 'Add a checklist item' },
  'events.taak.checklist_hint': { nl: '+ checklistpunt en Enter', en: '+ checklist item and Enter' },
  'events.taak.geen_checklist': { nl: 'Geen checklist. ', en: 'No checklist. ' },
  'events.taak.geschat': { nl: 'Geschat: {tijd}', en: 'Estimated: {tijd}' },
  'events.taak.uren': { nl: '{uren} u', en: '{uren} h' },
  'events.taak.details': { nl: 'Details, checklist en notities', en: 'Details, checklist and notes' },
  'events.prio.urgent': { nl: 'Urgent', en: 'Urgent' },
  'events.prio.hoog': { nl: 'Hoog', en: 'High' },

  // ── De velden van de fiche ─────────────────────────────────────────────
  'events.velden.naam': { nl: 'Naam', en: 'Name' },
  'events.velden.datum': { nl: 'Datum event', en: 'Event date' },
  'events.velden.kinderen': { nl: 'Waarvan kinderen', en: 'Of which children' },
  'events.velden.offerte': { nl: 'Offerte (€)', en: 'Quote (€)' },
  'events.velden.formule_hint': { nl: 'bv. Walking dinner', en: 'e.g. Walking dinner' },
  'events.velden.concept': { nl: 'Concept', en: 'Concept' },
  'events.velden.type': { nl: 'Type', en: 'Type' },
  'events.velden.type_hint': { nl: 'bv. Huwelijk', en: 'e.g. Wedding' },
  'events.velden.ontbreekt': {
    nl: 'Nog in te vullen voor de offerte: {wat}.',
    en: 'Still to fill in before the quote: {wat}.',
  },
  // De vier dingen die een aanvraag een offerte maken. Ze komen als woord uit
  // @lib/pipeline; hier staat hoe ze in een zin passen.
  'events.ontbreekt.klant': { nl: 'klant', en: 'customer' },
  'events.ontbreekt.datum': { nl: 'datum', en: 'date' },
  'events.ontbreekt.gasten': { nl: 'gasten', en: 'guests' },
  'events.ontbreekt.offertebedrag': { nl: 'offertebedrag', en: 'quote amount' },

  // ── Een nieuw event ────────────────────────────────────────────────────
  'events.postvak_aantal': {
    nl: 'Postvak — {aantal} stuk(s) post die nergens bij hoort',
    en: 'Inbox — {aantal} message(s) that belong nowhere yet',
  },
  'events.nieuw': { nl: 'Nieuw event', en: 'New event' },
  'events.nieuw.custom': { nl: 'Custom event', en: 'Custom event' },
  'events.nieuw.uit_formule': { nl: 'Bestaande formule', en: 'Existing formule' },
  'events.nieuw.naam_hint': { nl: 'bv. Trouw Tom en Sara', en: 'e.g. Tom and Sara’s wedding' },
  'events.nieuw.datum_hint': {
    nl: 'Deadlines van het template tellen hiervan terug',
    en: 'The template’s deadlines count back from this date',
  },
  'events.nieuw.template': { nl: 'Start van template', en: 'Start from a template' },
  'events.nieuw.geen_lijst': {
    nl: 'Er is nog geen eventlijst met de statuspijplijn. Maak ze aan in Instellingen → Lijsten.',
    en: 'There is no event list with the status pipeline yet. Create one in Settings → Lists.',
  },
  'events.nieuw.geen_formules': {
    nl: 'Er zijn nog geen formules. Een beheerder maakt ze aan in Instellingen → Formules.',
    en: 'There are no formules yet. An administrator creates them in Settings → Formules.',
  },
  'events.nieuw.personen': { nl: 'Aantal personen', en: 'Number of people' },
  'events.nieuw.personen_hint': {
    nl: 'Hierop wordt de bestellijst berekend',
    en: 'The order list is worked out on this number',
  },
  'events.nieuw.vast': { nl: ' + {bedrag} vast', en: ' + {bedrag} fixed' },
  'events.nieuw.btw': { nl: 'btw {percent}% op {basis}', en: 'VAT {percent}% on {basis}' },
  'events.nieuw.totaal': { nl: 'Totaal incl. btw', en: 'Total incl. VAT' },
  'events.nieuw.bestellijst': { nl: 'Bestellijst · {aantal} regels', en: 'Order list · {aantal} lines' },
  'events.nieuw.niets_bestellen': {
    nl: 'Nog niets te bestellen — vul een aantal personen in.',
    en: 'Nothing to order yet — fill in a number of people.',
  },
  'events.nieuw.en_meer': { nl: ', en {aantal} meer', en: ', and {aantal} more' },
  'events.nieuw.taken': { nl: 'Taken: {template} · {samenvatting}', en: 'Tasks: {template} · {samenvatting}' },
  'events.nieuw.geen_template': { nl: 'geen', en: 'none' },
  'events.nieuw.uitleg_formule': {
    nl: 'De prijs en de bestellijst staan meteen op het event. Alles blijft daarna aanpasbaar.',
    en: 'The price and the order list land on the event straight away. Everything stays editable afterwards.',
  },
  'events.nieuw.uitleg_custom': {
    nl: 'Gasten en offerte vul je aan op de fiche. Samen met klant en datum zijn ze verplicht vanaf de offertestap.',
    en: 'Guests and quote you fill in on the details. Together with customer and date they are required from the quote step onwards.',
  },
  'events.nieuw.aanmaken': { nl: 'Event aanmaken', en: 'Create event' },
  'events.nieuw.gemaakt': { nl: '{naam} staat in de planning.', en: '{naam} is in the planning.' },

  // ── Een pagina die niet bestaat ────────────────────────────────────────
  'events.weg.titel': { nl: 'Deze pagina bestaat niet', en: 'This page does not exist' },
  'events.weg.tekst': {
    nl: 'De link klopt niet meer, of het bord is verwijderd.',
    en: 'The link is out of date, or the board has been deleted.',
  },
  'events.weg.knop': { nl: 'Naar vandaag', en: 'Go to today' },

  // ── De bestellijst van een event ───────────────────────────────────────
  'bestellijst.titel': { nl: 'Bestellijst', en: 'Order list' },
  'bestellijst.besteld': { nl: '{klaar} van {totaal} besteld', en: '{klaar} of {totaal} ordered' },
  'bestellijst.berekend_op': { nl: 'Berekend op {aantal} personen', en: 'Worked out for {aantal} people' },
  'bestellijst.herberekenen': { nl: 'Herberekenen', en: 'Recalculate' },
  'bestellijst.herbereken_vraag': {
    nl: 'De lijst opnieuw berekenen op {aantal} personen? Handmatige wijzigingen gaan verloren.',
    en: 'Work the list out again for {aantal} people? Anything changed by hand will be lost.',
  },
  'bestellijst.herberekend': {
    nl: 'Bestellijst herberekend op {aantal} personen.',
    en: 'Order list worked out again for {aantal} people.',
  },
  'bestellijst.verschil': {
    nl: 'De fiche staat op {pax} personen, de lijst is op {berekend} berekend. Herbereken ze, of pas de aantallen hieronder aan.',
    en: 'The details say {pax} people, the list was worked out for {berekend}. Recalculate it, or adjust the numbers below.',
  },
  'bestellijst.leeg': {
    nl: 'Nog geen bestellijst. Ze rolt automatisch uit een formule; hieronder kun je ook zelf regels toevoegen.',
    en: 'No order list yet. It rolls out of a formule automatically; you can also add lines yourself below.',
  },
  'bestellijst.regels_een': { nl: '{aantal} regel', en: '{aantal} line' },
  'bestellijst.regels_meer': { nl: '{aantal} regels', en: '{aantal} lines' },
  'bestellijst.artikel': { nl: 'Artikel', en: 'Item' },
  'bestellijst.regel_toevoegen': { nl: 'Regel toevoegen', en: 'Add a line' },
  'bestellijst.aria_besteld': { nl: '{item} besteld', en: '{item} ordered' },
  'bestellijst.aria_aantal': { nl: 'Aantal {item}', en: 'Quantity of {item}' },
  'bestellijst.aria_categorie': { nl: 'Categorie van {item}', en: 'Category of {item}' },
  'bestellijst.aria_weg': { nl: '{item} van de lijst halen', en: 'Take {item} off the list' },

  // ── Klanten: de lijst ──────────────────────────────────────────────────
  'klant.actief': { nl: '{aantal} actief', en: '{aantal} active' },
  'klant.zoek_hint': { nl: 'Zoek op naam, btw of stad', en: 'Search by name, VAT or town' },
  'klant.zoek_label': {
    nl: 'Zoeken op naam, btw-nummer, stad of contactpersoon',
    en: 'Search by name, VAT number, town or contact',
  },
  'klant.nieuw': { nl: '+ Klant', en: '+ Customer' },
  'klant.aangemaakt': { nl: 'Klant aangemaakt.', en: 'Customer created.' },
  'klant.geen_gevonden': { nl: 'Geen klant gevonden.', en: 'No customer found.' },
  'klant.leeg': {
    nl: 'Nog geen klanten. Maak er een aan met “+ Klant”.',
    en: 'No customers yet. Create one with “+ Customer”.',
  },
  'klant.uit': { nl: 'uit', en: 'off' },
  'klant.geen_gegevens': { nl: 'Geen gegevens', en: 'No details' },

  // ── Klanten: de fiche ──────────────────────────────────────────────────
  'klant.kop_een': { nl: '{aantal} event · {bedrag}', en: '{aantal} event · {bedrag}' },
  'klant.kop_meer': { nl: '{aantal} events · {bedrag}', en: '{aantal} events · {bedrag}' },
  'klant.terughalen': { nl: 'Terughalen', en: 'Restore' },
  'klant.uit_gebruik': { nl: 'Uit gebruik nemen', en: 'Take out of use' },
  'klant.uit_gebruik_vraag': {
    nl: 'Klant uit gebruik nemen? De events blijven bewaard.',
    en: 'Take this customer out of use? The events are kept.',
  },
  'klant.weg_vraag': { nl: 'Deze klant definitief verwijderen?', en: 'Delete this customer for good?' },
  'klant.niet_weg_een': {
    nl: '{aantal} event — daarom niet te verwijderen',
    en: '{aantal} event — which is why it cannot be deleted',
  },
  'klant.niet_weg_meer': {
    nl: '{aantal} events — daarom niet te verwijderen',
    en: '{aantal} events — which is why it cannot be deleted',
  },
  'klant.bedrijfsnaam': { nl: 'Bedrijfsnaam', en: 'Company name' },
  'klant.btw': { nl: 'Btw-nummer', en: 'VAT number' },
  'klant.merk': { nl: 'Merk', en: 'Brand' },
  'klant.merk_hint': {
    nl: 'Onder welk merk valt deze klant meestal?',
    en: 'Which brand does this customer usually fall under?',
  },
  'klant.email': { nl: 'E-mail', en: 'Email' },
  'klant.telefoon': { nl: 'Telefoon', en: 'Phone' },
  'klant.website': { nl: 'Website', en: 'Website' },
  'klant.straat': { nl: 'Straat en nummer', en: 'Street and number' },
  'klant.postcode': { nl: 'Postcode', en: 'Postcode' },
  'klant.gemeente': { nl: 'Gemeente', en: 'Town' },
  'klant.land': { nl: 'Land', en: 'Country' },

  // ── Klanten: facturatie ────────────────────────────────────────────────
  'klant.facturatie': { nl: 'Facturatie', en: 'Invoicing' },
  'klant.facturatie_anders': {
    nl: 'Wijkt af van de gegevens hierboven',
    en: 'Differs from the details above',
  },
  'klant.facturatie_leeg': {
    nl: 'Leeg = dezelfde gegevens als hierboven',
    en: 'Empty = the same details as above',
  },
  'klant.factuur_email': { nl: 'Factuur-e-mail', en: 'Invoice email' },
  'klant.factuur_email_hint': { nl: 'Facturen naar {email}', en: 'Invoices go to {email}' },
  'klant.factuur_email_plaats': { nl: 'boekhouding@…', en: 'accounts@…' },
  'klant.factuur_naar': { nl: 'Factuur naar {adres}', en: 'Invoice to {adres}' },
  'klant.geen_adres': { nl: 'nog geen adres', en: 'no address yet' },

  // ── Klanten: contactpersonen ───────────────────────────────────────────
  'klant.contacten': { nl: 'Contactpersonen ({aantal})', en: 'Contacts ({aantal})' },
  'klant.bel': { nl: 'bel {naam}', en: 'ring {naam}' },
  'klant.contact_nieuw': { nl: '+ Contact', en: '+ Contact' },
  'klant.contact_naam': { nl: 'Naam', en: 'Name' },
  'klant.contact_rol': { nl: 'Rol', en: 'Role' },
  'klant.contact_rol_hint': {
    nl: 'Zaakvoerder, eventmanager, boekhouding…',
    en: 'Owner, event manager, accounts…',
  },
  'klant.hoofdcontact': { nl: 'Hoofdcontactpersoon', en: 'Main contact' },
  'klant.contact_weg': { nl: 'Contact weg', en: 'Remove contact' },
  'klant.contact_weg_vraag': { nl: 'Deze contactpersoon verwijderen?', en: 'Delete this contact?' },
  'klant.geen_contacten': { nl: 'Nog geen contactpersonen.', en: 'No contacts yet.' },

  // ── Klanten: wat ze waard zijn ─────────────────────────────────────────
  'klant.documenten': { nl: 'Logo’s en documenten', en: 'Logos and documents' },
  'klant.te_factureren': { nl: 'Nog te factureren ({aantal})', en: 'Still to invoice ({aantal})' },
  'klant.openstaand': { nl: 'Openstaand', en: 'Outstanding' },
  'klant.historiek_een': { nl: 'Historiek ({aantal} event)', en: 'History ({aantal} event)' },
  'klant.historiek_meer': { nl: 'Historiek ({aantal} events)', en: 'History ({aantal} events)' },
  'klant.historiek_leeg': {
    nl: 'Nog niets. Koppel een event aan deze klant op de fiche van dat event.',
    en: 'Nothing yet. Link an event to this customer on that event’s details.',
  },
  'klant.geen_datum': { nl: 'geen datum', en: 'no date' },
  'klant.samen_offertes': { nl: 'Samen aan offertes', en: 'Quoted in total' },
  'klant.losse_taken': { nl: 'Losse taken ({aantal})', en: 'Loose tasks ({aantal})' },
  'klant.notities': { nl: 'Notities', en: 'Notes' },
  'klant.notities_hint': {
    nl: 'Afspraken, voorkeuren, gevoeligheden…',
    en: 'Agreements, preferences, sensitivities…',
  },

  // ── De klant van een event kiezen ──────────────────────────────────────
  'klant.kiezen.gekoppeld': {
    nl: 'Gekoppeld — historiek en facturatie staan op de fiche van {naam}.',
    en: 'Linked — history and invoicing live on {naam}’s record.',
  },
  'klant.kiezen.hint': {
    nl: 'Kies een klant, maak er een aan, of typ een naam voor een particulier.',
    en: 'Pick a customer, create one, or type a name for a private client.',
  },
  'klant.kiezen.veld': { nl: 'Klant van dit event', en: 'Customer of this event' },
  'klant.kiezen.geen': { nl: 'Geen klant uit de lijst', en: 'No customer from the list' },
  'klant.kiezen.nieuw': { nl: '+ Nieuwe klant aanmaken…', en: '+ Create a new customer…' },
  'klant.kiezen.naam': { nl: 'Naam van de klant', en: 'Name of the customer' },
  'klant.kiezen.naam_hint': { nl: 'bv. Blum België', en: 'e.g. Blum België' },
  'klant.kiezen.email_hint': {
    nl: 'De rest van de gegevens vul je aan op de klantfiche.',
    en: 'The rest of the details you fill in on the customer record.',
  },
  'klant.kiezen.aanmaken': { nl: 'Klant aanmaken', en: 'Create customer' },
  'klant.kiezen.toegevoegd': { nl: '{naam} staat nu bij de klanten.', en: '{naam} is now with the customers.' },
  'klant.kiezen.vrije_naam': { nl: 'Klantnaam', en: 'Customer name' },
  'klant.kiezen.vrije_hint': {
    nl: 'Zonder fiche: geen historiek, geen btw-nummer.',
    en: 'Without a record: no history, no VAT number.',
  },
  'klant.kiezen.vrije_plaats': { nl: 'bv. Familie Peeters', en: 'e.g. the Peeters family' },
}
