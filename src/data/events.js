import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import { onSnapshot, query, where, writeBatch } from 'firebase/firestore'
import { COL, col, fromQuery, newRef } from '@lib/collections'
import { auth, db } from '@lib/firebase'
import { addDays, startOfDay } from '@lib/dates'
import { bestellijstVoorEvent, prijsVan } from '@lib/formules'
import { blockedTransition } from '@lib/pipeline'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createTask, setTaskStatus, statusFields, updateTask, useTasks } from './tasks'

/**
 * Events zijn de taken op het hoofdniveau van de eventlijst; de taken van een
 * event zijn zijn subtaken. Zo blijven de gemigreerde ClickUp-gegevens, het
 * socialbord, de klanten en de automatisaties werken zoals ze werken — het
 * design is een nieuwe blik op dezelfde documenten.
 *
 * De velden die het design op de fiche zet en die ClickUp niet kende (gasten,
 * formule, eventtype, offertebedrag, draaiboek) staan als gewone velden op het
 * eventdocument. Waar er al een veld voor bestond (`budget`, `location`,
 * `customerName`) wordt dat gebruikt.
 */

/** De dag van het event. Oude dossiers hebben enkel een deadline. */
export function eventDateOf(task) {
  return task?.eventDate ?? task?.startDate ?? task?.dueDate ?? null
}

export function quoteOf(task) {
  return task?.quoteAmount ?? task?.budget ?? null
}

export function isDone(task) {
  return task?.open === false
}

/** Een event zoals de schermen het lezen. */
export function toEvent(task, { brandById = {} } = {}) {
  const brand = brandById[task.brandId]
  return {
    ...task,
    name: task.title,
    eventDate: eventDateOf(task),
    quoteAmount: quoteOf(task),
    concept: brand?.name ?? null,
    conceptShort: brand ? shortBrand(brand.name) : null,
    team: task.assignees ?? [],
  }
}

/** "Meer — Het Vinne" → "Meer": op een kaart telt het merk, niet de plek. */
export function shortBrand(name = '') {
  return name.split(' — ')[0]
}

/**
 * Alle events en hun taken, live — één abonnement voor de hele app.
 *
 * Staat als provider rond de schil: de zijbalk (timer), de zoekbalk, de
 * assistent en het scherm zelf lezen dezelfde gegevens, en elk zijn eigen
 * abonnement laten openen is vier keer hetzelfde antwoord ophalen.
 */
const EventsContext = createContext(null)

export function EventsProvider({ children }) {
  const { eventsList, brandById } = useWorkspace()
  const { top, subtasks, loading, error } = useTasks(eventsList?.id)

  const value = useMemo(() => {
    const events = top.map((t) => toEvent(t, { brandById }))
    const eventById = Object.fromEntries(events.map((e) => [e.id, e]))
    const tasksByEvent = {}
    for (const t of subtasks) (tasksByEvent[t.parentId] ??= []).push(t)
    for (const list of Object.values(tasksByEvent)) list.sort(byDue)
    return { events, eventById, tasks: subtasks, tasksByEvent, loading, error, list: eventsList }
  }, [top, subtasks, brandById, loading, error, eventsList])

  return createElement(EventsContext.Provider, { value }, children)
}

export function useEvents() {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEvents moet binnen <EventsProvider> gebruikt worden.')
  return ctx
}

export function byDue(a, b) {
  const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
  const dbb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
  return da - dbb || (a.position ?? 0) - (b.position ?? 0)
}

export function byEventDate(a, b) {
  const da = a.eventDate ? new Date(a.eventDate).getTime() : Infinity
  const dbb = b.eventDate ? new Date(b.eventDate).getTime() : Infinity
  return da - dbb
}

// ─── Schrijven ─────────────────────────────────────────────────────────────

export class BlockedError extends Error {
  constructor(missing) {
    super(`Vul eerst ${missing.join(', ')} in voor je een offerte start.`)
    this.missing = missing
  }
}

