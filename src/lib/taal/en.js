/**
 * The English texts.
 *
 * Dutch is the source; this file mirrors its keys. A missing key here falls back
 * to the Dutch text rather than showing the key itself — a screen with the odd
 * Dutch word is usable, a screen full of `tasks.leeg.titel` is not.
 *
 * The English is British: this is a Belgian company, and "17/03" reads as March
 * to everyone here. Some words stay untranslated because the team uses them in
 * Dutch too — "Socials", "Goals", "Tasks" are the names on the boards, and
 * renaming them in one language only would make two people describe the same
 * screen differently.
 */
export const en = {
  // ── General ──────────────────────────────────────────────────────────────
  'alg.opslaan': 'Save',
  'alg.annuleren': 'Cancel',
  'alg.sluiten': 'Close',
  'alg.verwijderen': 'Delete',
  'alg.archiveren': 'Archive',
  'alg.toevoegen': 'Add',
  'alg.aanmaken': 'Create',
  'alg.aanpassen': 'Edit',
  'alg.zoeken': 'Search',
  'alg.laden': 'One moment…',
  'alg.herladen': 'Reload',
  'alg.opnieuw': 'Try again',
  'alg.vandaag': 'Today',
  'alg.morgen': 'Tomorrow',
  'alg.gisteren': 'Yesterday',
  'alg.niemand': 'Nobody',
  'alg.geen': 'None',
  'alg.alles': 'All',
  'alg.taak_een': '{aantal} task',
  'alg.taak_meer': '{aantal} tasks',
  'alg.persoon_een': '{aantal} person',
  'alg.persoon_meer': '{aantal} people',
  'alg.dag_een': '{aantal} day',
  'alg.dag_meer': '{aantal} days',

  // ── Navigation ───────────────────────────────────────────────────────────
  'nav.hoofdnavigatie': 'Main navigation',
  'nav.dashboard': 'Dashboard',
  'nav.events': 'Events',
  'nav.bord': 'Board',
  'nav.kalender': 'Calendar',
  'nav.klanten': 'Customers',
  'nav.socials': 'Socials',
  'nav.tasks': 'Tasks',
  'nav.werklast': 'Workload',
  'nav.goals': 'Goals',
  'nav.bistro': 'Bistro',
  'nav.openensluiten': 'Opening & closing',
  'nav.registraties': 'Records',
  'nav.team': 'Team',
  'nav.teamoverleg': 'Team meeting',
  'nav.rooster': 'Rota',
  'nav.uren': 'Hours',
  'nav.instellingen': 'Settings',
  'nav.meer': 'More',

  // ── The shell ────────────────────────────────────────────────────────────
  'schil.werkruimte_laadt': 'Loading your workspace…',
  'schil.laadt_niet_titel': 'The workspace will not load',
  'schil.laadt_niet_tekst':
    'Something went wrong fetching the lists and the people. Reload the page; if it persists, pass on this message: {fout}',
  'schil.duurt_te_lang_titel': 'This is taking too long',
  'schil.duurt_te_lang_tekst':
    'The data stored on this device is not answering. Starting over fixes it — nothing is lost, because everything is online as well.',
  'schil.opnieuw_beginnen': 'Start over',
  'schil.nieuwe_versie': 'A new version of JE Plan is ready.',
  'schil.assistent': 'Assistant',
  'schil.afmelden': 'Sign out',

  // ── Timer ────────────────────────────────────────────────────────────────
  'timer.titel': 'Timer',
  'timer.start': 'Start',
  'timer.starten': 'Start timer',
  'timer.stoppen': 'Stop timer',
  'timer.stop_en_boek': 'Stop and log',
  'timer.losse_tijd': 'Loose time',
  'timer.leeg': 'Start a timer from a task, or log time against a cost centre.',
  'timer.week_geboekt': 'Logged this week: {tijd}',
  'timer.gestopt': 'Stopped — {tijd} logged.',
  'timer.te_kort': 'Too short, nothing logged.',
  'timer.loopt': 'Timer running.',
  'timer.waaraan': 'What are you working on',
  'timer.waaraan_hint': 'Without a description an entry cannot be placed afterwards.',
  'timer.factureerbaar': 'Billable',
  'timer.naar_de_klant': 'Bill to the client',
  'timer.intern_standaard': 'Loose time is internal by default.',

  // ── Signing in ───────────────────────────────────────────────────────────
  'login.aanmelden': 'Sign in',
  'login.met_google': 'Sign in with Google',
  'login.ander_account': 'Sign in with another account',
  'login.geen_toegang': '{wie} has no access. Ask an administrator for an invitation.',
  'login.dit_account': 'This account',
  'login.enkel_voor': 'Only for @jeconcept.be and @kenjeklanten.be, or by invitation.',
  'login.technische_melding': 'Technical details',
  'login.niet_ingesteld':
    'The Firebase configuration is missing from this build. Set the VITE_FIREBASE_* variables and deploy again.',
  'login.vastgelopen':
    'JE Plan is getting no answer from the data stored on this device. That happens when an earlier tab did not close cleanly. Starting over fixes it — nothing is lost.',

  // ── Language ─────────────────────────────────────────────────────────────
  'taal.titel': 'Language',
  'taal.kiezen': 'Choose language',
  'taal.uitleg': 'Applies to you, on all your devices.',

  // ── Account menu ─────────────────────────────────────────────────────────
  'menu.installeren': 'Install on this device',
  'menu.welke_meldingen': 'Which notifications I get',
  'menu.push_aanzetten': 'Turn notifications on',
  'menu.push_uitzetten': 'Turn notifications off',
  'menu.push_aan': 'Notifications are on for this device.',
  'menu.push_uit': 'Notifications are off for this device.',
  'menu.push_geblokkeerd': 'Your browser is blocking notifications. Allow them in the site settings.',
  'menu.push_geblokkeerd_kort': 'Your browser blocks notifications for this site.',
  'menu.push_niet_ingesteld': 'Notifications have not been set up for this installation yet.',
  'menu.push_niet_ingesteld_kort': 'Not set up for this installation yet.',
  'menu.push_mislukt': 'Notifications do not work on this device.',
  'menu.meer': 'More',
  'menu.sneltoetsen': 'Keyboard shortcuts',

  // ── Roles ────────────────────────────────────────────────────────────────
  'rol.owner': 'Owner',
  'rol.admin': 'Administrator',
  'rol.member': 'Member',
  'rol.staff': 'Staff',
  'rol.guest': 'Guest',
}
