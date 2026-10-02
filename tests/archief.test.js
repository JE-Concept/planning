import { describe, expect, it } from 'vitest'
import { ARCHIEF_NA_DAGEN as SCHERM_NA_DAGEN } from '../src/lib/archief'
import {
  ARCHIEF_NA_DAGEN,
  afsluitDatum,
  archiefVelden,
  isGearchiveerd,
  jaarVan,
  moetBijgewerkt,
} from '../functions/archief-stand.js'

/*
  De archiefregel staat op één plek: `functions/archief-stand.js`. De server
  past hem toe en schrijft het antwoord op het document; de app vraagt alleen
  nog wat er níét op staat. Daarom staan de tests hier op de serverkopie en
  niet meer op een tweede kopie in de browser — die is er niet meer.

  Wat het scherm nog wél zelf zegt, is het getal in de uitlegzin ("meer dan
  zestig dagen geleden afgerond"). Dat getal staat onderaan getest.
*/

const NU = new Date('2026-09-29T10:00:00')
const dagenGeleden = (n) => new Date(NU.getTime() - n * 86400000)
const event = (extra) => ({ statusName: 'planning ongoing', eventDate: dagenGeleden(10), ...extra })

describe('isGearchiveerd', () => {
  it('archiveert wat iemand op afgerond zette, hoe recent ook', () => {
    expect(isGearchiveerd(event({ statusName: 'complete', eventDate: NU }), { nu: NU })).toBe(true)
  })

  it('laat een gefactureerd event staan zolang de factuur vers is', () => {
    const vers = event({ statusName: 'invoiced', eventDate: dagenGeleden(10) })
    expect(isGearchiveerd(vers, { nu: NU })).toBe(false)
  })

  it('archiveert een gefactureerd event zodra de factuur oud is', () => {
    const oud = event({ statusName: 'invoiced', eventDate: dagenGeleden(90) })
    expect(isGearchiveerd(oud, { nu: NU })).toBe(true)
  })

  it('laat precies op de grens het event nog staan', () => {
    const grens = event({ statusName: 'invoiced', eventDate: dagenGeleden(ARCHIEF_NA_DAGEN) })
    expect(isGearchiveerd(grens, { nu: NU })).toBe(false)
  })

  it('verbergt nooit wat nog gefactureerd moet worden', () => {
    const wacht = event({ statusName: 'ready to invoice', eventDate: dagenGeleden(400) })
    expect(isGearchiveerd(wacht, { nu: NU })).toBe(false)
  })

  it('laat een gefactureerd event zonder enige datum staan', () => {
    const leeg = { statusName: 'invoiced' }
    expect(isGearchiveerd(leeg, { nu: NU })).toBe(false)
  })

  it('valt terug op de deadline wanneer er geen eventdag is', () => {
    const oud = { statusName: 'invoiced', dueDate: dagenGeleden(120) }
    expect(isGearchiveerd(oud, { nu: NU })).toBe(true)
  })

  it('leest de status los van hoofdletters en spaties', () => {
    expect(isGearchiveerd({ statusName: ' Complete ' }, { nu: NU })).toBe(true)
  })

  it('gaat om met niets', () => {
    expect(isGearchiveerd(null, { nu: NU })).toBe(false)
  })
})

describe('afsluitDatum', () => {
  it('neemt de laatste dag van een meerdaags event', () => {
    const festival = { eventDate: dagenGeleden(62), eventEndDate: dagenGeleden(59) }
    expect(afsluitDatum(festival)).toEqual(dagenGeleden(59))
  })

  it('negeert een einddatum die vóór de begindag ligt', () => {
    const onzin = { eventDate: dagenGeleden(10), eventEndDate: dagenGeleden(40) }
    expect(afsluitDatum(onzin)).toEqual(dagenGeleden(10))
  })

  it('houdt een meerdaags event dat nog loopt uit het archief', () => {
    const loopt = { statusName: 'invoiced', eventDate: dagenGeleden(62), eventEndDate: dagenGeleden(59) }
    expect(isGearchiveerd(loopt, { nu: NU })).toBe(false)
  })
})

describe('jaarVan', () => {
  it('neemt het jaar van de eventdag', () => {
    expect(jaarVan({ eventDate: new Date('2025-12-13T12:00:00') })).toBe(2025)
  })

  it('valt terug op de aanmaakdatum als er geen datum bekend is', () => {
    expect(jaarVan({ createdAt: new Date('2024-03-01T12:00:00') })).toBe(2024)
    expect(jaarVan({})).toBe(null)
  })
})

describe('wat er op het document komt te staan', () => {
  const nu = new Date('2026-10-02T12:00:00Z')
  const geleden = (n) => new Date(nu.getTime() - n * 86400000)

  it('schrijft het jaar alleen op wat ook echt afgesloten is', () => {
    const dicht = archiefVelden({ statusName: 'complete', eventDate: geleden(5) }, { nu })
    expect(dicht).toEqual({ afgesloten: true, afgeslotenJaar: 2026 })

    const open = archiefVelden({ statusName: 'create offer', eventDate: geleden(5) }, { nu })
    expect(open).toEqual({ afgesloten: false, afgeslotenJaar: null })
  })

  it('merkt wanneer het document niet meer klopt', () => {
    const dossier = { statusName: 'complete', eventDate: geleden(5) }
    expect(moetBijgewerkt(dossier, { nu })).toBe(true)
    expect(moetBijgewerkt({ ...dossier, afgesloten: true, afgeslotenJaar: 2026 }, { nu })).toBe(false)
    // Een event dat van status wisselt, moet terug open.
    expect(moetBijgewerkt({ statusName: 'create offer', afgesloten: true, afgeslotenJaar: 2026 }, { nu })).toBe(true)
  })

  /*
    Het scherm zegt "meer dan zestig dagen geleden afgerond". Staat dat getal
    los van waar de server mee rekent, dan staat er een zin op het scherm die
    niet klopt — en dat is precies het soort fout dat niemand meldt omdat
    niemand het narekent.
  */
  it('en het getal in de uitleg op het scherm is hetzelfde', () => {
    expect(SCHERM_NA_DAGEN).toBe(ARCHIEF_NA_DAGEN)
  })
})
