/**
 * De teksten van de offerte.
 *
 * De voorwaarden onderaan een offerte staan hier niet: die staan in
 * `src/lib/offerte-voorwaarden.js`, want dat is een juridische tekst die in zijn
 * geheel gelezen en aangepast wordt, niet zin per zin vertaald.
 */
export default {
  'offerte.titel': { nl: 'Offerte', en: 'Quote' },
  'offerte.spijzen': { nl: 'Spijzen', en: 'Food' },
  'offerte.dranken': { nl: 'Dranken', en: 'Drinks' },

  // ── De rubrieken van de tabel ──────────────────────────────────────────
  'offerte.rubriek.basis': { nl: 'Basis', en: 'Basics' },
  'offerte.rubriek.catering': { nl: 'Catering', en: 'Catering' },
  'offerte.rubriek.dranken': { nl: 'Dranken', en: 'Drinks' },
  'offerte.rubriek.personeel': { nl: 'Personeel', en: 'Staff' },
  'offerte.rubriek.optioneel': { nl: 'Optioneel', en: 'Optional' },

  // ── Wat er nog gevraagd moet worden ────────────────────────────────────
  'offerte.mist_personen': {
    nl: 'Voor hoeveel personen? Zonder aantal kan er enkel een prijs per persoon gegeven worden.',
    en: 'For how many people? Without a number only a price per person can be given.',
  },
  'offerte.mist_klant': { nl: 'Er staat nog geen klant op dit event.', en: 'This event has no customer yet.' },
  'offerte.mist_regels': { nl: 'De offerte heeft nog geen regels.', en: 'The quote has no lines yet.' },
  'offerte.mist_datum': { nl: 'De datum van het event staat nog niet vast.', en: 'The date of the event is not settled.' },
  'offerte.mist_dranken': {
    nl: 'Er staat geen drankenlijn op. Forfait of op verbruik?',
    en: 'There is no drinks line. A flat rate, or charged on consumption?',
  },

  // ── De foodcost, intern ────────────────────────────────────────────────
  'offerte.foodcost_goed': { nl: 'Foodcost {percent}% — in lijn.', en: 'Food cost {percent}% — in line.' },
  'offerte.foodcost_hoog': {
    nl: 'Foodcost {percent}%. Boven de 30% van het huis: hier blijft weinig van over.',
    en: 'Food cost {percent}%. Above the usual 30%: little is left of this.',
  },
  'offerte.foodcost_laag': {
    nl: 'Foodcost {percent}%. Ver onder de 30%: klopt de raming, of vergeet je iets?',
    en: 'Food cost {percent}%. Well under 30%: is the estimate right, or is something missing?',
  },
}
