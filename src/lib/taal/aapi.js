/**
 * De teksten van de planning uit AAPI.
 *
 * "Shift" en niet "dienst": zo noemt de ploeg het, en zo staat het ook in AAPI
 * zelf. Een tweede woord voor hetzelfde ding is een tweede ding om uit te
 * leggen.
 */
export default {
  'nav.planning': { nl: 'Planning', en: 'Planning' },

  'aapi.titel': { nl: 'Planning', en: 'Planning' },
  'aapi.eyebrow': { nl: 'Uit AAPI', en: 'From AAPI' },
  'aapi.uitleg': {
    nl: 'Wie wanneer werkt, zoals het in AAPI staat. Shifts bij Evenementen hangen aan een event.',
    en: 'Who works when, as it stands in AAPI. Shifts in Events are linked to an event.',
  },

  'aapi.tab.kalender': { nl: 'Kalender', en: 'Calendar' },
  'aapi.tab.import': { nl: 'Import', en: 'Import' },

  // ── De kalender ─────────────────────────────────────────────────────────
  'aapi.week': { nl: 'Week', en: 'Week' },
  'aapi.maand': { nl: 'Maand', en: 'Month' },
  'aapi.vandaag': { nl: 'Vandaag', en: 'Today' },
  'aapi.vorige': { nl: 'Vorige', en: 'Previous' },
  'aapi.volgende': { nl: 'Volgende', en: 'Next' },
  'aapi.niemand': { nl: 'Niemand ingepland', en: 'Nobody scheduled' },
  'aapi.aantal_dag': { nl: '{aantal} ingepland', en: '{aantal} scheduled' },
  'aapi.leeg': { nl: 'Er staat nog geen planning', en: 'No planning yet' },
  'aapi.leeg_uitleg': {
    nl: 'Importeer de "Planning Overview" uit AAPI; daarna staat ze hier.',
    en: 'Import the "Planning Overview" from AAPI; it appears here afterwards.',
  },

  'aapi.filter.afdeling': { nl: 'Afdeling', en: 'Department' },
  'aapi.filter.medewerker': { nl: 'Medewerker', en: 'Employee' },
  'aapi.filter.alles': { nl: 'Alles', en: 'All' },
  'aapi.filter.enkel_events': { nl: 'Enkel Evenementen', en: 'Events only' },
  'aapi.filter.enkel_problemen': { nl: 'Enkel wat aandacht vraagt', en: 'Only what needs attention' },
  'aapi.filter.toon_geannuleerd': { nl: 'Toon geannuleerde', en: 'Show cancelled' },

  // ── De afdelingen en statuten ───────────────────────────────────────────
  'aapi.afdeling.bar': { nl: 'Bar', en: 'Bar' },
  'aapi.afdeling.zaal': { nl: 'Zaal', en: 'Floor' },
  'aapi.afdeling.keuken': { nl: 'Keuken', en: 'Kitchen' },
  'aapi.afdeling.evenementen': { nl: 'Evenementen', en: 'Events' },

  'aapi.statuut.vast': { nl: 'Vast', en: 'Permanent' },
  'aapi.statuut.student': { nl: 'Student', en: 'Student' },
  'aapi.statuut.flexi': { nl: 'Flexi', en: 'Flexi' },
  'aapi.statuut.zelfstandig': { nl: 'Zelfstandig', en: 'Self-employed' },
  'aapi.statuut.extern': { nl: 'Extern', en: 'External' },
  'aapi.statuut.onbekend': { nl: 'Onbekend', en: 'Unknown' },

  // ── De stand van een shift ──────────────────────────────────────────────
  'aapi.stand.gepland': { nl: 'Gepland', en: 'Scheduled' },
  'aapi.stand.voorgesteld': { nl: 'Voorgesteld', en: 'Suggested' },
  'aapi.stand.twijfel': { nl: 'Welk event?', en: 'Which event?' },
  'aapi.stand.ongekoppeld': { nl: 'Geen event', en: 'No event' },
  'aapi.stand.geannuleerd': { nl: 'Geannuleerd', en: 'Cancelled' },
  'aapi.stand.verdwenen': { nl: 'Niet meer in AAPI', en: 'No longer in AAPI' },

  'aapi.koppeling.auto': { nl: 'Vanzelf gekoppeld', en: 'Linked automatically' },
  'aapi.koppeling.manual': { nl: 'Met de hand gekoppeld', en: 'Linked by hand' },
  'aapi.koppeling.ambiguous': { nl: 'Meerdere events mogelijk', en: 'Several events possible' },
  'aapi.koppeling.unlinked': { nl: 'Nog niet gekoppeld', en: 'Not linked yet' },
  'aapi.koppeling.none': { nl: 'Hoort bij geen event', en: 'Belongs to no event' },
  'aapi.koppeling.nvt': { nl: 'Geen eventafdeling', en: 'Not an event department' },

  // ── Het detail van een shift ────────────────────────────────────────────
  'aapi.shift.titel': { nl: 'Shift', en: 'Shift' },
  'aapi.shift.gepland_van': { nl: 'Gepland', en: 'Scheduled' },
  'aapi.shift.oorspronkelijk': { nl: 'Oorspronkelijk', en: 'Originally' },
  'aapi.shift.pauze': { nl: '{minuten} min pauze', en: '{minuten} min break' },
  'aapi.shift.netto': { nl: '{uren} netto', en: '{uren} net' },
  'aapi.shift.vestiging': { nl: 'Vestiging', en: 'Establishment' },
  'aapi.shift.vestiging_hint': {
    nl: 'In AAPI staat alles onder Meer, ook events op verplaatsing. Daarom koppelen we op tijd en niet op plaats.',
    en: 'In AAPI everything sits under Meer, including off-site events. Hence we match on time, not place.',
  },
  'aapi.shift.event': { nl: 'Event', en: 'Event' },
  'aapi.shift.kies_event': { nl: 'Kies een event', en: 'Choose an event' },
  'aapi.shift.geen_event': { nl: 'Hoort bij geen event', en: 'Belongs to no event' },
  'aapi.shift.losmaken': { nl: 'Koppeling losmaken', en: 'Unlink' },
  'aapi.shift.gekoppeld': { nl: 'Gekoppeld.', en: 'Linked.' },
  'aapi.shift.losgemaakt': {
    nl: 'Losgemaakt. De volgende import mag opnieuw proberen.',
    en: 'Unlinked. The next import may try again.',
  },
  'aapi.shift.score': { nl: 'Zekerheid {score}%', en: 'Confidence {score}%' },
  'aapi.shift.kandidaten': { nl: 'Mogelijke events', en: 'Possible events' },
  'aapi.shift.naar_kalender': { nl: 'Bekijk die dag', en: 'See that day' },

  // ── Het blok op een event ───────────────────────────────────────────────
  'aapi.event.titel': { nl: 'Personeel', en: 'Crew' },
  'aapi.event.uit_aapi': { nl: 'Uit AAPI', en: 'From AAPI' },
  'aapi.event.leeg': { nl: 'Er staat nog niemand van AAPI op dit event.', en: 'Nobody from AAPI is on this event yet.' },
  'aapi.event.samenvatting': {
    nl: '{aantal} ingepland · {uren} samen',
    en: '{aantal} scheduled · {uren} in total',
  },
  'aapi.event.afgezegd': { nl: '{aantal} afgezegd', en: '{aantal} cancelled' },
  'aapi.event.mogelijk': { nl: 'Mogelijk voor dit event', en: 'Possibly for this event' },
  'aapi.event.koppel_hier': { nl: 'Koppel aan dit event', en: 'Link to this event' },
  'aapi.event.naar_kalender': { nl: 'Naar de planning van die dag', en: 'To that day in the planning' },

  // ── De import ───────────────────────────────────────────────────────────
  'aapi.import.titel': { nl: 'Planning importeren', en: 'Import planning' },
  'aapi.import.uitleg': {
    nl: 'Zet hier de "Planning Overview" of de personeelslijst uit AAPI neer. De tool ziet zelf welk van de twee het is, en toont eerst wat erin zit.',
    en: 'Drop the "Planning Overview" or the staff list from AAPI here. The tool sees which of the two it is, and shows what is in it first.',
  },
  'aapi.import.kies': { nl: 'Kies een bestand', en: 'Choose a file' },
  'aapi.import.sleep': { nl: 'of sleep het hierheen', en: 'or drag it here' },
  'aapi.import.lezen': { nl: 'Bestand lezen…', en: 'Reading file…' },
  'aapi.import.bezig': { nl: 'Importeren…', en: 'Importing…' },
  'aapi.import.nu': { nl: 'Importeren', en: 'Import' },
  'aapi.import.opnieuw': { nl: 'Ander bestand', en: 'Another file' },
  'aapi.import.klaar': { nl: 'De planning staat erin.', en: 'The planning is in.' },
  'aapi.import.geen_beheerder': {
    nl: 'Alleen een beheerder kan de planning importeren.',
    en: 'Only an admin can import the planning.',
  },

  'aapi.import.voorbeeld': { nl: 'Wat erin zit', en: 'What is in it' },
  'aapi.import.rijen': { nl: 'Rijen', en: 'Rows' },
  'aapi.import.periode': { nl: 'Periode', en: 'Period' },
  'aapi.import.mensen': { nl: 'Medewerkers', en: 'Employees' },
  'aapi.import.eventshifts': { nl: 'Bij Evenementen', en: 'In Events' },
  'aapi.import.afdelingen': { nl: 'Afdelingen', en: 'Departments' },
  'aapi.import.nieuw': { nl: 'Nieuw', en: 'New' },
  'aapi.import.bijgewerkt': { nl: 'Bijgewerkt', en: 'Updated' },
  'aapi.import.ongewijzigd': { nl: 'Ongewijzigd', en: 'Unchanged' },
  'aapi.import.verdwenen': { nl: 'Niet meer in de bron', en: 'Gone from the source' },
  'aapi.import.gekoppeld': { nl: 'Vanzelf gekoppeld', en: 'Linked automatically' },
  'aapi.import.twijfel': { nl: 'Vraagt een keuze', en: 'Needs a choice' },
  'aapi.import.fouten': { nl: 'Overgeslagen rijen', en: 'Skipped rows' },
  'aapi.import.fout_regel': { nl: 'Rij {rij}: {reden}', en: 'Row {rij}: {reden}' },
  'aapi.import.onbekende_kolommen': {
    nl: 'Nieuwe kolommen in de export: {kolommen}. Ze zijn genegeerd.',
    en: 'New columns in the export: {kolommen}. They were ignored.',
  },

  'aapi.import.nazien': { nl: 'Dit vraagt nog een keuze', en: 'This still needs a choice' },
  'aapi.import.nazien_uitleg': {
    nl: 'Deze shifts bij Evenementen hangen aan geen event. Kies er een, of zeg dat ze er geen hebben.',
    en: 'These shifts in Events have no event. Pick one, or say they have none.',
  },
  'aapi.import.herkend': { nl: 'Al bekend', en: 'Already known' },
  'aapi.import.soort.planning': { nl: 'Planning', en: 'Planning' },
  'aapi.import.soort.personeel': { nl: 'Personeelslijst', en: 'Staff list' },
  'aapi.import.weggelaten': {
    nl: 'Niet overgenomen uit dit bestand: {velden}. Die horen in AAPI en niet in een planningstool.',
    en: 'Not taken from this file: {velden}. Those belong in AAPI, not in a planning tool.',
  },

  'aapi.import.per_mail': { nl: 'Per mail binnengekomen', en: 'Arrived by mail' },
  'aapi.wachtrij.wachtend': { nl: 'Wordt gelezen', en: 'Being read' },
  'aapi.wachtrij.klaar': { nl: 'Geïmporteerd', en: 'Imported' },
  'aapi.wachtrij.afgewezen': { nl: 'Geen planning', en: 'Not a planning' },
  'aapi.wachtrij.mislukt': { nl: 'Mislukt', en: 'Failed' },
  'aapi.import.historiek': { nl: 'Vorige keren', en: 'Previous runs' },
  'aapi.import.historiek_leeg': { nl: 'Nog nooit geïmporteerd.', en: 'Never imported.' },
  'aapi.import.door': { nl: 'door {wie}', en: 'by {wie}' },
  'aapi.import.bron.xlsx-upload': { nl: 'Bestand', en: 'File' },
  'aapi.import.bron.xlsx-mail': { nl: 'Mail', en: 'Mail' },
  'aapi.import.bron.api': { nl: 'API', en: 'API' },
}