/** Zet een event op een andere stap, met de offerteregel ervoor. */
export function moveEvent(event, statusName, statuses) {
  const missing = blockedTransition(event, statusName)
  if (missing) throw new BlockedError(missing)
  const status = statuses.find((s) => s.name === statusName)
  if (!status) throw new Error(`Status "${statusName}" bestaat niet in deze lijst.`)
  return setTaskStatus(event.id, status)
}

export function updateEvent(id, patch) {
  return updateTask(id, patch)
}

/**
 * Een taak onder een event afvinken of heropenen.
 *
 * Een taak heeft in de gegevens een status uit de pijplijn (zo kwam ze uit
 * ClickUp). Afvinken zet ze op de laatste stap; heropenen zet ze terug op de
 * stap waar het event nu staat.
 */
export function toggleTaskDone(task, { event, statuses }) {
  const closed = [...statuses].reverse().find((s) => s.kind === 'closed' || s.kind === 'done')
  const reopen = statuses.find((s) => s.name === event?.statusName) ?? statuses.find((s) => s.kind === 'open') ?? statuses[0]
  return setTaskStatus(task.id, isDone(task) ? reopen : closed)
}

export function addEventTask({ event, list, title, assignee, dueDate, priority = null }) {
  const status = list.statuses?.find((s) => s.name === event.statusName) ?? list.statuses?.[0]
  return createTask({
    list,
    status,
    title,
    parentId: event.id,
    brandId: event.brandId ?? list.brandId ?? null,
    assignees: assignee ? [assignee] : [],
    dueDate: dueDate ?? addDays(startOfDay(), 3),
    priority,
  })
}

/** Checklistpunt (subtaak in het design) afvinken. */
export function toggleChecklistItem(task, index) {
  const checklist = (task.checklist ?? []).map((item, i) => (i === index ? { ...item, done: !item.done } : item))
  return updateTask(task.id, { checklist })
}

/**
 * Nieuw event uit een template, en eventueel uit een vaste formule.
 *
 * Eén batch: het event en al zijn taken bestaan samen of niet. De deadlines
 * tellen terug vanaf de eventdatum; wat daardoor al voorbij zou zijn, komt op
 * vandaag te staan in plaats van meteen te laat te beginnen.
 *
 * Komt er een formule mee, dan staan de prijs én de bestellijst er meteen op —
 * uitgerekend op het aantal personen, met de gekozen antwoorden erin verwerkt.
 * Ze worden als gewone velden op het event gezet en niet als verwijzing naar de
 * formule: vanaf hier is het een dossier dat zijn eigen leven leidt, en een
 * prijswijziging in de formule hoort een verkocht event niet te veranderen.
 */
