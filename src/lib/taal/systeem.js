/**
 * Of de tool nog doet wat ze hoort te doen.
 *
 * De toon is die van een collega die het even nakeek, niet van een
 * bewakingssysteem: "de post kwam om 9:05 nog binnen", niet "STATUS: OK".
 */
export default {
  'systeem.titel': { nl: 'Doet alles het nog', en: 'Is everything running' },
  'systeem.laden': { nl: 'Even kijken…', en: 'Just a moment…' },
  'systeem.stand.goed': { nl: 'Alles draait', en: 'All running' },
  'systeem.stand.let_op': { nl: 'Even kijken', en: 'Needs a look' },
  'systeem.stand.onbekend': { nl: 'Nog niet gestart', en: 'Not started yet' },

  'systeem.post': { nl: 'Post ophalen', en: 'Fetching mail' },
  'systeem.post_goed': {
    nl: 'Laatst binnengehaald om {wanneer}.',
    en: 'Last fetched at {wanneer}.',
  },
  'systeem.post_stil': {
    nl: 'Al {uren} uur niets opgehaald — dat hoort elke paar minuten te gebeuren. Kijk of het app-wachtwoord nog geldig is.',
    en: 'Nothing fetched for {uren} hours — that should happen every few minutes. Check whether the app password is still valid.',
  },
  'systeem.post_nooit': {
    nl: 'Nog nooit gedraaid. De sleutel IMAP_URL staat er waarschijnlijk nog niet; zie README → De post van info@jeconcept.be.',
    en: 'Never ran. The IMAP_URL secret is probably not set yet; see the README.',
  },

  'systeem.uitgaand': { nl: 'Post versturen', en: 'Sending mail' },
  'systeem.uitgaand_goed': { nl: 'Niets blijven hangen.', en: 'Nothing stuck.' },
  'systeem.uitgaand_mislukt_een': {
    nl: '{aantal} mail is niet vertrokken.',
    en: '{aantal} message did not go out.',
  },
  'systeem.uitgaand_mislukt_meer': {
    nl: '{aantal} mails zijn niet vertrokken.',
    en: '{aantal} messages did not go out.',
  },
  'systeem.geen_reden': { nl: 'geen reden opgegeven', en: 'no reason given' },

  'systeem.uitleg': {
    nl: 'Dit ververst zichzelf. Er gaat ook een melding uit wanneer de post langer dan een paar uur stilvalt — een tool die zwijgt als ze stuk is, is erger dan een tool die niets doet.',
    en: 'This refreshes itself. A notification goes out when mail stops coming in for more than a few hours — a tool that stays quiet when it is broken is worse than one that does nothing.',
  },
}
