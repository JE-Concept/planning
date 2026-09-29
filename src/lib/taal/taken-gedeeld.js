/**
 * De teksten van de gedeelde helpers rond taken.
 *
 * Deze zinnen horen bij geen enkel scherm in het bijzonder: de verwijdervraag,
 * de herkomst van een taak en het activiteitslog staan alle drie tegelijk op
 * het bord, in het takenpaneel en op de eventpagina. Daarom één catalogus, en
 * niet drie keer dezelfde zin bij het scherm dat hem toevallig eerst nodig had.
 *
 * Wat hier met opzet níét in staat: de namen die uit de database komen. Een
 * statuslabel, een lijstnaam, de naam van wie iets verzette en de titel van een
 * taak worden als `{van}`, `{naar}`, `{wie}` en `{titel}` ingevuld en blijven
 * staan zoals het team ze geschreven heeft. Alleen het Nederlands eromheen
 * verandert mee met de taal.
 */
export default {

  // ── Opsommen ───────────────────────────────────────────────────────────
  // Het voegwoord van een opsomming ("… en …"), zodat de lijstjes hieronder in
  // beide talen als een zin lezen en niet als een rij met komma's.
  'taaklib.en': { nl: 'en', en: 'and' },

  // ── De vraag voor een taak verdwijnt ───────────────────────────────────
  'taaklib.verwijder.vraag': {
    nl: '“{titel}” definitief verwijderen?',
    en: 'Permanently delete “{titel}”?',
  },
  'taaklib.verwijder.deze_taak': { nl: 'Deze taak', en: 'This task' },
  'taaklib.verwijder.weg_ook': { nl: 'Weg zijn dan ook: {lijst}.', en: 'Also gone: {lijst}.' },
  'taaklib.verwijder.subtaak_een': { nl: '{aantal} subtaak', en: '{aantal} subtask' },
  'taaklib.verwijder.subtaak_meer': { nl: '{aantal} subtaken', en: '{aantal} subtasks' },
  'taaklib.verwijder.bijlage_een': { nl: '{aantal} bijlage', en: '{aantal} attachment' },
  'taaklib.verwijder.bijlage_meer': { nl: '{aantal} bijlagen', en: '{aantal} attachments' },
  'taaklib.verwijder.reactie_een': { nl: '{aantal} reactie', en: '{aantal} comment' },
  'taaklib.verwijder.reactie_meer': { nl: '{aantal} reacties', en: '{aantal} comments' },
  'taaklib.verwijder.tijd_blijft': {
    nl: 'De {tijd} geboekte tijd blijft bestaan, maar verliest haar taak.',
    en: 'The {tijd} logged against it stays, but loses its task.',
  },
  'taaklib.verwijder.onomkeerbaar': {
    nl: 'Dit kan niet ongedaan gemaakt worden. Archiveren bewaart alles.',
    en: 'This cannot be undone. Archiving keeps everything.',
  },

  // ── Waar een taak vandaan komt ─────────────────────────────────────────
  // ClickUp blijft ClickUp: dat is de naam van het pakket waar de planning uit
  // overgezet is, en die heet in beide talen hetzelfde.
  'taaklib.herkomst.aangemaakt': { nl: 'Aangemaakt {datum}', en: 'Created {datum}' },
  'taaklib.herkomst.clickup': {
    nl: 'Overgenomen uit ClickUp op {datum}',
    en: 'Brought over from ClickUp on {datum}',
  },
  'taaklib.herkomst.clickup_uitleg': {
    nl: 'De datum van de verhuizing, niet van de taak zelf.',
    en: 'The date of the move, not of the task itself.',
  },

  // ── Het activiteitslog ─────────────────────────────────────────────────
  // Zinnen zonder onderwerp: de naam van wie het deed staat in het paneel
  // ervoor, dus er staat "Elke Motmans" + "verzette de status van …".
  'taaklib.log.hernoemd': {
    nl: 'hernoemde “{van}” naar “{naar}”',
    en: 'renamed “{van}” to “{naar}”',
  },
  'taaklib.log.titel_gezet': {
    nl: 'gaf de taak de titel “{naar}”',
    en: 'gave the task the title “{naar}”',
  },
  'taaklib.log.status_verzet': {
    nl: 'verzette de status van {van} naar {naar}',
    en: 'moved the status from {van} to {naar}',
  },
  'taaklib.log.status_gezet': { nl: 'zette de status op {naar}', en: 'set the status to {naar}' },
  'taaklib.log.afgerond': { nl: 'rondde de taak af', en: 'completed the task' },
  'taaklib.log.heropend': { nl: 'heropende de taak', en: 'reopened the task' },
  'taaklib.log.deadline_weg': {
    nl: 'haalde de deadline weg (stond op {van})',
    en: 'removed the deadline (it was {van})',
  },
  'taaklib.log.deadline_gezet': {
    nl: 'zette de deadline op {naar}',
    en: 'set the deadline to {naar}',
  },
  'taaklib.log.deadline_verzet': {
    nl: 'verzette de deadline van {van} naar {naar}',
    en: 'moved the deadline from {van} to {naar}',
  },
  'taaklib.log.geen_datum': { nl: 'geen datum', en: 'no date' },
  'taaklib.log.toegewezen': { nl: 'zette {wie} op de taak', en: 'put {wie} on the task' },
  'taaklib.log.afgehaald': { nl: 'haalde {wie} van de taak', en: 'took {wie} off the task' },
  'taaklib.log.iemand': { nl: 'iemand', en: 'someone' },
  'taaklib.log.prioriteit_gezet': {
    nl: 'zette de prioriteit op {prio}',
    en: 'set the priority to {prio}',
  },
  'taaklib.log.prioriteit_weg': { nl: 'haalde de prioriteit weg', en: 'removed the priority' },
  'taaklib.log.gearchiveerd': { nl: 'archiveerde de taak', en: 'archived the task' },
  'taaklib.log.uit_archief': {
    nl: 'haalde de taak uit het archief',
    en: 'took the task out of the archive',
  },
  'taaklib.log.gewijzigd': { nl: 'wijzigde de taak', en: 'changed the task' },
}
