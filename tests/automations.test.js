import { describe, expect, it } from 'vitest'
import { laadCatalogus } from '../src/lib/i18n'
import {
  ENTITIES,
  MAX_DEPTH,
  TRIGGER_KINDS,
  applyAction,
  changedFields,
  entityOf,
  evaluateNode,
  isRuleEcho,
  normaliseRule,
  planFor,
  ruleFires,
  writableFields,
} from '../functions/automations.js'
import {
  actionsFor,
  describeRule,
  emptyAction,
  emptyRule,
  emptyTable,
  ruleWarnings,
  toEditable,
  triggersFor,
} from '../src/lib/automations.js'

/**
 * Dit is de enige code die ongevraagd andermans werk aanpast. Vier dingen
 * moeten kloppen: een regel vuurt op het juiste moment, ze vuurt niet op elk
 * moment daarna, ze raakt niets aan wat ze niet mag raken, en de regels die het
 * team al had blijven precies doen wat ze deden.
 */

const ELKE = 'u-elke'
const JASPER = 'u-jasper'

// ── De oude vorm, letterlijk zoals ze in `automations` staat ────────────────

const oudeRegel = (extra = {}) => ({
  id: 'r1',
  name: 'Facturatie is voor Elke',
  enabled: true,
  listId: null,
  trigger: { kind: 'status', status: 'ready to invoice' },
  actions: [{ kind: 'assignees', mode: 'set', profileIds: [ELKE] }],
  position: 0,
  ...extra,
})

const taak = (extra = {}) => ({
  id: 't1',
  listId: 'overview-planning',
  statusName: 'ready to invoice',
  assignees: [JASPER],
  tags: [],
  priority: null,
  dueDate: null,
  ...extra,
})

// De teksten van de business rules horen bij het instellingenscherm en komen
// pas met dat scherm mee; zie de routetabel in `src/AppPrive.jsx`.
await laadCatalogus('instellingen')


describe('de bestaande regels blijven werken', () => {
  it('vuurt zodra een taak de status binnenkomt', () => {
    const { patch, fired } = planFor({
      rules: [oudeRegel()],
      task: taak(),
      before: taak({ statusName: 'planning ready' }),
    })
    expect(patch).toEqual({ assignees: [ELKE] })
    expect(fired.map((f) => f.id)).toEqual(['r1'])
  })

  it('vuurt niet opnieuw zolang de taak in die status blijft staan', () => {
    // Iemand zette na de wissel bewust Jasper erop. Dat blijft zo.
    const { patch } = planFor({
      rules: [oudeRegel()],
      task: taak({ assignees: [JASPER] }),
      before: taak({ assignees: [ELKE] }),
    })
    expect(patch).toEqual({})
  })

  it('vuurt op een taak die meteen in die status wordt aangemaakt', () => {
    const { patch } = planFor({ rules: [oudeRegel()], task: taak(), before: null })
    expect(patch).toEqual({ assignees: [ELKE] })
  })

  it('trekt zich niets aan van hoofdletters of spaties in de statusnaam', () => {
    const { patch } = planFor({
      rules: [oudeRegel({ trigger: { kind: 'status', status: '  Ready To Invoice ' } })],
      task: taak(),
      before: taak({ statusName: 'invoiced' }),
    })
    expect(patch).toEqual({ assignees: [ELKE] })
  })

  it('blijft van andere lijsten af wanneer de regel er één noemt', () => {
    const regel = oudeRegel({ listId: 'overleg' })
    expect(ruleFires(regel, { task: taak(), before: null })).toBe(false)
    expect(ruleFires(regel, { task: taak({ listId: 'overleg' }), before: null })).toBe(true)
  })

  it('doet niets wanneer de regel uitstaat', () => {
    const { patch, fired } = planFor({ rules: [oudeRegel({ enabled: false })], task: taak(), before: null })
    expect(patch).toEqual({})
    expect(fired).toEqual([])
  })

  it('vuurt bij "taak aangemaakt" alleen op het aanmaken zelf', () => {
    const r = oudeRegel({ trigger: { kind: 'created' }, actions: [{ kind: 'priority', value: 2 }] })
    expect(ruleFires(r, { task: taak(), before: null })).toBe(true)
    expect(ruleFires(r, { task: taak(), before: taak({ statusName: 'request' }) })).toBe(false)
    // Een taak onder een event valt buiten de regels.
    expect(ruleFires(r, { task: taak({ parentId: 'event-1' }), before: null })).toBe(false)
  })

  it('leest de oude "dueInDays" nog als een aantal dagen', () => {
    const { patch } = planFor({
      rules: [oudeRegel({ actions: [{ kind: 'dueInDays', value: 7 }] })],
      task: taak(),
      before: null,
      now: new Date('2026-09-28T09:20:00'),
    })
    expect(patch.dueDate.toISOString().slice(0, 10)).toBe('2026-10-05')
    expect(patch.dueDate.getHours()).toBe(17)
  })

  it('zet de oude vorm om zonder er iets aan te veranderen', () => {
    const genormaliseerd = normaliseRule(oudeRegel({ listId: 'overleg' }))
    expect(genormaliseerd.trigger).toEqual({ kind: 'changed', field: 'statusName' })
    expect(genormaliseerd.when.kind).toBe('all')
    expect(genormaliseerd.when.nodes).toHaveLength(2)
    expect(genormaliseerd.entity).toBe('task')
  })

  it('toont de oude vorm in het scherm als voorwaarde, zonder te bewaren', () => {
    const bewerkbaar = toEditable(oudeRegel())
    expect(bewerkbaar.trigger).toEqual({ kind: 'changed', field: 'statusName' })
    expect(bewerkbaar.when.nodes[0]).toMatchObject({ field: 'statusName', op: 'is', value: 'ready to invoice' })
    // En hij betekent daarna nog hetzelfde.
    const { patch } = planFor({ rules: [{ ...bewerkbaar, id: 'r1' }], task: taak(), before: null })
    expect(patch).toEqual({ assignees: [ELKE] })
  })
})

