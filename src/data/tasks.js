import { useEffect, useMemo, useState } from 'react'
import {
  doc,
  getDocs,
  limit,
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
import { auth, db } from '@lib/firebase'
import { byPosition, needsRebalance, positionFor, rebalance } from '@lib/position'
import { SOCIAL_STAGE_KEYS, SOCIAL_VANAF, heeftSocial } from '@lib/social-stage'

/**
 * A task carries a copy of its column (`statusName`, `statusColor`,
 * `statusKind`) and of `listName`. Firestore cannot join, and a board that
 * had to resolve those per card would read the list document once per row.
 * Every writer below refreshes the copies; nothing else may set them.
 */
/**
 * Wie de wijziging maakte.
 *
 * Staat op elke taakschrijving omdat de meldingen het nodig hebben: wie een
 * taak naar zichzelf haalt, hoeft daar geen melding van te krijgen. Zonder dit
 * trilt je telefoon van je eigen klik, en zo leren mensen meldingen uitzetten.
 */
const doorWie = () => auth.currentUser?.uid ?? null

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
    createdBy: doorWie(),
    updatedBy: doorWie(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...statusFields(status),
    ...rest,
  }

  return setDoc(taskRef, payload).then(() => taskRef.id)
}

export function updateTask(id, patch) {
  return updateDoc(ref(COL.tasks, id), { ...patch, updatedBy: doorWie(), updatedAt: serverTimestamp() })
}

export function setTaskStatus(id, status) {
  return updateDoc(ref(COL.tasks, id), {
    ...statusFields(status),
    updatedBy: doorWie(),
    completedAt: status?.kind === 'done' || status?.kind === 'closed' ? new Date() : null,
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
    updatedBy: doorWie(),
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

/**
 * Open tasks to pick from — the project a social post hangs on.
 *
 * Firestore has no text search, so the recent open tasks are subscribed once
 * and filtered in the browser. A planning this size never has enough open work
 * for that to be the wrong trade, and it keeps the picker instant.
 */
export function useTaskSearch(term, { max = 250, enabled = true } = {}) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Pas abonneren wanneer de kiezer echt openstaat. Anders loopt er bij elke
    // geopende post een abonnement op tweehonderdvijftig taken mee waar
    // niemand naar kijkt.
    if (!enabled) {
      setLoading(false)
      return undefined
    }

    return onSnapshot(
      query(col(COL.tasks), where('open', '==', true), orderBy('updatedAt', 'desc'), limit(max)),
      (snap) => {
        setTasks(fromQuery(snap).filter((t) => !t.parentId))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [max, enabled])

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return tasks.slice(0, 25)
    return tasks
      .filter((t) =>
        `${t.title ?? ''} ${t.listName ?? ''}`.toLowerCase().includes(needle)
      )
      .slice(0, 25)
  }, [tasks, term])

  return { results, loading }
}

/**
 * De events op het socialbord.
 *
 * Twee abonnementen, en dat is met opzet. Een event komt op dit bord doordat
 * het ver genoeg staat op het eventbord (status), of doordat er al een stand
 * voor social op staat. Alleen het tweede volgen zou betekenen dat er eerst
 * iets moet gebeuren voor een event zichtbaar wordt — en dan is een bord dat
 * leeg blijft niet te onderscheiden van een bord dat niets te doen heeft.
 *
 * Zo werkt het ook zonder dat er iets aan de bestaande gegevens veranderd
 * wordt: wat vandaag op "invoiced" staat, staat morgen op dit bord, zonder
 * migratie.
 */
export function useSocialEvents() {
  const [perStatus, setPerStatus] = useState([])
  const [metStand, setMetStand] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const klaar = new Set(['status', 'stand'])
    const af = (welke) => {
      klaar.delete(welke)
      if (klaar.size === 0) setLoading(false)
    }

    const stop1 = onSnapshot(
      query(
        col(COL.tasks),
        where('statusName', 'in', SOCIAL_VANAF),
        where('archived', '==', false),
        orderBy('position')
      ),
      (snap) => {
        setPerStatus(fromQuery(snap))
        af('status')
      },
      () => af('status')
    )

    const stop2 = onSnapshot(
      query(
        col(COL.tasks),
        where('socialStage', 'in', SOCIAL_STAGE_KEYS),
        where('archived', '==', false),
        orderBy('position')
      ),
      (snap) => {
        setMetStand(fromQuery(snap))
        af('stand')
      },
      () => af('stand')
    )

    return () => {
      stop1()
      stop2()
    }
  }, [])

  const events = useMemo(() => {
    const perId = new Map()
    for (const taak of [...perStatus, ...metStand]) perId.set(taak.id, taak)
    return [...perId.values()].filter((taak) => !taak.parentId && heeftSocial(taak)).sort(byPosition)
  }, [perStatus, metStand])

  return { events, loading }
}

export { statusFields }
