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

/**
 * Wat er ook binnenkomt, er komt een Date of niets uit.
 *
 * `Intl` gooit `RangeError: Invalid time value` op een ongeldige datum, en
 * omdat dit in de render gebeurt neemt die fout het hele scherm mee — één rare
 * waarde uit de database en de pagina is wit. Een Firestore-Timestamp die nog
 * niet omgezet is, is precies zo'n waarde; die wordt hier alsnog omgezet.
 *
 * Bij twijfel liever een leeg vakje dan een wit scherm: een ontbrekend tijdstip
 * is te zien en te verhelpen, een verdwenen pagina niet.
 */
function asDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      return asDate(value.toDate())
    } catch {
      return null
    }
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export { asDate }

const formatteer = (fmt) => (value) => {
  const d = asDate(value)
  return d ? fmt.format(d) : ''
}

export const formatDay = formatteer(dayFmt)
export const formatDate = formatteer(dateFmt)
export const formatDateTime = formatteer(dateTimeFmt)
export const formatTime = formatteer(timeFmt)
export const formatMonth = formatteer(monthFmt)

/** "vandaag", "morgen", "over 3 dagen", "5 dagen te laat" — board-card language. */
export function relativeDay(value) {
  if (!asDate(value)) return ''
  const days = daysUntil(value)
  if (days === 0) return 'vandaag'
  if (days === 1) return 'morgen'
  if (days === -1) return 'gisteren'
  if (days > 0) return days < 7 ? `over ${days} dagen` : formatDate(value)
  return `${Math.abs(days)} dagen te laat`
}

export function daysUntil(value) {
  const d = asDate(value)
  if (!d) return 0
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000)
}

export function isOverdue(value) {
  const d = asDate(value)
  return Boolean(d) && d.getTime() < Date.now()
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
  const d = asDate(value)
  return Boolean(d) && sameDay(d, new Date())
}

/** "2026-09-15" in local time — the key a calendar grid buckets on. */
export function dayKey(value) {
  const d = asDate(value)
  if (!d) return ''
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** `<input type="datetime-local">` wants local time without a zone suffix. */
export function toLocalInput(value) {
  const d = asDate(value)
  if (!d) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value) {
  return asDate(value)?.toISOString() ?? null
}

export function toDateInput(value) {
  return value ? dayKey(value) : ''
}

/**
 * Een dag uit een datumveld, bewaard als het midden van die dag.
 *
 * `new Date('2026-09-30')` is middernacht in UTC, niet hier. Dat scheelt in
 * Brussel één of twee uur, en dat is genoeg om een datum de verkeerde dag te
 * geven zodra er ergens met een lokale dag gerekend wordt — of om een tijd te
 * tonen die niemand heeft ingevuld.
 *
 * Twaalf uur 's middags ligt van beide kanten ver genoeg van de dagovergang dat
 * geen enkele tijdzone of zomeruurwissel de dag nog kan verzetten. De tijd zelf
 * betekent niets: het veld vroeg om een dag.
 */
export function fromDateInput(value) {
  if (!value) return null
  const d = new Date(`${value}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}
