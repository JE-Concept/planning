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
  'lijst.wordt_doorgestuurd': {
    nl: 'Wordt doorgestuurd zodra er weer bereik is',
    en: 'Goes across as soon as there is signal again',
  },
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
}
