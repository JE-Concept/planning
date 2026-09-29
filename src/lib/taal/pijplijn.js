/**
 * De standaardnamen van de statuspijplijn.
 *
 * In de database heten de statussen nog wat ze in ClickUp heetten — `request`,
 * `create offer`, `complete` — en dat blijft zo, want de automatisaties, het
 * socialbord en de migratie rekenen op die namen.
 *
 * Wat het team ziet is een label. Kiest een beheerder er zelf een in
 * Instellingen → Pijplijn, dan staat dat in de database en wint dat altijd: één
 * naam voor iedereen, want het team praat met elkaar over dezelfde kolom.
 * Wordt er niets gekozen, dan is het de tekst hieronder, en die volgt de taal.
 */
export default {
  'pijplijn.request': { nl: 'Aanvraag', en: 'Request' },
  'pijplijn.create offer': { nl: 'Offerte maken', en: 'Draw up quote' },
  'pijplijn.offer send': { nl: 'Offerte verstuurd', en: 'Quote sent' },
  'pijplijn.offer accepted': { nl: 'Akkoord', en: 'Accepted' },
  'pijplijn.planning ongoing': { nl: 'Planning loopt', en: 'Planning under way' },
  'pijplijn.planning ready': { nl: 'Planning klaar', en: 'Planning done' },
  'pijplijn.ready to invoice': { nl: 'Te factureren', en: 'To be invoiced' },
  'pijplijn.invoiced': { nl: 'Gefactureerd', en: 'Invoiced' },
  'pijplijn.complete': { nl: 'Afgerond', en: 'Completed' },
}