describe('wat een regel doet', () => {
  it('vervangt alle toegewezenen bij "wordt de enige"', () => {
    const { patch } = planFor({
      rules: [oudeRegel()],
      task: taak({ assignees: [JASPER, 'u-anneleen'] }),
      before: null,
    })
    expect(patch.assignees).toEqual([ELKE])
  })

  it('laat de anderen staan bij "komt erbij"', () => {
    const { patch } = planFor({
      rules: [oudeRegel({ actions: [{ kind: 'assignees', mode: 'add', profileIds: [ELKE] }] })],
      task: taak({ assignees: [JASPER] }),
      before: null,
    })
    expect(patch.assignees).toEqual([JASPER, ELKE])
  })

  it('zet een label erbij zonder het te verdubbelen', () => {
    const r = oudeRegel({ actions: [{ kind: 'tag', value: 'facturatie' }] })
    expect(planFor({ rules: [r], task: taak(), before: null }).patch.tags).toEqual(['facturatie'])
    expect(planFor({ rules: [r], task: taak({ tags: ['facturatie'] }), before: null }).patch).toEqual({})
  })

  it('ziet een Firestore-Timestamp als dezelfde datum', () => {
    const doel = new Date('2026-10-05T17:00:00')
    const stamp = { toMillis: () => doel.getTime() }
    const { patch } = planFor({
      rules: [oudeRegel({ actions: [{ kind: 'dueInDays', value: 7 }] })],
      task: taak({ dueDate: stamp }),
      before: null,
      now: new Date('2026-09-28T09:20:00'),
    })
    expect(patch).toEqual({})
  })

  it('past meerdere regels toe in de volgorde waarin ze staan', () => {
    const { patch, fired } = planFor({
      rules: [
        oudeRegel({ id: 'laat', position: 2, actions: [{ kind: 'assignees', mode: 'set', profileIds: [ELKE] }] }),
        oudeRegel({ id: 'vroeg', position: 1, actions: [{ kind: 'assignees', mode: 'set', profileIds: [JASPER] }] }),
      ],
      task: taak({ assignees: [] }),
      before: null,
    })
    expect(fired.map((f) => f.id)).toEqual(['vroeg', 'laat'])
    expect(patch.assignees).toEqual([ELKE])
  })
})

// ── Relatieve datums ────────────────────────────────────────────────────────

