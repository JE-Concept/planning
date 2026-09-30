import { useEffect, useState } from 'react'
import {
  deleteDoc,
  doc,
  getDoc,
  increment,
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
import { COL, col, fromQuery, newRef, normalise, ref } from '@lib/collections'
import { db } from '@lib/firebase'
import { durationOf, periodKeys } from '@lib/time-math'

function entryContext(task, list, brandId) {
  return {
    taskId: task?.id ?? null,
    taskTitle: task?.title ?? null,
    listId: list?.id ?? task?.listId ?? null,
    listName: list?.name ?? task?.listName ?? null,
    // Het merk mag van buitenaf komen: een post op de socialkalender hangt aan
    // een merk, ook wanneer er geen taak onder zit. Zonder dat zou die tijd op
    // geen enkele kostenplaats terechtkomen.
    brandId: brandId ?? list?.brandId ?? task?.brandId ?? null,
  }
}

/**
 * Starts the clock. The running timer is a document keyed by uid, so a second
 * start simply overwrites the first — "one timer per person" is a property of
 * the data, not a rule the UI has to remember.
 */
export async function startTimer({ uid, task, list, description = '', billable, brandId }) {
  const running = await getDoc(doc(db, COL.runningTimers, uid))
  if (running.exists()) await stopTimer(uid)

  await setDoc(doc(db, COL.runningTimers, uid), {
    profileId: uid,
    description,
    startedAt: new Date(),
    // Tijd op een taak is werk voor een klant; losse tijd zonder taak is dat
    // niet vanzelf. Die aanname stond hier op "wel", en dat leverde
    // factureerbare boekingen op die niemand bedoeld had.
    billable: billable ?? Boolean(task),
    ...entryContext(task, list, brandId),
  })
}

/** Closes the running timer into a permanent entry. Anything under 10s is noise. */
export async function stopTimer(uid) {
  const timerRef = doc(db, COL.runningTimers, uid)
  const snap = await getDoc(timerRef)
  if (!snap.exists()) return null

  const timer = normalise({ id: snap.id, ...snap.data() })
  const endedAt = new Date()
  const durationSeconds = durationOf({ ...timer, endedAt })

  if (durationSeconds < 10) {
    await deleteDoc(timerRef)
    return null
  }

  const entryRef = newRef(COL.timeEntries)
  const batch = writeBatch(db)

  batch.set(entryRef, {
    profileId: timer.profileId,
    description: timer.description ?? '',
    taskId: timer.taskId ?? null,
    taskTitle: timer.taskTitle ?? null,
    listId: timer.listId ?? null,
    listName: timer.listName ?? null,
    brandId: timer.brandId ?? null,
    billable: timer.billable ?? true,
    startedAt: timer.startedAt,
    endedAt,
    durationSeconds,
    ...periodKeys(timer.startedAt),
    createdAt: serverTimestamp(),
  })
  batch.delete(timerRef)

  await batch.commit()

  /*
    De teller op de taak staat bewust buiten die batch.

    Hij zat erin, en dat leek net: de urenregel en het totaal op de taak horen
    bij elkaar. Maar een batch is alles of niets, en de socialrol mag `tasks`
    niet bijwerken — terwijl ze haar tijd juist op een event boekt, en een event
    ís een taak. Het gevolg was dat haar timer helemaal niet te stoppen was: de
    schrijfbeurt werd in zijn geheel geweigerd, de klok liep door, en het uur
    was weg.

    Van de twee mogelijke fouten is deze de minst erge. Lukt de teller niet, dan
    klopt een optelsom op de taakfiche niet; lukt de urenregel niet, dan is
    iemands werk verdwenen. De urenregel gaat dus eerst en apart, en de teller
    mag mislukken.
  */
  if (timer.taskId) {
    await updateDoc(ref(COL.tasks, timer.taskId), {
      trackedSeconds: increment(durationSeconds),
    }).catch((err) => {
      console.warn('JE Plan: de tijd is geboekt, het totaal op de taak niet bijgewerkt', err)
    })
  }

  return entryRef.id
}

export async function addManualEntry({ uid, task, list, startedAt, endedAt, description, billable = true }) {
  const durationSeconds = durationOf({ startedAt, endedAt })
  if (durationSeconds <= 0) throw new Error('De eindtijd moet na de starttijd liggen.')

  const entryRef = newRef(COL.timeEntries)
  const batch = writeBatch(db)

  batch.set(entryRef, {
    profileId: uid,
    description: description ?? '',
    billable,
    startedAt: new Date(startedAt),
    endedAt: new Date(endedAt),
    durationSeconds,
    ...entryContext(task, list),
    ...periodKeys(startedAt),
    createdAt: serverTimestamp(),
  })
  if (task?.id) {
    batch.update(ref(COL.tasks, task.id), { trackedSeconds: increment(durationSeconds) })
  }

  await batch.commit()
  return entryRef.id
}

export async function updateEntry(entry, patch) {
  const startedAt = patch.startedAt ? new Date(patch.startedAt) : new Date(entry.startedAt)
  const endedAt = patch.endedAt ? new Date(patch.endedAt) : new Date(entry.endedAt)
  const durationSeconds = durationOf({ startedAt, endedAt })
  if (durationSeconds <= 0) throw new Error('De eindtijd moet na de starttijd liggen.')

  const delta = durationSeconds - (entry.durationSeconds ?? 0)
  const batch = writeBatch(db)

  batch.update(ref(COL.timeEntries, entry.id), {
    ...patch,
    startedAt,
    endedAt,
    durationSeconds,
    ...periodKeys(startedAt),
  })
  if (entry.taskId && delta !== 0) {
    batch.update(ref(COL.tasks, entry.taskId), { trackedSeconds: increment(delta) })
  }

  await batch.commit()
}

export async function deleteEntry(entry) {
  const batch = writeBatch(db)
  batch.delete(ref(COL.timeEntries, entry.id))
  if (entry.taskId) {
    batch.update(ref(COL.tasks, entry.taskId), {
      trackedSeconds: increment(-(entry.durationSeconds ?? 0)),
    })
  }
  await batch.commit()
}

export { durationOf, periodKeys }

// ─── Subscriptions ──────────────────────────────────────────────────────────

/** The running timer plus a second-by-second `elapsed` for the header widget. */
export function useRunningTimer(uid) {
  const [timer, setTimer] = useState(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!uid) return undefined
    return onSnapshot(doc(db, COL.runningTimers, uid), (snap) =>
      setTimer(snap.exists() ? normalise({ id: snap.id, ...snap.data() }) : null)
    )
  }, [uid])

  useEffect(() => {
    if (!timer) {
      setElapsed(0)
      return undefined
    }
    const tick = () => setElapsed(durationOf(timer))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timer])

  return { timer, elapsed }
}

/** Entries of one calendar month (`YYYY-MM`), optionally for one person. */
export function useTimeEntries({ month, profileId }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!month) return undefined
    setLoading(true)

    const clauses = [where('month', '==', month)]
    if (profileId) clauses.push(where('profileId', '==', profileId))

    return onSnapshot(
      query(col(COL.timeEntries), ...clauses, orderBy('startedAt', 'desc')),
      (snap) => {
        setEntries(fromQuery(snap))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [month, profileId])

  return { entries, loading }
}

export function useTaskTimeEntries(taskId) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!taskId) {
      setEntries([])
      return undefined
    }
    return onSnapshot(
      query(
        col(COL.timeEntries),
        where('taskId', '==', taskId),
        orderBy('startedAt', 'desc'),
        limit(50)
      ),
      (snap) => setEntries(fromQuery(snap))
    )
  }, [taskId])

  return entries
}

export function setEntryBillable(entry, billable) {
  return updateDoc(ref(COL.timeEntries, entry.id), { billable })
}
