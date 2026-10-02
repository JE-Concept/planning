/**
 * Aanmelden met een cijfercode, en wat erbij hoort.
 *
 * De foutmeldingen die met `ploeg.fout.` beginnen, komen als sleutel uit de
 * Cloud Function terug. Die weet niet in welke taal het scherm staat, en een
 * zin die daar geschreven wordt, is altijd Nederlands.
 */
export default {
  'ploeg.ik_kom_werken': { nl: 'Ik kom werken', en: 'I work here' },
  'ploeg.kies_naam': { nl: 'Zoek je naam', en: 'Find your name' },
  'ploeg.zoek': { nl: 'Je naam', en: 'Your name' },
  'ploeg.niemand': { nl: 'Niemand gevonden met die naam.', en: 'Nobody found by that name.' },
  'ploeg.terug': { nl: 'Toch met Google', en: 'Use Google instead' },
  'ploeg.andere_naam': { nl: 'Andere naam', en: 'Different name' },
  'ploeg.typ_code': { nl: 'Je code van vier cijfers', en: 'Your four-digit code' },
  'ploeg.code': { nl: 'Code', en: 'Code' },
  'ploeg.aanmelden': { nl: 'Aanmelden', en: 'Sign in' },
  'ploeg.eerste_keer': {
    nl: 'Eerste keer? Dan kies je nu je code. Neem niet de code van je bankkaart — het bureau kan deze code inkijken.',
    en: 'First time? You choose your code now. Do not use your bank card PIN — the office can look this code up.',
  },

  'ploeg.code.vorm': { nl: 'Een code is precies vier cijfers.', en: 'A code is exactly four digits.' },
  'ploeg.code.te_simpel': {
    nl: 'Die code raadt iemand meteen. Kies er een die geen rijtje of herhaling is.',
    en: 'That code is the first one anyone tries. Pick one that is not a run or a repeat.',
  },
  'ploeg.fout.verkeerd': { nl: 'Die code klopt niet.', en: 'That code is not right.' },
  'ploeg.fout.geblokkeerd': {
    nl: 'Te vaak mis geprobeerd. Wacht een kwartier, of vraag het bureau.',
    en: 'Too many wrong tries. Wait fifteen minutes, or ask the office.',
  },
  'ploeg.fout.lijst': {
    nl: 'De namenlijst komt niet door. Probeer het zo nog eens.',
    en: 'The list of names did not load. Try again in a moment.',
  },
  'ploeg.fout.algemeen': { nl: 'Aanmelden is niet gelukt.', en: 'Signing in did not work.' },

  // ── Je eigen code wijzigen ─────────────────────────────────────────────
  'ploeg.mijn_code': { nl: 'Mijn code', en: 'My code' },
  'ploeg.mijn_code_uitleg': {
    nl: 'Vier cijfers waarmee je je aanmeldt. Neem niet de code van je bankkaart — het bureau kan deze inkijken.',
    en: 'The four digits you sign in with. Do not use your bank card PIN — the office can look it up.',
  },
  'ploeg.nieuwe_code': { nl: 'Nieuwe code', en: 'New code' },
  'ploeg.code_bewaren': { nl: 'Code wijzigen', en: 'Change code' },
  'ploeg.code_gewijzigd': { nl: 'Je code is gewijzigd.', en: 'Your code has been changed.' },

  // ── Wat het bureau ziet ────────────────────────────────────────────────
  'ploeg.toon_code': { nl: 'Code tonen', en: 'Show code' },
  'ploeg.geen_code': { nl: 'Nog geen code gekozen', en: 'No code chosen yet' },
  'ploeg.code_bekeken': {
    nl: 'Inkijken wordt bijgehouden.',
    en: 'Looking this up is logged.',
  },
}
