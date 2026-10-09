import { asDate, dayKey, daysUntil, formatDate, startOfWeek } from './dates'
import { priorityOf } from './format'
import { STANDAARDTAAL, vertaal } from './i18n'
import { isAfgerond } from './laat'

/**
 * Wat de Tasks-pagina met een lijst taken doet: filteren, groeperen, sorteren.
 *
 * Dit staat los van het scherm omdat het rekenwerk is en geen tekening. Dat
 * scheelt niet alleen een test — het maakt ook de fouten zichtbaar die er zaten:
 * "te laat" stond niet op deadline gesorteerd, en een groep heette "Komende
 * week" terwijl er "Deze week" in stond. Zulke dingen zie je in een tabel met
 * verwachte uitkomsten, en niet in een component van driehonderd regels.
 *
 * De namen van de keuzes staan hier als sleutel en niet als tekst. Ze worden op
 * twee schermen getoond, en een tekst die op twee plekken vertaald wordt, loopt
 * op de derde plek uiteen.
 */

/** De tekst in de brontaal, voor wie geen `t` meegeeft — de tests bijvoorbeeld. */
const nederlands = (sleutel, waarden) => vertaal(STANDAARDTAAL, sleutel, waarden)

export const WEERGAVEN = [
  { key: 'lijst', sleutel: 'tasks.weergave.lijst' },
  { key: 'bord', sleutel: 'tasks.weergave.bord' },
  { key: 'kalender', sleutel: 'tasks.weergave.kalender' },
]

export const GROEPEN = [
  { key: 'deadline', sleutel: 'tasks.groep.deadline' },
  { key: 'status', sleutel: 'tasks.groep.status' },
  { key: 'persoon', sleutel: 'tasks.groep.persoon' },
  { key: 'lijst', sleutel: 'tasks.groep.lijst' },
  { key: 'prioriteit', sleutel: 'tasks.groep.prioriteit' },
  { key: 'geen', sleutel: 'tasks.groep.geen' },
]

export const SORTERINGEN = [
  { key: 'deadline', sleutel: 'tasks.sortering.deadline' },
  { key: 'prioriteit', sleutel: 'tasks.sortering.prioriteit' },
  { key: 'titel', sleutel: 'tasks.sortering.titel' },
  { key: 'gewijzigd', sleutel: 'tasks.sortering.gewijzigd' },
]

/**
 * De prioriteit als sleutel.
 *
 * `PRIORITIES` in `format` draagt de naam en de kleur, en wordt ook buiten de
 * taken gebruikt. De naam hoort bij de taal en staat daarom hier; de kleur
 * blijft waar ze stond.
 */
export const PRIO_SLEUTELS = {
  1: 'tasks.prio.urgent',
  2: 'tasks.prio.hoog',
  3: 'tasks.prio.normaal',
  4: 'tasks.prio.laag',
}

/** De naam van een prioriteit, of die van "geen". */
export const prioSleutel = (waarde) => PRIO_SLEUTELS[waarde] ?? 'tasks.prio.geen'

/**
 * De vervaldag in woorden: "Vandaag", "over 3 dagen", "5 dagen te laat".
 *
 * Hetzelfde als `relativeDay` in `dates`, maar dan vertaald. Die functie staat
 * in een lib die de taal niet kent en die ook buiten de taken gebruikt wordt;
 * hier is de taal er wel, want elk scherm dat dit toont heeft `t`.
 *
 * `afgerond`: er is niets meer te doen. Dan is een voorbije datum gewoon een
 * datum. De kaart kleurde al niet meer rood (zie `@lib/laat`), maar de tekst
 * zei nog altijd "22 dagen te laat" — op een event dat gefactureerd was, en op
 * het socialbord in de kolom van wat al online staat.
 */
export function vervaldag(t, value, { afgerond = false } = {}) {
  if (!asDate(value)) return ''
  const dagen = daysUntil(value)
  if (dagen === 0) return t('alg.vandaag')
  if (dagen === 1) return t('alg.morgen')
  if (dagen === -1) return t('alg.gisteren')
  if (dagen > 0) return dagen < 7 ? t('tasks.verval.over', { aantal: dagen }) : formatDate(value)
  if (afgerond) return formatDate(value)
  return t('tasks.verval.telaat', { aantal: Math.abs(dagen) })
}

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
  // Wat af is, is niet te laat. Een event dat klaar is om te factureren staat
  // anders elke dag verder in het rood terwijl er niets meer aan te doen is.
  if (dagen < 0) return isAfgerond(task) ? 'later' : 'telaat'
  if (dagen === 0) return 'vandaag'

  const eindDezeWeek = startOfWeek(vandaag).getTime() + 7 * 86400000
  const due = new Date(task.dueDate).getTime()
  if (due < eindDezeWeek) return 'dezeweek'
  if (due < eindDezeWeek + 7 * 86400000) return 'volgendeweek'
  return 'later'
}

export const DEADLINE_GROEPEN = [
  { key: 'telaat', sleutel: 'tasks.deadline.telaat', toon: 'danger' },
  { key: 'vandaag', sleutel: 'alg.vandaag', toon: 'accent' },
  { key: 'dezeweek', sleutel: 'tasks.deadline.dezeweek', toon: 'accent' },
  { key: 'volgendeweek', sleutel: 'tasks.deadline.volgendeweek', toon: 'rustig' },
  { key: 'later', sleutel: 'tasks.deadline.later', toon: 'rustig' },
  { key: 'zonder', sleutel: 'tasks.deadline.zonder', toon: 'rustig' },
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
export function groepeer(
  tasks,
  { groep = 'deadline', sortering = 'deadline', profileById = {}, listById = {}, t = nederlands } = {}
) {
  const gesorteerd = sorteer(tasks, sortering)

  if (groep === 'geen') {
    return [{ key: 'alles', label: '', tasks: gesorteerd }]
  }

  if (groep === 'deadline') {
    const emmers = Object.fromEntries(DEADLINE_GROEPEN.map((g) => [g.key, []]))
    for (const task of gesorteerd) emmers[deadlineGroep(task)].push(task)
    return DEADLINE_GROEPEN.filter((g) => emmers[g.key].length).map((g) => ({
      ...g,
      label: t(g.sleutel),
      tasks: emmers[g.key],
    }))
  }

  // De naam van een status of een lijst komt uit de database en blijft staan;
  // alleen wat de code zelf invult wanneer er niets is, hoort vertaald.
  const sleutelVan = {
    status: (taak) => [taak.statusName || t('tasks.zonder_status'), taak.statusName || t('tasks.zonder_status')],
    lijst: (taak) => [taak.listId || 'geen', listById[taak.listId]?.name ?? taak.listName ?? t('tasks.zonder_lijst')],
    prioriteit: (taak) => [
      String(taak.priority ?? 'geen'),
      priorityOf(taak.priority) ? t(prioSleutel(taak.priority)) : t('tasks.zonder_prioriteit'),
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
        label:
          id === 'geen'
            ? t('tasks.groep.niemand')
            : profileById[id]?.fullName || profileById[id]?.email || t('tasks.groep.onbekend'),
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
