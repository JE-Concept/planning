import { dayKey } from './dates'

/**
 * The arithmetic behind time tracking, kept away from Firestore so it can be
 * reasoned about (and tested) on its own.
 */

/** Seconds on a finished entry; live seconds on a running one. */
export function durationOf(entry, now = Date.now()) {
  if (!entry?.startedAt) return 0
  const start = new Date(entry.startedAt).getTime()
  const end = entry.endedAt ? new Date(entry.endedAt).getTime() : now
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
