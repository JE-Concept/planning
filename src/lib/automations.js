/**
 * De woordenschat van de business rules: wat je in Instellingen kunt kiezen.
 *
 * Het uitvoeren zelf staat in `functions/automations.js` en draait op de
 * server; wát er bestaat — entiteiten, velden, operatoren, acties — staat in
 * `functions/rule-schema.js`. Dat is één bestand, met opzet: er stonden hier
 * keuzelijsten die de motor niet kende en in de motor takken die hier niet te
 * kiezen waren, en een regel die stil niets doet is erger dan geen regel.
 *
 * Dit bestand wijst dus naar `functions/`. Dat is de enige plek in `src/` die
 * dat doet, en het is de goede richting: alleen `functions/` wordt mee
 * uitgerold naar de server, dus de beschrijving moet daar staan. Wat hier nog
 * bij komt is puur interface: lege formulieren, en de regel in gewone taal.
 */

import {
  ENTITIES,
  MAX_DEPTH,
  OPERATORS,
  actionOf,
  entityOf,
  fieldOf,
  operatorsFor,
  operatorMeta,
  resolveDate,
  relativeDate,
  fixedDate,
  OPTION_SOURCES,
} from '../../functions/rule-schema.js'
import { formatDate } from './dates'

export {
  ENTITIES,
  MAX_DEPTH,
  OPERATORS,
  actionOf,
  entityOf,
  fieldOf,
  operatorsFor,
  operatorMeta,
  relativeDate,
  fixedDate,
  OPTION_SOURCES,
}

/** Wat een regel wakker maakt. De labels lenen het lidwoord van de entiteit. */
export function triggersFor(entity) {
  const ent = entityOf(entity?.key ?? entity)
  return [
    { kind: 'changed', label: `er iets wijzigt aan ${ent.article}` },
    { kind: 'created', label: `${ent.article} wordt aangemaakt` },
  ]
}

export const actionsFor = (entity) => entityOf(entity?.key ?? entity).actions
export const fieldsFor = (entity) => entityOf(entity?.key ?? entity).fields

export const ASSIGNEE_MODES = [
  { mode: 'set', label: 'wordt de enige' },
  { mode: 'add', label: 'komt erbij' },
]

export const GROUP_KINDS = [
  { kind: 'all', label: 'alles hieronder klopt' },
  { kind: 'any', label: 'één van deze klopt' },
  { kind: 'none', label: 'geen van deze klopt' },
]

// ─── Lege formulieren ───────────────────────────────────────────────────────

export const emptyGroup = (kind = 'all') => ({ kind, nodes: [] })

export function emptyCondition(entity) {
  const veld = fieldsFor(entity)[0]
  return {
    kind: 'condition',
    field: veld?.key ?? '',
    op: operatorsFor(veld?.type ?? 'text')[0]?.op ?? 'is',
    value: '',
  }
}

export const emptyRule = (entityKey = 'task') => ({
  kind: 'rule',
  entity: entityKey,
  name: '',
  enabled: true,
  listId: null,
  trigger: { kind: 'changed', field: fieldsFor(entityKey)[0]?.key ?? 'statusName' },
  when: emptyGroup('all'),
  actions: [],
})

/**
 * Een verse beslissingstabel: één kolom, twee rijen.
 *
 * Twee, niet één. Een tabel met één rij is een als-dan-regel met extra stappen;
 * met twee staat er meteen wat een tabel is — van boven naar beneden gelezen
 * tot er een rij past.
 */
export function emptyTable(entityKey = 'task') {
  const veld = fieldsFor(entityKey)[0]
  return {
    kind: 'table',
    entity: entityKey,
    name: '',
    enabled: true,
    listId: null,
    trigger: { kind: 'changed', field: veld?.key ?? 'statusName' },
    when: emptyGroup('all'),
    inputs: [{ field: veld?.key ?? '', op: operatorsFor(veld?.type ?? 'text')[0]?.op ?? 'is' }],
    rows: [emptyRow(1), emptyRow(2)],
  }
}

export const emptyRow = (nummer = 1) => ({
  id: `rij-${nummer}-${Math.random().toString(36).slice(2, 7)}`,
  label: '',
  cells: [],
  actions: [],
})

