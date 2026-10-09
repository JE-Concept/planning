import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import { doc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore'
import { COL, col, fromQuery, newRef } from '@lib/collections'
import { auth, db } from '@lib/firebase'
import { addDays, startOfDay } from '@lib/dates'
import { zetEinddatum } from '@lib/eventdagen'
import { bestellijstVoorEvent, prijsVan } from '@lib/formules'
import { isDone } from '@lib/taak'
import { kaartMensen, medewerkersVan, verantwoordelijkeVan } from '@lib/eventteam'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createTask, deleteTask, setTaskStatus, statusFields, updateTask, useTasks } from './tasks'

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

/*
  `isDone` staat in `@lib/taak` en wordt hier doorgegeven. Zo kan een scherm
  dat alleen wil weten of een taak af is, dat vragen zonder de Firebase-SDK
  in te laden — zie daar waarom dat uitmaakt.
*/
export { isDone }

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
    /*
      `team` is wat op de kaarten komt, en dat is alleen de verantwoordelijke.
      De ploeg staat apart: op een kaart van tweehonderd pixels past één vraag,
      en dat is wie je hierover aanspreekt. Zie `@lib/eventteam`.
    */
    team: kaartMensen(task),
    verantwoordelijke: verantwoordelijkeVan(task),
    medewerkers: medewerkersVan(task),
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
  /*
    Personeel en de socialrol lezen `tasks` niet — daar staan de bedragen op.

    Deze provider staat rond de hele schil en draaide dus ook voor hen. Bij
    personeel liep dat per ongeluk goed af: zij lezen de lijsten niet, dus was er
    geen eventlijst om taken van op te vragen. De socialrol leest de lijsten wél,
    want haar bord heeft ze nodig — en dus vond ze de eventlijst en vroeg de taken
    erbij op. Op elk scherm, elke keer. Dat komt niet terug als een lege lijst maar
    als een rechtenfout.

    Vandaar dat de rol hier beslist en niet het toeval. `useEvents()` geeft deze
    twee rollen dan niets, en dat klopt: voor hen bestaan de events niet.
  */
  const { isStaff, isSocial } = useAuth()
  /*
    Alleen het actieve deel. Wat afgesloten is, staat op het document (de
    server zet `afgesloten`, zie `functions/archiveren.js`) en komt hier niet
    meer binnen — het archiefscherm vraagt het per jaar op wanneer je het
    opent. Eerder kwam élk dossier van de laatste jaren mee, met al zijn taken,
    bij elke start van de app, om er daarna de helft van te verbergen.
  */
  const { top, subtasks, loading, error } = useTasks(isStaff || isSocial ? null : eventsList?.id, {
    alleenActief: true,
  })

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

/**
 * Zet een event op een andere stap.
 *
 * Zonder voorwaarden: wat er nog niet ingevuld is, staat op de fiche en houdt
 * het werk niet tegen. Zie `missingForOffer` in `@lib/pipeline` voor waarom
 * die regel geen slot meer is.
 */
export function moveEvent(event, statusName, statuses) {
  const status = statuses.find((s) => s.name === statusName)
  if (!status) throw new Error(`Status "${statusName}" bestaat niet in deze lijst.`)
  return setTaskStatus(event.id, status)
}

export function updateEvent(id, patch) {
  return updateTask(id, patch)
}

/**
 * Een event weggooien, met alles wat er alleen door bestond.
 *
 * Archiveren is bijna altijd het juiste: een afgelopen event hoort in de
 * geschiedenis en niet in de vuilbak. Maar een dubbel aangemaakt dossier, een
 * aanvraag die nooit een aanvraag was, een test van een nieuw template — die
 * horen daar juist niet in, en zolang ze alleen te archiveren zijn, vervuilen
 * ze elk overzicht en elke rapportage.
 *
 * De taken, reacties en bijlagen gaan mee (`deleteTask` doet dat), de geboekte
 * tijd blijft staan en verliest alleen haar koppeling: die uren gaan over
 * iemands week en niet over dit dossier. De kopie voor de socialrol ruimt de
 * trigger op. De offerte staat los van de taak en moet hier apart weg, anders
 * blijft er een publieke goedkeuringspagina staan voor een event dat niet meer
 * bestaat.
 */
