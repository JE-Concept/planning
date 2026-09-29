import { dayKey, daysUntil, startOfWeek } from './dates'
import { priorityOf } from './format'

/**
 * Wat de Tasks-pagina met een lijst taken doet: filteren, groeperen, sorteren.
 *
 * Dit staat los van het scherm omdat het rekenwerk is en geen tekening. Dat
 * scheelt niet alleen een test — het maakt ook de fouten zichtbaar die er zaten:
 * "te laat" stond niet op deadline gesorteerd, en een groep heette "Komende
 * week" terwijl er "Deze week" in stond. Zulke dingen zie je in een tabel met
 * verwachte uitkomsten, en niet in een component van driehonderd regels.
 */

export const WEERGAVEN = [
  { key: 'lijst', label: 'Lijst' },
  { key: 'bord', label: 'Bord' },
  { key: 'kalender', label: 'Kalender' },
]

export const GROEPEN = [
  { key: 'deadline', label: 'Deadline' },
  { key: 'status', label: 'Status' },
  { key: 'persoon', label: 'Persoon' },
  { key: 'lijst', label: 'Lijst' },
  { key: 'prioriteit', label: 'Prioriteit' },
  { key: 'geen', label: 'Niet groeperen' },
]

export const SORTERINGEN = [
  { key: 'deadline', label: 'Deadline' },
  { key: 'prioriteit', label: 'Prioriteit' },
  { key: 'titel', label: 'Titel' },
  { key: 'gewijzigd', label: 'Laatst gewijzigd' },
]

/**
 * Hoog eerst; wat geen prioriteit heeft komt achteraan in plaats van vooraan.
 *
 * De prioriteit is een getal waarin 1 het dringendst is — dat leest andersom dan
 * je verwacht, dus het staat hier één keer en nergens anders.
 */
const prioRang = (task) => (priorityOf(task.priority) ? task.priority : 9)

