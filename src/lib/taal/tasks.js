/**
 * De teksten van de takenschermen: Tasks, het bord, de werklast en de goals.
 *
 * "Tasks", "Goals" en "billable" staan er niet in: zo noemt het team ze zelf,
 * in allebei de talen. De namen van lijsten, kolommen, labels en taken komen
 * uit de database en horen hier evenmin thuis.
 *
 * Wat hier wél staat is alles wat de code zelf zegt — ook de tabellen met
 * keuzes (groeperen, sorteren, soort kolom, soort resultaat), want die stonden
 * als tekst in de code en zouden anders op twee plekken vertaald moeten worden.
 *
 * Meervoud: zet naast `x` ook `x_een` en `x_meer`, en geef `aantal` mee.
 */
export default {

  // ── De weergave-opties van Tasks ───────────────────────────────────────
  'tasks.weergave.lijst': { nl: 'Lijst', en: 'List' },
  'tasks.weergave.bord': { nl: 'Bord', en: 'Board' },
  'tasks.weergave.kalender': { nl: 'Kalender', en: 'Calendar' },

  'tasks.groep.deadline': { nl: 'Deadline', en: 'Deadline' },
  'tasks.groep.status': { nl: 'Status', en: 'Status' },
  'tasks.groep.persoon': { nl: 'Persoon', en: 'Person' },
  'tasks.groep.lijst': { nl: 'Lijst', en: 'List' },
  'tasks.groep.prioriteit': { nl: 'Prioriteit', en: 'Priority' },
  'tasks.groep.geen': { nl: 'Niet groeperen', en: 'None' },

  'tasks.sortering.deadline': { nl: 'Deadline', en: 'Deadline' },
  'tasks.sortering.prioriteit': { nl: 'Prioriteit', en: 'Priority' },
  'tasks.sortering.titel': { nl: 'Titel', en: 'Title' },
  'tasks.sortering.gewijzigd': { nl: 'Laatst gewijzigd', en: 'Last changed' },

  'tasks.groeperen_op': { nl: 'Groeperen op', en: 'Group by' },
  'tasks.sorteren_op': { nl: 'Sorteren op', en: 'Sort by' },
  'tasks.groep_optie': { nl: 'Groep: {naam}', en: 'Group: {naam}' },
  'tasks.sortering_optie': { nl: 'Sorteer: {naam}', en: 'Sort: {naam}' },

  'tasks.wie': { nl: 'Van wie', en: 'Whose' },
  'tasks.wie.ik': { nl: 'Mijn taken', en: 'My tasks' },
  'tasks.wie.iedereen': { nl: 'Van iedereen', en: 'Everyone’s' },

  'tasks.filter.lijst': { nl: 'Lijst', en: 'List' },
  'tasks.filter.alle_lijsten': { nl: 'Alle lijsten', en: 'All lists' },
  'tasks.filter.label': { nl: 'Label', en: 'Label' },
  'tasks.filter.alle_labels': { nl: 'Alle labels', en: 'All labels' },
  'tasks.filter.prioriteit': { nl: 'Prioriteit', en: 'Priority' },
  'tasks.filter.alle_prioriteiten': { nl: 'Alle prioriteiten', en: 'All priorities' },
  'tasks.zoek': { nl: 'Zoek in taken', en: 'Search tasks' },
  'tasks.alleen_open': { nl: 'Alleen open', en: 'Open only' },
  'tasks.ook_afgerond': { nl: 'Ook afgerond', en: 'Including done' },
  'tasks.alleen_open_hint': {
    nl: 'Afgeronde taken staan er niet bij',
    en: 'Finished tasks are left out',
  },
  'tasks.ook_afgerond_hint': {
    nl: 'Afgeronde taken staan er wel bij',
    en: 'Finished tasks are included',
  },

  // ── De groepen waarin taken vallen ─────────────────────────────────────
  'tasks.deadline.telaat': { nl: 'Te laat', en: 'Overdue' },
  'tasks.deadline.dezeweek': { nl: 'Deze week', en: 'This week' },
  'tasks.deadline.volgendeweek': { nl: 'Volgende week', en: 'Next week' },
  'tasks.deadline.later': { nl: 'Later', en: 'Later' },
  'tasks.deadline.zonder': { nl: 'Zonder deadline', en: 'No deadline' },

  'tasks.groep.niemand': { nl: 'Niemand toegewezen', en: 'Nobody assigned' },
  'tasks.groep.onbekend': { nl: 'Onbekend', en: 'Unknown' },
  'tasks.zonder_status': { nl: 'Zonder status', en: 'No status' },
  'tasks.zonder_lijst': { nl: 'Zonder lijst', en: 'No list' },
  'tasks.zonder_prioriteit': { nl: 'Zonder prioriteit', en: 'No priority set' },

  // De prioriteit is een getal in de database; deze namen horen bij de code.
  'tasks.prio.urgent': { nl: 'Urgent', en: 'Urgent' },
  'tasks.prio.hoog': { nl: 'Hoog', en: 'High' },
  'tasks.prio.normaal': { nl: 'Normaal', en: 'Normal' },
  'tasks.prio.laag': { nl: 'Laag', en: 'Low' },
  'tasks.prio.geen': { nl: 'Geen prioriteit', en: 'No priority' },

  // ── De vervaldag in woorden ────────────────────────────────────────────
  'tasks.verval.afgerond': { nl: 'Afgerond', en: 'Done' },
  'tasks.verval.geweest': { nl: 'geweest', en: 'passed' },
  'tasks.verval.telaat_een': { nl: '{aantal} dag te laat', en: '{aantal} day overdue' },
  'tasks.verval.telaat_meer': { nl: '{aantal} dagen te laat', en: '{aantal} days overdue' },
  'tasks.verval.over_een': { nl: 'over {aantal} dag', en: 'in {aantal} day' },
  'tasks.verval.over_meer': { nl: 'over {aantal} dagen', en: 'in {aantal} days' },

  // ── De pagina Tasks ────────────────────────────────────────────────────
  'tasks.leeg.titel': { nl: 'Niets te doen', en: 'Nothing to do' },
  'tasks.leeg.gefilterd': {
    nl: 'Geen taak past bij wat je gefilterd hebt.',
    en: 'No task matches what you filtered on.',
  },
  'tasks.leeg.niets_open': { nl: 'Er staat hier niets open.', en: 'Nothing is open here.' },
  'tasks.niemand': { nl: 'niemand', en: 'nobody' },
  'tasks.kalender.telling': {
    nl: '{metdatum} met datum · {zonder} zonder',
    en: '{metdatum} with a date · {zonder} without',
  },

  // ── Werklast ───────────────────────────────────────────────────────────
  'tasks.werklast.week': { nl: 'Week {week} · {reeks}', en: 'Week {week} · {reeks}' },
  'tasks.werklast.vorige': { nl: 'Vorige week', en: 'Previous week' },
  'tasks.werklast.volgende': { nl: 'Volgende week', en: 'Next week' },
  'tasks.werklast.geboekt': { nl: 'Geboekt / {uren}u', en: 'Logged / {uren}h' },
  'tasks.werklast.open_een': { nl: '{aantal} open taak', en: '{aantal} open task' },
  'tasks.werklast.open_meer': { nl: '{aantal} open taken', en: '{aantal} open tasks' },
  'tasks.werklast.uren': { nl: '{uren} u', en: '{uren} h' },
  'tasks.werklast.legenda_taak': { nl: 'Taak met deadline', en: 'Task with a deadline' },
  'tasks.werklast.legenda_telaat': { nl: 'Te laat of urgent', en: 'Overdue or urgent' },
  'tasks.werklast.legenda_event': { nl: 'Event', en: 'Event' },
  'tasks.werklast.leeg': { nl: 'Nog niemand om in te plannen', en: 'Nobody to plan yet' },
  'tasks.werklast.leeg_uitleg': {
    nl: 'Dit overzicht toont het team. Nodig collega’s uit bij Instellingen → Team, dan staan ze hier.',
    en: 'This overview shows the team. Invite colleagues under Settings → Team and they will appear here.',
  },

  // De dagen boven de werklast, kort genoeg voor een kolom van 56 pixels.
  'tasks.wd.zo': { nl: 'zo', en: 'Sun' },
  'tasks.wd.ma': { nl: 'ma', en: 'Mon' },
  'tasks.wd.di': { nl: 'di', en: 'Tue' },
  'tasks.wd.wo': { nl: 'wo', en: 'Wed' },
  'tasks.wd.do': { nl: 'do', en: 'Thu' },
  'tasks.wd.vr': { nl: 'vr', en: 'Fri' },
  'tasks.wd.za': { nl: 'za', en: 'Sat' },

  // ── Het bord ───────────────────────────────────────────────────────────
  'bord.niet_gevonden': { nl: 'Bord niet gevonden', en: 'Board not found' },
  'bord.niet_gevonden_tekst': {
    nl: 'Dit bord bestaat niet meer, of je hebt er geen toegang toe.',
    en: 'This board is gone, or you have no access to it.',
  },
  'bord.kolommen': { nl: 'Kolommen', en: 'Columns' },
  'bord.nieuwe_taak': { nl: 'Nieuwe taak', en: 'New task' },
  'bord.nieuwe_taak_in': { nl: 'Nieuwe taak in {lijst}', en: 'New task in {lijst}' },
  'bord.sleep_hier': { nl: 'Sleep hier een taak naartoe.', en: 'Drag a task here.' },
  'bord.taak_toevoegen_in': { nl: 'Taak toevoegen in {kolom}', en: 'Add a task in {kolom}' },
  'bord.prioriteit_van': { nl: 'Prioriteit {naam}', en: 'Priority {naam}' },
  'bord.niet_toegewezen': { nl: 'Niet toegewezen', en: 'Unassigned' },
  'bord.iedereen': { nl: 'Iedereen', en: 'Everyone' },
  'bord.elke_prioriteit': { nl: 'Elke prioriteit', en: 'Any priority' },
  'bord.elk_label': { nl: 'Elk label', en: 'Any label' },
  'bord.enkel_open': { nl: 'Enkel open', en: 'Open only' },
  'bord.filters_wissen': { nl: 'Filters wissen ({aantal})', en: 'Clear filters ({aantal})' },
  'bord.groeperen': { nl: 'Groeperen', en: 'Group' },
  'bord.filter_persoon': { nl: 'Filter op persoon', en: 'Filter by person' },
  'bord.filter_prioriteit': { nl: 'Filter op prioriteit', en: 'Filter by priority' },
  'bord.filter_label': { nl: 'Filter op label', en: 'Filter by label' },
  'bord.zoeken_in_taken': { nl: 'Zoeken in taken…', en: 'Search tasks…' },

  // ── De kolomeditor ─────────────────────────────────────────────────────
  // "Opslaan" en niet `alg.opslaan` ("Bewaren"): deze knop heet in de tool al
  // jaren zo, en de browsertest zoekt hem onder die naam.
  'bord.opslaan': { nl: 'Opslaan', en: 'Save' },
  'bord.kolommen_van': { nl: 'Kolommen van {lijst}', en: 'Columns of {lijst}' },
  'bord.soort': { nl: 'Soort', en: 'Kind' },
  'bord.soort.open': { nl: 'Nieuw', en: 'New' },
  'bord.soort.active': { nl: 'Bezig', en: 'In progress' },
  'bord.soort.done': { nl: 'Afgerond', en: 'Done' },
  'bord.soort.closed': { nl: 'Gesloten', en: 'Closed' },
  'bord.kolomnaam': { nl: 'Kolomnaam', en: 'Column name' },
  'bord.kleur_van': { nl: 'Kleur van {kolom}', en: 'Colour of {kolom}' },
  'bord.kolom': { nl: 'kolom', en: 'column' },
  'bord.omhoog': { nl: 'Omhoog', en: 'Up' },
  'bord.omlaag': { nl: 'Omlaag', en: 'Down' },
  'bord.kolom_verwijderen': { nl: 'Kolom {kolom} verwijderen', en: 'Delete column {kolom}' },
  'bord.kolom_toevoegen': { nl: '+ Kolom toevoegen', en: '+ Add a column' },
  'bord.kolommen_verdwijnen': { nl: 'Kolommen die verdwijnen', en: 'Columns that disappear' },
  'bord.taken_naar_een': { nl: '{aantal} taak naar', en: '{aantal} task to' },
  'bord.taken_naar_meer': { nl: '{aantal} taken naar', en: '{aantal} tasks to' },
  'bord.taken_verplaatsen_naar': {
    nl: 'Taken van {kolom} verplaatsen naar',
    en: 'Move the tasks of {kolom} to',
  },
  'bord.kies_kolom': { nl: 'Kies een kolom…', en: 'Pick a column…' },
  'bord.kolom_leeg': { nl: 'leeg — verdwijnt zonder gevolgen', en: 'empty — disappears without consequences' },
  'bord.toch_houden': { nl: 'Toch houden', en: 'Keep after all' },
  'bord.kolom_nodig': {
    nl: 'Een bord heeft minstens één kolom nodig.',
    en: 'A board needs at least one column.',
  },
  'bord.kies_bestemming': {
    nl: 'Kies eerst waar de taken van de verwijderde kolommen heen gaan.',
    en: 'First pick where the tasks of the deleted columns go.',
  },
  'bord.kolommen_bijgewerkt': { nl: 'Kolommen bijgewerkt.', en: 'Columns updated.' },
  'bord.kolommen_bijgewerkt_verhuisd': {
    nl: 'Kolommen bijgewerkt, {aantal} taken verhuisd.',
    en: 'Columns updated, {aantal} tasks moved.',
  },
  'bord.klaar_uitleg': {
    nl: '{afgerond} en {gesloten} tellen als klaar: taken in zo’n kolom krijgen een afwerkdatum, vallen weg uit “enkel open” en tellen mee voor goals.',
    en: '{afgerond} and {gesloten} count as finished: tasks in such a column get a completion date, drop out of “open only” and count towards goals.',
  },

  // ── De taakfiche ───────────────────────────────────────────────────────
  'bord.taak': { nl: 'Taak', en: 'Task' },
  'bord.veld.titel': { nl: 'Titel', en: 'Title' },
  'bord.veld.status': { nl: 'Status', en: 'Status' },
  'bord.veld.prioriteit': { nl: 'Prioriteit', en: 'Priority' },
  'bord.veld.startdatum': { nl: 'Startdatum', en: 'Start date' },
  'bord.veld.deadline': { nl: 'Deadline', en: 'Deadline' },
  'bord.veld.raming': { nl: 'Raming (minuten)', en: 'Estimate (minutes)' },
  'bord.veld.budget': { nl: 'Budget', en: 'Budget' },
  'bord.veld.locatie': { nl: 'Locatie', en: 'Location' },
  'bord.veld.klant': { nl: 'Klant', en: 'Client' },
  'bord.veld.omschrijving': { nl: 'Omschrijving', en: 'Description' },
  'bord.veld.toewijzen': { nl: 'Toewijzen aan', en: 'Assign to' },
  'bord.geen_status': { nl: 'Geen status', en: 'No status' },
  'bord.adres_of_zaal': { nl: 'Adres of zaal', en: 'Address or venue' },
  'bord.wat_moet_gebeuren': { nl: 'Wat moet er gebeuren?', en: 'What needs doing?' },
  'bord.wat_precies': {
    nl: 'Wat moet er precies gebeuren?',
    en: 'What exactly needs doing?',
  },
  'bord.toegewezen_aan': { nl: 'Toegewezen aan', en: 'Assigned to' },
  'bord.geen_klant': { nl: 'Geen klant', en: 'No client' },
  'bord.klant_van_event': { nl: 'Klant van dit event', en: 'Client of this event' },
  'bord.klant_uit_gebruik': { nl: 'Klant uit gebruik', en: 'Client no longer in use' },
  'bord.naar_archief': {
    nl: 'Naar het archief. Alles blijft bewaard.',
    en: 'Into the archive. Everything is kept.',
  },
  'bord.labels': { nl: 'Labels', en: 'Labels' },
  'bord.nieuw_label': { nl: 'Nieuw label', en: 'New label' },
  'bord.nieuw_label_hint': { nl: 'Nieuw label…', en: 'New label…' },
  'bord.bijlagen': { nl: 'Bijlagen', en: 'Attachments' },
  'bord.bijlagen_event': { nl: 'Bijlagen bij dit event', en: 'Attachments to this event' },

  // Social content op een event; de standen zelf komen uit `social-stage`.
  'bord.social.titel': { nl: 'Social content', en: 'Social content' },
  'bord.social.aan': {
    nl: 'Dit event levert social content op',
    en: 'This event produces social content',
  },
  'bord.social.stand': { nl: 'Stand van de social content', en: 'Stage of the social content' },
  'bord.social.uit': { nl: 'Uitgezet voor dit event.', en: 'Turned off for this event.' },
  'bord.social.vanzelf': {
    nl: 'Komt er vanzelf bij zodra het event op “ready to invoice” staat.',
    en: 'Comes along by itself once the event is on “ready to invoice”.',
  },
  'bord.social.posts': { nl: 'Social posts ({aantal})', en: 'Social posts ({aantal})' },
  'bord.social.niet_ingepland': { nl: 'nog niet ingepland', en: 'not scheduled yet' },

  // Subtaken
  'bord.subtaken': { nl: 'Subtaken ({aantal})', en: 'Subtasks ({aantal})' },
  'bord.subtaak_afwerken': { nl: '{taak} afwerken', en: 'Finish {taak}' },
  'bord.subtaak_verwijderen': { nl: 'Subtaak verwijderen', en: 'Delete subtask' },
  'bord.subtaak_verwijderen_vraag': { nl: 'Subtaak verwijderen?', en: 'Delete this subtask?' },
  'bord.subtaak_toevoegen': { nl: 'Subtaak toevoegen…', en: 'Add a subtask…' },

  // Tijd op een taak
  'bord.tijd': { nl: 'Tijd', en: 'Time' },
  'bord.handmatig': { nl: 'Handmatig', en: 'By hand' },
  'bord.tijd_geboekt': { nl: 'Tijd geboekt.', en: 'Time logged.' },
  'bord.timer_loopt': { nl: 'Timer loopt op deze taak.', en: 'Timer running on this task.' },
  'bord.geboekt': { nl: 'geboekt', en: 'logged' },
  'bord.van_geraamd': { nl: 'van {tijd} geraamd', en: 'of {tijd} estimated' },
  'bord.tijd_verwijderen': { nl: 'Tijdsregistratie verwijderen?', en: 'Delete this time entry?' },
  'bord.van': { nl: 'Van', en: 'From' },
  'bord.tot': { nl: 'Tot', en: 'To' },
  'bord.tijd_toegevoegd': { nl: 'Tijd toegevoegd.', en: 'Time added.' },

  // Verloop: reacties en wijzigingen door elkaar
  'bord.verloop': { nl: 'Verloop ({aantal})', en: 'History ({aantal})' },
  'bord.verloop_leeg': {
    nl: 'Nog geen reacties, en geen wijzigingen sinds het bijhouden begon op {datum}. Wat daarvoor aan deze taak veranderde, staat er niet in.',
    en: 'No comments yet, and no changes since logging began on {datum}. Whatever changed on this task before that is not in here.',
  },
  'bord.reactie_verwijderen': { nl: 'Reactie verwijderen', en: 'Delete comment' },
  'bord.reactie_verwijderen_vraag': { nl: 'Reactie verwijderen?', en: 'Delete this comment?' },
  'bord.iemand': { nl: 'Iemand', en: 'Someone' },
  'bord.reactie_schrijven': { nl: 'Reactie schrijven…', en: 'Write a comment…' },
  'bord.plaatsen': { nl: 'Plaatsen', en: 'Post' },

  // ── Goals ──────────────────────────────────────────────────────────────
  'goals.status.draft': { nl: 'Concept', en: 'Draft' },
  'goals.status.active': { nl: 'Lopend', en: 'Running' },
  'goals.status.achieved': { nl: 'Behaald', en: 'Achieved' },
  'goals.status.missed': { nl: 'Niet gehaald', en: 'Missed' },
  'goals.status.archived': { nl: 'Gearchiveerd', en: 'Archived' },

  'goals.soort.number': { nl: 'Aantal', en: 'Count' },
  'goals.soort.currency': { nl: 'Bedrag (€)', en: 'Amount (€)' },
  'goals.soort.percent': { nl: 'Percentage', en: 'Percentage' },
  'goals.soort.boolean': { nl: 'Ja / nee', en: 'Yes / no' },
  'goals.soort.tasks': {
    nl: 'Taken afgewerkt (telt automatisch)',
    en: 'Tasks finished (counts by itself)',
  },

  'goals.ja': { nl: 'Ja', en: 'Yes' },
  'goals.nee': { nl: 'Nee', en: 'No' },
  'goals.lopend_een': { nl: '{aantal} lopend doel', en: '{aantal} running goal' },
  'goals.lopend_meer': { nl: '{aantal} lopende doelen', en: '{aantal} running goals' },
  'goals.filter': { nl: 'Filter', en: 'Filter' },
  'goals.nieuw': { nl: '+ Goal', en: '+ Goal' },
  'goals.leeg.titel': { nl: 'Nog geen doelen', en: 'No goals yet' },
  'goals.leeg.tekst': {
    nl: 'Een goal bundelt meetbare resultaten: omzet, aantal events, posts per maand.',
    en: 'A goal bundles measurable results: turnover, number of events, posts a month.',
  },
  'goals.leeg.knop': { nl: 'Eerste goal maken', en: 'Make the first goal' },
  'goals.over_tijd': { nl: '{aantal} dagen over tijd', en: '{aantal} days past due' },
  'goals.nog_dagen': { nl: 'nog {aantal} dagen', en: '{aantal} days left' },
  'goals.geen_resultaten': {
    nl: 'Nog geen resultaten toegevoegd.',
    en: 'No results added yet.',
  },
  'goals.bewerken': { nl: 'Bewerken', en: 'Edit' },
  'goals.naamloos': { nl: 'Naamloos resultaat', en: 'Unnamed result' },
  'goals.telt_automatisch': {
    nl: 'Telt automatisch de afgewerkte taken.',
    en: 'Counts the finished tasks by itself.',
  },
  'goals.nieuwe_waarde': { nl: 'Nieuwe waarde', en: 'New value' },
  'goals.notitie': { nl: 'Notitie', en: 'Note' },
  'goals.bijwerken': { nl: 'Bijwerken', en: 'Update' },
  'goals.verloop': { nl: 'Verloop', en: 'History' },
  'goals.verloop_verbergen': { nl: 'Verberg verloop', en: 'Hide history' },
  'goals.geen_bijwerkingen': { nl: 'Nog geen bijwerkingen.', en: 'No updates yet.' },

  'goals.bewerk_titel': { nl: 'Goal bewerken', en: 'Edit goal' },
  'goals.nieuw_titel': { nl: 'Nieuwe goal', en: 'New goal' },
  'goals.verwijder_vraag': { nl: 'Deze goal verwijderen?', en: 'Delete this goal?' },
  'goals.opgeslagen': { nl: 'Goal opgeslagen.', en: 'Goal saved.' },
  'goals.veld.naam': { nl: 'Naam', en: 'Name' },
  'goals.veld.naam_hint': { nl: 'Omzet Q4 verdubbelen', en: 'Double Q4 turnover' },
  'goals.veld.toelichting': { nl: 'Toelichting', en: 'Notes' },
  'goals.veld.uitvoerders': { nl: 'Uitvoerders', en: 'Working on it' },
  'goals.veld.uitvoerders_hint': {
    nl: 'Wie er aan trekt. De eigenaar is wie erover rapporteert.',
    en: 'Who does the work. The owner is who reports on it.',
  },
  'goals.veld.eigenaar': { nl: 'Eigenaar', en: 'Owner' },
  'goals.veld.deadline': { nl: 'Deadline', en: 'Deadline' },
  'goals.veld.status': { nl: 'Status', en: 'Status' },
  'goals.resultaten': { nl: 'Resultaten', en: 'Results' },
  'goals.resultaat_naam': { nl: 'Naam van het resultaat', en: 'Name of the result' },
  'goals.wat_meten': { nl: 'Wat meten we?', en: 'What do we measure?' },
  'goals.soort_label': { nl: 'Soort', en: 'Kind' },
  'goals.lijst': { nl: 'Lijst', en: 'List' },
  'goals.kies_lijst': { nl: 'Kies een lijst…', en: 'Pick a list…' },
  'goals.start': { nl: 'Start', en: 'Start' },
  'goals.startwaarde': { nl: 'Startwaarde', en: 'Starting value' },
  'goals.doel': { nl: 'Doel', en: 'Target' },
  'goals.doelwaarde': { nl: 'Doelwaarde', en: 'Target value' },
  'goals.resultaat_toevoegen': { nl: '+ Resultaat', en: '+ Result' },
}
