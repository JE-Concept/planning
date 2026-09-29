import { useEffect, useState } from 'react'
import {
  deleteDoc,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { goalProgress, keyResultProgress } from '@lib/goal-math'

export { goalProgress, keyResultProgress }

export const KEY_RESULT_KINDS = [
  { key: 'number', label: 'Aantal' },
  { key: 'currency', label: 'Bedrag (€)' },
  { key: 'percent', label: 'Percentage' },
  { key: 'boolean', label: 'Ja / nee' },
  { key: 'tasks', label: 'Taken afgewerkt (telt automatisch)' },
]

/**
 * Key results live inside the goal document.
 *
 * A goal has a handful of them, they are never queried on their own, and
 * keeping them together means one read per goal card instead of one plus N.
 * Check-in history is separate, because that grows without bound.
 */
export function newKeyResult(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    kind: 'number',
    startValue: 0,
    targetValue: 100,
    currentValue: 0,
    unit: '',
    listId: null,
    ...overrides,
  }
}

export function createGoal({ name, dueDate, ownerId, assignees, ...rest }) {
  const goalRef = newRef(COL.goals)

  return setDoc(goalRef, {
    name: name.trim(),
    description: '',
    // Wie het doel waarmaakt. Een merk zei niets over wie eraan trekt; dit wel.
    assignees: assignees ?? [],
    ownerId: ownerId ?? null,
    startDate: new Date(),
    dueDate: new Date(dueDate),
    status: 'active',
    color: '#3377ff',
    position: Date.now(),
    keyResults: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...rest,
  }).then(() => goalRef.id)
}

export function updateGoal(id, patch) {
  return updateDoc(ref(COL.goals, id), { ...patch, updatedAt: serverTimestamp() })
}

export function deleteGoal(id) {
  return deleteDoc(ref(COL.goals, id))
}

export function setKeyResults(goalId, keyResults) {
  return updateGoal(goalId, { keyResults })
}

/**
 * Records a check-in: the new value on the key result plus a line of history,
 * so a goal can show how it moved and not just where it landed.
 */
export async function checkIn({ goal, keyResultId, value, note, profileId }) {
  const keyResults = (goal.keyResults ?? []).map((kr) =>
    kr.id === keyResultId ? { ...kr, currentValue: Number(value) } : kr
  )

  await updateGoal(goal.id, { keyResults })
  await setDoc(newRef(COL.goalUpdates), {
    goalId: goal.id,
    keyResultId,
    value: Number(value),
    note: note ?? '',
    profileId: profileId ?? null,
    createdAt: serverTimestamp(),
  })
}

/**
 * Key results of kind `tasks` read their value from a list instead of from a
 * person: the count of completed tasks. `getCountFromServer` bills one read
 * for the whole count rather than one per task.
 */
export async function refreshTaskKeyResults(goal) {
  const taskKrs = (goal.keyResults ?? []).filter((kr) => kr.kind === 'tasks' && kr.listId)
  if (taskKrs.length === 0) return goal.keyResults ?? []

  const counts = await Promise.all(
    taskKrs.map((kr) =>
      getCountFromServer(
        query(
          col(COL.tasks),
          where('listId', '==', kr.listId),
          where('archived', '==', false),
          where('open', '==', false)
        )
      ).then((snap) => snap.data().count)
    )
  )

  const byId = Object.fromEntries(taskKrs.map((kr, i) => [kr.id, counts[i]]))
  const keyResults = (goal.keyResults ?? []).map((kr) =>
    kr.id in byId ? { ...kr, currentValue: byId[kr.id] } : kr
  )

  const changed = keyResults.some(
    (kr, i) => kr.currentValue !== (goal.keyResults ?? [])[i]?.currentValue
  )
  if (changed) await updateGoal(goal.id, { keyResults })

  return keyResults
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export function useGoals({ includeArchived = false } = {}) {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.goals), orderBy('dueDate')),
        (snap) => {
          const all = fromQuery(snap)
          setGoals(includeArchived ? all : all.filter((g) => g.status !== 'archived'))
          setLoading(false)
        },
        () => setLoading(false)
      ),
    [includeArchived]
  )

  return { goals, loading }
}

export function useKeyResultHistory(keyResultId) {
  const [updates, setUpdates] = useState([])

  useEffect(() => {
    if (!keyResultId) {
      setUpdates([])
      return undefined
    }
    return onSnapshot(
      query(
        col(COL.goalUpdates),
        where('keyResultId', '==', keyResultId),
        orderBy('createdAt', 'desc')
      ),
      (snap) => setUpdates(fromQuery(snap)),
      () => setUpdates([])
    )
  }, [keyResultId])

  return updates
}
