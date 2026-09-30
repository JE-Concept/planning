import { dayKey } from './dates'

/**
 * The arithmetic behind time tracking, kept away from Firestore so it can be
 * reasoned about (and tested) on its own.
 */

/**
 * Seconds on a finished entry; live seconds on a running one.
 *
 * Een onleesbare datum geeft 0 en geen NaN, en dat is hier geen detail. De
 * schrijvers in `src/data/time.js` weigeren een boeking met
 * `durationSeconds <= 0` — maar `NaN <= 0` is onwaar, dus met NaN glipte een
 * boeking langs die controle en belandde ze met een lege dag- en maandsleutel
 * in de database. Die uren staan dan nergens meer in een overzicht en niemand
 * ziet dat ze weg zijn. Een leeg datumveld in het urenformulier ("") wordt
 * `new Date('')` en is precies zo'n waarde.
 */
export function durationOf(entry, now = Date.now()) {
  if (!entry?.startedAt) return 0
  const start = new Date(entry.startedAt).getTime()
  const end = entry.endedAt ? new Date(entry.endedAt).getTime() : now
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.round((end - start) / 1000))
}

/**
 * The day, ISO week and month an entry belongs to.
 *
 * Firestore cannot group, so these are written onto the entry: a month report
 * becomes one indexed equality query instead of a range scan plus bucketing.
 */
export function periodKeys(date) {
  const d = new Date(date)
  const day = dayKey(d)

  // Zonder leesbare datum geen verzonnen sleutels. `dayKey` gaf al een lege
  // dag, maar de weekberekening eronder maakte er "NaN-WNaN" van — een bak
  // waar geen enkel overzicht naar vraagt, dus werk dat stil verdwijnt.
  if (!day) return { day: '', month: '', week: '' }

  // ISO 8601: the Thursday of the current week decides both year and number.
  const thursday = new Date(d)
  thursday.setHours(0, 0, 0, 0)
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7))

  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))

  const weekNumber = 1 + Math.round((thursday - firstThursday) / (7 * 86400000))

  return {
    day,
    month: day.slice(0, 7),
    week: `${thursday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`,
  }
}