/**
 * Een regel uit de database → de vorm waarmee het scherm werkt.
 *
 * De bestaande regels staan er in de oude, enkelvoudige vorm in: hun aanleiding
 * heet `{ kind: 'status', status: 'ready to invoice' }` en verder is er niets.
 * Die worden hier gelezen als wat ze betekenen — "de status wijzigde, en hij is
 * nu ready to invoice" — zonder dat er aan de database iets verandert. Pas
 * wanneer iemand zo'n regel bewerkt en bewaart, staat de nieuwe vorm erin. Zo
 * kan er geen regel stilvallen omdat een migratie nog moest lopen.
 */
export function toEditable(rule) {
  if (!rule) return rule
  const trigger = rule.trigger ?? {}
  const tabel = rule.kind === 'table'

  let aanleiding = { kind: 'changed', field: trigger.field ?? 'statusName' }
  let when = rule.when ?? emptyGroup('all')

  if (trigger.kind === 'created') {
    aanleiding = { kind: 'created', field: null }
  } else if (trigger.kind === 'status') {
    aanleiding = { kind: 'changed', field: 'statusName' }
    if (trigger.status && !rule.when) {
      when = {
        kind: 'all',
        nodes: [{ kind: 'condition', field: 'statusName', op: 'is', value: trigger.status }],
      }
    }
  }

  return {
    ...rule,
    kind: tabel ? 'table' : 'rule',
    entity: rule.entity ?? 'task',
    trigger: aanleiding,
    when,
    actions: tabel ? [] : (rule.actions ?? []),
    inputs: tabel ? (rule.inputs ?? []) : [],
    rows: tabel ? (rule.rows ?? []) : [],
  }
}

export function emptyAction(entity, kind) {
  const desc = actionOf(entityOf(entity?.key ?? entity), kind)
  if (!desc) return { kind }
  switch (desc.apply) {
    case 'people':
      return { kind: desc.kind, mode: 'set', profileIds: [] }
    case 'listAdd':
      return { kind: desc.kind, value: '', date: null }
    case 'date':
      return { kind: desc.kind, date: relativeDate(7) }
    default:
      return { kind: desc.kind, value: desc.type === 'boolean' ? true : '' }
  }
}

// ─── Keuzelijsten ───────────────────────────────────────────────────────────

/**
 * De keuzes achter een `options`-verwijzing uit de beschrijving.
 *
 * De werkruimte levert de mensen, lijsten, labels en merken; de vaste lijstjes
 * (prioriteit, poststatus, review, rol) staan bij de beschrijving zelf. Zonder
 * dit moet je in het scherm een id intypen, en dan schrijft niemand een regel.
 */
export function optionsFor(source, context = {}) {
  if (!source) return null
  if (OPTION_SOURCES[source]) return OPTION_SOURCES[source]

  const { profiles = [], lists = [], tags = [], brands = [] } = context

  switch (source) {
    case 'profiles':
      return profiles.map((p) => ({ value: p.id, label: p.fullName ?? p.email ?? p.id }))
    case 'lists':
      return lists.map((l) => ({ value: l.id, label: l.name }))
    case 'tags':
      return tags.map((t) => ({ value: t.name, label: t.name }))
    case 'brands':
      return brands.map((b) => ({ value: b.id, label: b.name }))
    case 'statuses':
      return [...new Set(lists.flatMap((l) => (l.statuses ?? []).map((s) => s.name)))].map((naam) => ({
        value: naam,
        label: naam,
      }))
    default:
      return null
  }
}

const labelVan = (source, value, context) => {
  const opties = optionsFor(source, context)
  if (!opties) return value ?? ''
  const gevonden = opties.find((o) => `${o.value}` === `${value}`)
  return gevonden?.label ?? value ?? ''
}

// ─── In gewone taal ─────────────────────────────────────────────────────────

/** "over 3 dagen", "op 5 oktober 2026" — zoals je het zou uitspreken. */
export function describeDate(value) {
  if (value === null || value === undefined || value === '') return 'een datum'
  if (typeof value === 'number' || typeof value === 'string' || value.mode === 'relative') {
    const dagen = Number(typeof value === 'object' ? value.days : value)
    if (!Number.isFinite(dagen)) return 'een datum'
    if (dagen === 0) return 'vandaag'
    const woord = Math.abs(dagen) === 1 ? 'dag' : 'dagen'
    return dagen > 0 ? `over ${dagen} ${woord}` : `${Math.abs(dagen)} ${woord} geleden`
  }
  const datum = resolveDate(value)
  return datum ? `op ${formatDate(datum)}` : 'een datum'
}

