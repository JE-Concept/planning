/**
 * Business rules: wat er automatisch met een taak gebeurt.
 *
 * Eén voorbeeld uit de praktijk, en meteen de reden dat dit bestaat: alles wat
 * op "ready to invoice" komt is werk voor Elke, en niemand anders. Dat met de
 * hand doortrekken werkt tot iemand het vergeet — en een taak die bij de
 * verkeerde persoon blijft hangen, wordt niet gefactureerd.
 *
 * De regels draaien server-side, in een trigger op elke taakschrijving. Dat is
 * niet de snelste plek maar wel de enige juiste: een taak verandert ook van
 * status vanuit het bord van een collega, vanuit de overlegfunctie en straks
 * vanuit een import. Een regel die alleen in deze browser draait, geldt niet.
 *
 * Deze module is bewust puur — geen Firebase, geen datum van vandaag behalve de
 * meegegeven `now`. Zo is elke regel in een test na te rekenen zonder emulator,
 * en dat is nodig: dit is de enige code die ongevraagd andermans taken aanpast.
 */

/** Statussen heten "ready to invoice", niet "Ready To Invoice". */
const norm = (value) => (value ?? '').toString().trim().toLowerCase()

const unique = (values) => [...new Set(values.filter((v) => v !== null && v !== undefined && v !== ''))]

export const TRIGGER_KINDS = ['status', 'created']
export const ACTION_KINDS = ['assignees', 'priority', 'tag', 'dueInDays']

/** Firestore Timestamp | Date | string → milliseconden, of null. */
function millis(value) {
  if (!value) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

/**
 * Vuurt deze regel op deze wijziging?
 *
 * `before` is null bij een nieuwe taak. Een statusregel vuurt op het moment dat
 * een taak de status binnenkomt, niet zolang ze er staat: anders zet hij een
 * toewijzing die iemand daarna bewust veranderde bij de eerste volgende
 * schrijving weer terug.
 */
export function ruleFires(rule, { task, before = null }) {
  if (!rule || rule.enabled === false) return false
  if (rule.listId && rule.listId !== task.listId) return false
  // Regels gaan over events, niet over de taken eronder. Zonder deze grens
  // kreeg elke taak uit een template bij een nieuwe aanvraag de toewijzing en
  // de deadline van de aanvraagregel, en verdween wat het template instelde.
  if (task.parentId) return false

  const trigger = rule.trigger ?? {}
  const nieuw = !before

  if (trigger.kind === 'created') return nieuw

  if (trigger.kind === 'status') {
    const doel = norm(trigger.status)
    if (!doel) return false
    if (norm(task.statusName) !== doel) return false
    return nieuw || norm(before.statusName) !== doel
  }

  return false
}

function applyAction(action, task, draft, now) {
  switch (action?.kind) {
    case 'assignees': {
      const ids = unique(action.profileIds ?? [])
      if (ids.length === 0) return
      draft.assignees =
        action.mode === 'add'
          ? unique([...(draft.assignees ?? task.assignees ?? []), ...ids])
          : ids
      return
    }

    case 'priority': {
      const value = action.value === null || action.value === '' ? null : Number(action.value)
      draft.priority = Number.isFinite(value) ? value : null
      return
    }

    case 'tag': {
      const naam = (action.value ?? '').toString().trim()
      if (!naam) return
      draft.tags = unique([...(draft.tags ?? task.tags ?? []), naam])
      return
    }

    case 'dueInDays': {
      const dagen = Number(action.value)
      if (!Number.isFinite(dagen)) return
      const datum = new Date(millis(now) ?? Date.now())
      datum.setDate(datum.getDate() + dagen)
      // Eind van de werkdag: een vervaldag zonder uur leest als middernacht en
      // staat dan in Mijn werk al over tijd op de dag zelf.
      datum.setHours(17, 0, 0, 0)
      draft.dueDate = datum
      return
    }

    default:
      return
  }
}

/** Twee waarden die in Firestore hetzelfde betekenen. */
function same(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = a ?? []
    const right = b ?? []
    if (left.length !== right.length) return false
    const rest = [...right]
    return left.every((v) => {
      const i = rest.indexOf(v)
      if (i === -1) return false
      rest.splice(i, 1)
      return true
    })
  }
  if (b instanceof Date || millis(b) !== null) {
    const links = millis(a)
    const rechts = millis(b)
    if (links !== null || rechts !== null) return links === rechts
  }
  if (a === null || a === undefined) return b === null || b === undefined
  return a === b
}

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0)

/**
 * Wat de regels van deze wijziging maken.
 *
 * Geeft alleen terug wat echt verandert. Dat is niet alleen zuinig: de trigger
 * die dit oproept schrijft zijn eigen resultaat weg en wordt daardoor opnieuw
 * wakker. Een lege patch is wat die tweede ronde laat stoppen.
 */
export function planFor({ rules = [], task, before = null, now = new Date() }) {
  const draft = {}
  const fired = []

  for (const rule of [...rules].sort(byPosition)) {
    if (!ruleFires(rule, { task, before })) continue
    for (const action of rule.actions ?? []) applyAction(action, task, draft, now)
    fired.push(rule.id)
  }

  const patch = {}
  for (const [key, value] of Object.entries(draft)) {
    if (!same(task[key], value)) patch[key] = value
  }

  return { patch, fired }
}
