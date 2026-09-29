/**
 * De teksten van de gedeelde helpers: formules, templates en socialkanalen.
 *
 * Deze regels staan niet op één scherm. Ze komen uit gewone functies —
 * `formuleSamenvatting`, `bestelTekst`, `templateSummary` — die op de
 * bestellijst van een event én in Instellingen gelezen worden. Vandaar een
 * eigen bestand: het hoort bij de helpers, niet bij een pagina.
 *
 * Wat hier met opzet níét staat: de namen van de kanalen. Instagram, Facebook,
 * TikTok, LinkedIn en Google Business heten overal zo. "Nieuwsbrief" is geen
 * merk en staat er dus wel in.
 *
 * Meervoud: zet naast `x` ook `x_een` en `x_meer`, en geef `aantal` mee.
 */
export default {

  // ── De samenvatting onder een formule ──────────────────────────────────
  // "€ 29,90 p.p. · 3 vragen · 12 bestelregels". Het bedrag wordt in beide
  // talen met een komma geschreven, zoals elk ander bedrag in de tool.
  'formulelib.formule.per_persoon': { nl: '€ {bedrag} p.p.', en: '€ {bedrag} pp' },
  'formulelib.formule.vraag_een': { nl: '{aantal} vraag', en: '{aantal} question' },
  'formulelib.formule.vraag_meer': { nl: '{aantal} vragen', en: '{aantal} questions' },
  'formulelib.formule.geen_vragen': { nl: 'geen vragen', en: 'no questions' },
  'formulelib.formule.bestelregel_een': { nl: '{aantal} bestelregel', en: '{aantal} order line' },
  'formulelib.formule.bestelregel_meer': { nl: '{aantal} bestelregels', en: '{aantal} order lines' },

  // ── De bestelbon ───────────────────────────────────────────────────────
  // De eenheid en de naam van de verpakking komen uit de formule zelf en
  // worden geschreven zoals ze daar ingevuld staan; alleen het woord ertussen
  // hangt aan de taal.
  'formulelib.bestel.verpakt': {
    nl: '{aantal} × {verpakking} van {inhoud} {eenheid}',
    en: '{aantal} × {verpakking} of {inhoud} {eenheid}',
  },
  'formulelib.bestel.verpakking': { nl: 'verpakking', en: 'pack' },
  'formulelib.bestel.nodig': { nl: '{aantal} {eenheid} nodig', en: '{aantal} {eenheid} needed' },

  // ── De samenvatting onder een template ─────────────────────────────────
  // "8 taken · 3 subtaken". De taken komen uit `alg.taak`.
  'formulelib.template.geen_taken': { nl: 'Zonder taken', en: 'No tasks' },
  'formulelib.template.subtaak_een': { nl: '{aantal} subtaak', en: '{aantal} subtask' },
  'formulelib.template.subtaak_meer': { nl: '{aantal} subtaken', en: '{aantal} subtasks' },

  // ── De kanalen ─────────────────────────────────────────────────────────
  'formulelib.kanaal.nieuwsbrief': { nl: 'Nieuwsbrief', en: 'Newsletter' },
  'formulelib.kanaal.geen': { nl: 'Nog geen kanaal', en: 'No channel yet' },
  'formulelib.kanaal.onbekend': { nl: 'Onbekend', en: 'Unknown' },
}
