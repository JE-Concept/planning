/**
 * Welke shift bij welk event hoort.
 *
 * ── Waarom op tijd en niet op plaats ──────────────────────────────────────
 * In AAPI staat elke shift onder vestiging "Meer-Bistro Het Vinne", óók de
 * shifts van een event dat in Kortessem doorgaat. De vestiging zegt dus niets
 * over waar iemand staat, en matchen op locatie zou elk event op verplaatsing
 * aan de verkeerde kant uitkomen. Wat wél klopt is wanneer iemand werkt.
 *
 * ── Hoe scherp we kunnen kijken, hangt van het event af ───────────────────
 * Een event in JE Plan heeft een datum, soms een beginuur, nooit een einduur.
 * Dus drie bronnen, van scherp naar grof:
 *
 *  1. **Het draaiboek.** Staat dat ingevuld, dan weten we van opbouw tot
 *     afbraak wat er gebeurt — dat is het echte venster, en nauwkeuriger dan
 *     wat welk veld dan ook zegt.
 *  2. **Een echt beginuur.** Dan rekenen we met een standaardduur. Niet omdat
 *     die klopt, maar omdat hij beter is dan de hele dag.
 *  3. **Alleen een datum.** Dan telt alleen nog: hoeveel events staan er die
 *     dag. Eén is een match, meer is een vraag aan een mens.
 *
 * Rond elk venster komt dezelfde marge voor opbouw en afbraak. Ook rond een
 * draaiboek: wie de tent zet staat er vóór de eerste regel, en wie opruimt
 * blijft na de laatste.
 *
 * ── Wat deze functie níét doet ────────────────────────────────────────────
 * Ze raadt niet. Bij twijfel geeft ze `ambiguous` met alle kandidaten en hun
 * score, zodat een mens er met één klik een kiest. Een koppeling die stilletjes
 * fout staat is erger dan een vraag: niemand gaat die ooit nakijken.
 *
 * Geen imports uit `src/`: deze codebase wordt apart verpakt en uitgerold.
 */
import { brusselNaarInstant, dagenTussen } from './tijd.js'
import { EVENEMENTEN } from './normaliseer.js'

/** De marge voor opbouw vooraf en afbraak achteraf. */
export const MARGE_VOOR_MS = 3 * 3600 * 1000
export const MARGE_NA_MS = 3 * 3600 * 1000

/** Hoe lang een event duurt als we alleen zijn beginuur kennen. */
export const STANDAARD_DUUR_MS = 6 * 3600 * 1000

/** Vanaf welke score een koppeling vanzelf gelegd wordt. */
export const DREMPEL = 0.5

/** Hoeveel een kandidaat op de tweede voor moet hebben om alleen te winnen. */
export const VOORSPRONG = 0.25

/*
  De statussen waarin een event nog niet vaststaat. Ze staan hier met dezelfde
  namen als in `src/lib/pipeline.js` en met opzet een tweede keer: `functions/`
  wordt apart verpakt en kan niets uit `src/` importeren. `tests/aapi-matcher`
  kijkt na of de twee lijsten elkaar niet tegenspreken.

  Waarom juist deze drie: zolang er geen offerte aanvaard is, is er geen event
  maar een kans. Er personeel aan koppelen zou betekenen dat de kalender vol
  staat met werk dat misschien nooit doorgaat.
*/
export const NIET_BEVESTIGD = ['request', 'create offer', 'offer send']

/** Tijden die in de gegevens staan maar niets betekenen; zie `parts.jsx`. */
const PLAATSHOUDERS = ['00:00', '12:00']

const alsDatum = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : v.toDate ? v.toDate() : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Doet dit event mee aan het koppelen? */
export function komtInAanmerking(event) {
  if (!event || event.archived) return false
  if (!alsDatum(event.eventDate ?? event.startDate)) return false
  return !NIET_BEVESTIGD.includes(String(event.statusName ?? '').toLowerCase())
}

/**
 * Het venster waarin dit event op zijn plek is, zonder marge.
 *
 * `null` betekent: we weten alleen de dag. Dat is geen fout maar een feit over
 * dit event, en de score hieronder gaat er anders mee om.
 */
