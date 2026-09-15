/**
 * Card ordering inside a board column.
 *
 * Cards carry a float. Dropping between two neighbours takes the midpoint, so a
 * move writes one row instead of renumbering the column. Floats run out of
 * precision after ~50 consecutive splits in the same gap; `needsRebalance`
 * spots that and `rebalance` hands back a clean 1, 2, 3 … sequence.
 */

const STEP = 1024
const MIN_GAP = 1e-6

/** Position for a card dropped at `index` within `ordered` (that list excludes the card). */
export function positionFor(ordered, index) {
  const before = ordered[index - 1]
  const after = ordered[index]

  if (!before && !after) return STEP
  if (!before) return after.position - STEP
  if (!after) return before.position + STEP
  return (before.position + after.position) / 2
}

export function needsRebalance(ordered) {
  for (let i = 1; i < ordered.length; i += 1) {
    if (Math.abs(ordered[i].position - ordered[i - 1].position) < MIN_GAP) return true
  }
  return false
}

/** Fresh, evenly spaced positions — `[{ id, position }]` ready to upsert. */
export function rebalance(ordered) {
  return ordered.map((item, i) => ({ id: item.id, position: (i + 1) * STEP }))
}

export function byPosition(a, b) {
  if (a.position === b.position) return String(a.id).localeCompare(String(b.id))
  return a.position - b.position
}

/** Moves `id` to `toIndex` of `items` and returns the reordered array. */
export function moveItem(items, id, toIndex) {
  const from = items.findIndex((i) => i.id === id)
  if (from === -1) return items
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, item)
  return next
}