/** Een ontbrekende deadline is niet "lang geleden": die hoort achteraan. */
const dueGetal = (task) => {
  if (!task.dueDate) return Number.POSITIVE_INFINITY
  const t = new Date(task.dueDate).getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

const tijd = (value) => {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * De vergelijkers, elk met een vaste tweede sleutel.
 *
 * Zonder die tweede sleutel wisselt de volgorde van twee taken met dezelfde
 * prioriteit bij elke hertekening van het scherm, en dat leest als een lijst
 * die uit zichzelf beweegt.
 */
export const VERGELIJKERS = {
  deadline: (a, b) => dueGetal(a) - dueGetal(b) || (a.title ?? '').localeCompare(b.title ?? ''),
  prioriteit: (a, b) => prioRang(a) - prioRang(b) || dueGetal(a) - dueGetal(b),
  titel: (a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'nl'),
  gewijzigd: (a, b) => tijd(b.updatedAt) - tijd(a.updatedAt) || dueGetal(a) - dueGetal(b),
}

export function sorteer(tasks, sortering = 'deadline') {
  return [...tasks].sort(VERGELIJKERS[sortering] ?? VERGELIJKERS.deadline)
}

/**
 * De groepen op deadline, in de taal van iemand die naar zijn week kijkt.
 *
 * "Deze week" betekent de dagen tot en met zondag, niet "de komende zeven
 * dagen". Dat verschil is het hele punt van de groep: op donderdag wil je weten
 * wat er nog voor het weekend moet, niet wat er woensdag aankomt. Wat daarna
 * komt en nog deze maand valt, staat onder "Volgende week"; de rest is "Later".
 */
export function deadlineGroep(task, vandaag = new Date()) {
  if (!task.dueDate) return 'zonder'

  const dagen = daysUntil(task.dueDate)
  if (dagen < 0) return 'telaat'
  if (dagen === 0) return 'vandaag'

  const eindDezeWeek = startOfWeek(vandaag).getTime() + 7 * 86400000
  const due = new Date(task.dueDate).getTime()
  if (due < eindDezeWeek) return 'dezeweek'
  if (due < eindDezeWeek + 7 * 86400000) return 'volgendeweek'
  return 'later'
}

export const DEADLINE_GROEPEN = [
  { key: 'telaat', label: 'Te laat', toon: 'danger' },
  { key: 'vandaag', label: 'Vandaag', toon: 'accent' },
  { key: 'dezeweek', label: 'Deze week', toon: 'accent' },
  { key: 'volgendeweek', label: 'Volgende week', toon: 'rustig' },
  { key: 'later', label: 'Later', toon: 'rustig' },
  { key: 'zonder', label: 'Zonder deadline', toon: 'rustig' },
]

/**
 * Filteren op wat er in de balk gekozen is.
 *
 * De zoekterm kijkt naar de titel en de omschrijving; meer velden maken het
 * onvoorspelbaar ("waarom komt deze naar boven?"). Wat leeg is filtert niet —
 * een filter dat niets uitsluit hoort ook niets uit te sluiten.
 */
export function filter(tasks, { zoek = '', lijstId = '', label = '', prioriteit = '', persoon = '' } = {}) {
  const term = zoek.trim().toLowerCase()

  return tasks.filter((task) => {
    if (lijstId && task.listId !== lijstId) return false
    if (label && !(task.tags ?? []).includes(label)) return false
    if (prioriteit && Number(task.priority) !== Number(prioriteit)) return false
    if (persoon && !(task.assignees ?? []).includes(persoon)) return false
    if (!term) return true
    return `${task.title ?? ''} ${task.description ?? ''}`.toLowerCase().includes(term)
  })
}

/**
 * De taken in groepen, in de volgorde waarin ze op het scherm horen.
 *
 * Binnen elke groep wordt gesorteerd met dezelfde vergelijker als de rest van de
 * pagina. Dat klinkt vanzelfsprekend maar was het niet: "te laat" kwam binnen in
 * de volgorde waarin Firestore het gaf, waardoor iets van vorige maand onder
 * iets van gisteren stond. Juist in die groep is de volgorde het antwoord.
 */
export function groepeer(tasks, { groep = 'deadline', sortering = 'deadline', profileById = {}, listById = {} } = {}) {
  const gesorteerd = sorteer(tasks, sortering)

  if (groep === 'geen') {
    return [{ key: 'alles', label: '', tasks: gesorteerd }]
  }

  if (groep === 'deadline') {
    const emmers = Object.fromEntries(DEADLINE_GROEPEN.map((g) => [g.key, []]))
    for (const task of gesorteerd) emmers[deadlineGroep(task)].push(task)
    return DEADLINE_GROEPEN.filter((g) => emmers[g.key].length).map((g) => ({ ...g, tasks: emmers[g.key] }))
  }

  const sleutelVan = {
    status: (t) => [t.statusName || 'Zonder status', t.statusName || 'Zonder status'],
    lijst: (t) => [t.listId || 'geen', listById[t.listId]?.name ?? t.listName ?? 'Zonder lijst'],
    prioriteit: (t) => [
      String(t.priority ?? 'geen'),
      priorityOf(t.priority)?.label ?? 'Zonder prioriteit',
    ],
  }[groep]

  // Persoon is de enige groepering waar één taak in meerdere groepen hoort: een
  // taak met twee uitvoerders staat bij beiden. Anders zou je hem missen op het
  // moment dat je juist naar jouw naam kijkt.
  if (groep === 'persoon') {
    const emmers = new Map()
    for (const task of gesorteerd) {
      const wie = (task.assignees ?? []).length ? task.assignees : ['geen']
      for (const id of wie) {
        if (!emmers.has(id)) emmers.set(id, [])
        emmers.get(id).push(task)
      }
    }
    return [...emmers.entries()]
      .map(([id, taken]) => ({
        key: id,
        label: id === 'geen' ? 'Niemand toegewezen' : profileById[id]?.fullName || profileById[id]?.email || 'Onbekend',
        tasks: taken,
      }))
      .sort((a, b) => (a.key === 'geen' ? 1 : b.key === 'geen' ? -1 : a.label.localeCompare(b.label, 'nl')))
  }

  const emmers = new Map()
  for (const task of gesorteerd) {
    const [key, label] = sleutelVan(task)
    if (!emmers.has(key)) emmers.set(key, { key, label, tasks: [] })
    emmers.get(key).tasks.push(task)
  }
  return [...emmers.values()]
}

/** Dezelfde taken op hun vervaldag, voor de kalenderweergave. */
export function perDag(tasks) {
  const map = {}
  for (const task of tasks) {
    if (!task.dueDate) continue
    const sleutel = dayKey(task.dueDate)
    if (!sleutel) continue
    ;(map[sleutel] ??= []).push(task)
  }
  return map
}
