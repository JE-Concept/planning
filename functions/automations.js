/**
 * Business rules: wat er automatisch gebeurt, en waarmee.
 *
 * Eén voorbeeld uit de praktijk, en meteen de reden dat dit bestaat: alles wat
 * op "ready to invoice" komt is werk voor Elke, en niemand anders. Dat met de
 * hand doortrekken werkt tot iemand het vergeet — en een taak die bij de
 * verkeerde persoon blijft hangen, wordt niet gefactureerd.
 *
 * De regels draaien server-side, in een trigger op elke schrijving. Dat is niet
 * de snelste plek maar wel de enige juiste: een taak verandert ook van status
 * vanuit het bord van een collega, vanuit de overlegfunctie en straks vanuit
 * een import. Een regel die alleen in deze browser draait, geldt niet.
 *
 * ── Wat er sinds de eerste versie bij kwam ──────────────────────────────────
 *
 * 1. Alle entiteiten, niet alleen taken. Wát er bestaat staat in
 *    `rule-schema.js`; hier staat alleen hoe het uitgevoerd wordt.
 * 2. Een boom van voorwaarden (EN/OF/GEEN) in plaats van één voorwaarde.
 * 3. Beslissingstabellen, naar het voorbeeld van GoRules: de voorwaarden als
 *    kolommen, één rij per geval, van boven naar beneden gelezen tot er een rij
 *    past. Tien losse als-dan-regels die elkaar overschrijven zijn voor wie de
 *    zaak runt niet na te lezen; één tabel wel.
 *
 * De oude vorm blijft leesbaar: wat in de database staat wordt bij het lezen
 * omgezet (`normaliseRule`), niet gemigreerd. Er is geen moment waarop een
 * bestaande regel stilvalt omdat een migratie nog moest lopen.
 *
 * Deze module is bewust puur — geen Firebase, geen datum van vandaag behalve de
 * meegegeven `now`. Zo is elke regel in een test na te rekenen zonder emulator,
 * en dat is nodig: dit is de enige code die ongevraagd andermans werk aanpast.
 */

import {
  ENTITIES,
  MAX_DEPTH,
  actionOf,
  dayLabel,
  entityOf,
  fieldOf,
  millis,
  norm,
  readField,
  resolveDate,
  unique,
} from './rule-schema.js'

export {
  ENTITIES,
  ENTITY_KEYS,
  MAX_DEPTH,
  OPERATORS,
  entityByCollection,
  entityOf,
  fieldOf,
  actionOf,
  operatorsFor,
  relativeDate,
  fixedDate,
  resolveDate,
  writableFields,
} from './rule-schema.js'

/**
 * De aanleidingen. `status` staat er niet meer bij maar wordt nog gelezen: zo
 * staan de bestaande regels in de database, en die vertalen naar "de status
 * wijzigde, en hij is nu X" is precies wat ze altijd al betekenden.
 */
export const TRIGGER_KINDS = ['created', 'changed']

/** Alles wat er ooit uitgevoerd wordt, over alle entiteiten heen. */
export const ACTION_KINDS = unique(ENTITIES.flatMap((e) => e.actions.map((a) => a.kind)))

/**
 * Het veld waarmee de motor haar eigen schrijfbeurt ondertekent.
 *
 * Zie `isRuleEcho`: dit is de helft van de lusbeveiliging.
 */
export const RULE_STAMP = 'ruleStamp'

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ De oude vorm lezen                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const conditie = (field, op, value = null) => ({ kind: 'condition', field, op, value })

const groep = (kind, nodes) => ({ kind, nodes: nodes.filter(Boolean) })

/** Een knoop uit de database, met de rommel eruit. */
function normaliseNode(node, depth = 0) {
  if (!node || depth > MAX_DEPTH) return null

  if (node.kind === 'all' || node.kind === 'any' || node.kind === 'none') {
    const nodes = (node.nodes ?? []).map((n) => normaliseNode(n, depth + 1)).filter(Boolean)
    return nodes.length === 0 ? null : groep(node.kind, nodes)
  }

  if (!node.field || !node.op) return null
  return conditie(node.field, node.op, node.value ?? null)
}

