/**
 * De teksten van het overzichtstabblad.
 *
 * De aandachtspunten staan hier als hele zinnen en niet als losse woorden die
 * het scherm aan elkaar plakt. Een waarschuwing wordt gelezen zoals ze er
 * staat, en "geen locatie" leest anders dan "er staat nog geen locatie op,
 * terwijl het event binnen twee weken is".
 */
export default {
  'overzicht.dagen_te_gaan': { nl: 'dagen te gaan', en: 'days to go' },
  'overzicht.dagen_geleden': { nl: 'dagen geleden', en: 'days ago' },
  'overzicht.geen_datum': { nl: 'Nog geen datum', en: 'No date yet' },
  'overzicht.geen_klant': { nl: 'Nog geen klant', en: 'No customer yet' },
  'overzicht.geen_mail': { nl: 'Nog geen post', en: 'No mail yet' },
  'overzicht.geboekt': { nl: 'geboekt op dit dossier', en: 'booked on this file' },
  'overzicht.pijplijn': { nl: 'Waar staat het', en: 'Where it stands' },

  'overzicht.vraagt_aandacht': { nl: 'Vraagt aandacht', en: 'Needs attention' },
  // Meervoud: "1 dingen vragen aandacht" stond er live.
  'overzicht.mist_aantal_een': { nl: '{aantal} ding vraagt aandacht', en: '{aantal} thing needs attention' },
  'overzicht.mist_aantal_meer': { nl: '{aantal} dingen vragen aandacht', en: '{aantal} things need attention' },
  'overzicht.mist_bekijk': { nl: 'bekijken', en: 'show' },
  'overzicht.in_orde': { nl: 'Alles in orde', en: 'All good' },
  'overzicht.in_orde_uitleg': {
    nl: 'Er is niets dat nu om een beslissing vraagt.',
    en: 'Nothing here needs a decision right now.',
  },

  'overzicht.taken_open': { nl: '{aantal} nog open', en: '{aantal} still open' },
  'overzicht.taken_klaar': { nl: 'Alles afgevinkt', en: 'All ticked off' },
  'overzicht.met_bestellijst': { nl: '{aantal} regels op de bestellijst', en: '{aantal} lines on the order list' },
  'overzicht.geen_bestellijst': { nl: 'Geen bestellijst', en: 'No order list' },
  'overzicht.taken_geen': { nl: 'Nog geen taken', en: 'No tasks yet' },
  'overzicht.gasten_leeg': { nl: 'Aantal nog in te vullen', en: 'Number still to fill in' },
  'overzicht.bijlagen_wel': { nl: 'bij dit dossier', en: 'on this file' },
  'overzicht.bijlagen_geen': { nl: 'Nog geen bestanden', en: 'No files yet' },

  // ── De kaarten ─────────────────────────────────────────────────────────
  'overzicht.kaart.taken': { nl: 'Taken', en: 'Tasks' },
  'overzicht.kaart.offerte': { nl: 'Offerte incl. btw', en: 'Quote incl. VAT' },
  'overzicht.kaart.gasten': { nl: 'Gasten', en: 'Guests' },
  'overzicht.kaart.mail': { nl: 'Post', en: 'Mail' },
  'overzicht.kaart.tijd': { nl: 'Tijd', en: 'Time' },
  'overzicht.kaart.bijlagen': { nl: 'Bijlagen', en: 'Attachments' },

  // ── De stand van de offerte, zoals de kaart ze samenvat ────────────────
  'overzicht.offerte.geen': { nl: 'Nog geen offerte', en: 'No quote yet' },
  'overzicht.offerte.concept': { nl: 'Concept — nog niet verstuurd', en: 'Draft — not sent yet' },
  'overzicht.offerte.verstuurd': { nl: 'Verstuurd, wacht op antwoord', en: 'Sent, awaiting an answer' },
  'overzicht.offerte.goedgekeurd': { nl: 'Goedgekeurd door de klant', en: 'Approved by the customer' },
  'overzicht.offerte.feedback': { nl: 'De klant heeft een vraag', en: 'The customer has a question' },

  // ── Wat een aandachtspunt oplost: de knop ernaast ──────────────────────
  'overzicht.los.datum': { nl: 'Datum invullen', en: 'Fill in date' },
  'overzicht.los.klant': { nl: 'Klant koppelen', en: 'Link customer' },
  'overzicht.los.gasten': { nl: 'Gasten invullen', en: 'Fill in guests' },
  'overzicht.los.locatie': { nl: 'Locatie invullen', en: 'Fill in venue' },
  'overzicht.los.planning': { nl: 'Planning bijwerken', en: 'Update planning' },
  'overzicht.los.offerte_maken': { nl: 'Offerte opmaken', en: 'Draft quote' },
  'overzicht.los.offerte': { nl: 'Naar de offerte', en: 'Go to quote' },
  'overzicht.los.taken': { nl: 'Naar de taken', en: 'Go to tasks' },

  // ── Wat aandacht vraagt ────────────────────────────────────────────────
  'overzicht.let.geen_datum': {
    nl: 'Er staat nog geen datum op dit event.',
    en: 'This event has no date yet.',
  },
  'overzicht.let.geen_klant': {
    nl: 'Er hangt nog geen klant aan dit dossier.',
    en: 'No customer is linked to this file yet.',
  },
  'overzicht.let.geen_gasten': {
    nl: 'Het aantal gasten ontbreekt, en het event is binnen {dagen} dagen.',
    en: 'The guest count is missing, and the event is within {dagen} days.',
  },
  'overzicht.let.geen_locatie': {
    nl: 'De locatie ontbreekt, en het event is binnen {dagen} dagen.',
    en: 'The venue is missing, and the event is within {dagen} days.',
  },
  'overzicht.let.geen_offerte': {
    nl: 'Het dossier staat op de offertestap, maar er is nog geen offerte.',
    en: 'The file is at the quote stage, but there is no quote yet.',
  },
  'overzicht.let.offerte_concept': {
    nl: 'De offerte staat nog op concept; de klantenpagina opent pas na versturen.',
    en: 'The quote is still a draft; the customer page only opens once it is sent.',
  },
  'overzicht.let.offerte_verlopen': {
    nl: 'De offerte is verlopen en nog niet beantwoord.',
    en: 'The quote has expired and has not been answered.',
  },
  'overzicht.let.planning_open': {
    nl: 'De planning is nog niet rond en het event komt dichtbij.',
    en: 'Planning is not settled yet and the event is coming up.',
  },
  'overzicht.let.taken_na_afloop': {
    nl: 'Het event is voorbij, maar er staan nog taken open.',
    en: 'The event is over, but tasks are still open.',
  },
  'overzicht.let.niet_gefactureerd': {
    nl: 'Het event is voorbij en er is nog niet gefactureerd.',
    en: 'The event is over and has not been invoiced.',
  },
}
