/**
 * De bus van messaging: wat er over Pub/Sub gaat, en hoe het eruitziet.
 *
 * Zonder één import, zodat `tests/messaging.test.js` het kan nalopen; de
 * functies in `messaging-verwerking.js` publiceren en lezen alleen via hier.
 *
 * ── Waarom een bus tussen de log en de verwerkers ─────────────────────────
 * De log `messaging` in Firestore blijft de bron van waarheid: elke rij is er
 * één keer, onveranderlijk, en kan altijd opnieuw afgespeeld worden. Maar een
 * Firestore-trigger per verwerker koppelt elke verwerker aan de database en
 * aan elkaar: één trigger, één functie, één manier van herkansen. Met een
 * topic ertussen krijgt elke verwerker een eigen abonnement en schaalt hij
 * los van de andere; komt er een verwerker bij (de boekhouding, Lightspeed,
 * een rapport in BigQuery), dan abonneert hij zich, zonder dat er aan de
 * ingang of aan de log iets verandert. Ook iets buiten JE Plan kan dat.
 *
 * ── Outbox ────────────────────────────────────────────────────────────────
 * De ingang schrijft alleen de rij, met `bus.stand: 'wacht'`. Een trigger op
 * de log (de relay) zet ze op het topic en noteert `gepubliceerd`. Zo is er
 * nooit een bericht op de bus dat niet in de log staat, en wat de relay mist,
 * vindt de herkansing terug aan zijn stand `wacht`. Twee keer publiceren kan
 * (een trigger mag twee keer vuren); elke verwerker kijkt daarom eerst naar
 * zijn eigen stand.
 *
 * ── Claim check ───────────────────────────────────────────────────────────
 * Op de bus staat alleen de verwijzing (id, bron, soort, sleutel), nooit de
 * inhoud: daar staan namen, mailadressen en telefoonnummers in, en die horen
 * in de log, waar de rules ze afschermen en waar ze te wissen zijn — niet in
 * de bewaartijd van een topic. Een verwerker leest de rij zelf.
 *
 * ── Dead letter ───────────────────────────────────────────────────────────
 * Wat MAX_POGINGEN keer faalt, gaat naar een tweede topic. De melding aan de
 * beheerders is daar een abonnee van; een monitor of een ander systeem kan
 * er ook op luisteren.
 */

/** Elk nieuw bericht in de log, en elke herkansing ervan. */
export const TOPIC_BERICHTEN = 'messaging-berichten'
/** Wat MAX_POGINGEN keer faalde en een mens nodig heeft. */
export const TOPIC_VASTGELOPEN = 'messaging-vastgelopen'
/** De versie van de vorm van een busbericht; een verwerker die een hogere ziet, laat ze liggen. */
export const BUS_VERSIE = 1

/**
 * Het busbericht voor een rij uit de log. `verwerker` staat er alleen bij een
 * herkansing: dan is het bericht voor die ene verwerker, en laten de andere
 * het links liggen.
 */
export function busBericht(id, rij, { verwerker = null } = {}) {
  const json = { v: BUS_VERSIE, id, bron: rij?.bron ?? null, soort: rij?.soort ?? null, sleutel: rij?.sleutel ?? null }
  if (verwerker) json.verwerker = verwerker
  // Attributen zijn strings; ze laten een abonnement of een monitor filteren zonder de data te openen.
  const attributes = { id: String(id), bron: String(json.bron ?? ''), soort: String(json.soort ?? '') }
  if (verwerker) attributes.verwerker = verwerker
  return { json, attributes }
}

/**
 * Leest wat er van de bus binnenkomt. Geeft null als het geen bericht van
 * deze bus is, of een vorm die deze verwerker niet kent: liever een bericht
 * laten liggen (het staat in de log) dan het half begrijpen.
 */
export function leesBusBericht(json) {
  if (!json || typeof json !== 'object') return null
  if (typeof json.id !== 'string' || !json.id) return null
  if (Number(json.v ?? 0) > BUS_VERSIE) return null
  return { id: json.id, bron: json.bron ?? null, soort: json.soort ?? null, verwerker: json.verwerker ?? null }
}

/** Is dit busbericht voor deze verwerker? Een herkansing voor een ander is dat niet. */
export const isVoor = (bericht, verwerker) => Boolean(bericht) && (!bericht.verwerker || bericht.verwerker === verwerker)

/** Het busbericht voor de dead-letter-topic. */
export function vastgelopenBericht(id, verwerker, fout) {
  return {
    json: { v: BUS_VERSIE, id, verwerker, fout: String(fout ?? '').slice(0, 200) },
    attributes: { id: String(id), verwerker },
  }
}
