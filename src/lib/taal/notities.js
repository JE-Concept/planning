/**
 * De teksten van de notities: het scherm Notities, de notities bij een klant,
 * een event of materiaal, de objectkiezer, en het verslag van een overleg —
 * dat sinds de notities ook een notitie is.
 *
 * Nederlands en Engels naast elkaar, zoals in `team.js`.
 */
export default {

  // ── Het scherm ─────────────────────────────────────────────────────────
  'notities.titel': { nl: 'Notities', en: 'Notes' },
  'notities.aantal_een': { nl: '{aantal} notitie', en: '{aantal} note' },
  'notities.aantal_meer': { nl: '{aantal} notities', en: '{aantal} notes' },
  'notities.gevonden_een': { nl: '{gevonden} van {aantal} notitie', en: '{gevonden} of {aantal} note' },
  'notities.gevonden_meer': { nl: '{gevonden} van {aantal} notities', en: '{gevonden} of {aantal} notes' },
  'notities.nieuw': { nl: 'Nieuwe notitie', en: 'New note' },
  'notities.filter.alles': { nl: 'Alles', en: 'All' },
  'notities.filter.notitie': { nl: 'Notities', en: 'Notes' },
  'notities.filter.overleg': { nl: 'Teamoverleg', en: 'Team meetings' },
  'notities.filter.over': { nl: 'Over', en: 'About' },
  'notities.filter.over_hint': {
    nl: 'Alleen notities over een klant, event, materiaal…',
    en: 'Only notes about a customer, event, equipment…',
  },
  'notities.leeg': { nl: 'Nog geen notities', en: 'No notes yet' },
  'notities.leeg_uitleg': {
    nl: 'Een notitie hangt aan wat ze raakt: een klant, een event, materiaal, een urenboeking. Zo vind je ze terug waar je ze nodig hebt.',
    en: 'A note hangs on what it touches: a customer, an event, equipment, a time entry. That way you find it where you need it.',
  },
  'notities.zoek': { nl: 'Zoek in de notities…', en: 'Search the notes…' },
  'notities.zoek_label': { nl: 'Zoek in de notities', en: 'Search the notes' },
  'notities.niets_gevonden': { nl: 'Niets gevonden', en: 'Nothing found' },
  'notities.niets_gevonden_uitleg': {
    nl: 'Geen notitie met "{term}".',
    en: 'No note with "{term}".',
  },
  'notities.treffer_tekst': { nl: 'tekst', en: 'text' },
  'notities.treffer_actiepunt': { nl: 'actiepunt', en: 'action point' },
  'notities.treffer_besproken': { nl: 'besproken', en: 'discussed' },
  'notities.nog_andere': { nl: 'en {aantal} andere', en: 'and {aantal} more' },
  'notities.soort_overleg': { nl: 'Teamoverleg', en: 'Team meeting' },
  'notities.prive': { nl: 'Beperkt leesbaar', en: 'Restricted' },

  // ── Wat een notitie raakt ──────────────────────────────────────────────
  'notities.over': { nl: 'Over', en: 'About' },
  'notities.nergens_aan': { nl: 'Hangt nergens aan.', en: 'Not linked to anything.' },

  // ── De objectkiezer ────────────────────────────────────────────────────
  'notities.kiezer.plaatshouder': {
    nl: 'Zoek een klant, event, materiaal, uren…',
    en: 'Search a customer, event, equipment, time…',
  },
  'notities.kiezer.soort': { nl: 'Soort', en: 'Kind' },
  'notities.kiezer.alles': { nl: 'Alles', en: 'All' },
  'notities.kiezer.niets': { nl: 'Niets gevonden voor “{vraag}”.', en: 'Nothing found for “{vraag}”.' },

  // ── Een notitie schrijven ──────────────────────────────────────────────
  'notities.bewerken': { nl: 'Notitie bewerken', en: 'Edit note' },
  'notities.veld.titel': { nl: 'Titel', en: 'Title' },
  'notities.veld.titel_hint': { nl: 'Waarover gaat het?', en: 'What is it about?' },
  'notities.veld.tekst': { nl: 'Notitie', en: 'Note' },
  'notities.veld.tekst_hint': {
    nl: 'Wat moet het team hierover weten?',
    en: 'What should the team know about this?',
  },
  'notities.veld.datum': { nl: 'Datum', en: 'Date' },
  'notities.veld.over': { nl: 'Gaat over', en: 'About' },
  'notities.bewaren': { nl: 'Bewaren', en: 'Save' },
  'notities.bewaard': { nl: 'Notitie bewaard.', en: 'Note saved.' },
  'notities.weg': { nl: 'Verwijderen', en: 'Delete' },
  'notities.weg_vraag': { nl: 'Deze notitie verwijderen?', en: 'Delete this note?' },
  'notities.door': { nl: 'door {wie}', en: 'by {wie}' },
  'notities.koppelingen_bewaard': { nl: 'Koppelingen bewaard.', en: 'Links saved.' },

  // ── Bij een klant, event of materiaal ──────────────────────────────────
  'notities.hier': { nl: 'Notities', en: 'Notes' },
  'notities.hier_leeg': {
    nl: 'Nog geen notities hierover.',
    en: 'No notes about this yet.',
  },
  'notities.toevoegen': { nl: 'Notitie toevoegen', en: 'Add a note' },

  // ── Het verslag van een overleg ────────────────────────────────────────
  'notities.overleg.deelnemers': { nl: 'Deelnemers', en: 'Attendees' },
  'notities.overleg.besproken': { nl: 'Besproken', en: 'Discussed' },
  'notities.overleg.actiepunten': { nl: 'Actiepunten ({aantal})', en: 'Action points ({aantal})' },
  'notities.overleg.geen_wie': { nl: 'niemand', en: 'nobody' },
  'notities.overleg.geen_actiepunten': {
    nl: 'Geen actiepunten uit dit overleg.',
    en: 'No action points from this meeting.',
  },
  'notities.overleg.actiepunten_zijn_taken': {
    nl: 'Actiepunten zijn gewone taken: wie er een kreeg, ziet hem ook in Mijn werk.',
    en: 'Action points are ordinary tasks: whoever got one sees it in their own work as well.',
  },
  'notities.overleg.bron': { nl: 'Bron', en: 'Source' },
  'notities.overleg.de_opname': { nl: 'de opname', en: 'the recording' },
  'notities.overleg.door_ai': {
    nl: 'Samengevat door AI. Lees na voor je erop voortgaat — wat er niet in stond, staat er ook niet in.',
    en: 'Summarised by AI. Read it over before you build on it — what was not said is not in here either.',
  },
}
