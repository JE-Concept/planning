/**
 * Een aanvraag van een klant inlezen.
 *
 * De toon is die van een collega die meeleest: "dit las ik eruit", niet "dit
 * is het". Alles blijft aan te passen, en wat geraden is staat er als geraden
 * bij — zie `src/lib/aanvraag.js`.
 */
export default {
  'aanvraag.tab': { nl: 'Uit een mail', en: 'From an email' },
  'aanvraag.plak': { nl: 'De mail van de klant', en: 'The customer’s email' },
  'aanvraag.plak_hint': {
    nl: 'Plak de aanvraag hier. Wat eruit te lezen valt, vul ik hieronder in — je kan alles aanpassen.',
    en: 'Paste the request here. Whatever I can read from it goes in below — you can change anything.',
  },
  'aanvraag.plaatshouder': {
    nl: 'Beste,\n\nWe zouden graag…',
    en: 'Hello,\n\nWe would like to…',
  },
  'aanvraag.gelezen': { nl: 'Dit las ik eruit', en: 'This is what I read' },
  'aanvraag.niets': {
    nl: 'Hier lees ik nog niets uit. Vul de velden gerust zelf in.',
    en: 'I can’t read anything from this yet. Feel free to fill the fields in yourself.',
  },
  'aanvraag.geraden': { nl: 'geraden', en: 'a guess' },
  'aanvraag.weekdag_klopt_niet': {
    nl: 'De klant schrijft een andere weekdag dan waarop deze datum valt. Even navragen.',
    en: 'The customer names a different weekday than this date falls on. Worth checking.',
  },
  'aanvraag.vork': {
    nl: 'De klant noemt {laag} tot {hoog}; ik reken met {laag}.',
    en: 'The customer says {laag} to {hoog}; I am using {laag}.',
  },
  'aanvraag.jaar_geraden': {
    nl: 'Er staat geen jaartal in de mail; dit is de eerstvolgende keer dat die dag valt.',
    en: 'The email gives no year; this is the next time that day comes round.',
  },
  'aanvraag.vragen': { nl: 'Waar ze om vragen', en: 'What they are asking for' },
  'aanvraag.vraag.prijzen': { nl: 'Richtprijzen', en: 'Ballpark prices' },
  'aanvraag.vraag.formules': { nl: 'Welke formules er zijn', en: 'Which formules exist' },
  'aanvraag.vraag.locatie': { nl: 'Een locatie voorstellen', en: 'Suggest a venue' },
  'aanvraag.vraag.beschikbaar': { nl: 'Of die datum vrij is', en: 'Whether that date is free' },
  'aanvraag.vraag.menu': { nl: 'Het menu', en: 'The menu' },
  'aanvraag.losse_dagen': {
    nl: 'De klant noemt meer dan één losse dag; ik zet de eerste. Even navragen.',
    en: 'The customer names more than one separate day; I am using the first. Worth checking.',
  },
  'aanvraag.reeks': { nl: '{van} t/m {tot}', en: '{van} to {tot}' },
  // De naam van een event wanneer er geen soort feest uit de mail te lezen is:
  // "Aanvraag — Sofie Peeters".
  'aanvraag.naam_standaard': { nl: 'Aanvraag', en: 'Request' },
  'aanvraag.mail_bewaard': {
    nl: 'De mail komt op het tabblad Mail van het event te staan, zodat de vraag bij het antwoord blijft.',
    en: 'The email goes on the event’s Mail tab, so the question stays with the answer.',
  },
  'aanvraag.mail_uit_postvak': {
    nl: 'Deze mail van {van} staat al in Aanvragen. Ze komt aan het nieuwe event te hangen en verdwijnt uit het postvak.',
    en: 'This email from {van} is already in Requests. It will be attached to the new event and leave the inbox.',
  },
  'aanvraag.mail_niet_bewaard': {
    nl: 'Het event staat er, maar de mail kon niet bij het tabblad Mail. Ze staat nu in de omschrijving.',
    en: 'The event is created, but the email could not go on the Mail tab. It is in the description instead.',
  },
}
