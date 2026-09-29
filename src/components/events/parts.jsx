import { Badge, Bar, Hex, initialsOf } from '@components/ds'
import { labelOf, toneOf } from '@lib/pipeline'
import { isDone } from '@data/events'

/**
 * Kleine stukken die op meer dan één scherm terugkomen: de statusbadge, het
 * team als zeshoekjes, de voortgang van een event.
 */

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const WD = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
export const MONTHS_FULL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
export const WD_FULL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

export const shortDate = (d) => (d ? `${new Date(d).getDate()} ${MONTHS[new Date(d).getMonth()]}` : null)
export const dayLabel = (d) => (d ? `${WD[new Date(d).getDay()]} ${shortDate(d)}` : null)
export const longDate = (d) => {
  if (!d) return null
  const x = new Date(d)
  return `${WD_FULL[x.getDay()]} ${x.getDate()} ${MONTHS_FULL[x.getMonth()]}`
}
export const monthShort = (d) => MONTHS[new Date(d).getMonth()]

export const euro = (n) => (n == null || n === '' ? null : `€ ${Number(n).toLocaleString('nl-BE')}`)

/** Uren als "21u30", zoals in het design. */
export const hours = (seconds) => {
  const m = Math.round((seconds ?? 0) / 60)
  return `${Math.floor(m / 60)}u${String(m % 60).padStart(2, '0')}`
}

export function StatusBadge({ statusName, statuses }) {
  return (
    <Badge tone={toneOf(statusName)} dot>
      {labelOf(statusName, statuses)}
    </Badge>
  )
}

export function TeamHexes({ ids = [], profileById, size = 26 }) {
  return (
    <span style={{ display: 'flex', gap: 2 }}>
      {ids.slice(0, 4).map((id) => {
        const p = profileById[id]
        return (
          <Hex key={id} size={size} title={p?.fullName ?? p?.email}>
            {initialsOf(p)}
          </Hex>
        )
      })}
    </span>
  )
}

export function progressOf(tasks = []) {
  const done = tasks.filter(isDone).length
  return {
    done,
    total: tasks.length,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    label: tasks.length ? `${done}/${tasks.length} taken` : 'Geen taken',
  }
}

export function ProgressLine({ tasks }) {
  const p = progressOf(tasks)
  return <Bar pct={p.pct} />
}

export function paxLabel(e) {
  return e.pax ? `${e.pax} pax` : '— pax'
}
