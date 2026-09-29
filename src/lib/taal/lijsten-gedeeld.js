/**
 * De teksten van de gedeelde helpers achter de afvinklijsten.
 *
 * Deze regels staan niet op één scherm. Ze komen uit `checklist-templates.js` en
 * `checklist-herhaling.js`, en die twee worden zowel op het bistroscherm als in
 * de lijsteditor in Instellingen gebruikt. Vandaar een eigen catalogus: wie aan
 * één van die twee schermen werkt, hoeft hier niet in.
 *
 * Wat er met opzet níét in staat: dag- en maandnamen. `Intl` maakt die al in de
 * gekozen taal — zie `huidigeLocaleVan` in `dates.js` — en een eigen tabel zou
 * naast die van de kalenders komen te staan en er op termijn van afwijken.
 *
 * De rangtelwoorden hieronder zijn wél een tabel, en dat moet: het Nederlands
 * zet achter elk getal een "e", het Engels kiest tussen st, nd, rd en th. Welke
 * van de vier het is, vraagt de code aan `Intl.PluralRules`; wat erachter komt,
 * staat hier.
 */
export default {

  // ── Wie ziet wat ───────────────────────────────────────────────────────
  'lijstlib.afdeling.iedereen': { nl: 'Iedereen', en: 'Everyone' },
  'lijstlib.afdeling.verantwoordelijke': { nl: 'Verantwoordelijke', en: 'Supervisor' },
  'lijstlib.afdeling.keuken': { nl: 'Keuken', en: 'Kitchen' },
  'lijstlib.afdeling.zaal': { nl: 'Zaal', en: 'Front of house' },

  // ── De grens onder een meting ──────────────────────────────────────────
  'lijstlib.grens.tussen': { nl: 'tussen {min} en {max}', en: 'between {min} and {max}' },
  'lijstlib.grens.max': { nl: 'max {waarde}', en: 'max {waarde}' },
  'lijstlib.grens.min': { nl: 'min {waarde}', en: 'min {waarde}' },
  'lijstlib.grens.eenheid': { nl: 'in {eenheid}', en: 'in {eenheid}' },

  // ── Wanneer een punt moet ──────────────────────────────────────────────
  'lijstlib.herhaal.dagelijks': { nl: 'elke dag', en: 'every day' },
  'lijstlib.herhaal.weekend': { nl: 'weekend', en: 'weekend' },
  'lijstlib.herhaal.geen_dag': { nl: 'geen dag gekozen', en: 'no day chosen' },
  'lijstlib.herhaal.wekelijks': { nl: 'elke {dag}', en: 'every {dag}' },
  'lijstlib.herhaal.maandelijks': { nl: 'de {dag} van de maand', en: 'the {dag} of the month' },
  'lijstlib.herhaal.kwartaal': { nl: 'elk kwartaal, de {dag}', en: 'every quarter, the {dag}' },
  'lijstlib.herhaal.jaarlijks': { nl: 'jaarlijks in {maand}', en: 'every year in {maand}' },

  // Het rangtelwoord bij een dag van de maand. `Intl.PluralRules` met
  // `type: 'ordinal'` zegt welke van de vier vormen een getal krijgt; het
  // Nederlands kent er maar één, het Engels alle vier.
  'lijstlib.ordinaal_one': { nl: '{dag}e', en: '{dag}st' },
  'lijstlib.ordinaal_two': { nl: '{dag}e', en: '{dag}nd' },
  'lijstlib.ordinaal_few': { nl: '{dag}e', en: '{dag}rd' },
  'lijstlib.ordinaal_other': { nl: '{dag}e', en: '{dag}th' },

  // ── De uitleg onder de keuze in de editor ──────────────────────────────
  'lijstlib.uitleg.eerstvolgend': { nl: '{label} · eerstvolgend {datum}', en: '{label} · next on {datum}' },
  'lijstlib.probleem.geen_dag': {
    nl: 'Geen enkele dag aangevinkt — zo komt dit punt nooit meer op de lijst.',
    en: 'No day ticked — this item will never come round on the list again.',
  },
  'lijstlib.probleem.nooit': {
    nl: 'Deze herhaling komt het komende jaar niet voor.',
    en: 'This repeat does not come round in the year ahead.',
  },
}