/**
 * Een regel zoals ze in `automations` staat → de vorm waar de motor mee rekent.
 *
 * Twee generaties komen hier samen. De oude regel noemde haar aanleiding
 * `{ kind: 'status', status: 'ready to invoice' }` en haar bereik `listId`;
 * beide worden voorwaarden, want dat zijn ze. Zo hoeft de rest van dit bestand
 * maar één vorm te kennen, en hoeft er niets aan de database te gebeuren.
 */
export function normaliseRule(raw) {
  if (!raw) return null
  if (raw.__genormaliseerd) return raw

  const entity = entityOf(raw.entity)
  const trigger = raw.trigger ?? {}
  const bereik = []

  let aanleiding
  if (trigger.kind === 'created') {
    aanleiding = { kind: 'created', field: null }
  } else if (trigger.kind === 'status') {
    aanleiding = { kind: 'changed', field: 'statusName' }
    if (trigger.status) bereik.push(conditie('statusName', 'is', trigger.status))
  } else {
    aanleiding = { kind: 'changed', field: trigger.field ?? 'statusName' }
  }

  // `listId` was het bereik van de oude regel. Het beheerscherm zet het nog
  // steeds, want "alleen op dit bord" is de vraag die het vaakst gesteld wordt.
  if (raw.listId && fieldOf(entity, 'listId')) bereik.push(conditie('listId', 'is', raw.listId))

  const eigen = normaliseNode(raw.when)
  const when = bereik.length === 0 ? eigen : groep('all', [...bereik, eigen])

  const tabel = raw.kind === 'table'

  return {
    __genormaliseerd: true,
    id: raw.id ?? null,
    name: raw.name ?? '',
    kind: tabel ? 'table' : 'rule',
    entity: entity.key,
    enabled: raw.enabled !== false,
    position: raw.position ?? 0,
    trigger: aanleiding,
    when,
    actions: tabel ? [] : (raw.actions ?? []),
    inputs: tabel ? (raw.inputs ?? []).filter((i) => i?.field) : [],
    rows: tabel
      ? (raw.rows ?? []).map((row, i) => ({
          id: row.id ?? `rij-${i + 1}`,
          label: row.label ?? '',
          cells: row.cells ?? [],
          actions: row.actions ?? [],
        }))
      : [],
  }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Voorwaarden                                                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const leeg = (waarde) => {
  if (waarde === null || waarde === undefined || waarde === '') return true
  if (Array.isArray(waarde)) return waarde.length === 0
  return false
}

const alsLijst = (waarde) => (Array.isArray(waarde) ? waarde : leeg(waarde) ? [] : [waarde])

const getal = (waarde) => {
  // Een leeg veld is geen nul. Zonder deze regel valt elke taak zonder aantal
  // gasten onder "minder dan vijftig" en vuurt de regel op alles.
  if (leeg(waarde)) return null
  const n = Number(waarde)
  return Number.isFinite(n) ? n : null
}

/** 2026-10-05T17:00 → 20261005. Vergelijken op dag, niet op uur. */
function dagNummer(waarde) {
  const ms = millis(waarde)
  if (ms === null) return null
  const d = new Date(ms)
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

/**
 * Eén voorwaarde tegen één document.
 *
 * Tekst wordt vergeleken zonder op hoofdletters en spaties te letten — dezelfde
 * afspraak als bij de statusnamen, want "Ready To Invoice" en
 * "ready to invoice" zijn hier hetzelfde ding. Datums worden op de dág
 * vergeleken: een vervaldag die om 17.00 staat valt niet "na" diezelfde dag.
 */
export function evaluateCondition(cond, { doc, entity, now }) {
  if (!cond?.field || !cond?.op) return false

  const veld = fieldOf(entity, cond.field)
  // Een veld dat niet in de beschrijving staat, bestaat niet. Anders kan een
  // regel voorwaarden stellen aan velden waarvan niemand weet dat ze er zijn.
  if (!veld) return false

  const links = readField(doc, cond.field)

  switch (cond.op) {
    case 'empty':
      return leeg(links)
    case 'notEmpty':
      return !leeg(links)
    case 'isTrue':
      return links === true
    case 'isFalse':
      return links !== true
    default:
      break
  }

  if (veld.type === 'date') {
    const l = dagNummer(links)
    const r = dagNummer(resolveDate(cond.value, now))
    if (l === null || r === null) return false
    if (cond.op === 'before') return l < r
    if (cond.op === 'after') return l > r
    if (cond.op === 'is') return l === r
    if (cond.op === 'isNot') return l !== r
    return false
  }

  if (veld.type === 'number') {
    const l = getal(links)
    const r = getal(cond.value)
    if (l === null || r === null) return false
    switch (cond.op) {
      case 'is': return l === r
      case 'isNot': return l !== r
      case 'gt': return l > r
      case 'gte': return l >= r
      case 'lt': return l < r
      case 'lte': return l <= r
      default: return false
    }
  }

  if (veld.type === 'list' || veld.type === 'people') {
    const l = alsLijst(links).map(norm)
    const r = norm(cond.value)
    if (!r) return false
    if (cond.op === 'contains') return l.includes(r)
    if (cond.op === 'notContains') return !l.includes(r)
    return false
  }

  // Tekst en keuzelijst.
  const l = norm(links)
  const r = norm(cond.value)
  switch (cond.op) {
    case 'is': return l === r
    case 'isNot': return l !== r
    case 'contains': return r !== '' && l.includes(r)
    case 'notContains': return r !== '' && !l.includes(r)
    default: return false
  }
}

/**
 * Een boom van voorwaarden.
 *
 * Een lege boom is waar: een regel zonder voorwaarden vuurt op haar aanleiding
 * alleen. Dieper dan `MAX_DEPTH` wordt niet gelezen — niet omdat het rekenwerk
 * duur is, maar omdat een regel die niemand meer kan nalezen geen regel is.
 */
export function evaluateNode(node, ctx, depth = 0) {
  if (!node) return true
  if (depth > MAX_DEPTH) return false

  if (node.kind === 'all') return node.nodes.every((n) => evaluateNode(n, ctx, depth + 1))
  if (node.kind === 'any') return node.nodes.some((n) => evaluateNode(n, ctx, depth + 1))
  if (node.kind === 'none') return !node.nodes.some((n) => evaluateNode(n, ctx, depth + 1))

  return evaluateCondition(node, ctx)
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Vuurt deze regel?                                                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * `before` is null bij een nieuw document.
 *
 * Een regel op een veldwijziging vuurt op het moment dat het veld die waarde
 * binnenkomt, niet zolang het die houdt: anders zet ze een toewijzing die
 * iemand daarna bewust veranderde bij de eerste volgende schrijving weer terug.
 */
export function ruleFires(rawRule, { doc, task, before = null, now = new Date() } = {}) {
  const rule = normaliseRule(rawRule)
  const onderwerp = doc ?? task
  if (!rule || !onderwerp || !rule.enabled) return false

  const entity = entityOf(rule.entity)
  const ctx = { doc: onderwerp, entity, now }

  // De uitzondering die de entiteit zelf stelt — bij taken: geen subtaken.
  if (entity.skip && evaluateCondition({ kind: 'condition', ...entity.skip }, ctx)) return false

  const nieuw = !before

  if (rule.trigger.kind === 'created') {
    if (!nieuw) return false
  } else {
    const veld = rule.trigger.field
    if (!fieldOf(entity, veld)) return false
    if (!nieuw && same(readField(before, veld), readField(onderwerp, veld))) return false
  }

  return evaluateNode(rule.when, ctx)
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Acties                                                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function coerce(desc, waarde) {
  if (desc.type === 'boolean') return waarde === true || waarde === 'true'
  if (desc.type === 'number' || desc.options === 'priorities') {
    if (leeg(waarde)) return null
    return getal(waarde)
  }
  if (leeg(waarde)) return null
  return `${waarde}`.trim() || null
}

/**
 * Wat één actie aan het klad toevoegt.
 *
 * De actie moet in de beschrijving van deze entiteit staan, anders gebeurt er
 * niets. Dat is geen vormcontrole maar de grens zelf: de motor draait met
 * beheerdersrechten en kan bij elk veld van elk document. Wat ze werkelijk
 * aanraakt, is precies wat in `rule-schema.js` als actie beschreven staat —
 * daarom staan `role` en `active` van een profiel daar niet bij.
 */
export function applyAction(entity, action, doc, draft, now) {
  const desc = actionOf(entity, action?.kind)
  if (!desc) return

  const huidig = (veld) => (veld in draft ? draft[veld] : readField(doc, veld))

  switch (desc.apply) {
    case 'people': {
      const ids = unique(action.profileIds ?? [])
      if (ids.length === 0) return
      draft[desc.field] =
        action.mode === 'add' ? unique([...alsLijst(huidig(desc.field)), ...ids]) : ids
      return
    }

    case 'listAdd': {
      let naam = (action.value ?? '').toString().trim()
      if (!naam) return
      // "Label toevoegen" met een datum erbij: Jasper wil een label kunnen
      // zetten dat zegt wanneer er iets moet gebeuren ("opvolgen 02-10"), niet
      // alleen een vast woord.
      const datum = action.date ? dayLabel(resolveDate(action.date, now)) : ''
      if (datum) naam = `${naam} ${datum}`
      draft[desc.field] = unique([...alsLijst(huidig(desc.field)), naam])
      return
    }

    case 'date': {
      const datum = resolveDate(action.date ?? action.value, now)
      if (!datum) return
      draft[desc.field] = datum
      return
    }

    case 'value': {
      const waarde = coerce(desc, action.value)
      if (waarde === null && !desc.nullable && desc.type !== 'boolean') return
      draft[desc.field] = waarde
      for (const [veld, vast] of Object.entries(desc.also ?? {})) draft[veld] = vast
      return
    }

    default:
      return
  }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Het plan                                                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Twee waarden die in Firestore hetzelfde betekenen. */
export function same(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = alsLijst(a)
    const right = alsLijst(b)
    if (left.length !== right.length) return false
    const rest = [...right]
    return left.every((v) => {
      const i = rest.indexOf(v)
      if (i === -1) return false
      rest.splice(i, 1)
      return true
    })
  }
  // Een datum komt als Date, als Timestamp of als tekst terug; alleen de
  // milliseconden zeggen of het dezelfde dag en hetzelfde uur is.
  if (b instanceof Date || (b !== null && typeof b === 'object')) {
    const links = millis(a)
    const rechts = millis(b)
    if (links !== null || rechts !== null) return links === rechts
  }
  if (a === null || a === undefined) return b === null || b === undefined
  return a === b
}

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0)

/**
 * De rij van een beslissingstabel die past — of geen.
 *
 * Van boven naar beneden, de eerste die past wint. Dat is wat een tabel op
 * papier ook doet, en het is de reden dat een tabel te lezen is zonder de
 * volgorde van tien losse regels in je hoofd te houden. Een lege cel betekent
 * "maakt niet uit".
 */
export function matchRow(rule, ctx) {
  for (const row of rule.rows) {
    const past = rule.inputs.every((input, i) => {
      const cel = row.cells[i]
      if (cel === null || cel === undefined || cel === '') return true
      const op = cel.op ?? input.op ?? 'is'
      const value = typeof cel === 'object' ? (cel.value ?? null) : cel
      // Een cel met alleen een operator die geen waarde vraagt ("is leeg") mag
      // leeg zijn; een cel die er wél een vraagt en niets heeft, staat voor
      // "maakt niet uit".
      const vraagtWaarde = !['empty', 'notEmpty', 'isTrue', 'isFalse'].includes(op)
      if (vraagtWaarde && (value === null || value === undefined || value === '')) return true
      return evaluateCondition({ kind: 'condition', field: input.field, op, value }, ctx)
    })
    if (past) return row
  }
  return null
}

/**
 * Wat de regels van deze wijziging maken.
 *
 * Geeft alleen terug wat echt verandert. Dat is niet alleen zuinig: de trigger
 * die dit oproept schrijft zijn eigen resultaat weg en wordt daardoor opnieuw
 * wakker. Een lege patch is wat die tweede ronde laat stoppen — samen met
 * `isRuleEcho`, dat een eigen schrijfbeurt herkent nog voor de regels gelezen
 * worden.
 *
 * `fired` zegt niet alleen wélke regel vuurde maar ook welke rij van een
 * beslissingstabel het was. Zonder dat is een tabel van twaalf rijen achteraf
 * niet uit te leggen aan wie vraagt waarom zijn taak van eigenaar wisselde.
 */
export function planFor({ rules = [], entity = 'task', doc, task, before = null, now = new Date() }) {
  const ent = entityOf(entity)
  const onderwerp = doc ?? task
  const draft = {}
  const fired = []
  if (!onderwerp) return { patch: {}, fired }

  const ctx = { doc: onderwerp, entity: ent, now }

  for (const raw of [...rules].sort(byPosition)) {
    const rule = normaliseRule(raw)
    if (!rule || rule.entity !== ent.key) continue
    if (!ruleFires(rule, { doc: onderwerp, before, now })) continue

    if (rule.kind === 'table') {
      const row = matchRow(rule, ctx)
      if (!row) continue
      for (const action of row.actions) applyAction(ent, action, onderwerp, draft, now)
      fired.push({ id: rule.id, name: rule.name, kind: 'table', rowId: row.id, rowLabel: row.label })
      continue
    }

    for (const action of rule.actions) applyAction(ent, action, onderwerp, draft, now)
    fired.push({ id: rule.id, name: rule.name, kind: 'rule', rowId: null, rowLabel: '' })
  }

  const patch = {}
  for (const [key, value] of Object.entries(draft)) {
    if (!same(readField(onderwerp, key), value)) patch[key] = value
  }

  return { patch, fired }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Lusbeveiliging                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Was deze schrijfbeurt er eentje van onszelf?
 *
 * De trigger schrijft het resultaat van de regels weg op het document dat haar
 * wakker maakte, en wordt daar opnieuw wakker van. Tot nu stopte dat op de lege
 * patch: de tweede ronde vond niets meer te veranderen. Dat blijft zo — het is
 * de beveiliging die ook geldt wanneer een wijziging langs een andere weg
 * terugkomt — maar met een boom van voorwaarden is die tweede ronde niet meer
 * gratis: elke regel wordt opnieuw nagerekend, op elke entiteit. Daarom
 * ondertekent de motor haar eigen schrijfbeurt met `ruleStamp` en herkent ze
 * die hier terug voordat er ook maar één regel gelezen wordt.
 *
 * Een wijziging van iemand anders laat `ruleStamp` staan zoals hij is, en gaat
 * dus gewoon door.
 */
export function isRuleEcho(before, after) {
  if (!before || !after) return false
  const oud = millis(before[RULE_STAMP])
  const nieuw = millis(after[RULE_STAMP])
  return nieuw !== null && oud !== nieuw
}

/**
 * De velden die in deze schrijfbeurt veranderden — de goedkope voorcontrole.
 *
 * Zonder dit leest elke schrijving op elke collectie de regels op. Met dit
 * gebeurt dat alleen wanneer er iets veranderde waar überhaupt een regel over
 * kan gaan.
 */
export function changedFields(before, after, entity) {
  const ent = entityOf(entity)
  if (!after) return []
  if (!before) return ent.fields.map((f) => f.key)
  return ent.fields
    .filter((f) => !same(readField(before, f.key), readField(after, f.key)))
    .map((f) => f.key)
}
