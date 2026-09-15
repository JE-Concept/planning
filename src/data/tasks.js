import { useEffect, useMemo, useState } from 'react'
import {
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { db } from '@lib/firebase'
import { byPosition, needsRebalance, positionFor, rebalance } from '@lib/position'

/**
 * A task carries a copy of its column (`statusName`, `statusColor`,
 * `statusKind`) and of `listName`. Firestore cannot join, and a board that
 * had to resolve those per card would read the list document once per row.
 * Every writer below refreshes the copies; nothing else may set them.
 */
function statusFields(status) {
  if (!status) {
    return { statusId: null, statusName: null, statusColor: null, statusKind: null, open: true }
  }
  return {
    statusId: status.id,
    statusName: status.name,
    statusColor: status.color,
    statusKind: status.kind,
    open: status.kind !== 'done' && status.kind !== 'closed',
  }
}

export function createTask({ list, status, title, ...rest }) {
  const taskRef = newRef(COL.tasks)
  const payload = {
    listId: list.id,
    listName: list.name,
    spaceId: list.spaceId ?? null,
    brandId: list.brandId ?? null,
    parentId: null,
    title: title.trim(),
    description: '',
    priority: null,
    startDate: null,
    dueDate: null,
    timeEstimateMinutes: null,
    budget: null,
    location: null,
    assignees: [],
    tags: [],
    position: Date.now(),
    archived: false,
    completedAt: null,
    trackedSeconds: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...statusFields(status),
    ...rest,
  }

  return setDoc(taskRef, payload).then(() => taskRef.id)
}

export function updateTask(id, patch) {
  return updateDoc(ref(COL.tasks, id), { ...patch, updatedAt: serverTimestamp() })
}

export function setTaskStatus(id, status) {
  return updateDoc(ref(COL.tasks, id), {
    ...statusFields(status),
    completedAt: status?.kind === 'done' || status?.kind === 'closed' ? new Date() : null,
    updatedAt: serverTimestamp(),
  })
}

export function setTaskList(id, list, status) {
  return updateDoc(ref(COL.tasks, id), {
    listId: list.id,
    listName: list.name,
    spaceId: list.spaceId ?? null,
    brandId: list.brandId ?? null,
    ...statusFields(status),
    updatedAt: serverTimestamp(),
  })
}

export function toggleAssignee(task, uid) {
  const next = task.assignees?.includes(uid)
    ? task.assignees.filter((a) => a !== uid)
    : [...(task.assignees ?? []), uid]
  return updateTask(task.id, { assignees: next })
}

export function toggleTag(task, name) {
  const next = task.tags?.includes(name)
    ? task.tags.filter((t) => t !== name)
    : [...(task.tags ?? []), name]
  return updateTask(task.id, { tags: next })
}

export function archiveTask(id) {
  return updateTask(id, { archived: true })
}

/** Removes the task and everything that only existed because of it. */
export async function deleteTask(id) {
  const [subtasks, comments, attachments] = await Promise.all([
    getDocs(query(col(COL.tasks), where('parentId', '==', id))),
    getDocs(query(col(COL.comments), where('taskId', '==', id))),
    getDocs(query(col(COL.attachments), where('taskId', '==', id))),
  ])

  const batch = writeBatch(db)
  for (const snap of [...subtasks.docs, ...comments.docs, ...attachments.docs]) {
    batch.delete(snap.ref)
  }
  batch.delete(ref(COL.tasks, id))
  await batch.commit()

  // Time already spent is a fact about somebody's week, so it survives the
  // task and simply loses its link.
  const entries = await getDocs(query(col(COL.timeEntries), where('taskId', '==', id)))
  if (entries.empty) return

  const cleanup = writeBatch(db)
  entries.docs.forEach((snap) => cleanup.update(snap.ref, { taskId: null }))
  await cleanup.commit()
}

/**
 * Drops `taskId` into `status` at `index` of `columnTasks` (the column as it
 * looks *without* the dragged card). Writes one row; renumbers the column only
 * when the float gaps have collapsed.
 */
export async function moveTaskTo({ taskId, status, columnTasks, index }) {
  const position = positionFor(columnTasks, index)

  await updateDoc(ref(COL.tasks, taskId), {
    ...statusFields(status),
    position,
    completedAt: status?.kind === 'done' || status?.kind === 'closed' ? new Date() : null,
    updatedAt: serverTimestamp(),
  })

  const reordered = [...columnTasks]
  reordered.splice(index, 0, { id: taskId, position })

  if (needsRebalance(reordered)) {
    const batch = writeBatch(db)
    rebalance(reordered).forEach((item) => batch.update(ref(COL.tasks, item.id), item))
    await batch.commit()
  }
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

/** Live top-level tasks of one list, ordered the way the board shows them. */
export function useTasks(listId, { includeArchived = false } = {}) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!listId) {
      setTasks([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    const clauses = [where('listId', '==', listId)]
    if (!includeArchived) clauses.push(where('archived', '==', false))

    return onSnapshot(
      query(col(COL.tasks), ...clauses, orderBy('position')),
      (snap) => {
        setTasks(fromQuery(snap))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )
  }, [listId, includeArchived])

  const [top, subtasks] = useMemo(() => {
    const roots = tasks.filter((t) => !t.parentId).sort(byPosition)
    const children = tasks.filter((t) => t.parentId)
    return [roots, children]
  }, [tasks])

  return { tasks, top, subtasks, loading, error }
}

/** One task, live — the drawer stays correct while someone else edits it. */
export function useTask(id) {
  const [task, setTask] = useState(null)

  useEffect(() => {
    if (!id) {
      setTask(null)
      return undefined
    }
    return onSnapshot(doc(db, COL.tasks, id), (snap) =>
      setTask(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    )
  }, [id])

  return task
}

/** Everything assigned to one person that is still open, soonest first. */
export function useMyTasks(uid) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setTasks([])
      setLoading(false)
      return undefined
    }

    return onSnapshot(
      query(
        col(COL.tasks),
        where('assignees', 'array-contains', uid),
        where('open', '==', true),
        orderBy('dueDate')
      ),
      (snap) => {
        setTasks(fromQuery(snap))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [uid])

  return { tasks, loading }
}

export { statusFields }
