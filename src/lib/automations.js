import { PRIORITIES } from './format'

/**
 * De woordenschat van de business rules: wat je in Instellingen kunt kiezen.
 *
 * Het uitvoeren zelf staat in `functions/automations.js` en draait op de
 * server. Hier staat alleen wat de interface nodig heeft — de keuzelijsten, een
 * leeg formulier en de regel in gewone taal. De soortnamen ('status',
 * 'assignees', …) zijn het contract tussen die twee bestanden; een test
 * controleert dat elke actie die je hier kunt maken daar ook echt uitgevoerd
 * wordt, want een regel die stil niets doet is erger dan geen regel.
 */

export const TRIGGERS = [
  { kind: 'status', label: 'een taak in een status komt' },
  { kind: 'created', label: 'een taak wordt aangemaakt' },
]

export const ACTIONS = [
  { kind: 'assignees', label: 'Toewijzen' },
  { kind: 'priority', label: 'Prioriteit zetten' },
  { kind: 'tag', label: 'Label toevoegen' },
  { kind: 'dueInDays', label: 'Vervaldag zetten' },
]

export const ASSIGNEE_MODES = [
  { mode: 'set', label: 'wordt de enige toegewezene' },
  { mode: 'add', label: 'komt erbij' },
]

export const emptyRule = () => ({
  name: '',
  enabled: true,
  listId: null,
  trigger: { kind: 'status', status: '' },
  actions: [],
})

export function emptyAction(kind) {
  switch (kind) {
    case 'assignees':
      return { kind, mode: 'set', profileIds: [] }
    case 'priority':
      return { kind, value: 1 }
    case 'tag':
      return { kind, value: '' }
    case 'dueInDays':
      return { kind, value: 7 }
    default:
      return { kind }
  }
}

const namen = (ids, profileById) =>
  (ids ?? [])
    .map((id) => profileById?.[id]?.fullName ?? profileById?.[id]?.email ?? 'iemand')
    .join(', ')

/** Eén actie in gewone taal, zodat je niet hoeft te raden wat een regel doet. */
export function describeAction(action, { profileById } = {}) {
  switch (action?.kind) {
    case 'assignees': {
      const wie = namen(action.profileIds, profileById) || 'niemand'
      return action.mode === 'add'
        ? `${wie} komt erbij als toegewezene`
        : `${wie} wordt de enige toegewezene`
    }
    case 'priority': {
      const p = PRIORITIES.find((x) => x.value === Number(action.value))
      return p ? `prioriteit wordt ${p.label.toLowerCase()}` : 'prioriteit wordt leeggemaakt'
    }
    case 'tag':
      return action.value ? `het label "${action.value}" komt erbij` : 'er komt een label bij'
    case 'dueInDays': {
      const n = Number(action.value)
      if (!Number.isFinite(n)) return 'de vervaldag wordt gezet'
      if (n === 0) return 'de vervaldag wordt vandaag'
      return `de vervaldag wordt ${n} ${Math.abs(n) === 1 ? 'dag' : 'dagen'} later`
    }
    default:
      return 'er gebeurt niets'
  }
}

/** De hele regel in één zin, voor onder het formulier. */
export function describeRule(rule, { profileById, listById } = {}) {
  const waar = rule.listId ? (listById?.[rule.listId]?.name ?? 'een lijst') : 'een willekeurige lijst'
  const wanneer =
    rule.trigger?.kind === 'created'
      ? `Komt er een taak op ${waar} bij`
      : `Komt een taak op ${waar} in ${rule.trigger?.status ? `"${rule.trigger.status}"` : 'een status'}`

  const gevolgen = (rule.actions ?? []).map((a) => describeAction(a, { profileById }))
  if (gevolgen.length === 0) return `${wanneer}, dan gebeurt er nog niets — voeg een actie toe.`

  return `${wanneer}, dan ${gevolgen.join(' en ')}.`
}

/**
 * Waar deze regel stil op zou stuklopen.
 *
 * Een regel hangt aan de náám van een status, niet aan zijn id — dezelfde naam
 * op twee borden betekent hier hetzelfde. De prijs daarvan is dat een kolom
 * hernoemen de regel losmaakt, en dat zie je nergens gebeuren. Dus staat het
 * hier, naast de regel.
 */
export function ruleWarnings(rule, { lists = [] } = {}) {
  const uit = []
  const relevant = rule.listId ? lists.filter((l) => l.id === rule.listId) : lists
  const bestaat = relevant.some((l) =>
    (l.statuses ?? []).some(
      (s) => (s.name ?? '').trim().toLowerCase() === (rule.trigger?.status ?? '').trim().toLowerCase()
    )
  )

  if (rule.trigger?.kind === 'status' && !rule.trigger?.status) uit.push('Kies een status.')
  else if (rule.trigger?.kind === 'status' && !bestaat) {
    uit.push(
      rule.listId
        ? 'Deze status staat niet op die lijst — de regel vuurt nooit.'
        : 'Geen enkele lijst heeft deze status — de regel vuurt nooit.'
    )
  }

  if ((rule.actions ?? []).length === 0) uit.push('Zonder actie doet de regel niets.')

  ;(rule.actions ?? []).forEach((a) => {
    if (a.kind === 'assignees' && (a.profileIds ?? []).length === 0) uit.push('Kies wie de taak krijgt.')
    if (a.kind === 'tag' && !(a.value ?? '').trim()) uit.push('Kies een label.')
  })

  return uit
}