describe('datums: vast of relatief', () => {
  const nu = new Date('2026-09-28T09:20:00')

  const metActie = (action) =>
    planFor({
      rules: [oudeRegel({ actions: [action] })],
      task: taak(),
      before: null,
      now: nu,
    }).patch

  it('rekent "+3 dagen" vanaf vandaag, op het einde van de werkdag', () => {
    const patch = metActie({ kind: 'dueDate', date: { mode: 'relative', days: 3 } })
    expect(patch.dueDate.toISOString().slice(0, 10)).toBe('2026-10-01')
    expect(patch.dueDate.getHours()).toBe(17)
  })

  it('neemt ook een vaste dag', () => {
    const patch = metActie({ kind: 'dueDate', date: { mode: 'fixed', date: '2026-12-24' } })
    expect(patch.dueDate.toISOString().slice(0, 10)).toBe('2026-12-24')
    expect(patch.dueDate.getHours()).toBe(17)
  })

  it('rekent achteruit', () => {
    const patch = metActie({ kind: 'dueDate', date: { mode: 'relative', days: -7 } })
    expect(patch.dueDate.toISOString().slice(0, 10)).toBe('2026-09-21')
  })

  it('zet een startdag net zo goed', () => {
    const patch = metActie({ kind: 'startDate', date: { mode: 'relative', days: 1 } })
    expect(patch.startDate.toISOString().slice(0, 10)).toBe('2026-09-29')
  })

  it('zet de datum in het label wanneer daarom gevraagd wordt', () => {
    // "Label toevoegen" met +3 dagen: een label dat zegt wanneer er iets moet
    // gebeuren, niet alleen een vast woord.
    const patch = metActie({ kind: 'tag', value: 'opvolgen', date: { mode: 'relative', days: 3 } })
    expect(patch.tags).toEqual(['opvolgen 01-10'])
  })

  it('doet niets met een datum die nergens op slaat', () => {
    expect(metActie({ kind: 'dueDate', date: { mode: 'fixed', date: '' } })).toEqual({})
    expect(metActie({ kind: 'dueDate', date: { mode: 'relative', days: 'ooit' } })).toEqual({})
  })
})

// ── De voorwaardeboom ───────────────────────────────────────────────────────

const boomRegel = (when, extra = {}) => ({
  id: 'b1',
  name: 'Grote aanvraag',
  enabled: true,
  entity: 'task',
  trigger: { kind: 'changed', field: 'statusName' },
  when,
  actions: [{ kind: 'assignees', mode: 'set', profileIds: [ELKE] }],
  position: 0,
  ...extra,
})

const vuurt = (when, t = taak(), before = taak({ statusName: 'request' }), now = new Date('2026-09-28T09:20:00')) =>
  ruleFires(boomRegel(when), { task: t, before, now })

const cond = (field, op, value = null) => ({ kind: 'condition', field, op, value })

