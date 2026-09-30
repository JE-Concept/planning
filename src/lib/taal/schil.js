/**
 * De teksten van de schil: de navigatie, het aanmelden, de timer, het menu.
 *
 * Nederlands en Engels staan naast elkaar op dezelfde regel. Dat is met opzet:
 * zo zie je terwijl je schrijft of de andere taal er al is, in plaats van pas
 * wanneer de test erover valt.
 *
 * De sleutel zegt waar het staat, niet wat er staat. `alg.opslaan` blijft
 * kloppen wanneer de knop ooit "Bewaren" gaat heten; `alg.bewaren` niet.
 *
 * Meervoud: zet naast `x` ook `x_een` en `x_meer`, en geef `aantal` mee.
 */
export default {

  // ── Algemeen ───────────────────────────────────────────────────────────
  'alg.opslaan': { nl: 'Bewaren', en: 'Save' },
  'alg.annuleren': { nl: 'Annuleren', en: 'Cancel' },
  'alg.sluiten': { nl: 'Sluiten', en: 'Close' },
  'alg.verwijderen': { nl: 'Verwijderen', en: 'Delete' },
  'alg.archiveren': { nl: 'Archiveren', en: 'Archive' },
  'alg.toevoegen': { nl: 'Toevoegen', en: 'Add' },
  'alg.aanmaken': { nl: 'Aanmaken', en: 'Create' },
  'alg.aanpassen': { nl: 'Aanpassen', en: 'Edit' },
  'alg.zoeken': { nl: 'Zoeken', en: 'Search' },
  'alg.laden': { nl: 'Even geduld…', en: 'One moment…' },
  'alg.herladen': { nl: 'Herladen', en: 'Reload' },
  'alg.opnieuw': { nl: 'Opnieuw proberen', en: 'Try again' },
  'alg.vandaag': { nl: 'Vandaag', en: 'Today' },
  'alg.morgen': { nl: 'Morgen', en: 'Tomorrow' },
  'alg.gisteren': { nl: 'Gisteren', en: 'Yesterday' },
  'alg.niemand': { nl: 'Niemand', en: 'Nobody' },
  'alg.geen': { nl: 'Geen', en: 'None' },
  'alg.alles': { nl: 'Alles', en: 'All' },
  'alg.taak_een': { nl: '{aantal} taak', en: '{aantal} task' },
  'alg.taak_meer': { nl: '{aantal} taken', en: '{aantal} tasks' },
  'alg.persoon_een': { nl: '{aantal} persoon', en: '{aantal} person' },
  'alg.persoon_meer': { nl: '{aantal} personen', en: '{aantal} people' },
  'alg.dag_een': { nl: '{aantal} dag', en: '{aantal} day' },
  'alg.dag_meer': { nl: '{aantal} dagen', en: '{aantal} days' },

  // ── Navigatie ──────────────────────────────────────────────────────────
  'nav.hoofdnavigatie': { nl: 'Hoofdnavigatie', en: 'Main navigation' },
  'nav.dashboard': { nl: 'Dashboard', en: 'Dashboard' },
  'nav.events': { nl: 'Events', en: 'Events' },
  'nav.bord': { nl: 'Bord', en: 'Board' },
  'nav.kalender': { nl: 'Kalender', en: 'Calendar' },
  'nav.klanten': { nl: 'Klanten', en: 'Customers' },
  'nav.socials': { nl: 'Socials', en: 'Socials' },
  'nav.tasks': { nl: 'Tasks', en: 'Tasks' },
  'nav.werklast': { nl: 'Werklast', en: 'Workload' },
  'nav.goals': { nl: 'Goals', en: 'Goals' },
  'nav.bistro': { nl: 'Bistro', en: 'Bistro' },
  'nav.openensluiten': { nl: 'Openen & sluiten', en: 'Opening & closing' },
  'nav.registraties': { nl: 'Registraties', en: 'Records' },
  'nav.team': { nl: 'Team', en: 'Team' },
  'nav.teamoverleg': { nl: 'Teamoverleg', en: 'Team meeting' },
  'nav.rooster': { nl: 'Rooster', en: 'Rota' },
  'nav.uren': { nl: 'Uren', en: 'Hours' },
  'nav.logboek': { nl: 'Logboek', en: 'Audit log' },
  'nav.instellingen': { nl: 'Instellingen', en: 'Settings' },
  'nav.meer': { nl: 'Meer', en: 'More' },

  // ── De schil ───────────────────────────────────────────────────────────
  'schil.werkruimte_laadt': { nl: 'Werkruimte laden…', en: 'Loading your workspace…' },
  'schil.laadt_niet_titel': { nl: 'De werkruimte laadt niet', en: 'The workspace will not load' },
  'schil.laadt_niet_tekst': {
    nl: 'Er ging iets mis bij het ophalen van de lijsten en de mensen. Herlaad de pagina; blijft het staan, geef dan deze melding door: {fout}',
    en: 'Something went wrong fetching the lists and the people. Reload the page; if it persists, pass on this message: {fout}',
  },
  'schil.duurt_te_lang_titel': { nl: 'Dit duurt te lang', en: 'This is taking too long' },
  'schil.duurt_te_lang_tekst': {
    nl: 'De gegevens die op dit toestel bewaard zijn, antwoorden niet. Opnieuw beginnen lost het op — er gaat niets verloren, want alles staat ook online.',
    en: 'The data stored on this device is not answering. Starting over fixes it — nothing is lost, because everything is online as well.',
  },
  'schil.opnieuw_beginnen': { nl: 'Opnieuw beginnen', en: 'Start over' },
  'schil.nieuwe_versie': {
    nl: 'Er staat een nieuwe versie van JE Plan klaar.',
    en: 'A new version of JE Plan is ready.',
  },
  'schil.assistent': { nl: 'Assistent', en: 'Assistant' },
  'schil.afmelden': { nl: 'Afmelden', en: 'Sign out' },

  // ── Timer ──────────────────────────────────────────────────────────────
  'timer.titel': { nl: 'Timer', en: 'Timer' },
  'timer.start': { nl: 'Start', en: 'Start' },
  'timer.starten': { nl: 'Timer starten', en: 'Start timer' },
  'timer.stoppen': { nl: 'Timer stoppen', en: 'Stop timer' },
  'timer.stop_en_boek': { nl: 'Stop en boek', en: 'Stop and log' },
  'timer.losse_tijd': { nl: 'Losse tijd', en: 'Loose time' },
  'timer.leeg': {
    nl: 'Start een timer vanaf een taak, of boek tijd op een kostenplaats.',
    en: 'Start a timer from a task, or log time against a cost centre.',
  },
  'timer.week_geboekt': { nl: 'Deze week geboekt: {tijd}', en: 'Logged this week: {tijd}' },
  'timer.gestopt': { nl: 'Gestopt — {tijd} geboekt.', en: 'Stopped — {tijd} logged.' },
  'timer.te_kort': { nl: 'Te kort, niets geboekt.', en: 'Too short, nothing logged.' },
  'timer.loopt': { nl: 'Timer loopt.', en: 'Timer running.' },
  'timer.waaraan': { nl: 'Waaraan werk je', en: 'What are you working on' },
  'timer.waaraan_hint': {
    nl: 'Zonder omschrijving is een boeking achteraf niet te plaatsen.',
    en: 'Without a description an entry cannot be placed afterwards.',
  },
  'timer.factureerbaar': { nl: 'Factureerbaar', en: 'Billable' },
  'timer.naar_de_klant': { nl: 'Naar de klant', en: 'Bill to the client' },
  'timer.intern_standaard': {
    nl: 'Losse tijd staat standaard op intern.',
    en: 'Loose time is internal by default.',
  },

  // ── Aanmelden ──────────────────────────────────────────────────────────
  'login.aanmelden': { nl: 'Aanmelden', en: 'Sign in' },
  'login.met_google': { nl: 'Aanmelden met Google', en: 'Sign in with Google' },
  'login.ander_account': { nl: 'Met een ander account aanmelden', en: 'Sign in with another account' },
  'login.geen_toegang': {
    nl: '{wie} heeft geen toegang. Vraag een beheerder om een uitnodiging.',
    en: '{wie} has no access. Ask an administrator for an invitation.',
  },
  'login.dit_account': { nl: 'Dit account', en: 'This account' },
  'login.enkel_voor': {
    nl: 'Enkel voor @jeconcept.be en @kenjeklanten.be, of op uitnodiging.',
    en: 'Only for @jeconcept.be and @kenjeklanten.be, or by invitation.',
  },
  'login.technische_melding': { nl: 'Technische melding', en: 'Technical details' },
  'login.niet_ingesteld': {
    nl: 'De Firebase-configuratie ontbreekt in deze build. Zet de VITE_FIREBASE_* variabelen en deploy opnieuw.',
    en: 'The Firebase configuration is missing from this build. Set the VITE_FIREBASE_* variables and deploy again.',
  },
  'login.vastgelopen': {
    nl: 'JE Plan krijgt geen antwoord van de opgeslagen gegevens op dit toestel. Dat gebeurt als een eerder tabblad niet netjes afgesloten werd. Opnieuw beginnen lost het op — er gaat niets verloren.',
    en: 'JE Plan is getting no answer from the data stored on this device. That happens when an earlier tab did not close cleanly. Starting over fixes it — nothing is lost.',
  },

  // ── Taal ───────────────────────────────────────────────────────────────
  'taal.titel': { nl: 'Taal', en: 'Language' },
  'taal.kiezen': { nl: 'Taal kiezen', en: 'Choose language' },
  'taal.uitleg': { nl: 'Geldt voor jou, op al je toestellen.', en: 'Applies to you, on all your devices.' },

  // ── Accountmenu ────────────────────────────────────────────────────────
  'menu.installeren': { nl: 'Installeren op dit toestel', en: 'Install on this device' },
  'menu.welke_meldingen': { nl: 'Welke meldingen ik krijg', en: 'Which notifications I get' },
  'menu.push_aanzetten': { nl: 'Meldingen aanzetten', en: 'Turn notifications on' },
  'menu.push_uitzetten': { nl: 'Meldingen uitzetten', en: 'Turn notifications off' },
  'menu.push_aan': { nl: 'Meldingen staan aan op dit toestel.', en: 'Notifications are on for this device.' },
  'menu.push_uit': { nl: 'Meldingen staan uit op dit toestel.', en: 'Notifications are off for this device.' },
  'menu.push_geblokkeerd': {
    nl: 'De browser blokkeert meldingen. Zet ze aan bij de site-instellingen.',
    en: 'Your browser is blocking notifications. Allow them in the site settings.',
  },
  'menu.push_geblokkeerd_kort': {
    nl: 'De browser blokkeert meldingen voor deze site.',
    en: 'Your browser blocks notifications for this site.',
  },
  'menu.push_niet_ingesteld': {
    nl: 'Meldingen zijn nog niet ingesteld voor deze installatie.',
    en: 'Notifications have not been set up for this installation yet.',
  },
  'menu.push_niet_ingesteld_kort': {
    nl: 'Nog niet ingesteld voor deze installatie.',
    en: 'Not set up for this installation yet.',
  },
  'menu.push_mislukt': {
    nl: 'Meldingen lukken niet op dit toestel.',
    en: 'Notifications do not work on this device.',
  },
  'menu.meer': { nl: 'Meer', en: 'More' },
  'menu.sneltoetsen': { nl: 'Sneltoetsen', en: 'Keyboard shortcuts' },

  // ── Rollen ─────────────────────────────────────────────────────────────
  'rol.owner': { nl: 'Eigenaar', en: 'Owner' },
  'rol.admin': { nl: 'Beheerder', en: 'Administrator' },
  'rol.member': { nl: 'Lid', en: 'Member' },
  'rol.staff': { nl: 'Personeel', en: 'Staff' },
  'rol.social': { nl: 'Social media', en: 'Social media' },
  'rol.guest': { nl: 'Gast', en: 'Guest' },

  // ── Tijd en prioriteit ─────────────────────────────────────────────────
  // De letter achter een uur. Nederlands schrijft 8u30, Engels 8h30 — en "u"
  // betekent in het Engels niets.
  'alg.uur_kort': { nl: 'u', en: 'h' },
  'alg.minuut_kort': { nl: 'm', en: 'm' },
  'alg.nul_minuten': { nl: '0m', en: '0m' },
  'alg.over_dagen': { nl: 'over {aantal} dagen', en: 'in {aantal} days' },
  'alg.dagen_te_laat_een': { nl: '1 dag te laat', en: '1 day overdue' },
  'alg.dagen_te_laat_meer': { nl: '{aantal} dagen te laat', en: '{aantal} days overdue' },
  'prio.1': { nl: 'Urgent', en: 'Urgent' },
  'prio.2': { nl: 'Hoog', en: 'High' },
  'prio.3': { nl: 'Normaal', en: 'Normal' },
  'prio.4': { nl: 'Laag', en: 'Low' },

  // ── De assistent ───────────────────────────────────────────────────────
  'assistent.groet': {
    nl: 'Dag {naam}. Vraag me iets over de planning, of laat me iets doen: een taak aanmaken, een status verzetten of een timer starten.',
    en: 'Hello {naam}. Ask me anything about the planning, or have me do something: create a task, move a status or start a timer.',
  },
  'assistent.tip1': { nl: 'Wat moet ik vandaag doen?', en: 'What should I do today?' },
  'assistent.tip2': {
    nl: 'Welke events moeten nog gefactureerd worden?',
    en: 'Which events still have to be invoiced?',
  },
  'assistent.tip3': {
    nl: 'Maak voor Elke een taak "Tafellinnen bestellen" bij het eerstvolgende huwelijk',
    en: 'Create a task "Order table linen" for Elke on the next wedding',
  },
  'assistent.tip4': { nl: 'Hoeveel gasten verwachten we deze maand?', en: 'How many guests do we expect this month?' },
  'assistent.gedaan': { nl: 'Gedaan.', en: 'Done.' },

  // ── Wanneer een functie niet antwoordt ─────────────────────────────────
  'fout.niet_uitgerold': {
    nl: '{wat} is nog niet uitgerold. Het wacht op de Claude-sleutel: een beheerder zet ANTHROPIC_API_KEY bij het Firebase-project en rolt opnieuw uit — zie docs/assistent-aanzetten.md.',
    en: '{wat} has not been deployed yet. It is waiting for the Claude key: an administrator sets ANTHROPIC_API_KEY on the Firebase project and deploys again — see docs/assistent-aanzetten.md.',
  },
  'fout.afgemeld': { nl: 'Je bent afgemeld. Herlaad de pagina.', en: 'You have been signed out. Reload the page.' },
  'fout.geen_toegang': { nl: 'Je hebt hier geen toegang toe.', en: 'You do not have access to this.' },
  'fout.te_lang': {
    nl: 'Het duurde te lang. Probeer het met een korter transcript, of probeer het zo opnieuw.',
    en: 'That took too long. Try a shorter transcript, or try again in a moment.',
  },
  'fout.niet_bereikbaar': {
    nl: 'De dienst is even niet bereikbaar. Probeer het zo opnieuw.',
    en: 'The service is briefly unreachable. Try again in a moment.',
  },
  'fout.iets_mis': { nl: 'Er ging iets mis.', en: 'Something went wrong.' },
  'fout.dit_onderdeel': { nl: 'Dit onderdeel', en: 'This part' },
}
