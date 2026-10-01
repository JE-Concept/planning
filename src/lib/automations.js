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
import { STANDAARDTAAL, vertaal } from './i18n'

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

/**
 * De woordenschat van de regels in twee talen.
 *
 * De namen in `functions/rule-schema.js` blijven wat ze zijn: daar hangt de
 * motor aan, en een regel die op `statusName` werkt moet op `statusName`
 * blijven werken. Wat hier staat is alleen de vertaling van wat je leest —
 * de sleutels wijzen naar `taal/instellingen.js`.
 *
 * Een onbekende sleutel geeft de sleutel zelf terug, dus valt alles wat hier
 * nog niet in staat vanzelf terug op het Nederlandse label uit het schema.
 * Zo kan een nieuw veld in het schema nooit een leeg keuzelijstje opleveren.
 */
const VELD_SLEUTELS = {
  task: {
    statusName: 'regels.veld.task.statusName',
    listId: 'regels.veld.task.listId',
    title: 'regels.veld.task.title',
    description: 'regels.veld.task.description',
    priority: 'regels.veld.task.priority',
    tags: 'regels.veld.task.tags',
    assignees: 'regels.veld.task.assignees',
    customerName: 'regels.veld.task.customerName',
    brandId: 'regels.veld.task.brandId',
    dueDate: 'regels.veld.task.dueDate',
    startDate: 'regels.veld.task.startDate',
    eventDate: 'regels.veld.task.eventDate',
    budget: 'regels.veld.task.budget',
    quoteAmount: 'regels.veld.task.quoteAmount',
    pax: 'regels.veld.task.pax',
    eventType: 'regels.veld.task.eventType',
    formule: 'regels.veld.task.formule',
    archived: 'regels.veld.task.archived',
    open: 'regels.veld.task.open',
    parentId: 'regels.veld.task.parentId',
  },
  customer: {
    name: 'regels.veld.customer.name',
    vatNumber: 'regels.veld.customer.vatNumber',
    email: 'regels.veld.customer.email',
    phone: 'regels.veld.customer.phone',
    'address.city': 'regels.veld.customer.city',
    'address.postalCode': 'regels.veld.customer.postalCode',
    brandId: 'regels.veld.customer.brandId',
    tags: 'regels.veld.customer.tags',
    notes: 'regels.veld.customer.notes',
    archived: 'regels.veld.customer.archived',
  },
  socialPost: {
    title: 'regels.veld.socialPost.title',
    status: 'regels.veld.socialPost.status',
    channels: 'regels.veld.socialPost.channels',
    assigneeId: 'regels.veld.socialPost.assigneeId',
    reviewState: 'regels.veld.socialPost.reviewState',
    reviewerId: 'regels.veld.socialPost.reviewerId',
    brandId: 'regels.veld.socialPost.brandId',
    publishAt: 'regels.veld.socialPost.publishAt',
    taskId: 'regels.veld.socialPost.taskId',
    caption: 'regels.veld.socialPost.caption',
  },
  checklistRun: {
    checklistName: 'regels.veld.checklistRun.checklistName',
    day: 'regels.veld.checklistRun.day',
    weekend: 'regels.veld.checklistRun.weekend',
    doneCount: 'regels.veld.checklistRun.doneCount',
    totalCount: 'regels.veld.checklistRun.totalCount',
    participants: 'regels.veld.checklistRun.participants',
    notes: 'regels.veld.checklistRun.notes',
    closedAt: 'regels.veld.checklistRun.closedAt',
    flagged: 'regels.veld.checklistRun.flagged',
  },
  timeEntry: {
    profileId: 'regels.veld.timeEntry.profileId',
    listId: 'regels.veld.timeEntry.listId',
    taskTitle: 'regels.veld.timeEntry.taskTitle',
    description: 'regels.veld.timeEntry.description',
    durationSeconds: 'regels.veld.timeEntry.durationSeconds',
    day: 'regels.veld.timeEntry.day',
    month: 'regels.veld.timeEntry.month',
    tags: 'regels.veld.timeEntry.tags',
  },
  profile: {
    email: 'regels.veld.profile.email',
    fullName: 'regels.veld.profile.fullName',
    role: 'regels.veld.profile.role',
    department: 'regels.veld.profile.department',
    active: 'regels.veld.profile.active',
    hourlyRate: 'regels.veld.profile.hourlyRate',
  },
}