describe('een boom van voorwaarden', () => {
  it('vuurt zonder voorwaarden op de aanleiding alleen', () => {
    expect(vuurt(null)).toBe(true)
    expect(vuurt({ kind: 'all', nodes: [] })).toBe(true)
  })

  it('EN wil alles', () => {
    const when = { kind: 'all', nodes: [cond('pax', 'gt', 100), cond('eventType', 'is', 'Huwelijk')] }
    expect(vuurt(when, taak({ pax: 140, eventType: 'Huwelijk' }))).toBe(true)
    expect(vuurt(when, taak({ pax: 40, eventType: 'Huwelijk' }))).toBe(false)
    expect(vuurt(when, taak({ pax: 140, eventType: 'Receptie' }))).toBe(false)
  })

  it('OF wil er één', () => {
    const when = { kind: 'any', nodes: [cond('budget', 'gte', 10000), cond('pax', 'gt', 150)] }
    expect(vuurt(when, taak({ budget: 16399, pax: 40 }))).toBe(true)
    expect(vuurt(when, taak({ budget: 900, pax: 180 }))).toBe(true)
    expect(vuurt(when, taak({ budget: 900, pax: 40 }))).toBe(false)
  })

  it('GEEN wil er geen enkele', () => {
    const when = { kind: 'none', nodes: [cond('tags', 'contains', 'losse events')] }
    expect(vuurt(when, taak({ tags: ['vaste klant'] }))).toBe(true)
    expect(vuurt(when, taak({ tags: ['losse events'] }))).toBe(false)
  })

  it('zet groepen in groepen', () => {
    // (huwelijk OF bedrijfsevent) EN meer dan honderd gasten
    const when = {
      kind: 'all',
      nodes: [
        { kind: 'any', nodes: [cond('eventType', 'is', 'Huwelijk'), cond('eventType', 'is', 'Bedrijfsevent')] },
        cond('pax', 'gt', 100),
      ],
    }
    expect(vuurt(when, taak({ eventType: 'Bedrijfsevent', pax: 180 }))).toBe(true)
    expect(vuurt(when, taak({ eventType: 'Bedrijfsevent', pax: 40 }))).toBe(false)
    expect(vuurt(when, taak({ eventType: 'Receptie', pax: 180 }))).toBe(false)
  })

  it('vergelijkt tekst zonder op hoofdletters of spaties te letten', () => {
    expect(vuurt(cond('title', 'contains', 'TROUW'), taak({ title: 'Trouw Niels en Inez' }))).toBe(true)
    expect(vuurt(cond('title', 'is', '  trouw niels en inez '), taak({ title: 'Trouw Niels en Inez' }))).toBe(true)
    expect(vuurt(cond('title', 'notContains', 'blum'), taak({ title: 'Trouw Niels en Inez' }))).toBe(true)
  })

  it('vergelijkt getallen als getallen', () => {
    expect(vuurt(cond('pax', 'lt', 50), taak({ pax: 12 }))).toBe(true)
    expect(vuurt(cond('pax', 'lte', 12), taak({ pax: 12 }))).toBe(true)
    expect(vuurt(cond('pax', 'gt', 12), taak({ pax: 12 }))).toBe(false)
    // Een leeg getal is geen nul.
    expect(vuurt(cond('pax', 'lt', 50), taak({ pax: null }))).toBe(false)
  })

  it('vergelijkt datums op de dag, vast én relatief', () => {
    const nu = new Date('2026-09-28T09:20:00')
    const t = taak({ dueDate: new Date('2026-10-01T17:00:00') })
    expect(vuurt(cond('dueDate', 'before', { mode: 'relative', days: 7 }), t, null, nu)).toBe(true)
    expect(vuurt(cond('dueDate', 'before', { mode: 'relative', days: 1 }), t, null, nu)).toBe(false)
    expect(vuurt(cond('dueDate', 'after', { mode: 'fixed', date: '2026-09-30' }), t, null, nu)).toBe(true)
    // Dezelfde dag is niet "erna", ook al staat er een uur op.
    expect(vuurt(cond('dueDate', 'after', { mode: 'fixed', date: '2026-10-01' }), t, null, nu)).toBe(false)
    expect(vuurt(cond('dueDate', 'is', { mode: 'fixed', date: '2026-10-01' }), t, null, nu)).toBe(true)
  })

  it('kijkt in een lijst en naar wie erop staat', () => {
    expect(vuurt(cond('tags', 'contains', 'losse events'), taak({ tags: ['losse events'] }))).toBe(true)
    expect(vuurt(cond('assignees', 'contains', ELKE), taak({ assignees: [JASPER, ELKE] }))).toBe(true)
    expect(vuurt(cond('assignees', 'notContains', ELKE), taak({ assignees: [JASPER] }))).toBe(true)
  })

  it('kent leeg en ingevuld', () => {
    expect(vuurt(cond('dueDate', 'empty'), taak({ dueDate: null }))).toBe(true)
    expect(vuurt(cond('tags', 'empty'), taak({ tags: [] }))).toBe(true)
    expect(vuurt(cond('assignees', 'notEmpty'), taak({ assignees: [JASPER] }))).toBe(true)
    expect(vuurt(cond('customerName', 'empty'), taak({ customerName: '' }))).toBe(true)
  })

  it('kent aan en uit', () => {
    expect(vuurt(cond('archived', 'isTrue'), taak({ archived: true }))).toBe(true)
    expect(vuurt(cond('archived', 'isFalse'), taak({ archived: false }))).toBe(true)
    expect(vuurt(cond('archived', 'isFalse'), taak({}))).toBe(true)
  })

  it('leest niet dieper dan zes lagen', () => {
    let node = cond('pax', 'gt', 1)
    for (let i = 0; i <= MAX_DEPTH + 2; i += 1) node = { kind: 'all', nodes: [node] }
    expect(evaluateNode(node, { doc: taak({ pax: 100 }), entity: entityOf('task'), now: new Date() })).toBe(false)
  })

  it('negeert een voorwaarde op een veld dat niet bestaat', () => {
    // Anders kan een regel voorwaarden stellen aan velden waarvan niemand weet
    // dat ze er zijn — en de uitkomst is dan niet na te lezen in het scherm.
    expect(vuurt(cond('geheimVeld', 'is', 'ja'), taak({ geheimVeld: 'ja' }))).toBe(false)
  })

  it('vuurt alleen wanneer het veld van de aanleiding echt wijzigde', () => {
    const regel = boomRegel(cond('pax', 'gt', 100), { trigger: { kind: 'changed', field: 'pax' } })
    expect(ruleFires(regel, { task: taak({ pax: 140 }), before: taak({ pax: 40 }) })).toBe(true)
    expect(ruleFires(regel, { task: taak({ pax: 140 }), before: taak({ pax: 140 }) })).toBe(false)
  })
})

// ── Beslissingstabellen ─────────────────────────────────────────────────────

