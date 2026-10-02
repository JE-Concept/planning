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
  /*
    "Planning" betekende hier twee dingen tegelijk: deze stap in de pijplijn,
    en de personeelsplanning uit AAPI die ondertussen een eigen scherm en een
    eigen bolletje heeft. Op een bord met beide staat "Planning klaar" naast
    een rood planningsbolletje, en dan klopt er voor de lezer iets niet.

    De sleutels in de databank blijven de ClickUp-namen; alleen het label
    verandert. Zie de kop van dit bestand.
  */
  'pijplijn.planning ongoing': { nl: 'Voorbereiding loopt', en: 'Preparation under way' },
  'pijplijn.planning ready': { nl: 'Voorbereiding klaar', en: 'Preparation done' },
  'pijplijn.ready to invoice': { nl: 'Te factureren', en: 'To be invoiced' },
  'pijplijn.invoiced': { nl: 'Gefactureerd', en: 'Invoiced' },
  'pijplijn.complete': { nl: 'Afgerond', en: 'Completed' },
}