const ACTIE_SLEUTELS = {
  task: {
    assignees: 'regels.actie.task.assignees',
    priority: 'regels.actie.task.priority',
    tag: 'regels.actie.task.tag',
    dueDate: 'regels.actie.task.dueDate',
    startDate: 'regels.actie.task.startDate',
  },
  customer: {
    brand: 'regels.actie.customer.brand',
    tag: 'regels.actie.customer.tag',
    archive: 'regels.actie.customer.archive',
  },
  socialPost: {
    assignee: 'regels.actie.socialPost.assignee',
    postStatus: 'regels.actie.socialPost.postStatus',
    review: 'regels.actie.socialPost.review',
    publishAt: 'regels.actie.socialPost.publishAt',
  },
  checklistRun: {
    flag: 'regels.actie.checklistRun.flag',
    followUp: 'regels.actie.checklistRun.followUp',
  },
  timeEntry: { tag: 'regels.actie.timeEntry.tag' },
  profile: { department: 'regels.actie.profile.department' },
}

const NOUN_SLEUTELS = { toegewezene: 'regels.noun.toegewezene', opvolger: 'regels.noun.opvolger' }

/** De vaste keuzelijstjes uit het schema, per bron en per waarde. */
const OPTIE_SLEUTELS = {
  priorities: { 1: 'regels.prio.1', 2: 'regels.prio.2', 3: 'regels.prio.3', 4: 'regels.prio.4' },
  postStatuses: {
    idea: 'social.status.idea',
    draft: 'social.status.draft',
    design: 'social.status.design',
    review: 'social.status.review',
    approved: 'social.status.approved',
    scheduled: 'social.status.scheduled',
    published: 'social.status.published',
  },
  reviewStates: {
    none: 'social.review.geen',
    requested: 'social.review.wacht',
    changes: 'social.review.aanpassing',
    approved: 'social.review.goedgekeurd',
  },
  roles: {
    owner: 'regels.rol.owner',
    admin: 'regels.rol.admin',
    member: 'regels.rol.member',
    staff: 'regels.rol.staff',
  },
}

const sleutelVan = (entity) => entityOf(entity?.key ?? entity).key

/**
 * De vertaler die bij deze aanroep hoort.
 *
 * Het scherm geeft `t` mee in de context; de tests en de server niet, en die
 * krijgen het Nederlands — de brontaal. Zo hoeft er geen aanroep aangepast te
 * worden om een zin te kunnen lezen.
 */
export const vertalerVan = (context = {}) =>
  context?.t ?? ((sleutel, waarden) => vertaal(STANDAARDTAAL, sleutel, waarden))

/**
 * Het label van een entiteit, een veld, een actie of een vergelijking.
 *
 * Staat de sleutel niet in de catalogus, dan geeft `t` de sleutel zelf terug;
 * dan valt het label uit het schema in — Nederlands, maar leesbaar.
 */
const metTerugval = (t, sleutel, terugval) => {
  const tekst = t(sleutel)
  return tekst === sleutel ? terugval : tekst
}

export const entiteitLabel = (t, entity) => {
  const ent = entityOf(entity?.key ?? entity)
  return metTerugval(t, `regels.ent.${ent.key}`, ent.label)
}

export const entiteitArtikel = (t, entity) => {
  const ent = entityOf(entity?.key ?? entity)
  return metTerugval(t, `regels.art.${ent.key}`, ent.article)
}

