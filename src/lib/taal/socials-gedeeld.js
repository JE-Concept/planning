/**
 * De namen van de socialstanden, los van het socialscherm.
 *
 * `src/data/social.js` zet ze om naar een label, en die module zit in de schil:
 * de zoekbalk en het dashboard lezen eraan mee. De rest van `socials.js` — de
 * kalender, de reviewstroom, de Canva-koppeling — komt pas met het socialbord
 * zelf binnen, en dat is dertien kilobyte die niemand nodig heeft die de tool
 * gewoon opent.
 *
 * Zelfde opzet als `taken-gedeeld.js` en `lijsten-gedeeld.js`: wat twee kanten
 * nodig hebben, staat apart.
 */
export default {
  'social.status.idea': { nl: 'Idee', en: 'Idea' },
  'social.status.draft': { nl: 'Tekst', en: 'Copy' },
  'social.status.design': { nl: 'Ontwerp', en: 'Design' },
  'social.status.review': { nl: 'Nakijken', en: 'To check' },
  'social.status.approved': { nl: 'Goedgekeurd', en: 'Approved' },
  'social.status.scheduled': { nl: 'Ingepland', en: 'Scheduled' },
  'social.status.published': { nl: 'Gepubliceerd', en: 'Published' },
  'social.review.geen': { nl: 'Geen review', en: 'No review' },
  'social.review.wacht': { nl: 'Wacht op review', en: 'Waiting for review' },
  'social.review.aanpassing': { nl: 'Aanpassing gevraagd', en: 'Changes asked' },
  'social.review.goedgekeurd': { nl: 'Goedgekeurd', en: 'Approved' },
}
