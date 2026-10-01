import { describe, expect, it } from 'vitest'
import {
  AFDELINGEN,
  ZEKER_VANAF,
  kleurVan,
  minutenVan,
  mogelijkVoor,
  naamVan,
  perDag,
  samenvatting,
  standVan,
  teltMee,
  urenTekst,
  vraagtAandacht,
} from '../src/lib/aapi-weergave'
import { AFDELINGEN as BRON_AFDELINGEN } from '../functions/aapi/normaliseer'

/*
  De afdelingen staan twee keer: in `functions/` omdat de import ze normaliseert,
  en hier omdat de kalender ze op volgorde zet en kleurt. Die codebases kunnen
  elkaar niet importeren; deze test is de draad ertussen.
*/
it('de afdelingen van de import en van het scherm zijn dezelfde', () => {
  expect(AFDELINGEN).toEqual(BRON_AFDELINGEN)
})

const shift = (over = {}) => ({
  aapiPlanningId: 'p-1',
  locationName: 'evenementen',
  statuut: 'flexi',
  start: new Date('2026-10-25T04:00:00Z'),
  end: new Date('2026-10-25T11:00:00Z'),
  pauseMinutes: 30,
  canceled: false,
  removedFromSourceAt: null,
  linkStatus: 'auto',
  linkScore: 1,
  dag: '2026-10-25',
  ...over,
})

describe('de naam bij een shift', () => {
  const kaartjes = { 'e-1': { aapiEmployeeId: 'e-1', displayName: 'Jumana Mhanawi' } }

  it('komt van het medewerkerskaartje', () => {
    expect(naamVan({ aapiEmployeeId: 'e-1' }, kaartjes)).toBe('Jumana Mhanawi')
  })

  /*
    De shifts die vóór het veld `naam` geïmporteerd zijn, dragen er geen — en
    een herimport schrijft een ongewijzigde rij niet opnieuw. Zonder het
    kaartje erbij zouden die voor altijd een GUID tonen, en dat is precies wat
    er live stond.
  */
  it('valt terug op wat er op de shift staat, en pas dan op de GUID', () => {
    expect(naamVan({ aapiEmployeeId: 'onbekend', naam: 'Lore Lelièvre' }, kaartjes)).toBe('Lore Lelièvre')
    expect(naamVan({ aapiEmployeeId: '84d70eee-d821-4331' }, kaartjes)).toBe('84d70eee-d821-4331')
  })

  // Het kaartje wint van wat er op de shift staat: wordt een naam rechtgezet,
  // dan is dat daar gebeurd en niet op elke shift apart.
  it('laat het kaartje voorgaan op de shift', () => {
    expect(naamVan({ aapiEmployeeId: 'e-1', naam: 'JUMANA  MHANAWI' }, kaartjes)).toBe('Jumana Mhanawi')
  })

  it('valt nooit stil', () => {
    expect(naamVan({}, {})).toBe('—')
    expect(naamVan(null)).toBe('—')
  })
})

describe('de stand van een shift', () => {
  it('is gepland bij een koppeling waar niets op aan te merken is', () => {
    expect(standVan(shift())).toBe('gepland')
    expect(standVan(shift({ linkStatus: 'manual', linkScore: null }))).toBe('gepland')
  })

  // Een koppeling die de machine zelf niet zeker genoeg vond, heet voorgesteld.
  it('is voorgesteld bij een zwakke automatische koppeling', () => {
    expect(standVan(shift({ linkScore: ZEKER_VANAF - 0.01 }))).toBe('voorgesteld')
    expect(standVan(shift({ linkScore: ZEKER_VANAF }))).toBe('gepland')
  })

  it('is twijfel of ongekoppeld als er geen event aan hangt', () => {
    expect(standVan(shift({ linkStatus: 'ambiguous', linkScore: null }))).toBe('twijfel')
    expect(standVan(shift({ linkStatus: 'unlinked', linkScore: null }))).toBe('ongekoppeld')
    expect(standVan(shift({ linkStatus: 'none', linkScore: null }))).toBe('ongekoppeld')
  })

  /*
    De volgorde telt. Wie niet meer in AAPI staat is geen geplande kracht meer,
    ook al zegt zijn koppeling van wel — en dat moet zwaarder wegen dan de
    koppeling, anders staat er "gepland" bij iemand die er niet is.
  */
  it('laat geannuleerd en verdwenen voorgaan op de koppeling', () => {
    expect(standVan(shift({ canceled: true }))).toBe('geannuleerd')
    expect(standVan(shift({ removedFromSourceAt: new Date() }))).toBe('verdwenen')
    expect(standVan(shift({ canceled: true, removedFromSourceAt: new Date() }))).toBe('verdwenen')
  })
})

