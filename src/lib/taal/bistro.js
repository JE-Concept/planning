/**
 * De teksten van de bistroschermen: de dagelijkse lijsten en het verslag.
 *
 * Dit is het stuk waar de tweetaligheid om begonnen is. In de keuken en de zaal
 * werkt personeel dat geen Nederlands leest, en een afvinklijst die je niet
 * begrijpt is geen afvinklijst — dan raad je wat er staat, en dat is precies wat
 * er bij een FAVV-controle niet mag gebeuren.
 *
 * Wat hier níét in staat, en met opzet:
 *
 *  - De punten zelf ("Koeling controleren", "Temperatuur koelcel"). Die staan in
 *    de database en worden door de beheerders geschreven; ze vertalen zou een
 *    tweede lijst maken die uit elkaar loopt met de eerste.
 *  - De koppen van het maandverslag en van de CSV-export. Dat verslag is het
 *    bewijsstuk voor de voedselinspectie, en een controleur leest Nederlands.
 *    Zie de toelichting in `pages/ChecklistReport.jsx` en `lib/checklist-report.js`.
 *
 * De schil (`alg.*`) wordt hergebruikt waar dat kan: "Vandaag", "personen" en
 * dergelijke staan al in `schil.js`.
 */
export default {

  // ── De dagelijkse lijsten ──────────────────────────────────────────────
  'lijst.titel': { nl: 'Openen en sluiten', en: 'Opening and closing' },
  'lijst.vandaag': { nl: 'vandaag', en: 'today' },
  'lijst.vorige_dag': { nl: 'Vorige dag', en: 'Previous day' },
  'lijst.volgende_dag': { nl: 'Volgende dag', en: 'Next day' },
  'lijst.geen_titel': { nl: 'Nog geen lijsten', en: 'No lists yet' },
  'lijst.geen_tekst': {
    nl: 'De openings- en sluitingslijst worden bij de eerste inrichting klaargezet.',
    en: 'The opening and closing lists are set up when the bistro is first configured.',
  },
  'lijst.voortgang': { nl: '{gedaan} van {totaal}', en: '{gedaan} of {totaal}' },
  'lijst.binnenkort': { nl: 'Komt er nog aan', en: 'Still to come' },
  'lijst.code_tonen': { nl: 'Code tonen', en: 'Show code' },

  // ── Wat nog niet doorgestuurd is ───────────────────────────────────────
  // Het merkje op de lijst zelf; de balk bovenaan staat hieronder.
  'lijst.nog_op_toestel': { nl: 'Nog op dit toestel', en: 'Still on this device' },
  'lijst.geen_verbinding': { nl: 'Geen verbinding', en: 'No connection' },
  'lijst.gesloten': {
    nl: 'De bistro is op deze dag gesloten. Afvinken hoeft niet; wat je toch afvinkt, komt in de registraties.',
    en: 'The bistro is closed on this day. No need to tick anything off; whatever you do tick off goes into the records.',
  },
  'lijst.gesloten_reden': {
    nl: 'De bistro is op deze dag gesloten ({reden}). Afvinken hoeft niet; wat je toch afvinkt, komt in de registraties.',
    en: 'The bistro is closed on this day ({reden}). No need to tick anything off; whatever you do tick off goes into the records.',
  },
  'lijst.wordt_doorgestuurd': {
    nl: 'Wordt doorgestuurd zodra er weer bereik is',
    en: 'Goes across as soon as there is signal again',
  },

  // ── De metingen naast een vinkje ───────────────────────────────────────
  'lijst.waarde': { nl: 'Waarde', en: 'Value' },
  'lijst.veld_voor': { nl: '{veld} voor {punt}', en: '{veld} for {punt}' },
  'lijst.ingevuld_door': { nl: 'ingevuld door {wie}', en: 'entered by {wie}' },
  // De aangehaalde tekst is de naam van een punt uit de database en staat er
  // dus in beide talen in het Nederlands: op het scherm ernaast staat ze ook zo.
  'lijst.boven_grens': {
    nl: 'Boven de grens van {grens}. Noteer welke maatregel je genomen hebt bij “Afwijkingen en genomen maatregelen”.',
    en: 'Above the limit of {grens}. Note what you did about it under “Afwijkingen en genomen maatregelen”.',
  },
  'lijst.onder_grens': {
    nl: 'Onder de grens van {grens}. Noteer welke maatregel je genomen hebt bij “Afwijkingen en genomen maatregelen”.',
    en: 'Below the limit of {grens}. Note what you did about it under “Afwijkingen en genomen maatregelen”.',
  },

  // ── Overdracht en afronden ─────────────────────────────────────────────
  'lijst.overdracht': { nl: 'Over te dragen aan de volgende shift', en: 'To hand over to the next shift' },
  'lijst.overdracht_hint': { nl: 'Wat moet morgen zeker geweten zijn?', en: 'Anything tomorrow needs to know?' },
  'lijst.opmerkingen': { nl: 'Opmerkingen', en: 'Notes' },
  'lijst.opmerkingen_hint': { nl: 'Iets bijzonders vanmorgen?', en: 'Anything unusual this morning?' },
  'lijst.notitie_door': { nl: 'Laatst bijgewerkt door {wie}', en: 'Last updated by {wie}' },
  'lijst.notitie_door_om': {
    nl: 'Laatst bijgewerkt door {wie} om {tijd}',
    en: 'Last updated by {wie} at {tijd}',
  },
  'lijst.afronden': { nl: 'Lijst afronden', en: 'Finish list' },
  'lijst.is_afgerond': { nl: 'Afgerond', en: 'Finished' },
  'lijst.afgerond_toast': { nl: 'Lijst afgerond.', en: 'List finished.' },
  'lijst.afgerond_door': { nl: 'Afgerond door {wie} om {tijd}', en: 'Finished by {wie} at {tijd}' },
  'lijst.nog_te_gaan': { nl: 'Nog {rest} te gaan.', en: '{rest} still to go.' },

  // ── Het maandverslag ───────────────────────────────────────────────────
  /*
    Alleen wat je bedient staat hier: de knoppen om te bladeren, te exporteren
    en af te drukken, plus de lege staat. Het verslag zelf — de kop, de cijfers,
    de tabellen, de voetnoot — blijft Nederlands, want het wordt afgedrukt en op
    tafel gelegd bij een FAVV-controle. Die knoppen staan niet op papier (de
    afdrukstijl haalt ze weg), dus ze mogen wél meegaan met de taal van wie kijkt.
  */
  'rapport.vorige_maand': { nl: 'Vorige maand', en: 'Previous month' },
  'rapport.deze_maand': { nl: 'Deze maand', en: 'This month' },
  'rapport.volgende_maand': { nl: 'Volgende maand', en: 'Next month' },
  'rapport.afdrukken': { nl: 'Afdrukken of PDF', en: 'Print or PDF' },
  'rapport.leeg_titel': { nl: 'Nog niets te tonen', en: 'Nothing to show yet' },
  'rapport.leeg_tekst': { nl: 'Deze maand is nog niet begonnen.', en: 'This month has not started yet.' },

  /*
    Het maandverslag van de registraties.

    Het scherm volgt de taal; de CSV-export niet. Die staat in vaste
    Nederlandse kolomkoppen (zie `naarCsv` in `lib/checklist-report.js`), want
    twee exports van dezelfde maand horen hetzelfde bestand te zijn — en een
    FAVV-controleur leest Nederlands. Hetzelfde geldt voor de kop die alleen
    op papier staat.
  */
  'rapport.eyebrow': { nl: 'Registraties', en: 'Records' },
  'rapport.ondertitel': {
    nl: 'Wat er afgevinkt is, door wie, en wat er gemeten werd.',
    en: 'What was ticked off, by whom, and what was measured.',
  },

  'rapport.vak.afgevinkt': { nl: 'Afgevinkt', en: 'Ticked off' },
  'rapport.vak.punten': { nl: '{gedaan} van {totaal} punten', en: '{gedaan} of {totaal} items' },
  'rapport.vak.volledige_dagen': { nl: 'Volledige dagen', en: 'Complete days' },
  'rapport.vak.alles_afgevinkt': { nl: 'alles afgevinkt', en: 'everything ticked off' },
  'rapport.vak.overschrijdingen': { nl: 'Overschrijdingen', en: 'Out of range' },
  'rapport.vak.buiten': { nl: 'buiten de grens', en: 'outside the limit' },
  'rapport.vak.binnen': { nl: 'alles binnen de grens', en: 'everything within the limit' },
  // "Alles binnen de grens" alleen met het aantal metingen erbij, en nooit
  // over een maand waarin niets gemeten is: zie `meetStand`.
  'rapport.vak.binnen_gemeten': {
    nl: 'alles binnen de grens · {gemeten} van {totaal} gemeten',
    en: 'everything within the limit · {gemeten} of {totaal} measured',
  },
  'rapport.vak.geen_metingen': { nl: 'geen metingen', en: 'no readings' },
  'rapport.vak.gesloten_een': { nl: '{aantal} dag gesloten', en: '{aantal} day closed' },
  'rapport.vak.gesloten_meer': { nl: '{aantal} dagen gesloten', en: '{aantal} days closed' },

  'rapport.buiten.titel': { nl: 'Metingen buiten de grens', en: 'Readings outside the limit' },
  'rapport.kol.datum': { nl: 'Datum', en: 'Date' },
  'rapport.kol.wat': { nl: 'Wat', en: 'What' },
  'rapport.kol.gemeten': { nl: 'Gemeten', en: 'Measured' },
  'rapport.kol.grens': { nl: 'Grens', en: 'Limit' },
  'rapport.kol.ingevuld_door': { nl: 'Ingevuld door', en: 'Entered by' },
  'rapport.kol.lijst': { nl: 'Lijst', en: 'List' },
  'rapport.kol.afgevinkt': { nl: 'Afgevinkt', en: 'Ticked off' },
  'rapport.kol.afgerond_door': { nl: 'Afgerond door', en: 'Completed by' },
  'rapport.kol.open': { nl: 'Wat open bleef', en: 'What was left open' },
  'rapport.grens.max': { nl: 'max', en: 'max' },
  'rapport.grens.min': { nl: 'min', en: 'min' },

  'rapport.dag.titel': { nl: 'Dag per dag', en: 'Day by day' },
  'rapport.dagen_een': { nl: '{aantal} dag', en: '{aantal} day' },
  'rapport.dagen_meer': { nl: '{aantal} dagen', en: '{aantal} days' },
  'rapport.om': { nl: 'om {tijd}', en: 'at {tijd}' },
  'rapport.niet_afgerond': { nl: 'niet afgerond', en: 'not completed' },
  'rapport.niet_begonnen': { nl: 'niet begonnen', en: 'not started' },
  'rapport.niets_afgevinkt': { nl: 'niets afgevinkt', en: 'nothing ticked off' },
  'rapport.gesloten': { nl: 'Gesloten', en: 'Closed' },
  'rapport.gesloten_reden': { nl: 'Gesloten — {reden}', en: 'Closed — {reden}' },
  'rapport.gesloten_toch': { nl: 'gesloten, toch afgevinkt', en: 'closed, ticked off anyway' },
  'rapport.periodiek': { nl: 'waarvan {aantal} periodiek', en: 'incl. {aantal} periodic' },

  'rapport.grafiek.samenvatting': {
    nl: '{aantal} metingen · laagste {min} {eenheid} · hoogste {max} {eenheid}',
    en: '{aantal} readings · lowest {min} {eenheid} · highest {max} {eenheid}',
  },
  'rapport.grafiek.aria': { nl: '{label} per dag', en: '{label} per day' },
  'rapport.grafiek.grens': { nl: 'grens {waarde} {eenheid}', en: 'limit {waarde} {eenheid}' },
  'rapport.grafiek.gaten': {
    nl: 'Op {zonder} van de {totaal} dagen is er niets gemeten.',
    en: 'On {zonder} of the {totaal} days nothing was measured.',
  },

  'rapport.voet': {
    nl: 'Dit verslag komt rechtstreeks uit de afvinklijsten van JE Plan. Elk vinkje draagt de naam van wie het zette en het tijdstip; de gemeten waarden staan zoals ze ingevuld zijn.',
    en: 'This report comes straight from the JE Plan checklists. Every tick carries the name of whoever set it and the time; the measured values are shown as they were entered.',
  },
  'rapport.voet_telling': {
    nl: 'Per dag telt elk punt dat volgens zijn frequentie op die dag viel: dagelijkse punten elke dag, weekend-, week-, maand- en kwartaalpunten alleen op hun dag. Op een sluitingsdag telt alleen wat er toch afgevinkt werd.',
    en: 'Each day counts every item that fell on that day according to its frequency: daily items every day, weekend, weekly, monthly and quarterly items only on their day. On a closing day only what was ticked off anyway counts.',
  },
  'rapport.voet_admin': {
    nl: 'De lijsten zelf zijn aan te passen in Instellingen → Dagelijkse lijsten.',
    en: 'The lists themselves can be changed under Settings → Daily lists.',
  },
  'rapport.csv_blijft_nl': {
    nl: 'De CSV-export staat altijd in het Nederlands: dezelfde maand hoort altijd hetzelfde bestand te geven.',
    en: 'The CSV export is always in Dutch: the same month should always produce the same file.',
  },
}
