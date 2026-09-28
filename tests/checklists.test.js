import { describe, expect, it } from 'vitest'
import {
  CHECKLIST_TEMPLATES,
  CLOSING,
  OPENING,
  isWeekend,
  itemApplies,
  requiredItems,
  runId,
  runProgress,
} from '../src/lib/checklist-templates.js'

describe('de lijsten zelf', () => {
  it('heeft een openings- en een sluitingslijst', () => {
    expect(CHECKLIST_TEMPLATES.map((c) => c.id)).toEqual(['openen', 'sluiten'])
    expect(OPENING.kind).toBe('open')
    expect(CLOSING.kind).toBe('close')
  })

  it('geeft elk punt een eigen id — de afvinkingen hangen eraan', () => {
    for (const template of CHECKLIST_TEMPLATES) {
      const ids = template.sections.flatMap((s) => s.items).map((i) => i.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.every(Boolean)).toBe(true)
    }
  })

  it('houdt de toegangscodes achter de secret-vlag', () => {
    const all = CHECKLIST_TEMPLATES.flatMap((t) => t.sections.flatMap((s) => s.items))
    const metCode = all.filter((i) => /\b\d{4}\b/.test(`${i.label} ${i.hint ?? ''}`))
    expect(metCode.length).toBeGreaterThan(0)
    for (const item of metCode) expect(item.secret).toBe(true)
    // En nooit in het label zelf: dat staat altijd op het scherm.
    for (const item of all) expect(item.label).not.toMatch(/\b\d{4}\b/)
  })
})

describe('weekendpunten', () => {
  it('herkent zaterdag en zondag', () => {
    expect(isWeekend(new Date('2026-09-26T10:00:00'))).toBe(true) // zaterdag
    expect(isWeekend(new Date('2026-09-27T10:00:00'))).toBe(true) // zondag
    expect(isWeekend(new Date('2026-09-28T10:00:00'))).toBe(false) // maandag
  })

  it('tellen enkel mee in het weekend', () => {
    const item = { id: 'x', label: 'Toiletten', weekendOnly: true }
    expect(itemApplies(item, { weekend: true })).toBe(true)
    expect(itemApplies(item, { weekend: false })).toBe(false)
  })

  it('maken de lijst in het weekend langer dan doordeweeks', () => {
    const week = requiredItems(CLOSING, { weekend: false }).length
    const weekend = requiredItems(CLOSING, { weekend: true }).length
    expect(weekend).toBeGreaterThan(week)
  })
})

describe('runProgress', () => {
  const run = (ids) => ({ items: Object.fromEntries(ids.map((id) => [id, { done: true }])) })

  it('is nul zonder run', () => {
    const p = runProgress(OPENING, undefined, { weekend: false })
    expect(p.done).toBe(0)
    expect(p.ratio).toBe(0)
    expect(p.total).toBeGreaterThan(0)
  })

  it('telt alleen de punten die vandaag gelden', () => {
    // Een weekendpunt afvinken op een weekdag telt niet mee in de noemer,
    // anders staat de lijst nooit op 100%.
    const p = runProgress(OPENING, run(['toiletten-open']), { weekend: false })
    expect(p.done).toBe(0)
    expect(p.total).toBe(requiredItems(OPENING, { weekend: false }).length)
  })

  it('komt op 1 als alles wat geldt afgevinkt is', () => {
    const ids = requiredItems(OPENING, { weekend: false }).map((i) => i.id)
    const p = runProgress(OPENING, run(ids), { weekend: false })
    expect(p.done).toBe(p.total)
    expect(p.ratio).toBe(1)
  })

  it('negeert een uitgevinkt punt', () => {
    const p = runProgress(OPENING, { items: { sleutel: { done: false } } }, { weekend: false })
    expect(p.done).toBe(0)
  })
})

describe('runId', () => {
  it('is dezelfde voor iedereen op dezelfde dag — daarom kan je samen afvinken', () => {
    expect(runId('openen', '2026-09-28')).toBe('openen_2026-09-28')
    expect(runId('openen', '2026-09-28')).toBe(runId('openen', '2026-09-28'))
  })

  it('scheidt lijsten en dagen', () => {
    expect(runId('openen', '2026-09-28')).not.toBe(runId('sluiten', '2026-09-28'))
    expect(runId('openen', '2026-09-28')).not.toBe(runId('openen', '2026-09-29'))
  })
})

// De demobuild draait op een eigen in-memory Firestore. Als die ondiep zou
// mergen, zou wie afvinkt de vinkjes van zijn collega's wissen — precies wat
// deze lijst níét mag doen. Dit pint het gedrag vast op wat Firestore doet.
describe('samen afvinken in dezelfde run', () => {
  it('houdt de vinkjes van een ander bij een merge', async () => {
    const { doc, setDoc, getDoc, arrayUnion } = await import('../demo/firestore.js')
    const ref = doc(null, 'checklistRuns', 'openen_2026-09-28')

    await setDoc(ref, { day: '2026-09-28', items: { sleutel: { done: true, byName: 'Charish' } }, participants: arrayUnion('u-charish') }, { merge: true })
    await setDoc(ref, { items: { alarm: { done: true, byName: 'Elke' } }, participants: arrayUnion('u-elke') }, { merge: true })

    const data = (await getDoc(ref)).data()
    expect(data.items.sleutel.byName).toBe('Charish')
    expect(data.items.alarm.byName).toBe('Elke')
    expect(data.participants.sort()).toEqual(['u-charish', 'u-elke'])
  })

  it('laat een uitvinking het punt van de ander ongemoeid', async () => {
    const { doc, setDoc, getDoc } = await import('../demo/firestore.js')
    const ref = doc(null, 'checklistRuns', 'sluiten_2026-09-28')

    await setDoc(ref, { items: { tap_dicht: { done: true, byName: 'Elke' }, glazen: { done: true, byName: 'Charish' } } }, { merge: true })
    await setDoc(ref, { items: { glazen: { done: false, byName: null } } }, { merge: true })

    const data = (await getDoc(ref)).data()
    expect(data.items.tap_dicht.done).toBe(true)
    expect(data.items.glazen.done).toBe(false)
  })
})