const tabel = (extra = {}) => ({
  id: 'tab1',
  name: 'Wie doet wat met een aanvraag',
  kind: 'table',
  entity: 'task',
  enabled: true,
  trigger: { kind: 'changed', field: 'statusName' },
  when: { kind: 'all', nodes: [cond('statusName', 'is', 'request')] },
  inputs: [
    { field: 'budget', op: 'gte' },
    { field: 'eventType', op: 'is' },
  ],
  rows: [
    {
      id: 'groot-huwelijk',
      label: 'groot huwelijk',
      cells: [10000, 'Huwelijk'],
      actions: [{ kind: 'assignees', mode: 'set', profileIds: [ELKE] }],
    },
    {
      id: 'groot',
      label: 'groot',
      cells: [10000, ''],
      actions: [{ kind: 'priority', value: 1 }],
    },
    {
      id: 'de-rest',
      label: 'de rest',
      cells: ['', ''],
      actions: [{ kind: 'priority', value: 3 }],
    },
  ],
  position: 0,
  ...extra,
})

const aanvraag = (extra = {}) => taak({ statusName: 'request', ...extra })
const vorigeStatus = taak({ statusName: 'idea' })

describe('een beslissingstabel', () => {
  it('leest van boven naar beneden en stopt bij de eerste rij die past', () => {
    const { patch, fired } = planFor({
      rules: [tabel()],
      task: aanvraag({ budget: 16399, eventType: 'Huwelijk' }),
      before: vorigeStatus,
    })
    expect(patch).toEqual({ assignees: [ELKE] })
    expect(fired).toEqual([
      { id: 'tab1', name: 'Wie doet wat met een aanvraag', kind: 'table', rowId: 'groot-huwelijk', rowLabel: 'groot huwelijk' },
    ])
  })

  it('valt door naar de volgende rij wanneer een cel niet past', () => {
    const { patch, fired } = planFor({
      rules: [tabel()],
      task: aanvraag({ budget: 16399, eventType: 'Bedrijfsevent' }),
      before: vorigeStatus,
    })
    expect(patch).toEqual({ priority: 1 })
    expect(fired[0].rowId).toBe('groot')
  })

  it('leest een lege cel als "maakt niet uit"', () => {
    const { patch, fired } = planFor({
      rules: [tabel()],
      task: aanvraag({ budget: 500, eventType: 'Receptie' }),
      before: vorigeStatus,
    })
    expect(patch).toEqual({ priority: 3 })
    expect(fired[0].rowId).toBe('de-rest')
  })

  it('doet niets wanneer geen enkele rij past', () => {
    const zonderVangnet = tabel({ rows: tabel().rows.slice(0, 2) })
    const { patch, fired } = planFor({
      rules: [zonderVangnet],
      task: aanvraag({ budget: 500, eventType: 'Receptie' }),
      before: vorigeStatus,
    })
    expect(patch).toEqual({})
    expect(fired).toEqual([])
  })

  it('komt niet eens aan de rijen toe wanneer de voorwaarde erboven niet klopt', () => {
    const { patch } = planFor({
      rules: [tabel()],
      task: taak({ statusName: 'complete', budget: 16399, eventType: 'Huwelijk' }),
      before: vorigeStatus,
    })
    expect(patch).toEqual({})
  })

  it('laat een cel zijn eigen vergelijking meebrengen', () => {
    const eigen = tabel({
      inputs: [{ field: 'pax', op: 'gte' }],
      rows: [
        { id: 'klein', label: 'klein', cells: [{ op: 'lt', value: 50 }], actions: [{ kind: 'priority', value: 4 }] },
        { id: 'groot', label: 'groot', cells: [100], actions: [{ kind: 'priority', value: 1 }] },
      ],
    })
    expect(planFor({ rules: [eigen], task: aanvraag({ pax: 12 }), before: vorigeStatus }).patch).toEqual({ priority: 4 })
    expect(planFor({ rules: [eigen], task: aanvraag({ pax: 180 }), before: vorigeStatus }).patch).toEqual({ priority: 1 })
  })

  it('zegt welke rij het was, ook bij een tabel van twaalf rijen', () => {
    const { fired } = planFor({
      rules: [tabel()],
      task: aanvraag({ budget: 16399, eventType: 'Huwelijk' }),
      before: vorigeStatus,
    })
    expect(fired[0].rowLabel).toBe('groot huwelijk')
  })
})

// ── Alle entiteiten ─────────────────────────────────────────────────────────

