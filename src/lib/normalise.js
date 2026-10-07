/**
 * Wat uit Firestore komt, omgezet naar wat de app verwacht.
 *
 * Staat los van `collections.js` omdat hier geen Firebase aan te pas komt: het
 * is rekenwerk op een gewoon object, en dat hoort testbaar te zijn zonder een
 * SDK op te starten. De fout die dit bestand bestaansrecht gaf — een genest
 * tijdstip dat een Timestamp bleef en `Intl` liet crashen — is precies het
 * soort fout dat een unittest in één regel afdekt.
 */

import { herstelClickupDatums } from './clickupdatum'

/** Firestore Timestamp | Date | string → Date, or null. */
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// Velden die als tekst in de database kunnen staan — daar is de naam nodig om
// te weten dat het een datum is. Een Timestamp herkent zichzelf; een string niet.
const DATE_FIELDS = new Set([
  'createdAt', 'updatedAt', 'completedAt', 'dueDate', 'startDate', 'eventDate',
  'eventEndDate',
  'startedAt', 'endedAt', 'scheduledAt', 'publishAt', 'lastSeenAt',
  'reviewRequestedAt', 'reviewedAt',
])

const isTimestamp = (value) =>
  Boolean(value) && typeof value === 'object' && typeof value.toDate === 'function'

/**
 * Een document uit Firestore met echte datums erin.
 *
 * Dit liep eerst op een lijst veldnamen, en dat ging mis zodra een tijdstip
 * ergens genest stond: de afvinktijd van een punt zit in `items.<punt>.at`, en
 * die stond niet op de lijst. Wat er dan uitkwam was een Timestamp waar de code
 * een Date verwachtte, en `Intl` gooit daarop `RangeError: Invalid time value`
 * — een wit scherm, op een lijst van gisteren.
 *
 * Nu wordt elke Timestamp omgezet waar hij ook staat. De namenlijst blijft voor
 * datums die als tekst bewaard zijn; die kun je niet aan de waarde herkennen.
 */
export function normalise(data, diepte = 0) {
  if (Array.isArray(data)) {
    return diepte > 6 ? data : data.map((item) => normalise(item, diepte + 1))
  }
  if (isTimestamp(data)) return data.toDate()
  if (!data || typeof data !== 'object' || data instanceof Date) return data

  const out = {}
  for (const [key, value] of Object.entries(data)) {
    if (isTimestamp(value)) out[key] = value.toDate()
    else if (DATE_FIELDS.has(key)) out[key] = toDate(value)
    else if (value && typeof value === 'object' && !(value instanceof Date) && diepte <= 6)
      out[key] = normalise(value, diepte + 1)
    else out[key] = value
  }
  // Datums zonder uur uit ClickUp: zie clickupdatum.js.
  return diepte === 0 ? herstelClickupDatums(out) : out
}
