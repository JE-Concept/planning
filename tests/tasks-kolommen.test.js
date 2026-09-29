import { describe, expect, it } from 'vitest'
import { kolomId, planHernoeming, taakVelden } from '../src/lib/tasks-kolommen'

/** Het Tasks-bord zoals het live staat: de namen die uit ClickUp meekwamen. */
const UIT_CLICKUP = [
  { id: 'cu-1', name: 'Opgenomen', color: '#8593a9', kind: 'open', position: 0 },
  { id: 'cu-2', name: 'Samengevat', color: '#3377ff', kind: 'active', position: 1 },
  { id: 'cu-3', name: 'Nagelezen', color: '#008844', kind: 'closed', position: 2 },
]

describe('planHernoeming', () => {
  it('geeft de drie kolommen hun nieuwe naam en de id van een vers bord', () => {
    const { statuses, gewijzigd } = planHernoeming(UIT_CLICKUP)
    expect(gewijzigd).toBe(true)
    expect(statuses.map((s) => s.name)).toEqual(['open', 'on going', 'closed'])
    expect(statuses.map((s) => s.id)).toEqual(['seed-open', 'seed-on-going', 'seed-closed'])
    expect(statuses.map((s) => s.position)).toEqual([0, 1, 2])
  })

  it('zegt per kolom welke taken mee moeten verhuizen', () => {
    const { regels } = planHernoeming(UIT_CLICKUP)
    expect(regels.map((r) => r.actie)).toEqual(['hernoemd', 'hernoemd', 'hernoemd'])
    expect(regels[1].verplaatsing).toEqual({ van: 'cu-2', naar: 'seed-on-going' })
  })

  it('laat een kolom die het niet kent volledig met rust', () => {
    // Niets mag verdwijnen: een kolom die het team zelf maakte houdt haar id,
    // en dus ook haar taken.
    const eigen = { id: 'eigen-1', name: 'Wachten op klant', color: '#abc', kind: 'active', position: 3 }
    const { statuses, regels } = planHernoeming([...UIT_CLICKUP, eigen])
    expect(statuses[3]).toEqual(eigen)
    expect(regels[3]).toEqual({ vanId: 'eigen-1', vanNaam: 'Wachten op klant', actie: 'ongemoeid' })
  })

  it('doet niets meer wanneer ze een tweede keer draait', () => {
    const eerste = planHernoeming(UIT_CLICKUP)
    const tweede = planHernoeming(eerste.statuses)
    expect(tweede.gewijzigd).toBe(false)
    expect(tweede.statuses).toEqual(eerste.statuses)
    expect(tweede.regels.every((r) => r.actie === 'al goed')).toBe(true)
  })

  it('herkent een kolom die iemand al met de hand hernoemde', () => {
    const half = [{ id: 'cu-1', name: 'open', color: '#111', kind: 'open', position: 0 }]
    const { statuses, regels } = planHernoeming(half)
    expect(statuses[0].id).toBe('seed-open')
    expect(regels[0].actie).toBe('hernoemd')
  })

  it('voegt twee kolommen die op dezelfde naam uitkomen niet samen', () => {
    // Samenvoegen is een beslissing van het team, geen bijwerking van een uitrol.
    const dubbel = [
      { id: 'cu-1', name: 'Opgenomen', color: '#1', kind: 'open', position: 0 },
      { id: 'cu-9', name: 'open', color: '#2', kind: 'open', position: 1 },
    ]
    const { statuses, regels } = planHernoeming(dubbel)
    expect(statuses[1]).toEqual(dubbel[1])
    expect(regels[1].actie).toBe('dubbel')
  })

  it('valt niet om op een leeg bord', () => {
    expect(planHernoeming([])).toEqual({ statuses: [], regels: [], gewijzigd: false })
    expect(planHernoeming()).toEqual({ statuses: [], regels: [], gewijzigd: false })
  })
})

describe('taakVelden', () => {
  it('geeft de kopie mee die een taak van haar kolom draagt', () => {
    expect(taakVelden('on going')).toEqual({
      statusId: 'seed-on-going',
      statusName: 'on going',
      statusColor: '#3377ff',
      statusKind: 'active',
      open: true,
    })
  })

  it('zet een taak in de laatste kolom op afgewerkt', () => {
    expect(taakVelden('closed').open).toBe(false)
  })
})

describe('kolomId', () => {
  it('maakt dezelfde id als de seed voor een vers bord maakt', () => {
    expect(kolomId('on going')).toBe('seed-on-going')
    expect(kolomId('open')).toBe('seed-open')
  })
})