describe('regels op de andere entiteiten', () => {
  it('zet een merk op een klant', () => {
    const { patch } = planFor({
      rules: [
        {
          id: 'k1',
          entity: 'customer',
          enabled: true,
          trigger: { kind: 'created' },
          when: { kind: 'all', nodes: [cond('address.city', 'is', 'Borgloon')] },
          actions: [{ kind: 'brand', value: 'je-concept' }],
        },
      ],
      entity: 'customer',
      doc: { id: 'k-borgloon', name: 'Stad Borgloon', address: { city: 'Borgloon' } },
      before: null,
    })
    expect(patch).toEqual({ brandId: 'je-concept' })
  })

  it('vraagt review op een post die klaar is', () => {
    const { patch } = planFor({
      rules: [
        {
          id: 'p1',
          entity: 'socialPost',
          enabled: true,
          trigger: { kind: 'changed', field: 'status' },
          when: cond('status', 'is', 'review'),
          actions: [{ kind: 'review', value: JASPER }],
        },
      ],
      entity: 'socialPost',
      doc: { id: 'p1', status: 'review', reviewState: 'none', reviewerId: null },
      before: { status: 'design' },
    })
    expect(patch).toEqual({ reviewerId: JASPER, reviewState: 'requested' })
  })

  it('markeert een dag die afgesloten wordt met werk dat blijft liggen', () => {
    const { patch } = planFor({
      rules: [
        {
          id: 'c1',
          entity: 'checklistRun',
          enabled: true,
          trigger: { kind: 'changed', field: 'closedAt' },
          when: { kind: 'all', nodes: [cond('doneCount', 'lt', 20)] },
          actions: [
            { kind: 'flag', value: 'Niet alles afgevinkt' },
            { kind: 'followUp', mode: 'set', profileIds: [JASPER] },
          ],
        },
      ],
      entity: 'checklistRun',
      doc: { id: 'openen_2026-09-28', doneCount: 7, totalCount: 20, closedAt: new Date('2026-09-28T23:40:00') },
      before: { doneCount: 7, totalCount: 20, closedAt: null },
    })
    expect(patch).toEqual({ flagNote: 'Niet alles afgevinkt', flagged: true, followUpIds: [JASPER] })
  })

  /*
    Dit was een regel die uren op een lijst als niet-factureerbaar zette. Die
    actie bestaat niet meer: JE Concept werkt met een vaste prijs per event,
    dus "mag dit doorgerekend worden" was een vraag die nooit gesteld werd en
    het vinkje stond bij elke boeking.

    Wat de regels op uren nog wél kunnen — een label zetten — staat hieronder,
    zodat de entiteit `timeEntry` getest blijft in plaats van ongedekt achter
    te blijven nu haar enige andere actie weg is.
  */
  it('hangt een label aan uren op een bepaalde lijst', () => {
    const { patch } = planFor({
      rules: [
        {
          id: 'u1',
          entity: 'timeEntry',
          enabled: true,
          trigger: { kind: 'created' },
          when: cond('listId', 'is', 'l-socials'),
          actions: [{ kind: 'tag', value: 'socials' }],
        },
      ],
      entity: 'timeEntry',
      doc: { id: 'te-1', listId: 'l-socials', tags: [] },
      before: null,
    })
    expect(patch).toEqual({ tags: ['socials'] })
  })

  it('zet een afdeling op een profiel', () => {
    const { patch } = planFor({
      rules: [
        {
          id: 'pr1',
          entity: 'profile',
          enabled: true,
          trigger: { kind: 'created' },
          when: cond('email', 'contains', '@barvue.be'),
          actions: [{ kind: 'department', value: 'zaal' }],
        },
      ],
      entity: 'profile',
      doc: { id: 'u-lotte', email: 'lotte@barvue.be', role: 'staff' },
      before: null,
    })
    expect(patch).toEqual({ department: 'zaal' })
  })

  it('houdt de entiteiten uit elkaar', () => {
    // Een klantregel mag niet op een taak vuren, ook niet wanneer de velden
    // toevallig hetzelfde heten.
    const klantregel = {
      id: 'k2',
      entity: 'customer',
      enabled: true,
      trigger: { kind: 'created' },
      actions: [{ kind: 'archive', value: true }],
    }
    const { patch } = planFor({ rules: [klantregel], entity: 'task', task: taak(), before: null })
    expect(patch).toEqual({})
  })
})

// ── Wat een regel niet mag ──────────────────────────────────────────────────

