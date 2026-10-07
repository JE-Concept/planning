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
  'alg.zeker': { nl: 'Zeker weten?', en: 'Are you sure?' },
  'alg.doorgaan': { nl: 'Doorgaan', en: 'Continue' },
  'alg.sluiten': { nl: 'Sluiten', en: 'Close' },
  'alg.verwijderen': { nl: 'Verwijderen', en: 'Delete' },
  'alg.vorige': { nl: 'Vorige', en: 'Previous' },
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
  'nav.kalender': { nl: 'Kalender', en: 'Calendar' },
  'nav.klanten': { nl: 'Klanten', en: 'Customers' },
  'nav.socials': { nl: 'Socials', en: 'Socials' },
  'nav.tasks': { nl: 'Tasks', en: 'Tasks' },
  'nav.werklast': { nl: 'Werklast', en: 'Workload' },
  'nav.goals': { nl: 'Goals', en: 'Goals' },
  /*
    Heette "Bistro". Dat was de plek waar deze lijsten vandaan kwamen, maar
    niet wat eronder staat: het zijn de dagelijkse lijsten en de
    FAVV-registraties, en die gelden voor elke zaak van het huis. De naam
    noemt nu wat het is in plaats van waar het begon.
  */
  'nav.checklists': { nl: 'Checklists', en: 'Checklists' },
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
  'timer.week_geboekt': { nl: 'Deze week geboekt: {tijd}', en: 'Logged this week: {tijd}' },
  'timer.gestopt': { nl: 'Gestopt — {tijd} geboekt.', en: 'Stopped — {tijd} logged.' },
  'timer.te_kort': { nl: 'Te kort, niets geboekt.', en: 'Too short, nothing logged.' },
  'timer.loopt': { nl: 'Timer loopt.', en: 'Timer running.' },
  'timer.waaraan': { nl: 'Waaraan werk je', en: 'What are you working on' },
  'timer.waaraan_hint': {
    nl: 'Zonder omschrijving is een boeking achteraf niet te plaatsen.',
    en: 'Without a description an entry cannot be placed afterwards.',
  },
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

  // ── De uitnodiging om de app te installeren ────────────────────────────
  'install.titel': { nl: 'Zet JE Plan op je beginscherm', en: 'Add JE Plan to your home screen' },
  'install.waarom': {
    nl: 'Opent zonder adresbalk, werkt zonder bereik en kan je meldingen sturen.',
    en: 'Opens without an address bar, works without a signal, and can send you notifications.',
  },
  'install.nu': { nl: 'Installeren', en: 'Install' },
  'install.hoe': { nl: 'Hoe?', en: 'How?' },
  'install.begrepen': { nl: 'Oké', en: 'Got it' },
  'install.later': { nl: 'Later', en: 'Later' },
  'install.apple_stappen': {
    nl: 'Tik onderaan op het deel-icoon, en dan op "Zet op beginscherm".',
    en: 'Tap the share icon at the bottom, then "Add to Home Screen".',
  },
  'install.al_geopend': {
    nl: 'Je gebruikt JE Plan al als app op dit toestel.',
    en: 'You are already using JE Plan as an app on this device.',
  },
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

  // ── Een schrijfactie die niet doorging ─────────────────────────────────
  // Elke zin zegt eerst dát het niet bewaard is; dat is wat iemand moet weten.
  'fout.niet_bewaard': {
    nl: 'Niet bewaard. Probeer het opnieuw, en kijk na of het er daarna wel staat.',
    en: 'Not saved. Try again, and check afterwards that it stuck.',
  },
  'fout.niet_bewaard_geen_toegang': {
    nl: 'Niet bewaard: je hebt hier geen toegang toe. Wat je zag was alleen op dit scherm.',
    en: 'Not saved: you do not have access to this. What you saw was only on this screen.',
  },
  'fout.niet_bewaard_weg': {
    nl: 'Niet bewaard: dit bestaat niet meer. Iemand heeft het ondertussen verwijderd.',
    en: 'Not saved: this no longer exists. Someone has deleted it in the meantime.',
  },
  'fout.niet_bewaard_veranderd': {
    nl: 'Niet bewaard: er is ondertussen iets veranderd. Herlaad en probeer opnieuw.',
    en: 'Not saved: something changed in the meantime. Reload and try again.',
  },
  'fout.niet_bewaard_te_druk': {
    nl: 'Niet bewaard: het is even te druk. Probeer het zo opnieuw.',
    en: 'Not saved: it is too busy right now. Try again in a moment.',
  },
  'fout.wacht_op_verbinding': {
    nl: 'Nog niet verstuurd — dit gaat mee zodra er weer verbinding is.',
    en: 'Not sent yet — this will go through once there is a connection again.',
  },

  /*
    De zoekbalk en de sneltoetsen.

    Ze stonden bij de instellingen omdat het schermpje met de sneltoetsen daar
    ooit begon, maar ze horen bij de schil: de zoekbalk staat op elk scherm en
    de sneltoetsen werken overal. Sinds het instellingenwoordenboek pas
    ingeladen wordt wanneer je Instellingen opent, maakt dat verschil uit —
    anders zou de zoekbalk zijn eigen teksten missen tot je er geweest bent.

    De sleutels heten nog `inst.*`: ze staan in mails, in tests en in
    schermcode, en hernoemen zou dat allemaal raken zonder dat er iets beter
    van wordt.
  */
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

  /*
    Labels uit de zijbalk die bij hun eigen scherm stonden.

    Ze staan hier omdat de zijbalk ze op élk scherm toont, ook voordat dat
    scherm ingeladen is. Bleven ze bij `aapi.js`, `medewerkers.js` en
    `profiel.js` staan, dan moest de hele catalogus van die schermen mee in de
    eerste download om drie woorden in een menu te kunnen zetten.
  */
  'nav.planning': { nl: 'Planning', en: 'Planning' },
  'nav.medewerkers': { nl: 'Medewerkers', en: 'Crew' },
  'nav.mijnevents': { nl: 'Mijn events', en: 'My events' },
  'nav.materiaal': { nl: 'Materiaal', en: 'Equipment' },
  'profiel.titel': { nl: 'Mijn profiel', en: 'My profile' },

  /*
    De timer in de zijbalk, met zijn werkkiezer.

    Dezelfde reden: hij staat op elk scherm, en de rest van `team.js` — het
    dashboard, de uren, de werklast — komt pas met die schermen mee.
  */
  'uren.waarop': { nl: 'Waarop geboekt', en: 'Booked on' },
  'uren.waarop_hint': {
    nl: 'Het event of de taak. Het bord en het merk komen daaruit mee.',
    en: 'The event or task. The board and brand follow from it.',
  },
  'uren.kies_taak': { nl: 'Kies een event of taak', en: 'Choose an event or task' },
  'uren.zoek_taak': { nl: 'Zoeken', en: 'Search' },
  'uren.zoek_taak_hint': {
    nl: 'Typ een deel van de naam om de lijst korter te maken.',
    en: 'Type part of the name to narrow the list.',
  },
  'uren.omschrijving': { nl: 'Omschrijving', en: 'Description' },
  'uren.omschrijving_hint': { nl: 'Waaraan gewerkt?', en: 'Worked on what?' },

  /* Het assistentpaneel. Open te klappen vanaf elk scherm, dus ook hier. */
  'dashboard.assistent_wat': {
    nl: 'Beantwoordt vragen en voert acties uit in de planning.',
    en: 'Answers questions and carries out actions in the planning.',
  },
  'dashboard.assistent_openen': { nl: 'Openen', en: 'Open' },
  'dashboard.assistent_kijkt': { nl: 'Even kijken in de planning', en: 'Looking in the planning' },
  'dashboard.assistent_probeer': { nl: 'Probeer', en: 'Try' },
  'dashboard.assistent_vraag': { nl: 'Vraag of opdracht', en: 'Question or instruction' },
  'dashboard.assistent_bericht': { nl: 'Bericht aan de assistent', en: 'Message to the assistant' },
  'dashboard.assistent_versturen': { nl: 'Versturen', en: 'Send' },
  'dashboard.assistent_vergissen': {
    nl: 'De assistent kan zich vergissen. Acties zie je meteen in de planning.',
    en: 'The assistant can get things wrong. You see its actions in the planning straight away.',
  },

  /*
    De melding dat er geen bereik is.

    Staat in `offline.js`, dat op elk scherm meeluistert — niet alleen op de
    afvinklijsten waar de rest van `bistro.js` over gaat.
  */
  'lijst.offline_titel': {
    nl: 'Geen verbinding. Je kunt gewoon verder afvinken.',
    en: 'No connection. Carry on ticking off as usual.',
  },
  'lijst.offline_detail': {
    nl: 'Alles wat je invult, gaat mee zodra er weer bereik is.',
    en: 'Everything you enter goes across as soon as there is signal again.',
  },
  'lijst.offline_detail_wachtend_een': {
    nl: '{aantal} wijziging staat nog op dit toestel en gaat mee zodra er weer bereik is.',
    en: '{aantal} change is still on this device and goes across as soon as there is signal again.',
  },
  'lijst.offline_detail_wachtend_meer': {
    nl: '{aantal} wijzigingen staan nog op dit toestel en gaan mee zodra er weer bereik is.',
    en: '{aantal} changes are still on this device and go across as soon as there is signal again.',
  },
  'lijst.wachtend_een': {
    nl: '{aantal} wijziging nog op dit toestel.',
    en: '{aantal} change still on this device.',
  },
  'lijst.wachtend_meer': {
    nl: '{aantal} wijzigingen nog op dit toestel.',
    en: '{aantal} changes still on this device.',
  },
  'lijst.wachtend_detail': {
    nl: 'Doorsturen is bezig — laat de app nog even open.',
    en: 'Sending is under way — leave the app open a moment longer.',
  },
}
