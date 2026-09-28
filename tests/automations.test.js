import { describe, expect, it } from 'vitest'
import { ACTION_KINDS, planFor, ruleFires } from '../functions/automations.js'
import { ACTIONS, emptyAction, ruleWarnings } from '../src/lib/automations.js'

/**
 * Dit is de enige code die ongevraagd andermans taken aanpast. Twee dingen
 * moeten daarom kloppen: een regel vuurt op het juiste moment, en ze vuurt niet
 * op elk moment daarna — anders draait ze een bewuste wijziging telkens terug.
 */

const ELKE = 'u-elke'
const JASPER = 'u-jasper'

const regel = (extra = {}) => ({
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

describe('wanneer een regel vuurt', () => {
  it('vuurt zodra een taak de status binnenkomt', () => {
    const { patch, fired } = planFor({
      rules: [regel()],
      task: taak(),
      before: taak({ statusName: 'planning ready' }),
    })
    expect(patch).toEqual({ assignees: [ELKE] })
    expect(fired).toEqual(['r1'])
  })

  it('vuurt niet opnieuw zolang de taak in die status blijft staan', () => {
    // Iemand zette na de wissel bewust Jasper erop. Dat blijft zo.
    const { patch } = planFor({
      rules: [regel()],
      task: taak({ assignees: [JASPER] }),
      before: taak({ assignees: [ELKE] }),
    })
    expect(patch).toEqual({})
  })

  it('vuurt op een taak die meteen in die status wordt aangemaakt', () => {
    const { patch } = planFor({ rules: [regel()], task: taak(), before: null })
    expect(patch).toEqual({ assignees: [ELKE] })
  })

  it('trekt zich niets aan van hoofdletters of spaties in de statusnaam', () => {
    const { patch } = planFor({
      rules: [regel({ trigger: { kind: 'status', status: '  Ready To Invoice ' } })],
      task: taak(),
      before: taak({ statusName: 'invoiced' }),
    })
    expect(patch).toEqual({ assignees: [ELKE] })
  })

  it('blijft van andere lijsten af wanneer de regel er één noemt', () => {
    const rules = [regel({ listId: 'overleg' })]
    expect(ruleFires(rules[0], { task: taak(), before: null })).toBe(false)
    expect(ruleFires(rules[0], { task: taak({ listId: 'overleg' }), before: null })).toBe(true)
  })

  it('doet niets wanneer de regel uitstaat', () => {
    const { patch, fired } = planFor({ rules: [regel({ enabled: false })], task: taak(), before: null })
    expect(patch).toEqual({})
    expect(fired).toEqual([])
  })

  it('vuurt bij "taak aangemaakt" alleen op het aanmaken zelf', () => {
    const r = regel({ trigger: { kind: 'created' }, actions: [{ kind: 'priority', value: 2 }] })
    expect(ruleFires(r, { task: taak(), before: null })).toBe(true)
    expect(ruleFires(r, { task: taak(), before: taak({ statusName: 'request' }) })).toBe(false)
  })

  it('geeft een lege patch wanneer er niets te veranderen valt', () => {
    // Dit is wat de trigger laat stoppen: ze schrijft haar eigen resultaat weg
    // en wordt daardoor opnieuw wakker.
    const { patch } = planFor({ rules: [regel()], task: taak({ assignees: [ELKE] }), before: null })
    expect(patch).toEqual({})
  })
})

describe('wat een regel doet', () => {
  it('vervangt alle toegewezenen bij "wordt de enige"', () => {
    const { patch } = planFor({
      rules: [regel()],
      task: taak({ assignees: [JASPER, 'u-anneleen'] }),
      before: null,
    })
    expect(patch.assignees).toEqual([ELKE])
  })

  it('laat de anderen staan bij "komt erbij"', () => {
    const { patch } = planFor({
      rules: [regel({ actions: [{ kind: 'assignees', mode: 'add', profileIds: [ELKE] }] })],
      task: taak({ assignees: [JASPER] }),
      before: null,
    })
    expect(patch.assignees).toEqual([JASPER, ELKE])
  })

  it('zet een label erbij zonder het te verdubbelen', () => {
    const r = regel({ actions: [{ kind: 'tag', value: 'facturatie' }] })
    expect(planFor({ rules: [r], task: taak(), before: null }).patch.tags).toEqual(['facturatie'])
    expect(planFor({ rules: [r], task: taak({ tags: ['facturatie'] }), before: null }).patch).toEqual({})
  })

  it('zet de prioriteit', () => {
    const { patch } = planFor({
      rules: [regel({ actions: [{ kind: 'priority', value: 1 }] })],
      task: taak(),
      before: null,
    })
    expect(patch).toEqual({ priority: 1 })
  })

  it('rekent de vervaldag vanaf vandaag, op het einde van de werkdag', () => {
    const { patch } = planFor({
      rules: [regel({ actions: [{ kind: 'dueInDays', value: 7 }] })],
      task: taak(),
      before: null,
      now: new Date('2026-09-28T09:20:00'),
    })
    expect(patch.dueDate.toISOString().slice(0, 10)).toBe('2026-10-05')
    expect(patch.dueDate.getHours()).toBe(17)
  })

  it('ziet een Firestore-Timestamp als dezelfde datum', () => {
    const doel = new Date('2026-10-05T17:00:00')
    const stamp = { toMillis: () => doel.getTime() }
    const { patch } = planFor({
      rules: [regel({ actions: [{ kind: 'dueInDays', value: 7 }] })],
      task: taak({ dueDate: stamp }),
      before: null,
      now: new Date('2026-09-28T09:20:00'),
    })
    expect(patch).toEqual({})
  })

  it('past meerdere regels toe in de volgorde waarin ze staan', () => {
    const { patch, fired } = planFor({
      rules: [
        regel({ id: 'laat', position: 2, actions: [{ kind: 'assignees', mode: 'set', profileIds: [ELKE] }] }),
        regel({ id: 'vroeg', position: 1, actions: [{ kind: 'assignees', mode: 'set', profileIds: [JASPER] }] }),
      ],
      task: taak({ assignees: [] }),
      before: null,
    })
    expect(fired).toEqual(['vroeg', 'laat'])
    expect(patch.assignees).toEqual([ELKE])
  })
})

describe('de interface en de motor spreken dezelfde taal', () => {
  it('elke actie die je kunt kiezen, wordt ook uitgevoerd', () => {
    expect(ACTIONS.map((a) => a.kind).sort()).toEqual([...ACTION_KINDS].sort())
  })

  it('elke actie uit het formulier levert, ingevuld, een echte wijziging', () => {
    const gevuld = {
      assignees: { profileIds: [ELKE] },
      priority: {},
      tag: { value: 'facturatie' },
      dueInDays: {},
    }

    for (const { kind } of ACTIONS) {
      const action = { ...emptyAction(kind), ...gevuld[kind] }
      const { patch } = planFor({ rules: [regel({ actions: [action] })], task: taak(), before: null })
      expect(Object.keys(patch), `actie ${kind} verandert niets`).not.toHaveLength(0)
    }
  })
})

describe('waarschuwingen bij een regel', () => {
  const lists = [
    { id: 'overview-planning', name: 'Events', statuses: [{ name: 'ready to invoice' }] },
    { id: 'overleg', name: 'Tasks', statuses: [{ name: 'samengevat' }] },
  ]

  it('zwijgt over een regel die klopt', () => {
    expect(ruleWarnings(regel(), { lists })).toEqual([])
  })

  it('zegt het wanneer geen enkele lijst die status heeft', () => {
    const w = ruleWarnings(regel({ trigger: { kind: 'status', status: 'gefactureerd' } }), { lists })
    expect(w.join(' ')).toContain('vuurt nooit')
  })

  it('zegt het wanneer de status niet op de gekozen lijst staat', () => {
    const w = ruleWarnings(regel({ listId: 'overleg' }), { lists })
    expect(w.join(' ')).toContain('niet op die lijst')
  })

  it('zegt het wanneer er geen actie of geen persoon gekozen is', () => {
    expect(ruleWarnings(regel({ actions: [] }), { lists }).join(' ')).toContain('Zonder actie')
    expect(
      ruleWarnings(regel({ actions: [{ kind: 'assignees', mode: 'set', profileIds: [] }] }), { lists }).join(' ')
    ).toContain('Kies wie')
  })
})
