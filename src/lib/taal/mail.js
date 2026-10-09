/**
 * De post rond een event.
 *
 * De toon is die van een collega die meeleest, niet van een systeem dat
 * rapporteert: "via het antwoordadres" zegt waaróm een mail hier hangt, en
 * "geraden" zegt eerlijk dat er geredeneerd is.
 */
export default {
  'nav.aanvragen': { nl: 'Aanvragen', en: 'Requests' },

  // ── De draad op een event ──────────────────────────────────────────────
  'mail.tab': { nl: 'Mail', en: 'Mail' },
  'mail.geen_draad': {
    nl: 'Nog geen mail bij dit event. Wat er op info@jeconcept.be binnenkomt en bij dit dossier hoort, komt hier vanzelf te staan.',
    en: 'No mail on this event yet. Whatever arrives at info@jeconcept.be and belongs to this file shows up here by itself.',
  },
  'mail.geen_onderwerp': { nl: '(geen onderwerp)', en: '(no subject)' },
  'mail.geraden': { nl: 'Geraden', en: 'A guess' },
  'mail.koppeling.draad': {
    nl: 'Gekoppeld omdat dit een antwoord is op een bericht van dit event.',
    en: 'Linked because this replies to a message on this event.',
  },
  'mail.koppeling.klant': {
    nl: 'Gekoppeld omdat de afzender een klant is met precies één lopend dossier.',
    en: 'Linked because the sender is a customer with exactly one open file.',
  },
  'mail.koppeling.klant_meerdere': {
    nl: 'Deze klant heeft meer dan één lopend dossier; kies zelf welk.',
    en: 'This customer has more than one open file; pick the right one yourself.',
  },
  'mail.geplakt': { nl: 'Geplakt', en: 'Pasted' },
  'mail.geplakt_uitleg': {
    nl: 'Deze mail is bij het aanmaken van het event geplakt; ze kwam niet via info@ binnen.',
    en: 'This email was pasted in when the event was created; it did not arrive through info@.',
  },
  'mail.meer': { nl: 'Volledige mail', en: 'Full message' },
  'mail.minder': { nl: 'Inklappen', en: 'Collapse' },
  'mail.losmaken': { nl: 'Hoort hier niet', en: 'Does not belong here' },
  'mail.bijlagen_uitleg': {
    nl: 'Bijlagen blijven in de mailbox staan.',
    en: 'Attachments stay in the mailbox.',
  },

  // ── Het postvak ────────────────────────────────────────────────────────
  'mail.postvak.aantal_een': { nl: '{aantal} bericht', en: '{aantal} message' },
  'mail.postvak.aantal_meer': { nl: '{aantal} berichten', en: '{aantal} messages' },
  'mail.postvak.laden': { nl: 'Post ophalen…', en: 'Loading mail…' },
  'mail.postvak.leeg': { nl: 'Het postvak is leeg', en: 'The inbox is empty' },
  'mail.postvak.achter': {
    nl: 'De post is sinds {sinds} niet meer opgehaald',
    en: 'Mail has not been fetched since {sinds}',
  },
  'mail.postvak.achter_uitleg': {
    nl: 'Wat sindsdien binnenkwam op info@, staat hier nog niet. Een beheerder kijkt onder Instellingen › Systeem wat er mis is.',
    en: 'Whatever arrived at info@ since then is not shown here yet. An administrator checks Settings › System to see what is wrong.',
  },

  // Aanvragen van rental.jeconcept.be. Ze staan in hetzelfde postvak als
  // losse mail, want het is hetzelfde werk.
  'verhuuraanvraag.bron': { nl: 'Verhuursite', en: 'Rental site' },
  'verhuuraanvraag.datum': { nl: 'Datum: {datum}', en: 'Date: {datum}' },
  'verhuuraanvraag.gasten': { nl: '{aantal} personen', en: '{aantal} guests' },
  'verhuuraanvraag.event_maken': { nl: 'Event maken', en: 'Create event' },
  'verhuuraanvraag.afgehandeld': { nl: 'Afgehandeld', en: 'Handled' },
  'verhuuraanvraag.mailen': { nl: 'Mailen', en: 'Email' },
  'mail.postvak.leeg_uitleg': {
    nl: 'Alles wat binnenkwam, hangt aan een event. Wat hier komt te staan is post die nergens bij hoorde — meestal een nieuwe aanvraag.',
    en: 'Everything that came in is linked to an event. What lands here is mail that fitted nowhere — usually a new request.',
  },
  'mail.postvak.maak_event': { nl: 'Event aanmaken', en: 'Create event' },
  'mail.postvak.koppel': { nl: 'Aan een bestaand event hangen', en: 'Attach to an existing event' },
  'mail.postvak.gekoppeld': { nl: 'De mail hangt nu aan dat event.', en: 'The message is now on that event.' },
  'mail.postvak.event_gemaakt': {
    nl: 'Het event staat er, met de mail erbij.',
    en: 'The event is created, with the message attached.',
  },
}