export async function createEventFromTemplate({
  list,
  name,
  eventDate,
  brandId,
  template,
  createdBy,
  customerId = null,
  customerName = null,
  formule = null,
  keuzes = null,
  pax = null,
}) {
  const first = list.statuses?.find((s) => s.name === 'request') ?? list.statuses?.[0]
  const uid = createdBy ?? auth.currentUser?.uid ?? null
  const now = new Date()
  const today = startOfDay()
  const date = eventDate ? new Date(`${eventDate}T12:00:00`) : null

  const tasks = (template?.tasks ?? []).filter((t) => t.title?.trim())
  const team = [...new Set([uid, ...tasks.map((t) => t.who)].filter(Boolean))]

  const base = (extra) => ({
    listId: list.id,
    listName: list.name,
    spaceId: list.spaceId ?? null,
    brandId: brandId ?? list.brandId ?? null,
    description: '',
    startDate: null,
    budget: null,
    location: null,
    tags: [],
    archived: false,
    completedAt: null,
    trackedSeconds: 0,
    commentCount: 0,
    createdBy: uid,
    updatedBy: uid,
    createdAt: now,
    updatedAt: now,
    ...statusFields(first),
    ...extra,
  })

  const personen = pax != null ? Math.max(0, Math.round(Number(pax) || 0)) : null
  const prijs = formule ? prijsVan(formule, keuzes ?? {}, personen ?? 0) : null

  const eventRef = newRef(COL.tasks)
  const batch = writeBatch(db)
  batch.set(
    eventRef,
    base({
      parentId: null,
      title: name.trim(),
      eventDate: date,
      dueDate: date,
      // De klant staat op het event en niet op zijn taken: anders telt de
      // historiek op de klantfiche elk dossier zo vaak als het taken heeft.
      customerId: customerId || null,
      customerName: customerName?.trim() || null,
      // Een formule zegt meer over het soort event dan de naam van het
      // takentemplate; staat er geen formule, dan blijft het template de bron.
      eventType: formule?.name ?? (template && template.id !== 'leeg' ? template.name : null),
      templateId: template?.id ?? null,
      priority: null,
      timeEstimateMinutes: null,
      assignees: team,
      position: Date.now(),
      pax: personen,
      // `formule` is het veld dat de fiche al toonde: de naam van het aanbod.
      formule: formule?.name ?? null,
      formuleId: formule?.id ?? null,
      formuleKeuzes: formule ? (keuzes ?? {}) : null,
      formulePrijsPerPersoon: prijs?.perPersoon ?? null,
      formuleBtw: prijs?.btw ?? null,
      formuleInclBtw: prijs?.inclBtw ?? null,
      // `budget` is het oude ClickUp-veld waar de rapportage op leest; de fiche
      // toont `quoteAmount`. Ze horen hetzelfde bedrag te dragen.
      quoteAmount: prijs?.exclBtw ?? null,
      budget: prijs?.exclBtw ?? null,
      bestellijst: formule ? bestellijstVoorEvent(formule, keuzes ?? {}, personen ?? 0) : [],
    })
  )

  tasks.forEach((t, i) => {
    let due = date ? addDays(date, -(Number(t.offset) || 0)) : addDays(today, 3)
    if (due < today) due = today
    batch.set(
      newRef(COL.tasks),
      base({
        parentId: eventRef.id,
        title: t.title.trim(),
        dueDate: due,
        priority: t.prio === 'Urgent' ? 1 : t.prio === 'Hoog' ? 2 : null,
        repeat: t.repeat || null,
        timeEstimateMinutes: t.est ? Math.round(t.est * 60) : 60,
        checklist: (t.subs ?? []).map((text) => ({ text, done: false })),
        assignees: t.who ? [t.who] : [],
        position: Date.now() + i,
      })
    )
  })

  await batch.commit()
  return eventRef.id
}

// ─── Tijd per event ────────────────────────────────────────────────────────

/** Tijdregistraties op het event en zijn taken, nieuwste eerst. */
export function useEventTime(taskIds) {
  const [entries, setEntries] = useState([])
  const key = taskIds.join('|')

  useEffect(() => {
    const ids = key ? key.split('|') : []
    if (ids.length === 0) {
      setEntries([])
      return undefined
    }
    // Firestore neemt hoogstens dertig waarden in een `in`.
    const chunks = []
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
    const parts = chunks.map(() => [])
    const stops = chunks.map((chunk, n) =>
      onSnapshot(
        query(col(COL.timeEntries), where('taskId', 'in', chunk)),
        (snap) => {
          parts[n] = fromQuery(snap)
          setEntries(
            parts.flat().sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
          )
        },
        () => {}
      )
    )
    return () => stops.forEach((stop) => stop())
  }, [key])

  return entries
}

/** Uren van één ISO-week, voor de werklast. */
export function useWeekEntries(week) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!week) return undefined
    return onSnapshot(
      query(col(COL.timeEntries), where('week', '==', week)),
      (snap) => setEntries(fromQuery(snap)),
      () => setEntries([])
    )
  }, [week])

  return entries
}