export function eventVenster(event, dag) {
  /*
    De klokstanden uit het draaiboek, als tekst en niet als minuten sinds
    middernacht. Dat laatste stond hier eerst en was fout op precies één dag per
    jaar: op 25 oktober duurt de dag 25 uur, dus "negen uur na middernacht" is
    daar acht uur 's ochtends. Een klokstand hoort als klokstand omgerekend te
    worden — daar is `brusselNaarInstant` voor.
  */
  const klokken = (event?.draaiboek ?? [])
    .map((regel) => /^(\d{1,2}):(\d{2})$/.exec(String(regel?.tijd ?? '').trim()))
    .filter(Boolean)
    .map((m) => `${m[1].padStart(2, '0')}:${m[2]}`)
    .sort()

  if (klokken.length) {
    const van = brusselNaarInstant(`${dag} ${klokken[0]}:00`)
    let tot = brusselNaarInstant(`${dag} ${klokken[klokken.length - 1]}:00`)
    // Een draaiboek dat op "22:00 avondbar tot 03:00" eindigt, loopt tot in de
    // nacht. Eén regel zegt dat niet, maar een venster van nul minuten is
    // zinloos — vandaar een ondergrens van de standaardduur.
    if (tot - van < STANDAARD_DUUR_MS) tot = new Date(van.getTime() + STANDAARD_DUUR_MS)
    return { van, tot, bron: 'draaiboek' }
  }

  for (const veld of [event?.startDate, event?.eventDate]) {
    const d = alsDatum(veld)
    if (!d) continue
    const klok = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels', hour12: false, hour: '2-digit', minute: '2-digit',
    }).format(d)
    if (PLAATSHOUDERS.includes(klok)) continue
    return { van: d, tot: new Date(d.getTime() + STANDAARD_DUUR_MS), bron: 'beginuur' }
  }

  return null
}

/** Hoeveel van de shift binnen het opgerekte eventvenster valt: 0 tot 1. */
export function scoreVan(shift, event, dag) {
  const venster = eventVenster(event, dag)
  // Alleen een datum: elk event van die dag is even waarschijnlijk, en dan
  // beslist alleen nog het aantal kandidaten.
  if (!venster) return 1

  const van = venster.van.getTime() - MARGE_VOOR_MS
  const tot = venster.tot.getTime() + MARGE_NA_MS
  const duur = shift.eind.getTime() - shift.start.getTime()
  if (duur <= 0) return 0

  const overlap = Math.min(shift.eind.getTime(), tot) - Math.max(shift.start.getTime(), van)
  return Math.max(0, Math.min(1, overlap / duur))
}

/**
 * De events die deze shift kan raken, met hun score.
 *
 * Een shift die over middernacht loopt raakt twee kalenderdagen; allebei
 * tellen mee, want een avondbar tot 03:00 hoort bij het event van de dag
 * ervoor.
 */
export function kandidatenVoor(shift, events) {
  const dagen = new Set(dagenTussen(shift.start, shift.eind))
  const uit = []

  for (const event of events) {
    if (!komtInAanmerking(event)) continue
    const eventDag = event.dag ?? null
    if (!eventDag || !dagen.has(eventDag)) continue
    uit.push({ eventId: event.id, score: Number(scoreVan(shift, event, eventDag).toFixed(4)) })
  }

  return uit.sort((a, b) => b.score - a.score || String(a.eventId).localeCompare(String(b.eventId)))
}

/**
 * De beslissing: koppelen, vragen, of niets.
 *
 * Eén kandidaat die ruim genoeg scoort wordt gekoppeld. Bij meerdere moet de
 * beste niet alleen goed genoeg zijn maar ook duidelijk beter dan de tweede —
 * anders is "de hoogste" toeval en hoort er een mens naar te kijken.
 */
export function beslis(kandidaten) {
  if (!kandidaten.length) return { linkStatus: 'unlinked', eventId: null, linkScore: null, linkCandidates: [] }

  const [beste, tweede] = kandidaten
  const genoeg = beste.score >= DREMPEL
  const alleen = !tweede || beste.score - tweede.score >= VOORSPRONG

  if (genoeg && alleen) {
    return { linkStatus: 'auto', eventId: beste.eventId, linkScore: beste.score, linkCandidates: [] }
  }

  return { linkStatus: 'ambiguous', eventId: null, linkScore: null, linkCandidates: kandidaten }
}

/**
 * Wat er met deze shift moet gebeuren.
 *
 * Shifts buiten de afdeling Evenementen komen er niet aan te pas: die hebben
 * geen event. Dat is `notApplicable` en nadrukkelijk niet `none` — `none` is
 * iets wat een mens beslist heeft, en dat verschil hoort in de lijst leesbaar
 * te blijven.
 */
export function matchShift(shift, events) {
  if (shift.afdeling !== EVENEMENTEN) {
    return { linkStatus: 'notApplicable', eventId: null, linkScore: null, linkCandidates: [] }
  }
  // Een geannuleerde shift houdt wat ze had, maar krijgt niets nieuws: er komt
  // niemand werken, dus er valt niets te koppelen.
  if (shift.geannuleerd) {
    return { linkStatus: 'unlinked', eventId: null, linkScore: null, linkCandidates: [] }
  }
  return beslis(kandidatenVoor(shift, events))
}

/** Koppelingen die een mens gelegd heeft; een import raakt ze nooit aan. */
export const VASTGEZET = ['manual', 'none']