export const veldLabel = (t, entity, veld) =>
  veld ? t(VELD_SLEUTELS[sleutelVan(entity)]?.[veld.key] ?? veld.label) : ''

export const actieLabel = (t, entity, actie) =>
  actie ? t(ACTIE_SLEUTELS[sleutelVan(entity)]?.[actie.kind] ?? actie.label) : ''

export const operatorLabel = (t, op) => {
  const meta = typeof op === 'string' ? operatorMeta(op) : op
  return meta ? t(`regels.op.${meta.op}`) : ''
}

/** Wat een regel wakker maakt. De labels lenen het lidwoord van de entiteit. */
export function triggersFor(entity, context = {}) {
  const t = vertalerVan(context)
  const wat = entiteitArtikel(t, entity)
  return [
    { kind: 'changed', label: t('regels.trigger.changed', { wat }) },
    { kind: 'created', label: t('regels.trigger.created', { wat }) },
  ]
}

export const actionsFor = (entity) => entityOf(entity?.key ?? entity).actions
export const fieldsFor = (entity) => entityOf(entity?.key ?? entity).fields

export const ASSIGNEE_MODES = [
  { mode: 'set', sleutel: 'regels.modus.set' },
  { mode: 'add', sleutel: 'regels.modus.add' },
]

export const GROUP_KINDS = [
  { kind: 'all', sleutel: 'regels.groep.all' },
  { kind: 'any', sleutel: 'regels.groep.any' },
  { kind: 'none', sleutel: 'regels.groep.none' },
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

  if (OPTION_SOURCES[source]) {
    // De vaste lijstjes komen uit het schema en horen vertaald; de namen die
    // uit de werkruimte komen zijn gegevens en blijven staan zoals ze heten.
    const t = vertalerVan(context)
    return OPTION_SOURCES[source].map((o) => ({
      value: o.value,
      label: t(OPTIE_SLEUTELS[source]?.[o.value] ?? o.label),
    }))
  }

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
export function describeDate(value, context = {}) {
  const t = vertalerVan(context)
  if (value === null || value === undefined || value === '') return t('regels.zin.datum')
  if (typeof value === 'number' || typeof value === 'string' || value.mode === 'relative') {
    const dagen = Number(typeof value === 'object' ? value.days : value)
    if (!Number.isFinite(dagen)) return t('regels.zin.datum')
    if (dagen === 0) return t('regels.zin.vandaag')
    return dagen > 0
      ? t('regels.zin.over', { aantal: dagen })
      : t('regels.zin.geleden', { aantal: Math.abs(dagen) })
  }
  const datum = resolveDate(value)
  return datum ? t('regels.zin.op_datum', { datum: formatDate(datum) }) : t('regels.zin.datum')
}

/** Eén voorwaarde in gewone taal. */
export function describeCondition(cond, entity, context = {}) {
  const t = vertalerVan(context)
  const ent = entityOf(entity?.key ?? entity)
  const veld = fieldOf(ent, cond?.field)
  if (!veld) return t('regels.zin.veld_weg')

  const naam = veldLabel(t, ent, veld)
  const op = operatorMeta(cond.op)
  if (!op) return t('regels.zin.op_weg', { veld: naam })
  if (!op.value) return t('regels.zin.voorwaarde_kaal', { veld: naam, vergelijking: operatorLabel(t, op) })

  const waarde =
    veld.type === 'date' ? describeDate(cond.value, context) : labelVan(veld.options, cond.value, context)

  return waarde === ''
    ? `${t('regels.zin.voorwaarde_kaal', { veld: naam, vergelijking: operatorLabel(t, op) })} …`
    : t('regels.zin.voorwaarde', { veld: naam, vergelijking: operatorLabel(t, op), waarde })
}

const VOEGWOORD = { all: 'regels.zin.en', any: 'regels.zin.of', none: 'regels.zin.of' }

/** Een boom van voorwaarden als één zin. */
export function describeNode(node, entity, context = {}, depth = 0) {
  if (!node) return ''
  if (depth > MAX_DEPTH) return '…'

  const t = vertalerVan(context)

  if (node.kind === 'all' || node.kind === 'any' || node.kind === 'none') {
    const delen = (node.nodes ?? [])
      .map((n) => describeNode(n, entity, context, depth + 1))
      .filter(Boolean)
    if (delen.length === 0) return ''
    const zin = delen.length === 1 ? delen[0] : `(${delen.join(t(VOEGWOORD[node.kind]))})`
    return node.kind === 'none' ? t('regels.zin.niet', { zin }) : zin
  }

  return describeCondition(node, entity, context)
}

const namen = (ids, context) =>
  (ids ?? []).map((id) => labelVan('profiles', id, context)).join(', ')

/** Eén actie in gewone taal, zodat je niet hoeft te raden wat een regel doet. */
export function describeAction(action, entity, context = {}) {
  const t = vertalerVan(context)
  const ent = entityOf(entity?.key ?? entity)
  const desc = actionOf(ent, action?.kind)
  if (!desc) return t('regels.zin.niets')

  // De handeling staat midden in een zin, dus zonder hoofdletter.
  const handeling = actieLabel(t, ent, desc).toLowerCase()

  switch (desc.apply) {
    case 'people': {
      const wie = namen(action.profileIds, context) || t('regels.zin.niemand')
      const rol = t(NOUN_SLEUTELS[desc.noun ?? 'toegewezene'] ?? desc.noun ?? 'toegewezene')
      return action.mode === 'add'
        ? t('regels.zin.komt_erbij', { wie, rol })
        : t('regels.zin.wordt_enige', { wie, rol })
    }
    case 'listAdd': {
      const naam = (action.value ?? '').toString().trim()
      if (!naam) return t('regels.zin.label_leeg')
      return action.date
        ? t('regels.zin.label_datum', { naam, datum: describeDate(action.date, context) })
        : t('regels.zin.label', { naam })
    }
    case 'date':
      return t('regels.zin.actie_datum', {
        handeling,
        datum: describeDate(action.date ?? action.value, context),
      })
    default: {
      if (desc.type === 'boolean') {
        const waarde = action.value === true || action.value === 'true' ? t('regels.ja') : t('regels.nee')
        return t('regels.zin.actie_ja_nee', { handeling, waarde })
      }
      const waarde = labelVan(desc.options, action.value, context)
      return waarde
        ? t('regels.zin.actie_ja_nee', { handeling, waarde })
        : t('regels.zin.actie_leeg', { handeling })
    }
  }
}

/** De hele regel in één zin, voor onder het formulier. */
export function describeRule(rule, context = {}) {
  const t = vertalerVan(context)
  const ent = entityOf(rule?.entity)
  const genormaliseerd = toEditable(rule)
  const waar = rule?.listId ? t('regels.zin.op_lijst', { lijst: labelVan('lists', rule.listId, context) }) : ''
  const wat = entiteitArtikel(t, ent)

  const veld = fieldOf(ent, genormaliseerd.trigger.field)
  const wanneer =
    genormaliseerd.trigger.kind === 'created'
      ? t('regels.zin.komt_bij', { wat, waar })
      : veld
        ? t('regels.zin.wijzigt', { veld: veldLabel(t, ent, veld).toLowerCase(), wat, waar })
        : t('regels.zin.wijzigt_kaal', { wat, waar })

  // De omgezette vorm, niet de rauwe: een regel uit de oude vorm heeft geen
  // `when`, maar wel een status die als voorwaarde gelezen hoort te worden.
  const voorwaarde = describeNode(genormaliseerd.when, ent, context)
  const kop = voorwaarde ? t('regels.zin.met_voorwaarde', { wanneer, voorwaarde }) : wanneer

  if (rule?.kind === 'table') {
    return t('regels.zin.tabel', { kop, aantal: (rule.rows ?? []).length })
  }

  const gevolgen = (rule?.actions ?? []).map((a) => describeAction(a, ent, context))
  if (gevolgen.length === 0) return t('regels.zin.zonder_actie', { kop })

  return t('regels.zin.dan', { kop, gevolgen: gevolgen.join(t('regels.zin.en')) })
}

// ─── Waarschuwingen ─────────────────────────────────────────────────────────

function actieWaarschuwingen(entity, actions, waar, uit, t) {
  if ((actions ?? []).length === 0) uit.push(t('regels.waarschuwing.zonder_actie', { waar }))

  ;(actions ?? []).forEach((a) => {
    const desc = actionOf(entity, a.kind)
    if (!desc) {
      uit.push(
        t('regels.waarschuwing.actie_weg', {
          actie: a.kind,
          entiteit: entiteitLabel(t, entity).toLowerCase(),
        })
      )
      return
    }
    if (desc.apply === 'people' && (a.profileIds ?? []).length === 0) uit.push(t('regels.waarschuwing.kies_wie'))
    if (desc.apply === 'listAdd' && !(a.value ?? '').toString().trim()) uit.push(t('regels.waarschuwing.kies_label'))
    if (desc.apply === 'date' && !resolveDate(a.date ?? a.value)) uit.push(t('regels.waarschuwing.kies_datum'))
    if (desc.apply === 'value' && desc.type !== 'boolean' && !desc.nullable && !a.value) {
      uit.push(t('regels.waarschuwing.vul_in', { wat: actieLabel(t, entity, desc) }))
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
export function ruleWarnings(rule, { lists = [], t: vertaler } = {}) {
  const uit = []
  if (!rule) return uit

  const t = vertalerVan({ t: vertaler })
  const ent = entityOf(rule.entity)
  const genormaliseerd = toEditable(rule)

  if (genormaliseerd.trigger.kind === 'changed' && !fieldOf(ent, genormaliseerd.trigger.field)) {
    uit.push(t('regels.waarschuwing.kies_veld'))
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
      if (node.nodes.length === 0 && depth > 0) uit.push(t('regels.waarschuwing.lege_groep'))
      node.nodes.forEach((n) => loopNa(n, depth + 1))
      return
    }
    const veld = fieldOf(ent, node.field)
    if (!veld) {
      uit.push(t('regels.waarschuwing.veld_weg'))
      return
    }
    const op = operatorMeta(node.op)
    if (!op || !op.types.includes(veld.type)) {
      uit.push(t('regels.waarschuwing.vergelijking_kan_niet', { veld: veldLabel(t, ent, veld) }))
      return
    }
    if (op.value && (node.value === '' || node.value === null || node.value === undefined)) {
      uit.push(t('regels.waarschuwing.vul_waarde', { veld: veldLabel(t, ent, veld) }))
      return
    }
    if (veld.key === 'statusName' && op.op === 'is' && statussen.size > 0) {
      if (!statussen.has((node.value ?? '').toString().trim().toLowerCase())) {
        uit.push(
          t(rule.listId ? 'regels.waarschuwing.status_lijst' : 'regels.waarschuwing.status_nergens')
        )
      }
    }
  }

  loopNa(genormaliseerd.when)

  if (rule.kind === 'table') {
    if ((rule.inputs ?? []).filter((i) => i?.field).length === 0) uit.push(t('regels.waarschuwing.tabel_kolom'))
    if ((rule.rows ?? []).length === 0) uit.push(t('regels.waarschuwing.tabel_rijen'))
    ;(rule.rows ?? []).forEach((row, i) => {
      actieWaarschuwingen(ent, row.actions, t('regels.waarschuwing.rij', { nummer: i + 1 }), uit, t)
    })
  } else {
    actieWaarschuwingen(ent, rule.actions, t('regels.waarschuwing.de_regel'), uit, t)
  }

  return [...new Set(uit)]
}