describe('wat een regel niet mag aanraken', () => {
  it('voert geen actie uit die niet in de beschrijving staat', () => {
    const { patch } = planFor({
      rules: [oudeRegel({ actions: [{ kind: 'zetStatus', value: 'invoiced' }] })],
      task: taak(),
      before: null,
    })
    expect(patch).toEqual({})
  })

  it('kan de rol of de toegang van een profiel niet zetten', () => {
    // De motor draait met beheerdersrechten. Een regel die een rol kan zetten,
    // is een regel die zichzelf meer rechten geeft.
    const profiel = entityOf('profile')
    expect(writableFields(profiel)).toEqual(['department'])
    for (const kind of ['role', 'active', 'email', 'hourlyRate']) {
      const draft = {}
      applyAction(profiel, { kind, value: 'owner' }, { id: 'u-x' }, draft, new Date())
      expect(draft).toEqual({})
    }
  })

  it('laat een actie van een andere entiteit niet oversteken', () => {
    const draft = {}
    applyAction(entityOf('profile'), { kind: 'priority', value: 1 }, { id: 'u-x' }, draft, new Date())
    expect(draft).toEqual({})
  })

  it('schrijft per entiteit alleen wat er beschreven staat', () => {
    for (const entity of ENTITIES) {
      const velden = writableFields(entity)
      expect(velden.length, `${entity.key} heeft geen enkele actie`).toBeGreaterThan(0)
      for (const veld of velden) {
        expect(
          entity.actions.some((a) => a.field === veld || veld in (a.also ?? {})),
          `${entity.key}.${veld} hoort bij geen enkele actie`
        ).toBe(true)
      }
    }
  })
})

// ── De lus ──────────────────────────────────────────────────────────────────

describe('een regel die zichzelf opnieuw laat vuren', () => {
  it('stopt op de lege patch — wat al zo staat, wordt niet geschreven', () => {
    const { patch } = planFor({ rules: [oudeRegel()], task: taak({ assignees: [ELKE] }), before: null })
    expect(patch).toEqual({})
  })

  it('stopt ook wanneer de regel op haar eigen uitkomst staat te wachten', () => {
    // De gevaarlijkste vorm: de aanleiding is het veld dat de actie zelf zet.
    const zichzelf = boomRegel(cond('tags', 'notContains', 'nagekeken'), {
      id: 'lus',
      trigger: { kind: 'changed', field: 'tags' },
      actions: [{ kind: 'tag', value: 'nagekeken' }],
    })

    const eerste = planFor({ rules: [zichzelf], task: taak({ tags: ['losse events'] }), before: taak({ tags: [] }) })
    expect(eerste.patch).toEqual({ tags: ['losse events', 'nagekeken'] })

    // Ronde twee: de motor schreef haar eigen resultaat weg en werd daar wakker
    // van. De voorwaarde klopt niet meer, en zelfs als ze klopte levert de actie
    // niets nieuws op.
    const tweede = planFor({
      rules: [zichzelf],
      task: taak({ tags: ['losse events', 'nagekeken'] }),
      before: taak({ tags: ['losse events'] }),
    })
    expect(tweede.patch).toEqual({})
  })

  it('stopt met een boom van voorwaarden die na de actie nog waar is', () => {
    // De voorwaarde blijft kloppen na de wijziging — dan moet de lege patch het
    // werk doen, en dat doet hij.
    const blijftWaar = boomRegel(
      { kind: 'all', nodes: [cond('statusName', 'is', 'ready to invoice'), cond('pax', 'gt', 10)] },
      { id: 'lus2', trigger: { kind: 'changed', field: 'assignees' }, actions: [{ kind: 'assignees', mode: 'set', profileIds: [ELKE] }] }
    )
    const na = taak({ pax: 140, assignees: [ELKE] })
    expect(planFor({ rules: [blijftWaar], task: na, before: taak({ pax: 140, assignees: [JASPER] }) }).patch).toEqual({})
  })

  it('herkent haar eigen schrijfbeurt aan de stempel', () => {
    const voor = { ...taak(), ruleStamp: { toMillis: () => 1000 } }
    const na = { ...taak(), ruleStamp: { toMillis: () => 2000 } }
    expect(isRuleEcho(voor, na)).toBe(true)
    // Een wijziging van iemand anders laat de stempel staan.
    expect(isRuleEcho(voor, { ...taak(), ruleStamp: { toMillis: () => 1000 } })).toBe(false)
    expect(isRuleEcho(null, na)).toBe(false)
  })

  it('leest de regels niet eens op wanneer er niets veranderde', () => {
    expect(changedFields(taak(), taak(), 'task')).toEqual([])
    expect(changedFields(taak(), taak({ pax: 3 }), 'task')).toEqual(['pax'])
    // Een veld dat geen enkele regel kan zien, telt niet mee.
    expect(changedFields(taak(), taak({ updatedAt: new Date() }), 'task')).toEqual([])
  })
})

// ── Scherm en motor spreken dezelfde taal ───────────────────────────────────