describe('de uren', () => {
  it('trekt de pauze eraf', () => {
    expect(minutenVan(shift())).toBe(7 * 60 - 30)
    expect(minutenVan(shift({ pauseMinutes: 0 }))).toBe(7 * 60)
  })

  // Een geannuleerde shift staat er nog, maar er komt niemand werken.
  it('telt niets voor wie afgezegd of verdwenen is', () => {
    expect(minutenVan(shift({ canceled: true }))).toBe(0)
    expect(minutenVan(shift({ removedFromSourceAt: new Date() }))).toBe(0)
  })

  it('wordt nooit negatief door een pauze die langer is dan de shift', () => {
    expect(minutenVan(shift({ pauseMinutes: 999 }))).toBe(0)
  })

  it('schrijft zich als uren en minuten', () => {
    expect(urenTekst(450)).toBe('7u30')
    expect(urenTekst(420)).toBe('7u')
    expect(urenTekst(0)).toBe('0u')
  })

  it('telt mee wie er echt komt', () => {
    expect(teltMee(shift())).toBe(true)
    expect(teltMee(shift({ canceled: true }))).toBe(false)
  })
})

describe('de samenvatting boven een event', () => {
  const shifts = [
    shift({ aapiPlanningId: 'a', statuut: 'flexi' }),
    shift({ aapiPlanningId: 'b', statuut: 'student', pauseMinutes: 0 }),
    shift({ aapiPlanningId: 'c', statuut: 'flexi', canceled: true }),
  ]

  it('telt wie er komt, met hun uren en statuut', () => {
    const uit = samenvatting(shifts)
    expect(uit.gepland).toBe(2)
    expect(uit.afgezegd).toBe(1)
    expect(uit.minuten).toBe(7 * 60 - 30 + 7 * 60)
    expect(uit.perStatuut).toEqual({ flexi: 1, student: 1 })
  })

  it('verdraagt een event waar niemand op staat', () => {
    expect(samenvatting([])).toEqual({ gepland: 0, afgezegd: 0, minuten: 0, perStatuut: {} })
  })
})

describe('wat er nog bij dit event zou kunnen horen', () => {
  const dagen = ['2026-10-25']

  it('neemt een twijfelgeval mee waarin dit event kandidaat is', () => {
    const s = shift({ linkStatus: 'ambiguous', linkScore: null, linkCandidates: [{ eventId: 'e1', score: 0.6 }] })
    expect(mogelijkVoor('e1', dagen, [s])).toHaveLength(1)
    expect(mogelijkVoor('e2', dagen, [s])).toHaveLength(0)
  })

  it('neemt een ongekoppelde shift van die dag mee', () => {
    expect(mogelijkVoor('e1', dagen, [shift({ linkStatus: 'unlinked', linkScore: null })])).toHaveLength(1)
  })

  // Wat al ergens aan hangt, en wat een mens op "geen event" zette, blijft weg.
  it('laat wat al gekoppeld is en wat iemand afwees met rust', () => {
    expect(mogelijkVoor('e1', dagen, [shift({ eventRef: 'e9' })])).toHaveLength(0)
    expect(mogelijkVoor('e1', dagen, [shift({ linkStatus: 'none', linkScore: null })])).toHaveLength(0)
  })

  it('kijkt alleen naar de afdeling Evenementen en naar de juiste dagen', () => {
    expect(mogelijkVoor('e1', dagen, [shift({ linkStatus: 'unlinked', locationName: 'bar' })])).toHaveLength(0)
    expect(mogelijkVoor('e1', ['2026-10-26'], [shift({ linkStatus: 'unlinked' })])).toHaveLength(0)
  })
})

describe('de kalender', () => {
  it('bundelt per dag en zet de vroegste bovenaan', () => {
    const uit = perDag([
      shift({ aapiPlanningId: 'laat', start: new Date('2026-10-25T07:00:00Z') }),
      shift({ aapiPlanningId: 'vroeg', start: new Date('2026-10-25T04:00:00Z') }),
      shift({ aapiPlanningId: 'andere-dag', dag: '2026-10-26' }),
    ])
    expect(Object.keys(uit).sort()).toEqual(['2026-10-25', '2026-10-26'])
    expect(uit['2026-10-25'].map((s) => s.aapiPlanningId)).toEqual(['vroeg', 'laat'])
  })

  it('wijst alleen op evenementenshifts waar iets aan schort', () => {
    expect(vraagtAandacht(shift({ linkStatus: 'ambiguous' }))).toBe(true)
    expect(vraagtAandacht(shift({ linkStatus: 'unlinked' }))).toBe(true)
    expect(vraagtAandacht(shift())).toBe(false)
    expect(vraagtAandacht(shift({ linkStatus: 'unlinked', locationName: 'keuken' }))).toBe(false)
    // Een afgezegde shift die nergens bij hoort is geen probleem meer.
    expect(vraagtAandacht(shift({ linkStatus: 'unlinked', canceled: true }))).toBe(false)
  })

  it('geeft elke afdeling een eigen kleur en de rest een neutrale', () => {
    expect(new Set(AFDELINGEN.map(kleurVan)).size).toBe(4)
    expect(kleurVan('terras')).toBe('#55637a')
  })
})
