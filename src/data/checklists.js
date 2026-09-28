import { useEffect, useMemo, useState } from 'react'
import {
  arrayUnion,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { COL, col, fromQuery, ref } from '@lib/collections'
import { isWeekend, requiredItems, runId } from '@lib/checklist-templates'

export { isWeekend, requiredItems, runId }

/**
 * Openen en sluiten, per dag, door meerdere mensen tegelijk.
 *
 * Eén run per lijst per dag, met een vaste id `<lijst>_<dag>`. Dat is wat het
 * samen afvinken mogelijk maakt: wie de lijst opent, opent dezelfde. De stand
 * staat in een map `items`, gesleuteld op punt-id, en elke afvinking schrijft
 * alleen zijn eigen sleutel — twee mensen die tegelijk een ander punt aanvinken
 * overschrijven elkaar dus niet.
 */

/** De lijsten zelf: openen, sluiten, en wat het team er later bij maakt. */
export function useChecklists() {
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.checklists), orderBy('position')),
        (snap) => {
          setChecklists(fromQuery(snap).filter((c) => !c.archived))
          setLoading(false)
        },
        () => setLoading(false)
      ),
    []
  )

  return { checklists, loading }
}

/** De runs van één dag, live — je ziet de vinkjes van je collega binnenkomen. */
export function useRunsForDay(day) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!day) return undefined
    setLoading(true)
    return onSnapshot(
      query(col(COL.checklistRuns), where('day', '==', day)),
      (snap) => {
        setRuns(fromQuery(snap))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [day])

  return useMemo(
    () => ({ runs, byChecklist: Object.fromEntries(runs.map((r) => [r.checklistId, r])), loading }),
    [runs, loading]
  )
}

/**
 * Vinkt één punt aan of uit.
 *
 * `setDoc` met merge voegt diep samen, dus dit raakt alleen `items.<id>` en
 * laat de rest van de map staan. De voortgang wordt uit die map gerekend en
 * niet als getal bewaard: twee mensen die hetzelfde punt aanvinken zouden een
 * opgeslagen teller laten wegdrijven, en een fout getal is erger dan geen.
 */
export function toggleItem({ checklist, day, item, done, profile, weekend }) {
  const id = runId(checklist.id, day)
  const [year, month, dayOfMonth] = day.split('-').map(Number)

  return setDoc(
    ref(COL.checklistRuns, id),
    {
      checklistId: checklist.id,
      checklistKey: checklist.key ?? checklist.id,
      checklistName: checklist.name,
      brandId: checklist.brandId ?? null,
      day,
      // Middag, zodat een tijdzoneverschuiving de datum nooit een dag verzet.
      date: new Date(year, month - 1, dayOfMonth, 12, 0, 0),
      weekend: Boolean(weekend),
      participants: arrayUnion(profile.id),
      items: {
        [item.id]: done
          ? { done: true, byId: profile.id, byName: profile.fullName || profile.email, at: new Date() }
          : { done: false, byId: null, byName: null, at: null },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/**
 * De opmerking onderaan het papieren blad — bij sluiten ook wat naar de
 * volgende shift moet. Eén veld per dag, dus de laatste schrijver wint; de naam
 * erbij maakt zichtbaar wie dat was.
 */
export function saveNotes({ checklist, day, notes, profile }) {
  return setDoc(
    ref(COL.checklistRuns, runId(checklist.id, day)),
    {
      checklistId: checklist.id,
      day,
      notes,
      notesById: profile.id,
      notesByName: profile.fullName || profile.email,
      notesAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/** Markeert de lijst als afgerond; puur voor het overzicht. */
export function closeRun({ checklist, day, profile }) {
  return setDoc(
    ref(COL.checklistRuns, runId(checklist.id, day)),
    {
      checklistId: checklist.id,
      day,
      closedAt: serverTimestamp(),
      closedById: profile.id,
      closedByName: profile.fullName || profile.email,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}
