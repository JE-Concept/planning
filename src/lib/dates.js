const TZ = 'Europe/Brussels'

const dayFmt = new Intl.DateTimeFormat('nl-BE', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ,
})
const dateFmt = new Intl.DateTimeFormat('nl-BE', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ,
})
const dateTimeFmt = new Intl.DateTimeFormat('nl-BE', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: TZ,
})
const timeFmt = new Intl.DateTimeFormat('nl-BE', {
  hour: '2-digit', minute: '2-digit', timeZone: TZ,
})
const monthFmt = new Intl.DateTimeFormat('nl-BE', {
  month: 'long', year: 'numeric', timeZone: TZ,
})

export const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

export function formatDay(value) {
  return value ? dayFmt.format(new Date(value)) : ''
}
export function formatDate(value) {
  return value ? dateFmt.format(new Date(value)) : ''
}
export function formatDateTime(value) {
  return value ? dateTimeFmt.format(new Date(value)) : ''
}
export function formatTime(value) {
  return value ? timeFmt.format(new Date(value)) : ''
}
export function formatMonth(value) {
  return value ? monthFmt.format(new Date(value)) : ''
}

/** "vandaag", "morgen", "over 3 dagen", "5 dagen te laat" — board-card language. */
export function relativeDay(value) {
  if (!value) return ''
  const days = daysUntil(value)
  if (days === 0) return 'vandaag'
  if (days === 1) return 'morgen'
  if (days === -1) return 'gisteren'
  if (days > 0) return days < 7 ? `over ${days} dagen` : formatDate(value)
  return `${Math.abs(days)} dagen te laat`
}

export function daysUntil(value) {
  const target = startOfDay(new Date(value))
  const today = startOfDay(new Date())
  return Math.round((target - today) / 86400000)
}

export function isOverdue(value) {
  return Boolean(value) && new Date(value).getTime() < Date.now()
}

export function startOfDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Monday-first, matching how the team reads a week. */
export function startOfWeek(date = new Date()) {
  const d = startOfDay(date)
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return d
}

export function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

export function addMonths(date, amount) {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() + amount)
  return d
}

export function startOfMonth(date = new Date()) {
  const d = startOfDay(date)
  d.setDate(1)
  return d
}

export function endOfMonth(date = new Date()) {
  const d = startOfMonth(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return endOfDay(d)
}

/** The 5 or 6 Monday-first weeks a month grid needs to show whole weeks. */
export function monthGrid(date = new Date()) {
  const first = startOfWeek(startOfMonth(date))
  const last = endOfMonth(date)
  const weeks = []
  let cursor = first

  while (cursor <= last || weeks.length < 5) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i))
    weeks.push(week)
    cursor = addDays(cursor, 7)
    if (weeks.length >= 6) break
  }
  return weeks
}

export function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function isToday(value) {
  return sameDay(new Date(value), new Date())
}

/** "2026-09-15" in local time — the key a calendar grid buckets on. */
export function dayKey(value) {
  const d = new Date(value)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** `<input type="datetime-local">` wants local time without a zone suffix. */
export function toLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null
}

export function toDateInput(value) {
  return value ? dayKey(value) : ''
}