/** Eén voorwaarde in gewone taal. */
export function describeCondition(cond, entity, context = {}) {
  const veld = fieldOf(entityOf(entity?.key ?? entity), cond?.field)
  if (!veld) return 'een veld dat niet bestaat'

  const op = operatorMeta(cond.op)
  if (!op) return `${veld.label} — onbekende vergelijking`
  if (!op.value) return `${veld.label} ${op.label}`

  const waarde =
    veld.type === 'date' ? describeDate(cond.value) : labelVan(veld.options, cond.value, context)

  return `${veld.label} ${op.label} ${waarde === '' ? '…' : `“${waarde}”`}`
}

const VOEGWOORD = { all: ' en ', any: ' of ', none: ' of ' }

/** Een boom van voorwaarden als één zin. */
export function describeNode(node, entity, context = {}, depth = 0) {
  if (!node) return ''
  if (depth > MAX_DEPTH) return '…'

  if (node.kind === 'all' || node.kind === 'any' || node.kind === 'none') {
    const delen = (node.nodes ?? [])
      .map((n) => describeNode(n, entity, context, depth + 1))
      .filter(Boolean)
    if (delen.length === 0) return ''
    const zin = delen.length === 1 ? delen[0] : `(${delen.join(VOEGWOORD[node.kind])})`
    return node.kind === 'none' ? `niet ${zin}` : zin
  }

  return describeCondition(node, entity, context)
}

const namen = (ids, context) =>
  (ids ?? []).map((id) => labelVan('profiles', id, context)).join(', ')

/** Eén actie in gewone taal, zodat je niet hoeft te raden wat een regel doet. */
export function describeAction(action, entity, context = {}) {
  const ent = entityOf(entity?.key ?? entity)
  const desc = actionOf(ent, action?.kind)
  if (!desc) return 'er gebeurt niets'

  switch (desc.apply) {
    case 'people': {
      const wie = namen(action.profileIds, context) || 'niemand'
      const rol = desc.noun ?? 'toegewezene'
      return action.mode === 'add' ? `${wie} komt erbij als ${rol}` : `${wie} wordt de enige ${rol}`
    }
    case 'listAdd': {
      const naam = (action.value ?? '').toString().trim()
      const datum = action.date ? ` met ${describeDate(action.date)} erbij` : ''
      return naam ? `het label “${naam}” komt erbij${datum}` : 'er komt een label bij'
    }
    case 'date':
      return `${desc.label.toLowerCase()} — ${describeDate(action.date ?? action.value)}`
    default: {
      if (desc.type === 'boolean') {
        return `${desc.label.toLowerCase()}: ${action.value === true || action.value === 'true' ? 'ja' : 'nee'}`
      }
      const waarde = labelVan(desc.options, action.value, context)
      return waarde ? `${desc.label.toLowerCase()}: ${waarde}` : `${desc.label.toLowerCase()} wordt leeggemaakt`
    }
  }
}

/** De hele regel in één zin, voor onder het formulier. */
export function describeRule(rule, context = {}) {
  const ent = entityOf(rule?.entity)
  const genormaliseerd = toEditable(rule)
  const waar = rule?.listId ? ` op ${labelVan('lists', rule.listId, context)}` : ''

  const veldLabel = fieldOf(ent, genormaliseerd.trigger.field)?.label
  const wanneer =
    genormaliseerd.trigger.kind === 'created'
      ? `Komt er ${ent.article}${waar} bij`
      : `Wijzigt ${veldLabel ? `${veldLabel.toLowerCase()} van` : ''} ${ent.article}${waar}`

  // De omgezette vorm, niet de rauwe: een regel uit de oude vorm heeft geen
  // `when`, maar wel een status die als voorwaarde gelezen hoort te worden.
  const voorwaarde = describeNode(genormaliseerd.when, ent, context)
  const kop = voorwaarde ? `${wanneer}, en ${voorwaarde}` : wanneer

  if (rule?.kind === 'table') {
    const rijen = (rule.rows ?? []).length
    return `${kop}, dan wordt de tabel van boven naar beneden gelezen — ${rijen} ${
      rijen === 1 ? 'rij' : 'rijen'
    }, de eerste die past wint.`
  }

  const gevolgen = (rule?.actions ?? []).map((a) => describeAction(a, ent, context))
  if (gevolgen.length === 0) return `${kop}, dan gebeurt er nog niets — voeg een actie toe.`

  return `${kop}, dan ${gevolgen.join(' en ')}.`
}

