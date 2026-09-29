/**
 * De teksten van de instellingen, het zoeken en de sneltoetsen.
 *
 * Twee prefixen: `inst.` voor alles wat in een scherm staat, `regels.` voor de
 * regelengine — die heeft er zoveel en ze hangen zo aan elkaar (een veld, een
 * vergelijking, een handeling, en de zin die daaruit gemaakt wordt) dat ze
 * apart makkelijker terug te vinden zijn.
 *
 * Het zoeken en de sneltoetsen staan onder `inst.` en niet onder een eigen
 * prefix, omdat ze bij deze catalogus horen en een sleutel maar in één bestand
 * mag staan.
 *
 * Wat hier met opzet niet in staat: de namen van velden zoals ze in de
 * database heten. Een regel die op `statusName` werkt blijft op `statusName`
 * werken; wat je op het scherm leest is de vertaling, wat er bewaard wordt is
 * de veldnaam.
 */
export default {

  // ── Het zoeken ─────────────────────────────────────────────────────────
  'inst.zoek.plaatshouder': {
    nl: 'Zoek events, taken, klanten, verslagen',
    en: 'Search events, tasks, customers, minutes',
  },
  'inst.zoek.soort.events': { nl: 'Events', en: 'Events' },
  'inst.zoek.soort.taken': { nl: 'Taken', en: 'Tasks' },
  'inst.zoek.soort.klanten': { nl: 'Klanten', en: 'Customers' },
  'inst.zoek.soort.verslagen': { nl: 'Verslagen', en: 'Minutes' },
  'inst.zoek.soort.mensen': { nl: 'Mensen', en: 'People' },
  'inst.zoek.soort.templates': { nl: 'Templates', en: 'Templates' },
  'inst.zoek.klantfiche': { nl: 'klantfiche openen', en: 'open the customer' },
  'inst.zoek.teamoverleg': { nl: 'teamoverleg', en: 'team meeting' },
  'inst.zoek.overleg_van': { nl: 'Teamoverleg van {datum}', en: 'Team meeting of {datum}' },
  'inst.zoek.punt_een': { nl: '{aantal} punt', en: '{aantal} item' },
  'inst.zoek.punt_meer': { nl: '{aantal} punten', en: '{aantal} items' },
  'inst.zoek.mens_sub': {
    nl: '{aantal} open taken · werklast bekijken',
    en: '{aantal} open tasks · see the workload',
  },
  'inst.zoek.template_sub': { nl: 'Template · {uitleg}', en: 'Template · {uitleg}' },
  'inst.zoek.resultaat_een': { nl: '{aantal} resultaat', en: '{aantal} result' },
  'inst.zoek.resultaat_meer': { nl: '{aantal} resultaten', en: '{aantal} results' },
  'inst.zoek.niets': { nl: 'Niets gevonden voor “{vraag}”.', en: 'Nothing found for “{vraag}”.' },
  'inst.zoek.assistent': { nl: 'Vraag het de assistent', en: 'Ask the assistant' },

  // ── De sneltoetsen ─────────────────────────────────────────────────────
  'inst.sneltoets.zoeken': {
    nl: 'Zoeken in taken, events, klanten en verslagen',
    en: 'Search tasks, events, customers and minutes',
  },
  'inst.sneltoets.schuin': { nl: 'Hetzelfde, met één toets', en: 'The same, with one key' },
  'inst.sneltoets.hulp': { nl: 'Dit lijstje', en: 'This list' },
  'inst.sneltoets.eventbord': { nl: 'Naar het eventbord', en: 'To the event board' },
  'inst.sneltoets.tasks': { nl: 'Naar Tasks', en: 'To Tasks' },
  'inst.sneltoets.dashboard': { nl: 'Naar het dashboard', en: 'To the dashboard' },
  'inst.sneltoets.openensluiten': { nl: 'Naar Openen & sluiten', en: 'To Opening & closing' },
  'inst.sneltoets.assistent': { nl: 'Assistent open of dicht', en: 'Assistant open or shut' },
  'inst.sneltoets.uitleg': {
    nl: 'De losse letters werken alleen als je niet in een veld staat.',
    en: 'The single letters only work when your cursor is not in a field.',
  },

  // ── De instellingenpagina ──────────────────────────────────────────────
  'inst.tab.team': { nl: 'Team & toegang', en: 'Team & access' },
  'inst.tab.pijplijn': { nl: 'Pijplijn', en: 'Pipeline' },
  'inst.tab.templates': { nl: 'Templates', en: 'Templates' },
  'inst.tab.formules': { nl: 'Formules', en: 'Formulas' },
  'inst.tab.lijsten': { nl: 'Concepten & kostenplaatsen', en: 'Concepts & cost centres' },
  'inst.tab.structuur': { nl: 'Ruimtes & lijsten', en: 'Spaces & lists' },
  'inst.tab.merken': { nl: 'Merken & labels', en: 'Brands & labels' },
  'inst.tab.dagelijks': { nl: 'Dagelijkse lijsten', en: 'Daily lists' },
  'inst.tab.regels': { nl: 'Business rules', en: 'Business rules' },

  'inst.kop.beheer': {
    nl: 'Beheer · alleen zichtbaar voor beheerders',
    en: 'Admin · only visible to administrators',
  },
  'inst.kop.geen_toegang': { nl: 'Geen toegang', en: 'No access' },
  'inst.geen_toegang.titel': { nl: 'Alleen voor beheerders', en: 'Administrators only' },
  'inst.geen_toegang.tekst': {
    nl: 'Team, toegang, pijplijn en templates worden beheerd door de eigenaars en beheerders.',
    en: 'Team, access, pipeline and templates are looked after by the owners and administrators.',
  },

  // ── Team & toegang ─────────────────────────────────────────────────────
  'inst.team.sso_uitleg': {
    nl: 'Iedereen meldt aan met een Google-account. JE Plan bewaart geen wachtwoorden; wie uit Google verdwijnt, verliest meteen toegang.',
    en: 'Everyone signs in with a Google account. JE Plan keeps no passwords; whoever disappears from Google loses access straight away.',
  },
  'inst.team.enige_methode': { nl: 'Enige methode', en: 'The only way in' },
  'inst.team.automatisch': { nl: 'Automatisch toegang voor', en: 'Automatic access for' },
  'inst.team.domein_plaatshouder': { nl: '+ domein toevoegen', en: '+ add a domain' },
  'inst.team.domein_label': { nl: 'Domein toevoegen', en: 'Add a domain' },
  'inst.team.andere_accounts': {
    nl: 'Andere Google-accounts (bv. gmail.com) komen enkel binnen met een uitnodiging.',
    en: 'Other Google accounts (gmail.com, say) only get in by invitation.',
  },
  'inst.team.actief': { nl: '{aantal} actief', en: '{aantal} active' },
  'inst.team.rol_van': { nl: 'Rol van {wie}', en: 'Role of {wie}' },
  'inst.team.eigen_rol': {
    nl: 'Je eigen rol kun je niet wijzigen.',
    en: 'You cannot change your own role.',
  },
  'inst.team.afdeling_van': { nl: 'Afdeling van {wie}', en: 'Department of {wie}' },
  'inst.team.geen_afdeling': { nl: 'Geen afdeling', en: 'No department' },
  'inst.team.uurtarief_plaatshouder': { nl: '€ per uur', en: '€ per hour' },
  'inst.team.uurtarief': { nl: 'Intern uurtarief', en: 'Internal hourly rate' },
  'inst.team.zelf_archiveren': { nl: 'Jezelf archiveren kan niet.', en: 'You cannot archive yourself.' },
  'inst.team.uitnodigen': { nl: 'Iemand uitnodigen', en: 'Invite someone' },
  'inst.team.google_account': { nl: 'Google-account', en: 'Google account' },
  'inst.team.uitnodigen_knop': { nl: 'Uitnodigen', en: 'Invite' },
  'inst.team.uitgenodigd': {
    nl: '{wie} kan nu aanmelden met Google.',
    en: '{wie} can sign in with Google now.',
  },
  'inst.team.wacht': { nl: 'Wacht', en: 'Waiting' },
  'inst.team.intrekken': { nl: 'Uitnodiging intrekken', en: 'Withdraw the invitation' },
  'inst.team.gearchiveerd': { nl: 'Gearchiveerd', en: 'Archived' },
  'inst.team.gearchiveerd_uitleg': {
    nl: 'Kunnen niet aanmelden. Hun uren en taken blijven bewaard.',
    en: 'Cannot sign in. Their hours and tasks are kept.',
  },
  'inst.team.niemand_gearchiveerd': { nl: 'Niemand gearchiveerd.', en: 'Nobody archived.' },
  'inst.team.uren_bewaard': { nl: 'Uren en taken bewaard', en: 'Hours and tasks kept' },
  'inst.team.heractiveren': { nl: 'Heractiveren', en: 'Reactivate' },

  // De afdelingen van de dagelijkse lijsten, zoals ze op het scherm staan.
  'inst.afdeling.iedereen': { nl: 'Iedereen', en: 'Everyone' },
  'inst.afdeling.verantwoordelijke': { nl: 'Verantwoordelijke', en: 'Supervisor' },
  'inst.afdeling.keuken': { nl: 'Keuken', en: 'Kitchen' },
  'inst.afdeling.zaal': { nl: 'Zaal', en: 'Front of house' },

  // ── De pijplijn ────────────────────────────────────────────────────────
  'inst.pijplijn.geen_lijst': {
    nl: 'Er is nog geen eventlijst met de statuspijplijn.',
    en: 'There is no event list with the status pipeline yet.',
  },
  'inst.pijplijn.kop': { nl: 'Statuspijplijn events', en: 'Event status pipeline' },
  'inst.pijplijn.uitleg': {
    nl: 'Namen aanpassen mag; de volgorde volgt het verloop van aanvraag tot betaling.',
    en: 'You may rename them; the order follows the run from request to payment.',
  },
  'inst.pijplijn.statusnaam': { nl: 'Statusnaam', en: 'Status name' },
  'inst.pijplijn.regel.request': {
    nl: 'Vereist: klant, datum, gasten, offerte',
    en: 'Needs: customer, date, guests, quote',
  },
  'inst.pijplijn.regel.facturatie': { nl: 'Start facturatie-opvolging', en: 'Starts invoice follow-up' },
  'inst.pijplijn.regel.archief': { nl: 'Naar archief', en: 'To the archive' },

  // ── Templates ──────────────────────────────────────────────────────────
  'inst.tpl.nieuw': { nl: 'Nieuw template', en: 'New template' },
  'inst.tpl.verwijder_vraag': { nl: 'Template "{naam}" verwijderen?', en: 'Delete template "{naam}"?' },
  'inst.tpl.naam': { nl: 'Naam template', en: 'Template name' },
  'inst.tpl.icoon': { nl: 'Icoon', en: 'Icon' },
  'inst.tpl.dupliceren': { nl: 'Dupliceren', en: 'Duplicate' },
  'inst.tpl.taken': { nl: 'Taken', en: 'Tasks' },
  'inst.tpl.deadlines': {
    nl: 'Deadlines tellen terug vanaf de eventdatum; een negatief aantal valt erná.',
    en: 'Deadlines count back from the event date; a negative number falls after it.',
  },
  'inst.tpl.taak': { nl: 'Taak', en: 'Task' },
  'inst.tpl.standaard_voor': { nl: 'Standaard voor', en: 'Goes to' },
  'inst.tpl.dagen_vooraf': { nl: 'Dagen vooraf', en: 'Days before' },
  'inst.tpl.prioriteit': { nl: 'Prioriteit', en: 'Priority' },
  'inst.tpl.herhaling': { nl: 'Herhaling', en: 'Repeat' },
  'inst.tpl.taak_verwijderen': { nl: 'Taak verwijderen', en: 'Delete task' },
  'inst.tpl.subtaken': { nl: 'Subtaken', en: 'Subtasks' },
  'inst.tpl.subtaak_plaatshouder': { nl: '+ subtaak en Enter', en: '+ subtask and Enter' },
  'inst.tpl.subtaak_label': { nl: 'Subtaak toevoegen', en: 'Add a subtask' },
  'inst.tpl.taak_toevoegen': { nl: 'Taak toevoegen', en: 'Add a task' },
  'inst.tpl.telling': {
    nl: '{taken} taken · {subs} subtaken',
    en: '{taken} tasks · {subs} subtasks',
  },
  'inst.tpl.telling_wie': {
    nl: '{taken} taken · {subs} subtaken · {wie}',
    en: '{taken} tasks · {subs} subtasks · {wie}',
  },
  'inst.icoon.feest': { nl: 'Feest', en: 'Party' },
  'inst.icoon.team': { nl: 'Team', en: 'Team' },
  'inst.icoon.eten': { nl: 'Eten', en: 'Food' },
  'inst.icoon.muziek': { nl: 'Muziek', en: 'Music' },
  'inst.icoon.techniek': { nl: 'Techniek', en: 'Technical' },
  'inst.icoon.kalender': { nl: 'Kalender', en: 'Calendar' },
  'inst.icoon.document': { nl: 'Document', en: 'Document' },
  'inst.prio.normaal': { nl: 'Normaal', en: 'Normal' },
  'inst.prio.hoog': { nl: 'Hoog', en: 'High' },
  'inst.prio.urgent': { nl: 'Urgent', en: 'Urgent' },
  'inst.herhaling.eenmalig': { nl: 'Eenmalig', en: 'One-off' },
  'inst.herhaling.wekelijks': { nl: 'Wekelijks', en: 'Weekly' },
  'inst.herhaling.na3': { nl: 'Na 3 dagen', en: 'After 3 days' },

  // ── Concepten & kostenplaatsen ─────────────────────────────────────────
  'inst.concept.kop': { nl: 'Concepten', en: 'Concepts' },
  'inst.concept.uitleg': {
    nl: 'Uit staat niet meer bij nieuwe events en in de filters.',
    en: 'Switched off, it no longer turns up on new events or in the filters.',
  },
  'inst.concept.event_een': { nl: '{aantal} event', en: '{aantal} event' },
  'inst.concept.event_meer': { nl: '{aantal} events', en: '{aantal} events' },
  'inst.concept.actief': { nl: '{naam} actief', en: '{naam} active' },
  'inst.kosten.kop': { nl: 'Kostenplaatsen', en: 'Cost centres' },
  'inst.kosten.uitleg': { nl: 'Tijd boeken zonder event.', en: 'Logging time without an event.' },
  'inst.kosten.wisselen': {
    nl: 'Wisselen tussen billable en intern',
    en: 'Switch between billable and internal',
  },
  'inst.kosten.billable': { nl: 'Billable', en: 'Billable' },
  'inst.kosten.intern': { nl: 'Intern', en: 'Internal' },
  'inst.kosten.plaatshouder': { nl: '+ kostenplaats en Enter', en: '+ cost centre and Enter' },
  'inst.kosten.label': { nl: 'Kostenplaats toevoegen', en: 'Add a cost centre' },

  // ── Ruimtes & lijsten ──────────────────────────────────────────────────
  'inst.struct.ruimte_aangemaakt': { nl: 'Ruimte aangemaakt.', en: 'Space created.' },
  'inst.struct.lijst_aangemaakt': {
    nl: 'Lijst aangemaakt, met vier standaardkolommen.',
    en: 'List created, with four standard columns.',
  },
  'inst.struct.lijstnaam': { nl: 'Lijstnaam', en: 'List name' },
  'inst.struct.soort_social': { nl: 'social', en: 'social' },
  'inst.struct.soort_taken': { nl: 'taken', en: 'tasks' },
  'inst.struct.kolommen': { nl: 'Kolommen', en: 'Columns' },
  'inst.struct.terughalen': { nl: 'Terughalen', en: 'Bring back' },
  'inst.struct.archiveer_vraag': {
    nl: 'Lijst archiveren? De taken blijven bewaard.',
    en: 'Archive the list? The tasks are kept.',
  },
  'inst.struct.nieuwe_ruimte': { nl: 'Nieuwe ruimte', en: 'New space' },
  'inst.struct.naam': { nl: 'Naam', en: 'Name' },
  'inst.struct.nieuwe_lijst': { nl: 'Nieuwe lijst', en: 'New list' },
  'inst.struct.ruimte': { nl: 'Ruimte', en: 'Space' },
  'inst.struct.kies_ruimte': { nl: 'Kies een ruimte…', en: 'Choose a space…' },
  'inst.struct.soort': { nl: 'Soort', en: 'Kind' },
  'inst.struct.takenbord': { nl: 'Takenbord', en: 'Task board' },
  'inst.struct.socialcontent': { nl: 'Socialcontent', en: 'Social content' },

  // ── Merken & labels ────────────────────────────────────────────────────
  'inst.merk.kop': { nl: 'Merken', en: 'Brands' },
  'inst.merk.kleur_van': { nl: 'Kleur van {naam}', en: 'Colour of {naam}' },
  'inst.merk.naam': { nl: 'Merknaam', en: 'Brand name' },
  'inst.merk.toegevoegd': { nl: 'Merk toegevoegd.', en: 'Brand added.' },
  'inst.merk.kleur': { nl: 'Kleur', en: 'Colour' },
  'inst.merk.nieuw': { nl: 'Nieuw merk', en: 'New brand' },
  'inst.label.kop': { nl: 'Labels', en: 'Labels' },
  'inst.label.nieuw': { nl: 'Nieuw label', en: 'New label' },
  'inst.label.geen': { nl: 'Nog geen labels.', en: 'No labels yet.' },
  'inst.label.samenvoegen': { nl: 'samenvoegen', en: 'merge' },
  'inst.label.samenvoegen_knop': { nl: 'Samenvoegen', en: 'Merge' },
  'inst.label.verwijderen': { nl: 'Label verwijderen', en: 'Delete label' },
  'inst.label.verwijder_vraag': {
    nl: 'Label "{naam}" verwijderen? De taken houden de naam, maar de kleur verdwijnt. Samenvoegen is meestal wat je wil.',
    en: 'Delete label "{naam}"? The tasks keep the name, but the colour goes. Merging is usually what you want.',
  },
  'inst.label.samenvoeg_titel': { nl: '"{naam}" samenvoegen', en: 'Merge "{naam}"' },
  'inst.label.wordt': { nl: 'Wordt', en: 'Becomes' },
  'inst.label.wordt_hint': {
    nl: 'Het label hierboven verdwijnt; de taken krijgen deze naam.',
    en: 'The label above goes; the tasks take this name.',
  },
  'inst.label.tellen': { nl: 'Aan het tellen…', en: 'Counting…' },
  'inst.label.geen_taak': {
    nl: 'Er staat geen taak op "{naam}". Het label verdwijnt, verder verandert er niets.',
    en: 'No task carries "{naam}". The label goes, nothing else changes.',
  },
  'inst.label.taken_een': {
    nl: '{aantal} taak draagt "{van}" en krijgt "{naar}".',
    en: '{aantal} task carries "{van}" and takes "{naar}".',
  },
  'inst.label.taken_meer': {
    nl: '{aantal} taken dragen "{van}" en krijgen "{naar}".',
    en: '{aantal} tasks carry "{van}" and take "{naar}".',
  },
  'inst.label.samengevoegd_leeg': {
    nl: 'Samengevoegd; er stond geen taak op dat label.',
    en: 'Merged; no task carried that label.',
  },
  'inst.label.samengevoegd_een': { nl: 'Samengevoegd — {aantal} taak verplaatst.', en: 'Merged — {aantal} task moved.' },
  'inst.label.samengevoegd_meer': { nl: 'Samengevoegd — {aantal} taken verplaatst.', en: 'Merged — {aantal} tasks moved.' },
}