describe('de interface en de motor spreken dezelfde taal', () => {
  it('elke aanleiding die je kunt kiezen, kent de motor ook', () => {
    for (const entity of ENTITIES) {
      expect(triggersFor(entity).map((t) => t.kind).sort()).toEqual([...TRIGGER_KINDS].sort())
    }
  })

  const gevuld = {
    assignees: { profileIds: [ELKE] },
    followUp: { profileIds: [ELKE] },
    tag: { value: 'facturatie' },
    priority: { value: 1 },
    brand: { value: 'bar-vue' },
    archive: { value: true },
    assignee: { value: ELKE },
    postStatus: { value: 'approved' },
    review: { value: JASPER },
    flag: { value: 'kijk hier eens naar' },
    department: { value: 'zaal' },
    dueDate: {},
    startDate: {},
    publishAt: {},
  }

  it('elke actie uit het formulier levert, ingevuld, een echte wijziging', () => {
    for (const entity of ENTITIES) {
      for (const desc of actionsFor(entity)) {
        const action = { ...emptyAction(entity, desc.kind), ...(gevuld[desc.kind] ?? {}) }
        const draft = {}
        applyAction(entity, action, {}, draft, new Date('2026-09-28T09:20:00'))
        expect(Object.keys(draft), `actie ${entity.key}.${desc.kind} verandert niets`).not.toHaveLength(0)
      }
    }
  })

  it('een leeg formulier is voor elke entiteit bruikbaar', () => {
    for (const entity of ENTITIES) {
      expect(normaliseRule(emptyRule(entity.key)).entity).toBe(entity.key)
      const t = normaliseRule(emptyTable(entity.key))
      expect(t.kind).toBe('table')
      expect(t.rows.length).toBe(2)
    }
  })

  it('zegt in gewone taal wat er gebeurt', () => {
    const zin = describeRule(toEditable(oudeRegel()), {
      profiles: [{ id: ELKE, fullName: 'Elke Motmans' }],
    })
    expect(zin).toContain('Status')
    expect(zin).toContain('Elke Motmans')

    const tabelZin = describeRule(tabel(), {})
    expect(tabelZin).toContain('3 rijen')
  })
})

describe('waarschuwingen bij een regel', () => {
  const lists = [
    { id: 'overview-planning', name: 'Events', statuses: [{ name: 'ready to invoice' }] },
    { id: 'overleg', name: 'Tasks', statuses: [{ name: 'samengevat' }] },
  ]

  it('zwijgt over een regel die klopt', () => {
    expect(ruleWarnings(toEditable(oudeRegel()), { lists })).toEqual([])
  })

  it('zegt het wanneer geen enkele lijst die status heeft', () => {
    const regel = toEditable(oudeRegel({ trigger: { kind: 'status', status: 'gefactureerd' } }))
    expect(ruleWarnings(regel, { lists }).join(' ')).toContain('vuurt nooit')
  })

  it('zegt het wanneer de status niet op de gekozen lijst staat', () => {
    const regel = toEditable(oudeRegel({ listId: 'overleg' }))
    expect(ruleWarnings(regel, { lists }).join(' ')).toContain('niet op die lijst')
  })

  it('zegt het wanneer er geen actie of geen persoon gekozen is', () => {
    expect(ruleWarnings(toEditable(oudeRegel({ actions: [] })), { lists }).join(' ')).toContain('Zonder actie')
    expect(
      ruleWarnings(
        toEditable(oudeRegel({ actions: [{ kind: 'assignees', mode: 'set', profileIds: [] }] })),
        { lists }
      ).join(' ')
    ).toContain('Kies wie')
  })

  it('zwijgt over een lege bovenste groep — dan vuurt de regel op haar aanleiding', () => {
    const kaal = { ...boomRegel({ kind: 'all', nodes: [] }), listId: null }
    expect(ruleWarnings(kaal, { lists })).toEqual([])
    // Een lege groep dieper in de boom is wél aangeklikt en nooit ingevuld.
    const diep = boomRegel({ kind: 'all', nodes: [{ kind: 'any', nodes: [] }] })
    expect(ruleWarnings(diep, { lists }).join(' ')).toContain('lege groep')
  })

  it('zegt het wanneer een voorwaarde niet af is', () => {
    const regel = boomRegel({ kind: 'all', nodes: [cond('pax', 'gt', '')] })
    expect(ruleWarnings(regel, { lists }).join(' ')).toContain('Vul een waarde in')
  })

  it('zegt het wanneer een tabel geen rijen of geen kolommen heeft', () => {
    expect(ruleWarnings(tabel({ rows: [] }), { lists }).join(' ')).toContain('zonder rijen')
    expect(ruleWarnings(tabel({ inputs: [] }), { lists }).join(' ')).toContain('minstens één kolom')
  })
})