export async function deleteEvent(id) {
  const offertes = await getDocs(query(col(COL.offertes), where('eventId', '==', id)))
  if (!offertes.empty) {
    const batch = writeBatch(db)
    offertes.docs.forEach((snap) => batch.delete(snap.ref))
    await batch.commit()
  }
  await deleteTask(id)
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
  eventEndDate = null,
  brandId,
  template,
  createdBy,
  customerId = null,
  customerName = null,
  formule = null,
  keuzes = null,
  pax = null,
  plek = null,
  omschrijving = '',
  soort = null,
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
    // Zie `createTask`: zonder deze twee staat een vers event nergens.
    afgesloten: false,
    afgeslotenJaar: null,
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
      description: omschrijving ?? '',
      eventDate: date,
      // Leeg: een nieuw event duurt één dag tot iemand "meerdaags" aanvinkt —
      // of tot een aanvraag om drie dagen vraagt ("23, 24 en 25 februari").
      // Het veld staat er altijd, zodat elk eventdocument dezelfde vorm heeft;
      // `zetEinddatum` houdt een einde vóór het begin tegen.
      eventEndDate: date && eventEndDate ? zetEinddatum({ eventDate: date }, new Date(`${eventEndDate}T12:00:00`)).eventEndDate : null,
      dueDate: date,
      // De klant staat op het event en niet op zijn taken: anders telt de
      // historiek op de klantfiche elk dossier zo vaak als het taken heeft.
      customerId: customerId || null,
      customerName: customerName?.trim() || null,
      // Een formule zegt meer over het soort event dan de naam van het
      // takentemplate; staat er geen formule, dan blijft het template de bron.
      // Wat uit de aanvraag gelezen is, wint van de naam van de formule: "een
      // verjaardag" zegt meer over het dossier dan "Winter BBQ".
      eventType: soort ?? formule?.name ?? (template && template.id !== 'leeg' ? template.name : null),
      templateId: template?.id ?? null,
      priority: null,
      timeEstimateMinutes: null,
      assignees: team,
      position: Date.now(),
      pax: personen,
      // De locatie staat op het event zelf en niet op zijn taken: één plek,
      // één adres. De taken eronder houden `location: null` uit `base()`.
      location: plek?.location ?? null,
      locationPlaceId: plek?.locationPlaceId ?? null,
      locationLat: plek?.locationLat ?? null,
      locationLng: plek?.locationLng ?? null,
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

// ─── Archief ───────────────────────────────────────────────────────────────

/**
 * Wat er in het archief zit, zonder het archief op te halen.
 *
 * `config/archief` draagt de jaren waarin iets afgesloten is en hoeveel het er
 * in totaal zijn. Eén document, één leesbeurt — tegenover het hele archief
 * ophalen om die twee getallen zelf te tellen, wat de app vroeger deed en de
 * reden is dat deze verandering er is.
 *
 * De nachtronde schrijft het exact; de trigger werkt het meteen bij wanneer
 * iemand een event afsluit. Staat het document er nog niet (een verse
 * werkruimte, of de eerste uitrol), dan is het antwoord leeg en niet stuk.
 */
export function useArchiefStand() {
  const [stand, setStand] = useState({ jaren: [], aantal: 0 })

  useEffect(
    () =>
      onSnapshot(
        doc(db, COL.config, 'archief'),
        (snap) => {
          const data = snap.exists() ? snap.data() : null
          setStand({
            jaren: [...(data?.jaren ?? [])].sort((a, b) => b - a),
            aantal: Math.max(0, data?.aantal ?? 0),
          })
        },
        () => setStand({ jaren: [], aantal: 0 })
      ),
    []
  )

  return stand
}

/**
 * Eén event dat niet (meer) op het bord staat, met zijn taken.
 *
 * De eventfiche las alles uit `useEvents()`, en daar zit sinds kort alleen nog
 * het actieve deel in. Een link naar een afgesloten dossier — uit het archief,
 * uit de zoekbalk, uit een oude mail — kwam daardoor op een lege pagina uit.
 * Dat is erger dan traag: het leest als een event dat weg is, terwijl er
 * offertebedragen en facturatiegegevens aan hangen.
 *
 * Wel een abonnement en geen losse vraag, in tegenstelling tot `useArchiefJaar`
 * hierboven: dit is het scherm waar iemand staat te werken, en wat een collega
 * ondertussen wijzigt hoort hier te verschijnen.
 *
 * `aan` staat uit zolang het event gewoon op het bord staat; dan is dit een
 * tweede abonnement op gegevens die er al zijn.
 */
export function useLosEvent(id, { aan = true, brandById = {} } = {}) {
  const [taak, setTaak] = useState(null)
  const [subtaken, setSubtaken] = useState([])
  const [loading, setLoading] = useState(aan)

  useEffect(() => {
    if (!aan || !id) {
      setTaak(null)
      setSubtaken([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    let klaar = 0
    const af = () => {
      klaar += 1
      if (klaar >= 2) setLoading(false)
    }

    const stopEvent = onSnapshot(
      doc(db, COL.tasks, id),
      (snap) => {
        setTaak(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        af()
      },
      () => {
        setTaak(null)
        af()
      }
    )

    const stopTaken = onSnapshot(
      query(col(COL.tasks), where('parentId', '==', id)),
      (snap) => {
        setSubtaken(fromQuery(snap))
        af()
      },
      () => af()
    )

    return () => {
      stopEvent()
      stopTaken()
    }
  }, [id, aan])

  return useMemo(
    () => ({
      event: taak ? toEvent(taak, { brandById }) : null,
      tasks: [...subtaken].sort(byDue),
      loading,
    }),
    [taak, subtaken, brandById, loading]
  )
}

/**
 * De afgesloten events van één jaar.
 *
 * Geen abonnement maar één vraag: het archief verandert hoogstens een paar
 * keer per jaar en niemand zit ernaar te kijken wanneer dat gebeurt. Een
 * `onSnapshot` zou hier een luisteraar openhouden op honderden documenten die
 * stilstaan.
 *
 * De subtaken komen mee uit Firestore — ze dragen dezelfde stand, zodat ze het
 * bord ook niet meer belasten — en worden hier gescheiden, net zoals
 * `useTasks` dat doet.
 */
export function useArchiefJaar(jaar, { listId, brandById = {} } = {}) {
  const [rijen, setRijen] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!jaar || !listId) {
      setRijen([])
      setLoading(false)
      return undefined
    }

    let actueel = true
    setLoading(true)
    getDocs(
      query(
        col(COL.tasks),
        where('listId', '==', listId),
        where('afgesloten', '==', true),
        where('afgeslotenJaar', '==', jaar)
      )
    )
      .then((snap) => {
        if (!actueel) return
        setRijen(fromQuery(snap))
        setLoading(false)
      })
      .catch((err) => {
        if (!actueel) return
        console.error('JE Plan: het archief is niet op te halen', err)
        setRijen([])
        setLoading(false)
      })

    return () => {
      actueel = false
    }
  }, [jaar, listId])

  return useMemo(() => {
    const events = rijen.filter((t) => !t.parentId).map((t) => toEvent(t, { brandById }))
    const tasksByEvent = {}
    for (const t of rijen) if (t.parentId) (tasksByEvent[t.parentId] ??= []).push(t)
    for (const list of Object.values(tasksByEvent)) list.sort(byDue)
    return { events, tasksByEvent, loading }
  }, [rijen, brandById, loading])
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

/**
 * Uren van één ISO-week, voor de werklast.
 *
 * `profileId` beperkt de vraag tot één persoon, en dat is meer dan zuinigheid:
 * de socialrol mag alleen haar eigen urenregels lezen. Een vraag zonder dat
 * filter zou over andermans rijen lopen, en Firestore weigert zo'n vraag in zijn
 * geheel — niet per rij. De zijbalk vroeg de hele week van de hele ploeg op en
 * filterde daarna op zichzelf; live gaf dat een rechtenfout en een teller die
 * altijd op nul stond, precies bij de rol die haar uren op haar posts boekt.
 */
export function useWeekEntries(week, { profileId = null } = {}) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!week) return undefined
    const clauses = [where('week', '==', week)]
    if (profileId) clauses.push(where('profileId', '==', profileId))

    return onSnapshot(
      query(col(COL.timeEntries), ...clauses),
      (snap) => setEntries(fromQuery(snap)),
      () => setEntries([])
    )
  }, [week, profileId])

  return entries
}

