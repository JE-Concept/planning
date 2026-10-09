import { addDays, addMonths, dayKey, startOfMonth, startOfWeek } from './dates'
import { dagenVan } from './eventdagen'

/**
 * Het rekenwerk achter de eventkalender: welke dagen er in beeld staan, wat
 * er op elke dag valt, en hoeveel daarvan in een hokje past.
 *
 * ── Waarom het hier staat en niet in de kalender ──────────────────────────
 * De kalender heeft drie gedaanten — een maandraster, een week in zeven
 * kolommen, en op een telefoon een agendalijst — en ze moeten het over
 * dezelfde dagen eens zijn. Een event dat in de maand op zaterdag staat en in
 * de week op zondag, is een fout die niemand meldt omdat iedereen denkt dat
 * hij zich vergist. Eén plek voor die vraag, met tests erop.
 */

export const PERIODES = ['maand', 'week']

/** Hoeveel events een maandhokje toont voor het "+2 meer" zegt. */
export const PER_HOKJE = 3

/**
 * De dagen die in beeld staan.
 *
 * Een maand staat er in hele weken, maandag eerst — zoals het team een week
 * leest. Een week is maandag tot en met zondag rond het anker.
 */
export function dagenInBeeld(anker, periode = 'maand') {
  if (periode === 'week') {
    const maandag = startOfWeek(anker)
    return Array.from({ length: 7 }, (_, i) => addDays(maandag, i))
  }
  const eerste = startOfMonth(anker)
  const begin = startOfWeek(eerste)
  const laatste = new Date(eerste.getFullYear(), eerste.getMonth() + 1, 0)
  const aantal = Math.ceil((Math.round((laatste - begin) / 864e5) + 1) / 7) * 7
  return Array.from({ length: aantal }, (_, i) => addDays(begin, i))
}

/** Eén periode verder of terug. */
export function verschuif(anker, periode, stap) {
  return periode === 'week' ? addDays(startOfWeek(anker), 7 * stap) : addMonths(startOfMonth(anker), stap)
}

/**
 * De events per dag, gesleuteld op "2026-10-25".
 *
 * Een meerdaags event staat op elk van zijn dagen, en niet alleen op de
 * eerste: anders is een festival van vrijdag tot zondag op zaterdag
 * onzichtbaar, en net dan wil je weten wat er loopt. Welke dagen dat zijn,
 * zegt `@lib/eventdagen`.
 */
export function eventsPerDag(events = []) {
  const perDag = {}
  for (const e of events) {
    for (const sleutel of dagenVan(e)) (perDag[sleutel] ??= []).push(e)
  }
  return perDag
}

/**
 * Wat er in één hokje past.
 *
 * Drie events passen; bij een vierde worden het er twee plus "+2 meer". Niet
 * drie plus "+1 meer": dan staat er een regel die even veel plaats inneemt
 * als het event dat hij verbergt. Er stond vroeger geen teller, en dan was
 * het derde event op een drukke zondag gewoon weg.
 */
export function inHokje(lijst = [], max = PER_HOKJE) {
  if (lijst.length <= max) return { getoond: lijst, meer: 0 }
  const getoond = lijst.slice(0, max - 1)
  return { getoond, meer: lijst.length - getoond.length }
}

/**
 * De dagen van een agendalijst: alleen die waarop iets valt, plus vandaag.
 *
 * Een telefoon heeft geen plaats voor een raster van zeven kolommen — daar
 * werd een event één letter. Een lijst met alleen de dagen waarop iets
 * gebeurt, leest wél. Vandaag staat er altijd bij zolang het in de periode
 * valt, ook als het leeg is: "vandaag niets" is ook een antwoord.
 */
export function agendaDagen(dagen, perDag, vandaag = dayKey(new Date())) {
  return dagen
    .map((d) => ({ datum: d, sleutel: dayKey(d) }))
    .filter(({ sleutel }) => (perDag[sleutel]?.length ?? 0) > 0 || sleutel === vandaag)
}
