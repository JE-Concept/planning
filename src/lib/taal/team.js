/**
 * De teksten van het dashboard en de teamschermen: overleg, uren, rooster en
 * welke meldingen iemand wil.
 *
 * Nederlands en Engels staan naast elkaar op dezelfde regel, zoals in
 * `schil.js`: zo zie je terwijl je schrijft of de andere taal er al is.
 *
 * Twee dingen blijven met opzet in beide talen hetzelfde. De uren worden
 * geschreven als "8u30" — zo doet de urenregistratie het al jaren en zo belandt
 * het op de loonbrief; een rapport dat in het Engels ineens "8h30" zegt is niet
 * meer te leggen naast wat er uitbetaald werd. En de woorden die het team zelf
 * in het Engels gebruikt (billable, Socials, Goals, Tasks, "ready to invoice")
 * blijven staan zoals ze op de borden en in de database staan.
 */
export default {

  // ── Dashboard: de bovenste rij cijfers ─────────────────────────────────
  'dashboard.groet': { nl: 'Dag {naam}', en: 'Hello {naam}' },

  'dashboard.telaat': { nl: 'Te laat', en: 'Overdue' },
  'dashboard.telaat_onder': { nl: 'op jouw naam', en: 'in your name' },
  'dashboard.telaat_geen': { nl: 'niets over tijd', en: 'nothing over time' },
  'dashboard.vandaag_af': { nl: 'Vandaag af', en: 'Due today' },
  'dashboard.vandaag_af_onder': { nl: 'deze dag', en: 'this day' },
  'dashboard.te_factureren': { nl: 'Te factureren', en: 'To invoice' },
  'dashboard.te_factureren_onder': { nl: 'nog niet gefactureerd', en: 'not invoiced yet' },
  'dashboard.niemand_toegewezen': { nl: 'Niemand toegewezen', en: 'Nobody assigned' },
  'dashboard.niemand_toegewezen_onder': { nl: 'wacht op iemand', en: 'waiting for someone' },
  'dashboard.events_deze_maand': { nl: 'Events deze maand', en: 'Events this month' },
  'dashboard.events_deze_maand_onder': { nl: 'in de kalender', en: 'in the calendar' },
  'dashboard.week_geboekt': { nl: 'Deze week geboekt', en: 'Logged this week' },
  'dashboard.week_geboekt_onder': { nl: 'jouw uren', en: 'your hours' },

  // ── Dashboard: de panelen ──────────────────────────────────────────────
  'dashboard.aankomst': { nl: 'Wat er aankomt', en: 'What is coming up' },
  'dashboard.aankomst_naar': { nl: 'Naar het bord', en: 'To the board' },
  'dashboard.aankomst_leeg': {
    nl: 'Er staat geen event met een datum in de toekomst.',
    en: 'There is no event with a date in the future.',
  },
  'dashboard.telaat_aantal': { nl: '{aantal} te laat', en: '{aantal} overdue' },
  'dashboard.open_aantal': { nl: '{aantal} open', en: '{aantal} open' },
  'dashboard.event_klaar': { nl: 'klaar', en: 'done' },

  'dashboard.bij_jou': { nl: 'Wat bij jou ligt', en: 'What is on your plate' },
  'dashboard.bij_jou_naar': { nl: 'Alle taken', en: 'All tasks' },
  'dashboard.bij_jou_leeg': {
    nl: 'Alles wat aan jou toegewezen is, is afgewerkt.',
    en: 'Everything assigned to you is done.',
  },
  'dashboard.deze_week': { nl: 'Deze week', en: 'This week' },
  'dashboard.geen_prioriteit': { nl: 'Geen prioriteit', en: 'No priority' },

  'dashboard.checklists': { nl: 'Checklists vandaag', en: 'Checklists today' },
  'dashboard.checklists_naar': { nl: 'Naar de lijsten', en: 'To the lists' },
  'dashboard.checklists_leeg': {
    nl: 'Er staan nog geen dagelijkse lijsten klaar.',
    en: 'No daily lists have been set up yet.',
  },
  'dashboard.afgerond_door': { nl: 'Afgerond door {wie}', en: 'Finished by {wie}' },
  'dashboard.bezig_een': { nl: '{aantal} persoon bezig', en: '{aantal} person on it' },
  'dashboard.bezig_meer': { nl: '{aantal} personen bezig', en: '{aantal} people on it' },
  'dashboard.nog_niemand': { nl: 'nog niemand begonnen', en: 'nobody has started yet' },

  'dashboard.wacht_op_jou': { nl: 'Wacht op jou', en: 'Waiting on you' },
  'dashboard.wacht_op_jou_naar': { nl: 'Nakijken', en: 'Review' },
  'dashboard.voor_jou': { nl: 'voor jou', en: 'for you' },

  'dashboard.socials': { nl: 'Socials deze week', en: 'Socials this week' },
  'dashboard.socials_naar': { nl: 'Naar de kalender', en: 'To the calendar' },
  'dashboard.socials_leeg': {
    nl: 'Er staat niets ingepland deze week.',
    en: 'Nothing is scheduled this week.',
  },

  'dashboard.goals': { nl: 'Goals die aandacht vragen', en: 'Goals that need attention' },
  'dashboard.goals_naar': { nl: 'Alle goals', en: 'All goals' },
  'dashboard.goals_leeg': {
    nl: 'Alle lopende goals liggen op schema.',
    en: 'Every running goal is on track.',
  },

  // ── De assistent ───────────────────────────────────────────────────────
  // Hoort bij het dashboard en niet bij een eigen prefix: het paneel staat
  // naast elk scherm en de kop ervan staat al als `schil.assistent`.

  // ── Teamoverleg: de pagina ─────────────────────────────────────────────
  'overleg.agenda': { nl: 'Agenda', en: 'Agenda' },
  'overleg.verslagen': { nl: 'Verslagen', en: 'Reports' },
  'overleg.agenda_samenvatting_een': {
    nl: '{aantal} punt · {duur} gepland',
    en: '{aantal} item · {duur} planned',
  },
  'overleg.agenda_samenvatting_meer': {
    nl: '{aantal} punten · {duur} gepland',
    en: '{aantal} items · {duur} planned',
  },
  'overleg.verslag_aantal_een': { nl: '{aantal} verslag', en: '{aantal} report' },
  'overleg.verslag_aantal_meer': { nl: '{aantal} verslagen', en: '{aantal} reports' },
  'overleg.gevonden_een': { nl: '{gevonden} van {aantal} verslag', en: '{gevonden} of {aantal} report' },
  'overleg.gevonden_meer': { nl: '{gevonden} van {aantal} verslagen', en: '{gevonden} of {aantal} reports' },
  'overleg.samenvatten': { nl: 'Transcript samenvatten', en: 'Summarise transcript' },

  'overleg.geen_verslagen': { nl: 'Nog geen verslagen', en: 'No reports yet' },
  'overleg.geen_verslagen_uitleg': {
    nl: 'Zodra er een overleg is samengevat, staat het hier met zijn actiepunten.',
    en: 'As soon as a meeting has been summarised, it is here with its action points.',
  },
  'overleg.zoek': {
    nl: 'Zoek in de verslagen en de actiepunten…',
    en: 'Search the reports and the action points…',
  },
  'overleg.zoek_label': { nl: 'Zoek in de verslagen', en: 'Search the reports' },
  'overleg.niets_gevonden': { nl: 'Niets gevonden', en: 'Nothing found' },
  'overleg.niets_gevonden_uitleg': {
    nl: 'Geen verslag met "{term}" in de samenvatting of de actiepunten.',
    en: 'No report with "{term}" in the summary or the action points.',
  },
  'overleg.treffer_actiepunt': { nl: 'actiepunt', en: 'action point' },
  'overleg.treffer_besproken': { nl: 'besproken', en: 'discussed' },
  'overleg.nog_andere': { nl: 'en {aantal} andere', en: 'and {aantal} more' },

  // ── Teamoverleg: de agenda ─────────────────────────────────────────────
  'overleg.punt_toevoegen': { nl: 'Punt toevoegen', en: 'Add an item' },
  'overleg.onderwerp': { nl: 'Onderwerp', en: 'Subject' },
  'overleg.onderwerp_hint': { nl: 'Waarover gaat het?', en: 'What is it about?' },
  'overleg.omschrijving': { nl: 'Omschrijving', en: 'Description' },
  'overleg.omschrijving_hint': {
    nl: 'Wat moet het overleg hierover weten of beslissen?',
    en: 'What does the meeting need to know or decide about this?',
  },
  'overleg.jij_eigenaar': { nl: 'Jij bent de eigenaar', en: 'You are the owner' },
  'overleg.verwachte_tijd': { nl: 'Verwachte tijd', en: 'Expected time' },
  'overleg.minuten': { nl: '{minuten} min', en: '{minuten} min' },
  'overleg.op_de_agenda': { nl: 'Op de agenda', en: 'Onto the agenda' },

  'overleg.agenda_leeg': { nl: 'De agenda is leeg', en: 'The agenda is empty' },
  'overleg.agenda_leeg_uitleg': {
    nl: 'Iedereen kan hier een punt op zetten voor het volgende overleg.',
    en: 'Anyone can put an item here for the next meeting.',
  },
  'overleg.volgende': { nl: 'Volgende overleg', en: 'Next meeting' },
  'overleg.geplande_duur': { nl: '{duur} gepland', en: '{duur} planned' },
  'overleg.geen_eigenaar': { nl: 'Geen eigenaar', en: 'No owner' },
  'overleg.besproken': { nl: 'Besproken', en: 'Discussed' },
  'overleg.punt_verwijderen': { nl: 'Dit punt verwijderen?', en: 'Delete this item?' },
  'overleg.al_besproken': { nl: 'Al besproken ({aantal})', en: 'Already discussed ({aantal})' },
  'overleg.taak_aangemaakt_badge': { nl: 'taak aangemaakt', en: 'task created' },
  'overleg.terugzetten': { nl: 'Terugzetten', en: 'Put back' },

  // ── Teamoverleg: een punt afronden ─────────────────────────────────────
  'overleg.afronden_titel': { nl: 'Besproken — en dan?', en: 'Discussed — what now?' },
  'overleg.afronden_uitleg': {
    nl: 'Van “{titel}” een taak maken, met een eigenaar en een deadline erbij.',
    en: 'Turn “{titel}” into a task, with an owner and a deadline.',
  },
  'overleg.alleen_afvinken': { nl: 'Alleen afvinken', en: 'Just tick it off' },
  'overleg.bezig': { nl: 'Bezig…', en: 'Working…' },
  'overleg.taak_aanmaken': { nl: 'Taak aanmaken', en: 'Create task' },
  'overleg.wat_gebeuren': { nl: 'Wat moet er gebeuren?', en: 'What needs to happen?' },
  'overleg.wie_doet': { nl: 'Wie doet het?', en: 'Who does it?' },
  'overleg.nog_te_verdelen': { nl: 'Niemand — nog te verdelen', en: 'Nobody — still to be divided' },
  'overleg.tegen_wanneer': { nl: 'Tegen wanneer?', en: 'By when?' },
  'overleg.deadline_label': { nl: 'Deadline van de taak', en: 'Deadline of the task' },
  'overleg.taak_op_lijst': {
    nl: 'De taak komt op “{lijst}” te staan, en meteen in Mijn werk van wie ze krijgt.',
    en: 'The task lands on “{lijst}”, and straight into the work of whoever gets it.',
  },
  'overleg.geen_takenlijst': {
    nl: 'Er is nog geen takenlijst om dit op te zetten. Maak er een aan bij Instellingen.',
    en: 'There is no task list to put this on yet. Create one under Settings.',
  },
  'overleg.taak_aangemaakt_voor': { nl: 'Taak aangemaakt voor {wie}.', en: 'Task created for {wie}.' },
  'overleg.taak_aangemaakt': { nl: 'Taak aangemaakt.', en: 'Task created.' },

  // ── Teamoverleg: een verslag ───────────────────────────────────────────
  'overleg.deelnemers': { nl: 'Deelnemers', en: 'Attendees' },
  'overleg.besproken_kop': { nl: 'Besproken', en: 'Discussed' },
  'overleg.actiepunten': { nl: 'Actiepunten ({aantal})', en: 'Action points ({aantal})' },
  'overleg.geen_wie': { nl: 'niemand', en: 'nobody' },
  'overleg.geen_actiepunten': {
    nl: 'Geen actiepunten uit dit overleg.',
    en: 'No action points from this meeting.',
  },
  'overleg.actiepunten_zijn_taken': {
    nl: 'Actiepunten zijn gewone taken: wie er een kreeg, ziet hem ook in Mijn werk.',
    en: 'Action points are ordinary tasks: whoever got one sees it in their own work as well.',
  },
  'overleg.bron': { nl: 'Bron', en: 'Source' },
  'overleg.de_opname': { nl: 'de opname', en: 'the recording' },
  'overleg.door_ai': {
    nl: 'Samengevat door AI. Lees na voor je erop voortgaat — wat er niet in stond, staat er ook niet in.',
    en: 'Summarised by AI. Read it over before you build on it — what was not said is not in here either.',
  },

  // ── Teamoverleg: een transcript samenvatten ────────────────────────────
  'overleg.datum_overleg': { nl: 'Datum van het overleg', en: 'Date of the meeting' },
  'overleg.link_opname': { nl: 'Link naar de opname', en: 'Link to the recording' },
  'overleg.transcript': { nl: 'Transcript', en: 'Transcript' },
  'overleg.transcript_hint': {
    nl: 'Plak hier het transcript van de Meet-opname…',
    en: 'Paste the transcript of the Meet recording here…',
  },
  'overleg.samenvatten_knop': { nl: 'Samenvatten', en: 'Summarise' },
  'overleg.model_leest': {
    nl: 'Het model leest het transcript. Dit duurt een halve minuut tot enkele minuten.',
    en: 'The model is reading the transcript. This takes half a minute to a few minutes.',
  },
  'overleg.verslag_toegevoegd_een': {
    nl: 'Verslag toegevoegd met {aantal} actiepunt, waarvan {toegewezen} toegewezen.',
    en: 'Report added with {aantal} action point, {toegewezen} of them assigned.',
  },
  'overleg.verslag_toegevoegd_meer': {
    nl: 'Verslag toegevoegd met {aantal} actiepunten, waarvan {toegewezen} toegewezen.',
    en: 'Report added with {aantal} action points, {toegewezen} of them assigned.',
  },

  // ── Uren ───────────────────────────────────────────────────────────────
  // Factureerbaar stond hier als tweede getal. Dat is weg: JE Concept werkt
  // met een vaste prijs per event, dus welk deel van de uren doorgerekend mag
  // worden was een vraag die nooit gesteld werd.
  'uren.samenvatting': {
    nl: '{totaal} geboekt',
    en: '{totaal} logged',
  },
  'uren.maand': { nl: 'Maand', en: 'Month' },
  'uren.persoon': { nl: 'Persoon', en: 'Person' },
  'uren.mijn_uren': { nl: 'Mijn uren', en: 'My hours' },
  'uren.hele_team': { nl: 'Het hele team', en: 'The whole team' },
  'uren.tijd_kort': { nl: '+ Tijd', en: '+ Time' },
  'uren.registraties': { nl: 'Registraties', en: 'Entries' },
  'uren.kalender': { nl: 'Kalender', en: 'Calendar' },
  'uren.rapport': { nl: 'Rapport', en: 'Report' },
  'uren.deze_maand': { nl: '{tijd} deze maand', en: '{tijd} this month' },
  'uren.tijd': { nl: 'Tijd', en: 'Time' },

  'uren.leeg': { nl: 'Nog geen uren deze maand', en: 'No hours yet this month' },
  'uren.leeg_uitleg': {
    nl: 'Start de timer in de bovenbalk of voeg tijd handmatig toe.',
    en: 'Start the timer in the top bar, or add time by hand.',
  },
  'uren.tijd_toevoegen': { nl: 'Tijd toevoegen', en: 'Add time' },
  'uren.intern': { nl: 'intern', en: 'internal' },
  'uren.registratie_verwijderen': { nl: 'Registratie verwijderen?', en: 'Delete this entry?' },

  'uren.per_persoon': { nl: 'Per persoon', en: 'Per person' },
  'uren.per_lijst': { nl: 'Per lijst', en: 'Per list' },
  'uren.per_merk': { nl: 'Per merk', en: 'Per brand' },
  'uren.per_dag': { nl: 'Per dag', en: 'Per day' },
  'uren.onbekend': { nl: 'Onbekend', en: 'Unknown' },
  'uren.zonder_lijst': { nl: 'Zonder lijst', en: 'Without a list' },
  'uren.zonder_merk': { nl: 'Zonder merk', en: 'Without a brand' },
  'uren.totaal': { nl: 'Totaal', en: 'Total' },

  // De kolomkoppen van de uitvoer naar een rekenblad. Die uitvoer is het stuk
  // dat de tool verlaat, dus hij volgt de taal van wie hem maakt.
  'uren.csv_datum': { nl: 'Datum', en: 'Date' },
  'uren.csv_persoon': { nl: 'Persoon', en: 'Person' },
  'uren.csv_lijst': { nl: 'Lijst', en: 'List' },
  'uren.csv_taak': { nl: 'Taak', en: 'Task' },
  'uren.csv_omschrijving': { nl: 'Omschrijving', en: 'Description' },
  'uren.csv_van': { nl: 'Van', en: 'From' },
  'uren.csv_tot': { nl: 'Tot', en: 'To' },
  'uren.csv_uren': { nl: 'Uren', en: 'Hours' },
  'uren.csv_ja': { nl: 'ja', en: 'yes' },
  'uren.csv_nee': { nl: 'nee', en: 'no' },

  'uren.aanpassen_titel': { nl: 'Tijd aanpassen', en: 'Edit time' },
  'uren.toevoegen_titel': { nl: 'Tijd toevoegen', en: 'Add time' },
  'uren.van': { nl: 'Van', en: 'From' },
  'uren.tot': { nl: 'Tot', en: 'To' },
  /*
    De keuzelijst van bórden is een keuze van taken geworden: je boekte een uur
    op "Events" en daarmee was het weg. `uren.lijst` blijft bestaan omdat het
    verslag nog per bord groepeert — dat komt nu uit de gekozen taak mee.
  */
  'uren.lijst': { nl: 'Lijst', en: 'List' },
  'uren.opgeslagen': { nl: 'Opgeslagen.', en: 'Saved.' },

  // ── Rooster ────────────────────────────────────────────────────────────
  // De uren blijven "8u30", ook in het Engels: dat is het formaat van de
  // urenregistratie en van de loonbrief.
  'rooster.ingepland': { nl: '{uren} ingepland', en: '{uren} scheduled' },
  'rooster.vorige_week': { nl: 'Vorige week', en: 'Previous week' },
  'rooster.deze_week': { nl: 'Deze week', en: 'This week' },
  'rooster.volgende_week': { nl: 'Volgende week', en: 'Next week' },
  'rooster.kopieer': { nl: 'Kopieer naar volgende week', en: 'Copy to next week' },
  'rooster.niets_te_kopieren': {
    nl: 'Deze week is leeg; er viel niets te kopiëren.',
    en: 'This week is empty; there was nothing to copy.',
  },
  'rooster.gekopieerd_een': {
    nl: '{aantal} dienst naar volgende week gekopieerd.',
    en: '{aantal} shift copied to next week.',
  },
  'rooster.gekopieerd_meer': {
    nl: '{aantal} diensten naar volgende week gekopieerd.',
    en: '{aantal} shifts copied to next week.',
  },

  'rooster.botsing_een': {
    nl: 'Eén iemand staat twee keer tegelijk ingepland.',
    en: 'One person is scheduled twice at the same time.',
  },
  'rooster.botsing_meer': {
    nl: '{aantal} keer staat iemand twee keer tegelijk ingepland.',
    en: '{aantal} times someone is scheduled twice at the same time.',
  },
  'rooster.botsing_staart': {
    nl: 'Dat merk je anders pas op de dag zelf.',
    en: 'Otherwise you only notice on the day itself.',
  },

  'rooster.wie': { nl: 'Wie', en: 'Who' },
  'rooster.week': { nl: 'Week', en: 'Week' },
  'rooster.per_dag': { nl: 'Per dag', en: 'Per day' },
  'rooster.leeg': { nl: 'Nog niemand om in te roosteren', en: 'Nobody to schedule yet' },
  'rooster.leeg_uitleg': {
    nl: 'Iedereen met een actief profiel staat hier, ook zonder dienst. Nodig collega’s uit bij Instellingen → Team.',
    en: 'Everyone with an active profile appears here, shift or no shift. Invite colleagues under Settings → Team.',
  },
  'rooster.dienst_toevoegen_voor': {
    nl: 'Dienst toevoegen voor {wie} op {dag} {nummer}',
    en: 'Add a shift for {wie} on {dag} {nummer}',
  },
  'rooster.geboekt': { nl: '{uren} geboekt', en: '{uren} logged' },
  'rooster.precies': { nl: 'precies geboekt', en: 'logged exactly' },

  'rooster.dienst_aanpassen': { nl: 'Dienst aanpassen', en: 'Edit shift' },
  'rooster.dienst_toevoegen': { nl: 'Dienst toevoegen', en: 'Add shift' },
  'rooster.weghalen': { nl: 'Weghalen', en: 'Remove' },
  'rooster.van': { nl: 'Van', en: 'From' },
  'rooster.van_hint': {
    nl: 'Zoals het op de deur hangt, bijvoorbeeld 17:00.',
    en: 'As it hangs on the door, for instance 17:00.',
  },
  'rooster.tot': { nl: 'Tot', en: 'To' },
  'rooster.tot_hint': {
    nl: 'Loopt het over middernacht, vul dan gewoon 03:00 in.',
    en: 'If it runs past midnight, simply put 03:00.',
  },
  'rooster.pauze': { nl: 'Pauze', en: 'Break' },
  'rooster.pauze_hint': {
    nl: 'In minuten; telt niet mee in de uren.',
    en: 'In minutes; does not count towards the hours.',
  },
  'rooster.waar': { nl: 'Waar', en: 'Where' },
  'rooster.geen_plek': { nl: 'Geen plek gekozen', en: 'No place chosen' },
  'rooster.notitie': { nl: 'Notitie', en: 'Note' },
  'rooster.notitie_hint': { nl: 'Opbouw, avondbar, keuken…', en: 'Set-up, evening bar, kitchen…' },

  // ── Meldingen: wat je wil horen ────────────────────────────────────────
  'melding.titel': { nl: 'Meldingen', en: 'Notifications' },
  'melding.klaar': { nl: 'Klaar', en: 'Done' },
  'melding.intro': {
    nl: 'Wat je wil horen, en hoe. Dit geldt voor jou, op al je toestellen.',
    en: 'What you want to hear, and how. This applies to you, on all your devices.',
  },
  'melding.kanaal_push': { nl: 'Melding', en: 'Notification' },
  'melding.kanaal_email': { nl: 'E-mail', en: 'Email' },

  'melding.toewijzing_titel': { nl: 'Een taak komt op jouw naam', en: 'A task lands in your name' },
  'melding.toewijzing_uitleg': {
    nl: 'Zodra iemand je aan een taak toevoegt. Niet wanneer je dat zelf doet.',
    en: 'As soon as someone adds you to a task. Not when you do it yourself.',
  },
  'melding.reactie_titel': { nl: 'Iemand reageert op je taak', en: 'Someone replies on your task' },
  'melding.reactie_uitleg': {
    nl: 'Op taken die op jouw naam staan en op taken waar je zelf op reageerde.',
    en: 'On tasks in your name and on tasks you replied to yourself.',
  },
  'melding.deadline_titel': { nl: 'Een deadline van morgen', en: 'A deadline for tomorrow' },
  'melding.deadline_uitleg': {
    nl: 'Elke ochtend om zeven uur, alleen als er morgen iets van jou vervalt.',
    en: 'Every morning at seven, only when something of yours is due tomorrow.',
  },
  'melding.telaat_titel': {
    nl: 'Ochtendlijst van wat te laat staat',
    en: 'Morning list of what is overdue',
  },
  'melding.telaat_uitleg': {
    nl: 'Om half acht, en alleen op de dagen dat er iets op jouw naam over tijd staat.',
    en: 'At half past seven, and only on the days when something in your name is over time.',
  },

  'melding.push_niet_ingesteld': {
    nl: 'Meldingen op je toestel zijn voor deze installatie nog niet ingesteld. Tot dat gebeurt komt alles per e-mail binnen.',
    en: 'Notifications on your device have not been set up for this installation yet. Until that happens everything arrives by email.',
  },
  'melding.push_uit': {
    nl: 'Meldingen staan nog uit op dit toestel. Zet ze aan via “Meldingen aanzetten” in dit menu, anders komt alleen de e-mail aan.',
    en: 'Notifications are still off on this device. Turn them on with “Turn notifications on” in this menu, otherwise only the email arrives.',
  },
}
