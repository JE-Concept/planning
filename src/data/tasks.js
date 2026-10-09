import { useEffect, useMemo, useState } from 'react'
import {
  doc,
  getDoc,
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
import { COL, col, fromQuery, newRef, normalise, ref } from '@lib/collections'
import { auth, db } from '@lib/firebase'
import { meldSnapshot, vergeetBron } from '@lib/offline'
import { byPosition, needsRebalance, positionFor, rebalance } from '@lib/position'
import { raaktLog } from '@lib/activiteit'
import { SOCIAL_STAGE_KEYS, SOCIAL_VANAF, heeftSocial } from '@lib/social-stage'
import { logWijzigingen } from './activity'

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
    /*
      Een verse taak hoort op het bord, en Firestore vindt een document niet
      met `where('afgesloten', '==', false)` zolang dat veld er niet op staat.
      Zonder deze twee regels is een nieuw event meteen onzichtbaar — niet weg,
      maar dat scheelt voor wie ermee werkt niets. De server rekent het daarna
      bij; zie `functions/archiveren.js`.
    */
    afgesloten: false,
    afgeslotenJaar: null,
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

/**
 * Elke wijziging aan een taak loopt hier langs, zodat het log één ingang heeft.
 *
 * Voor het log is de oude stand nodig — "verzet van dinsdag naar vrijdag" kun
 * je niet uit de nieuwe waarde alleen afleiden, en zonder de oude waarde kun je
 * ook niet zien dat er níéts veranderde. Die leesbeurt gebeurt alleen als de
 * wijziging een gelogd veld raakt: een omschrijving bijwerken of een timer
 * stoppen kost dus nog altijd één schrijfbeurt en niets meer.
 *
 * Het is bewust geen transactie. Twee mensen die in dezelfde seconde dezelfde
 * taak verzetten, kunnen in theorie een regel opleveren die van de verkeerde
 * oude waarde uitgaat. Dat is een verkeerde zin in een logboek; een transactie
 * per klik is het antwoord op een probleem dat een planning van deze omvang
 * niet heeft.
 */
async function schrijfTaak(id, patch) {
  const taakRef = ref(COL.tasks, id)
  if (!raaktLog(patch)) return updateDoc(taakRef, patch)

  const voorSnap = await getDoc(taakRef).catch(() => null)
  await updateDoc(taakRef, patch)

  if (!voorSnap?.exists?.()) return undefined
  const voor = normalise({ id, ...voorSnap.data() })
  await logWijzigingen({ taskId: id, voor, na: { ...voor, ...patch }, door: doorWie() })
  return undefined
}

export function updateTask(id, patch) {
  return schrijfTaak(id, { ...patch, updatedBy: doorWie(), updatedAt: serverTimestamp() })
}

export function setTaskStatus(id, status) {
  return schrijfTaak(id, {
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

/**
 * Kaarten van het socialbord halen of terugzetten, in één keer.
 *
 * Eén batch en niet een schrijfbeurt per kaart: het gaat om tientallen
 * kaarten, en een halve opruiming — de helft weg, de rest niet omdat de
 * verbinding wegviel — laat een bord achter waar niemand nog iets van snapt.
 * Alleen `socialArchived` en de wie-en-wanneer: dat zijn velden die ook de
 * socialrol mag schrijven (zie `socialVelden` in `firestore.rules`). Een
 * Firestore-batch neemt hoogstens vijfhonderd schrijfbeurten; dit bord komt
 * daar niet in de buurt, maar het wordt toch in stukken gesneden.
 */
export async function zetSociaalArchief(ids, aan = true) {
  const door = doorWie()
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 400)) {
      batch.update(ref(COL.tasks, id), { socialArchived: aan, updatedBy: door, updatedAt: serverTimestamp() })
    }
    await batch.commit()
  }
}

/**
 * Removes the task and everything that only existed because of it.
 *
 * Het activiteitslog blijft staan: wie wil weten wie een taak weggooide, heeft
 * daar juist een log voor. De regels wijzen dan naar een `taskId` die niet meer
 * bestaat, en dat is precies wat er gebeurd is.
 */
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

  // Slepen binnen dezelfde kolom verandert alleen de volgorde, en dat is geen
  // logregel waard; `schrijfTaak` ziet vanzelf dat de status gelijk bleef.
  await schrijfTaak(taskId, {
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

/**
 * Live top-level tasks of one list, ordered the way the board shows them.
 *
 * `alleenActief` laat wat afgesloten is buiten het abonnement. Dat scheelt op
 * de eventlijst het meeste: daar stond élk dossier van de laatste jaren in,
 * met al zijn taken, op elk scherm en bij elke start — om in de browser de
 * helft ervan weer te verbergen. De server zet nu `afgesloten` op het document
 * (zie `functions/archiveren.js`) en deze vraag slaat die documenten over.
 *
 * Alleen voor de eventlijst aanzetten: op het Tasks- en socialbord bestaat het
 * veld niet, en Firestore vindt een document niet met `== false` wanneer het
 * veld er niet op staat. Dat zou daar een leeg bord opleveren.
 */
export function useTasks(listId, { includeArchived = false, alleenActief = false } = {}) {
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
    if (alleenActief) clauses.push(where('afgesloten', '==', false))

    // Dit abonnement draagt het hele bord. Wat er hier nog niet doorgestuurd is,
    // telt mee in de melding bovenaan: een taak die iemand met slecht bereik
    // verzet, hoort net zo zichtbaar open te staan als een vinkje in de keuken.
    const bron = `tasks:${listId}${includeArchived ? ':alles' : ''}${alleenActief ? ':actief' : ''}`

    const stop = onSnapshot(
      query(col(COL.tasks), ...clauses, orderBy('position')),
      (snap) => {
        meldSnapshot(bron, snap)
        setTasks(fromQuery(snap))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => {
      stop()
      vergeetBron(bron)
    }
  }, [listId, includeArchived, alleenActief])

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
    return onSnapshot(
      doc(db, COL.tasks, id),
      (snap) => setTask(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      // Zonder deze tak stopt het abonnement stil en blijft de lade de vorige
      // taak tonen. Leeg is het eerlijke antwoord: dan zie je dat er niets
      // staat in plaats van iets dat er niet meer hoort.
      () => setTask(null)
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
 * De taken voor de Tasks-pagina, met de keuzes die daar gemaakt worden.
 *
 * Dit bestaat naast `useMyTasks` omdat die pagina meer kan dan één lijstje van
 * één persoon: van jezelf naar een collega naar iedereen, en met of zonder wat
 * al afgerond is. Elk van die combinaties is een andere vraag aan Firestore, en
 * de vraag hier stellen is beter dan alles ophalen en in de browser weggooien —
 * leesbewerkingen worden per stuk gefactureerd.
 *
 * `who` is een gebruikers-id of `'iedereen'`. Er zit een plafond op: wie alles
 * van iedereen inclusief afgerond opvraagt, vraagt om de hele geschiedenis, en
 * daar is de pagina niet voor. Het archief is dat wel.
 */
export function useTaskBoard({ who, open = true, max = 500 } = {}) {
  const [eigen, setEigen] = useState([])
  const [zonder, setZonder] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!who) {
      setEigen([])
      setZonder([])
      setLoading(false)
      return undefined
    }

    const filters = [
      ...(who === 'iedereen' ? [] : [where('assignees', 'array-contains', who)]),
      ...(open ? [where('open', '==', true)] : []),
    ]

    setLoading(true)
    const stop = onSnapshot(
      query(col(COL.tasks), ...filters, orderBy('dueDate'), limit(max)),
      (snap) => {
        setEigen(fromQuery(snap))
        setLoading(false)
      },
      (err) => {
        console.error('JE Plan: de taken zijn niet op te halen', err)
        setLoading(false)
      }
    )

    /*
      En wat niemand op zijn naam heeft.

      Een taak zonder uitvoerder komt in geen enkele persoonlijke lijst voor —
      hij hoort bij niemand, dus vindt hij niemand. Precies dat werk moet gezien
      worden: het is wat blijft liggen omdat iedereen aanneemt dat een ander het
      doet.

      Het is een tweede vraag en geen deel van de eerste, omdat Firestore geen
      "van jou óf van niemand" in één keer kan beantwoorden. Het scherm voegt ze
      samen; dat is dezelfde aanpak als bij de socials.
    */
    const stopZonder =
      who === 'iedereen'
        ? () => {}
        : onSnapshot(
            query(
              col(COL.tasks),
              where('assignees', '==', []),
              ...(open ? [where('open', '==', true)] : []),
              orderBy('dueDate'),
              limit(max)
            ),
            (snap) => setZonder(fromQuery(snap)),
            (err) => console.error('JE Plan: de niet-toegewezen taken zijn niet op te halen', err)
          )

    return () => {
      stop()
      stopZonder()
    }
  }, [who, open, max])

  const tasks = useMemo(() => {
    if (zonder.length === 0) return eigen
    const gezien = new Set(eigen.map((t) => t.id))
    return [...eigen, ...zonder.filter((t) => !gezien.has(t.id))]
  }, [eigen, zonder])

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
export function useSocialEvents({ aan = true } = {}) {
  const [perStatus, setPerStatus] = useState([])
  const [metStand, setMetStand] = useState([])
  const [loading, setLoading] = useState(aan)

  useEffect(() => {
    // De socialrol mag `tasks` niet lezen en leest de kale kopie; dan hoort dit
    // abonnement niet open te gaan. Een geweigerde vraag is geen lege lijst maar
    // een fout, en die strandt het scherm.
    if (!aan) {
      setPerStatus([])
      setMetStand([])
      setLoading(false)
      return undefined
    }

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
  }, [aan])

  const events = useMemo(() => {
    const perId = new Map()
    for (const taak of [...perStatus, ...metStand]) perId.set(taak.id, taak)
    return [...perId.values()].filter((taak) => !taak.parentId && heeftSocial(taak)).sort(byPosition)
  }, [perStatus, metStand])

  return { events, loading }
}

export { statusFields }