// ─── Waarschuwingen ─────────────────────────────────────────────────────────

function actieWaarschuwingen(entity, actions, waar, uit) {
  if ((actions ?? []).length === 0) uit.push(`Zonder actie doet ${waar} niets.`)

  ;(actions ?? []).forEach((a) => {
    const desc = actionOf(entity, a.kind)
    if (!desc) {
      uit.push(`De actie “${a.kind}” bestaat niet op ${entity.label.toLowerCase()} — ze wordt overgeslagen.`)
      return
    }
    if (desc.apply === 'people' && (a.profileIds ?? []).length === 0) uit.push('Kies wie.')
    if (desc.apply === 'listAdd' && !(a.value ?? '').toString().trim()) uit.push('Kies een label.')
    if (desc.apply === 'date' && !resolveDate(a.date ?? a.value)) uit.push('Kies een datum.')
    if (desc.apply === 'value' && desc.type !== 'boolean' && !desc.nullable && !a.value) {
      uit.push(`Vul “${desc.label}” in.`)
    }
  })
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
  if (!rule) return uit

  const ent = entityOf(rule.entity)
  const genormaliseerd = toEditable(rule)

  if (genormaliseerd.trigger.kind === 'changed' && !fieldOf(ent, genormaliseerd.trigger.field)) {
    uit.push('Kies het veld dat de regel wakker maakt.')
  }

  // Statusnamen bestaan alleen zolang de kolom bestaat; dat is de enige
  // voorwaarde die stil kan verouderen zonder dat iemand het merkt.
  const statussen = new Set(
    (rule.listId ? lists.filter((l) => l.id === rule.listId) : lists).flatMap((l) =>
      (l.statuses ?? []).map((s) => (s.name ?? '').trim().toLowerCase())
    )
  )

  const loopNa = (node, depth = 0) => {
    if (!node || depth > MAX_DEPTH) return
    if (node.nodes) {
      // De buitenste groep mag leeg zijn: dan vuurt de regel op haar aanleiding
      // alleen, en dat staat er ook zo. Een lege groep dieper in de boom is wél
      // een vergissing — die is aangeklikt en nooit ingevuld.
      if (node.nodes.length === 0 && depth > 0) uit.push('Een lege groep voorwaarden telt niet mee.')
      node.nodes.forEach((n) => loopNa(n, depth + 1))
      return
    }
    const veld = fieldOf(ent, node.field)
    if (!veld) {
      uit.push('Een voorwaarde staat op een veld dat niet bestaat.')
      return
    }
    const op = operatorMeta(node.op)
    if (!op || !op.types.includes(veld.type)) {
      uit.push(`“${veld.label}” kan niet zo vergeleken worden.`)
      return
    }
    if (op.value && (node.value === '' || node.value === null || node.value === undefined)) {
      uit.push(`Vul een waarde in bij “${veld.label}”.`)
      return
    }
    if (veld.key === 'statusName' && op.op === 'is' && statussen.size > 0) {
      if (!statussen.has((node.value ?? '').toString().trim().toLowerCase())) {
        uit.push(
          rule.listId
            ? 'Deze status staat niet op die lijst — de regel vuurt nooit.'
            : 'Geen enkele lijst heeft deze status — de regel vuurt nooit.'
        )
      }
    }
  }

  loopNa(genormaliseerd.when)

  if (rule.kind === 'table') {
    if ((rule.inputs ?? []).filter((i) => i?.field).length === 0) uit.push('Een tabel heeft minstens één kolom nodig.')
    if ((rule.rows ?? []).length === 0) uit.push('Een tabel zonder rijen doet niets.')
    ;(rule.rows ?? []).forEach((row, i) => {
      const waar = `rij ${i + 1}`
      actieWaarschuwingen(ent, row.actions, waar, uit)
    })
  } else {
    actieWaarschuwingen(ent, rule.actions, 'de regel', uit)
  }

  return [...new Set(uit)]
}
