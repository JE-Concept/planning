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
  // ── Het werkblad in de tool ────────────────────────────────────────────
  'offerte.klaarzetten': { nl: 'De offerte wordt klaargezet…', en: 'Setting up the quote…' },
  'offerte.regels': { nl: 'Regels', en: 'Lines' },
  'offerte.kolom.rubriek': { nl: 'Rubriek', en: 'Section' },
  'offerte.regel_erbij': { nl: 'Regel', en: 'Line' },
  'offerte.regel_weg': { nl: 'Regel verwijderen', en: 'Delete line' },
  'offerte.afdrukken': { nl: 'Afdrukken', en: 'Print' },
  'offerte.versturen': { nl: 'Versturen', en: 'Send' },
  'offerte.verstuurd_bevestiging': {
    nl: 'De offerte staat op verstuurd; het bedrag staat nu ook op het event.',
    en: 'The quote is marked as sent; the amount is on the event too.',
  },
  'offerte.tab': { nl: 'Offerte', en: 'Quote' },

  // ── Het blad zoals de klant het krijgt ─────────────────────────────────
  'offerte.voor': { nl: 'Voor', en: 'For' },
  'offerte.klant': { nl: 'Klant', en: 'Customer' },
  'offerte.event': { nl: 'Het event', en: 'The event' },
  'offerte.wat': { nl: 'Wat', en: 'What' },
  'offerte.wanneer': { nl: 'Wanneer', en: 'When' },
  'offerte.waar': { nl: 'Waar', en: 'Where' },
  'offerte.personen': { nl: 'Personen', en: 'Guests' },
  'offerte.pax': { nl: '{aantal} personen', en: '{aantal} guests' },
  'offerte.kolom.omschrijving': { nl: 'Omschrijving', en: 'Description' },
  'offerte.kolom.aantal': { nl: 'Aantal', en: 'Qty' },
  'offerte.kolom.eenheid': { nl: 'Per stuk', en: 'Unit' },
  'offerte.kolom.btw': { nl: 'Btw', en: 'VAT' },
  'offerte.kolom.bedrag': { nl: 'Bedrag', en: 'Amount' },
  'offerte.geen_regels': { nl: 'Nog geen regels op deze offerte.', en: 'No lines on this quote yet.' },
  'offerte.excl': { nl: 'Totaal excl. btw', en: 'Total excl. VAT' },
  'offerte.btw_op': { nl: 'Btw {percent}% op {basis}', en: 'VAT {percent}% on {basis}' },
  'offerte.incl': { nl: 'Te betalen', en: 'Total due' },
  'offerte.optioneel': { nl: 'Optie', en: 'Option' },
  'offerte.optioneel_totaal': {
    nl: 'Opties, niet meegerekend',
    en: 'Options, not included',
  },
  'offerte.voorschot_zin': {
    nl: 'Een voorschot van {deel}% ({bedrag}) bevestigt de datum. Het saldo volgt na afloop.',
    en: 'A deposit of {deel}% ({bedrag}) confirms the date. The balance follows afterwards.',
  },
  'offerte.geldig': { nl: 'Geldigheid', en: 'Validity' },
  'offerte.geldig_zin': {
    nl: 'Deze offerte blijft {dagen} dagen geldig, tot {datum}.',
    en: 'This quote stays valid for {dagen} days, until {datum}.',
  },
  'offerte.annulatie': { nl: 'Annulatie', en: 'Cancellation' },
  // Met een | gescheiden: één sleutel, één lijstje, en de vertaling blijft
  // naast het origineel staan in plaats van over vijf sleutels verspreid.
  'offerte.annulatie_regels': {
    nl: 'Meer dan 60 dagen vooraf: 10%|30 tot 60 dagen: 30%|14 tot 30 dagen: 50%|7 tot 14 dagen: 75%|Minder dan 7 dagen: 100%',
    en: 'More than 60 days ahead: 10%|30 to 60 days: 30%|14 to 30 days: 50%|7 to 14 days: 75%|Less than 7 days: 100%',
  },

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
