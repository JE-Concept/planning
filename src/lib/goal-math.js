/** Progress of a key result and of the goal that holds it. Pure arithmetic. */

/** 0–1, clamped, and direction-aware so "lower is better" targets still work. */
export function keyResultProgress(kr) {
  if (!kr) return 0
  if (kr.kind === 'boolean') return Number(kr.currentValue) >= 1 ? 1 : 0

  const start = Number(kr.startValue ?? 0)
  const target = Number(kr.targetValue ?? 0)
  const current = Number(kr.currentValue ?? 0)
  const span = target - start

  if (span === 0) return current >= target ? 1 : 0
  return Math.max(0, Math.min(1, (current - start) / span))
}

/** A goal is the unweighted average of its key results. */
export function goalProgress(goal) {
  const krs = goal?.keyResults ?? []
  if (krs.length === 0) return 0
  return krs.reduce((sum, kr) => sum + keyResultProgress(kr), 0) / krs.length
}
