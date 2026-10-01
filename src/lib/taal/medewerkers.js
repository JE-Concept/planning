/**
 * De teksten van de medewerkerspagina.
 *
 * "Medewerker" en niet "personeel": het zijn studenten en flexi's die komen
 * werken, en zo noemt de ploeg ze ook.
 */
export default {
  'nav.medewerkers': { nl: 'Medewerkers', en: 'Crew' },

  'medewerkers.titel': { nl: 'Medewerkers', en: 'Crew' },
  'medewerkers.uitleg': {
    nl: 'Studenten en flexi’s die komen werken. Zij vullen de openings- en sluitingslijsten in en zien alleen de events waarop ze staan.',
    en: 'Students and flexi staff. They fill in the opening and closing lists and only see the events they are on.',
  },

  'medewerkers.actief': { nl: 'In dienst', en: 'Active' },
  'medewerkers.gestopt': { nl: 'Gestopt', en: 'Left' },
  'medewerkers.leeg': { nl: 'Nog geen medewerkers', en: 'No crew yet' },
  'medewerkers.leeg_uitleg': {
    nl: 'Nodig iemand uit met zijn e-mailadres. Hij krijgt een profiel zodra hij zich met dat adres aanmeldt.',
    en: 'Invite someone by email. They get a profile the moment they sign in with that address.',
  },

  'medewerkers.erbij': { nl: 'Iemand erbij', en: 'Add someone' },
  'medewerkers.erbij_hint': {
    nl: 'Het adres waarmee hij zich aanmeldt bij Google.',
    en: 'The address they sign in with at Google.',
  },
  'medewerkers.uitnodigen': { nl: 'Uitnodigen', en: 'Invite' },
  'medewerkers.uitgenodigd': {
    nl: '{wie} is uitgenodigd. Zijn profiel komt er bij zijn eerste aanmelding.',
    en: '{wie} has been invited. Their profile appears on their first sign-in.',
  },
  'medewerkers.na_uitnodiging': {
    nl: 'De afdeling gaat mee met de uitnodiging, zodat hij meteen de juiste lijst ziet.',
    en: 'The department travels with the invite, so they see the right list straight away.',
  },

  'medewerkers.afdeling': { nl: 'Afdeling', en: 'Department' },
  'medewerkers.afdeling_van': { nl: 'Afdeling van {wie}', en: 'Department of {wie}' },
  'medewerkers.geen_afdeling': { nl: 'Geen afdeling', en: 'No department' },

  'medewerkers.nergens': { nl: 'Staat nergens ingepland', en: 'Not scheduled anywhere' },
  'medewerkers.en_meer': { nl: 'en nog {aantal}', en: 'and {aantal} more' },

  'medewerkers.uit_aapi': { nl: 'In dienst volgens AAPI', en: 'Employed according to AAPI' },
  'medewerkers.uit_aapi_uitleg': {
    nl: 'Uit de personeelslijst van AAPI. Alleen om te lezen — wijzigen doe je daar. Hier staat wat je nodig hebt om iemand in te plannen en te bereiken; adressen, rijksregisternummers en rekeningnummers blijven in AAPI.',
    en: 'From the AAPI staff list. Read-only — change it there. This holds what you need to schedule and reach someone; addresses, national numbers and bank details stay in AAPI.',
  },
  'medewerkers.sinds': { nl: 'sinds {datum}', en: 'since {datum}' },

  'medewerkers.weg': { nl: 'Uit dienst', en: 'Archive' },
  'medewerkers.terug': { nl: 'Terug in dienst', en: 'Reinstate' },

  // ── Wat een medewerker zelf ziet ───────────────────────────────────────
  'nav.mijnevents': { nl: 'Mijn events', en: 'My events' },
  'mijnevents.eyebrow': { nl: 'Waar jij staat', en: 'Where you work' },
  'mijnevents.titel': { nl: 'Mijn events', en: 'My events' },
  'mijnevents.uitleg': {
    nl: 'De events waarop je ingepland staat: wanneer, waar en met hoeveel.',
    en: 'The events you are scheduled for: when, where and how many.',
  },
  'mijnevents.komt': { nl: 'Komt eraan', en: 'Coming up' },
  'mijnevents.geweest': { nl: 'Geweest', en: 'Past' },
  'mijnevents.niets_komt': { nl: 'Er staat niets nieuws ingepland.', en: 'Nothing new is scheduled.' },
  'mijnevents.geen_datum': { nl: 'nog geen datum', en: 'no date yet' },
  'mijnevents.gasten': { nl: '{aantal} gasten', en: '{aantal} guests' },
  'mijnevents.leeg': { nl: 'Je staat nog nergens ingepland', en: 'You are not scheduled yet' },
  'mijnevents.leeg_uitleg': {
    nl: 'Zodra iemand je op een event zet, verschijnt het hier.',
    en: 'As soon as someone adds you to an event, it appears here.',
  },
}
