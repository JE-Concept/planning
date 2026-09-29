/**
 * Wanneer een post de deur uit gaat, en hoe een week eruitziet.
 *
 * Een post hing tot nu toe aan de datum van zijn event: wie een post maakte
 * bij een trouw van 12 oktober, kreeg 12 oktober. Zo werkt het niet. De
 * aankondiging van datzelfde feest gaat weken op voorhand online en de
 * nabeschouwing dagen erna, en beide horen bij hetzelfde event. De
 * publicatiedatum is daarom een eigen veld (`publishAt`) en niet iets dat uit
 * het event af te leiden valt.
 *
 * Het rekenwerk staat hier en niet in de kalender zelf: de maandweergave, de
 * weekweergave, het dashboard en de kaartjes moeten het over hetzelfde moment
 * eens zijn, en dat lukt alleen als ze het op dezelfde plek vragen.
 */

import { addDays, asDate, dayKey, startOfDay, startOfWeek } from './dates'
import { GEEN_KANAAL, kanalenVan } from './social-channels'

/**
 * Het moment waarop een post online gaat.
 *
 * De applicatie draait al een tijd mee en de posts die er staan hebben nog
 * geen `publishAt`. Die niet overschrijven maar terugvallen: `scheduledAt` is
 * wat er vóór deze wijziging op stond, en dat was de datum die van het event
 * kwam. Voor een bestaande post is dat het beste antwoord dat er is; zodra
 * iemand een echte publicatiedatum invult, telt die en blijft het oude veld
 * ongemoeid staan.
 */
export function publicatieMoment(post) {
  return asDate(post?.publishAt) ?? asDate(post?.scheduledAt)
}

/**
 * Staat er al een echte publicatiedatum op, of komt hij nog van het event?
 *
 * De kalender zegt dat erbij, want een overgenomen datum is een datum die
 * niemand gekozen heeft — en dat wil je zien vóór de post online staat.
 */
export function heeftEigenPublicatiedatum(post) {
  return asDate(post?.publishAt) != null
}

/** De zeven dagen van de week waar deze datum in valt, maandag eerst. */
export function weekDagen(datum = new Date()) {
  const maandag = startOfWeek(datum)
  return Array.from({ length: 7 }, (_, i) => addDays(maandag, i))
}

/**
 * Het ISO-weeknummer — "week 40" is hoe dit team over zijn planning praat.
 *
 * ISO rekent van maandag tot zondag en legt week 1 op de week met de eerste
 * donderdag. Daarom wordt er eerst naar de donderdag van deze week gesprongen:
 * die bepaalt in welk jaar de week hoort, ook rond de jaarwissel.
 */
export function weekNummer(datum = new Date()) {
  const donderdag = addDays(startOfWeek(datum), 3)
  const eerste = new Date(donderdag.getFullYear(), 0, 1)
  const dagen = Math.round((startOfDay(donderdag) - startOfDay(eerste)) / 86400000)
  return Math.floor(dagen / 7) + 1
}

/** Het jaar waar deze week bij hoort — zie `weekNummer`: de donderdag beslist. */
export function weekJaar(datum = new Date()) {
  return addDays(startOfWeek(datum), 3).getFullYear()
}

/** Valt het publicatiemoment van deze post binnen deze dagen? */
export function valtInWeek(post, dagen) {
  const key = dayKey(publicatieMoment(post))
  return key !== '' && dagen.some((dag) => dayKey(dag) === key)
}

/**
 * De posts per dag, gesleuteld op "2026-09-30".
 *
 * Posts zonder publicatiemoment vallen weg: die horen in de lijst "nog in te
 * plannen" naast de kalender, niet op een dag.
 */
export function bucketPerDag(posts = []) {
  const map = {}
  for (const post of posts) {
    const key = dayKey(publicatieMoment(post))
    if (!key) continue
    ;(map[key] ??= []).push(post)
  }
  for (const key of Object.keys(map)) map[key].sort(opTijd)
  return map
}

/**
 * De posts per kanaal én per dag: `{ instagram: { '2026-09-30': [...] } }`.
 *
 * Een post op Instagram én Facebook staat in beide rijen. Dat is geen dubbel
 * werk maar de vraag die de weekweergave beantwoordt: wat gaat er dinsdag op
 * Facebook? Dan hoort die post daar te staan, ook al staat hij er ook boven.
 */
export function bucketPerDagEnKanaal(posts = []) {
  const map = {}
  for (const post of posts) {
    const key = dayKey(publicatieMoment(post))
    if (!key) continue
    const kanalen = kanalenVan(post)
    for (const kanaal of kanalen.length > 0 ? kanalen : [GEEN_KANAAL]) {
      ;((map[kanaal] ??= {})[key] ??= []).push(post)
    }
  }
  for (const perDag of Object.values(map)) {
    for (const key of Object.keys(perDag)) perDag[key].sort(opTijd)
  }
  return map
}

/** Vroeg op de dag eerst; wie geen uur heeft, sluit aan. */
function opTijd(a, b) {
  const x = publicatieMoment(a)?.getTime() ?? Infinity
  const y = publicatieMoment(b)?.getTime() ?? Infinity
  return x - y
}

/**
 * Hoeveel posts er deze week per kanaal staan — het cijfer naast de rijkop.
 *
 * Los geteld van het bucketen, want de rijkop telt de hele week en de cellen
 * tellen per dag; twee keer hetzelfde uitrekenen in een component geeft twee
 * antwoorden zodra er één filter bijkomt.
 */
export function telPerKanaal(posts = []) {
  const tellers = {}
  for (const post of posts) {
    const kanalen = kanalenVan(post)
    for (const kanaal of kanalen.length > 0 ? kanalen : [GEEN_KANAAL]) {
      tellers[kanaal] = (tellers[kanaal] ?? 0) + 1
    }
  }
  return tellers
}
