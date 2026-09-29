import { describe, expect, it } from 'vitest'
import { ARCHIEF_NA_DAGEN, isGearchiveerd, jaarVan, jarenIn, splitsArchief } from '../src/lib/archief'

const NU = new Date('2026-09-29T10:00:00')
const dagenGeleden = (n) => new Date(NU.getTime() - n * 86400000)
const event = (extra) => ({ statusName: 'planning ongoing', eventDate: dagenGeleden(10), ...extra })

describe('isGearchiveerd', () => {
  it('archiveert wat iemand op afgerond zette, hoe recent ook', () => {
    expect(isGearchiveerd(event({ statusName: 'complete', eventDate: NU }), { nu: NU })).toBe(true)
  })

  it('laat een gefactureerd event staan zolang de factuur vers is', () => {
    const vers = event({ statusName: 'invoiced', eventDate: dagenGeleden(20) })
    expect(isGearchiveerd(vers, { nu: NU })).toBe(false)
  })

  it('archiveert een gefactureerd event dat lang genoeg geleden is', () => {
    const oud = event({ statusName: 'invoiced', eventDate: dagenGeleden(ARCHIEF_NA_DAGEN + 1) })
    expect(isGearchiveerd(oud, { nu: NU })).toBe(true)
  })

  it('archiveert precies op de grens nog niet', () => {
    const grens = event({ statusName: 'invoiced', eventDate: dagenGeleden(ARCHIEF_NA_DAGEN) })
    expect(isGearchiveerd(grens, { nu: NU })).toBe(false)
  })

  // Hier moet nog iemand iets doen, hoe lang het er ook staat. Dat verstoppen
  // zou de factuur verstoppen.
  it('archiveert nooit wat nog te factureren is', () => {
    const wacht = event({ statusName: 'ready to invoice', eventDate: dagenGeleden(400) })
    expect(isGearchiveerd(wacht, { nu: NU })).toBe(false)
  })

  it('laat een gefactureerd event zonder datum liever op het bord staan', () => {
    const leeg = { statusName: 'invoiced', eventDate: null, dueDate: null, completedAt: null }
    expect(isGearchiveerd(leeg, { nu: NU })).toBe(false)
  })

  it('valt terug op de deadline als er geen eventdatum is', () => {
    const oud = { statusName: 'invoiced', eventDate: null, dueDate: dagenGeleden(200) }
    expect(isGearchiveerd(oud, { nu: NU })).toBe(true)
  })

  it('kijkt niet naar hoofdletters of spaties', () => {
    expect(isGearchiveerd({ statusName: ' Complete ' }, { nu: NU })).toBe(true)
  })

  it('gaat om met niets', () => {
    expect(isGearchiveerd(null, { nu: NU })).toBe(false)
  })
})

describe('splitsArchief', () => {
  it('stopt elk event in precies één van beide lijsten', () => {
    const events = [
      event({ id: 'a' }),
      event({ id: 'b', statusName: 'complete' }),
      event({ id: 'c', statusName: 'invoiced', eventDate: dagenGeleden(365) }),
      event({ id: 'd', statusName: 'ready to invoice', eventDate: dagenGeleden(365) }),
    ]
    const { actief, archief } = splitsArchief(events, { nu: NU })
    expect(actief.map((e) => e.id)).toEqual(['a', 'd'])
    expect(archief.map((e) => e.id)).toEqual(['b', 'c'])
    expect(actief.length + archief.length).toBe(events.length)
  })

  it('gaat om met een lege lijst', () => {
    expect(splitsArchief()).toEqual({ actief: [], archief: [] })
  })
})

describe('jaarVan en jarenIn', () => {
  it('neemt het jaar van de eventdag', () => {
    expect(jaarVan({ eventDate: new Date('2025-12-13T12:00:00') })).toBe(2025)
  })

  it('valt terug op de aanmaakdatum als er geen datum bekend is', () => {
    expect(jaarVan({ createdAt: new Date('2024-03-01T12:00:00') })).toBe(2024)
    expect(jaarVan({})).toBe(null)
  })

  it('geeft de jaren recentste eerst, zonder dubbels', () => {
    const events = [
      { eventDate: new Date('2025-12-13T12:00:00') },
      { eventDate: new Date('2024-09-21T12:00:00') },
      { eventDate: new Date('2025-02-06T12:00:00') },
      {},
    ]
    expect(jarenIn(events)).toEqual([2025, 2024])
  })
})
