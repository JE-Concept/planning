import { describe, expect, it } from 'vitest'
import { eigenUrenkost, inkoopkost, loonkost, margeVan, minutenVanShift } from '../src/lib/marge'
import { minutenVan } from '../src/lib/aapi-weergave'

/**
 * De marge van een event.
 *
 * Wat hier vooral getest wordt is niet of de optelling klopt — dat is één
 * vermenigvuldiging — maar wat er gebeurt met gegevens die ontbreken. Een
 * marge die een ontbrekende inkoopprijs als nul behandelt, ziet er beter uit
 * naarmate er minder ingevuld is, en dat is het soort fout waar iemand een
 * prijs op zet.
 */

const shift = (extra = {}) => ({
  start: '2027-03-13T16:00:00.000Z',
  end: '2027-03-14T00:00:00.000Z',
  pauseMinutes: 30,
  statuut: 'flexi',
  ...extra,
})

const TARIEVEN = { vast: 32, flexi: 18, student: 15 }

describe('de uren van een shift', () => {
  it('trekt de pauze af', () => {
    expect(minutenVanShift(shift())).toBe(450)
  })

  it('geeft nul bij een shift zonder tijden', () => {
    expect(minutenVanShift({})).toBe(0)
    expect(minutenVanShift(null)).toBe(0)
  })

  it('wordt nooit negatief door een pauze langer dan de dienst', () => {
    expect(minutenVanShift(shift({ pauseMinutes: 999 }))).toBe(0)
  })

  /*
    Dezelfde som staat in `aapi-weergave.js`, waar het scherm de uren mee
    toont. Lopen die twee uit elkaar, dan staat er onder de personeelstab een
    ander aantal uren dan waarmee de marge gerekend heeft, en dan gelooft
    niemand nog een van beide.
  */
  it('rekent hetzelfde als het personeelsscherm', () => {
    for (const geval of [shift(), shift({ pauseMinutes: 0 }), shift({ end: null }), shift({ pauseMinutes: 999 })]) {
      expect(minutenVanShift(geval)).toBe(minutenVan(geval))
    }
  })
})

describe('loonkost', () => {
  it('telt per statuut op en rekent met het tarief van dat statuut', () => {
    const uit = loonkost([shift(), shift(), shift({ statuut: 'vast' })], TARIEVEN)
    expect(uit.uren).toBe(22.5)
    // 15 uur flexi à 18 + 7,5 uur vast à 32
    expect(uit.kost).toBe(510)
    expect(uit.rijen.map((r) => r.statuut)).toEqual(['vast', 'flexi'])
  })

  it('laat een afgezegde shift buiten de rekening', () => {
    const uit = loonkost([shift(), shift({ canceled: true }), shift({ removedFromSourceAt: '2027-03-01' })], TARIEVEN)
    expect(uit.uren).toBe(7.5)
  })

  /*
    Zonder tarief geen kost — maar de uren blijven staan, zodat het scherm kan
    zeggen "er staan nog zeven uur zelfstandige zonder tarief" in plaats van
    stilzwijgend een te lage loonkost te tonen.
  */
  it('meldt een statuut zonder tarief en rekent het niet mee', () => {
    const uit = loonkost([shift(), shift({ statuut: 'zelfstandig' })], TARIEVEN)
    expect(uit.zonderTarief).toEqual(['zelfstandig'])
    expect(uit.kost).toBe(135)
    expect(uit.uren).toBe(15)
  })

  it('gaat om met geen enkele shift', () => {
    expect(loonkost([], TARIEVEN)).toMatchObject({ kost: 0, uren: 0, zonderTarief: [] })
  })
})

describe('inkoopkost', () => {
  const regel = (extra) => ({ item: 'Wijn wit', bestellen: 24, inkoopprijs: 4.2, ...extra })

  it('rekent met wat er besteld wordt, niet met wat er nodig is', () => {
    // 24 flessen besteld (vier bakken van zes) terwijl er 20 nodig zijn.
    expect(inkoopkost([regel({ nodig: 20 })]).kost).toBe(100.8)
  })

  it('telt een regel zonder inkoopprijs niet als gratis, maar meldt haar', () => {
    const uit = inkoopkost([regel(), regel({ item: 'Brood', inkoopprijs: null })])
    expect(uit.kost).toBe(100.8)
    expect(uit.zonderPrijs).toEqual(['Brood'])
  })

  it('slaat een regel over waarvan er niets besteld moet worden', () => {
    expect(inkoopkost([regel({ bestellen: 0, inkoopprijs: null })]).zonderPrijs).toEqual([])
  })
})

describe('eigen uren', () => {
  const profielen = { 'u-jasper': { fullName: 'Jasper', hourlyRate: 48 }, 'u-maxine': { fullName: 'Maxine' } }

  it('rekent de geboekte tijd tegen het uurtarief van het profiel', () => {
    const uit = eigenUrenkost([{ profileId: 'u-jasper', seconds: 7200 }], profielen)
    expect(uit).toMatchObject({ kost: 96, uren: 2 })
  })

  it('meldt wie geen uurtarief heeft en telt die uren niet mee in de kost', () => {
    const uit = eigenUrenkost(
      [{ profileId: 'u-jasper', seconds: 3600 }, { profileId: 'u-maxine', seconds: 3600 }],
      profielen
    )
    expect(uit.kost).toBe(48)
    expect(uit.uren).toBe(2)
    expect(uit.zonderTarief).toEqual(['Maxine'])
  })
})

describe('de marge van een event', () => {
  const event = { quoteAmount: 3432 }
  const volledig = {
    event,
    shifts: [shift(), shift({ statuut: 'vast' })],
    bestellijst: [{ item: 'Wijn wit', bestellen: 24, inkoopprijs: 4.2 }],
    uren: [{ profileId: 'u-jasper', seconds: 7200 }],
    profielen: { 'u-jasper': { fullName: 'Jasper', hourlyRate: 48 } },
    tarieven: TARIEVEN,
  }

  it('trekt loon, inkoop en eigen uren van de opbrengst af', () => {
    const uit = margeVan(volledig)
    // 7,5 u flexi à 18 = 135, 7,5 u vast à 32 = 240, inkoop 100,80, eigen 96
    expect(uit.kost).toBe(571.8)
    expect(uit.marge).toBe(2860.2)
    expect(uit.percent).toBe(83)
    expect(uit.volledig).toBe(true)
  })

  it('valt terug op het oude budgetveld wanneer er geen offertebedrag staat', () => {
    expect(margeVan({ ...volledig, event: { budget: 1000 } }).opbrengst).toBe(1000)
  })

  it('geeft geen percentage zonder opbrengst', () => {
    const uit = margeVan({ ...volledig, event: {} })
    expect(uit.opbrengst).toBe(null)
    expect(uit.marge).toBe(null)
    expect(uit.percent).toBe(null)
    expect(uit.ontbreekt.map((o) => o.soort)).toContain('opbrengst')
  })

  /*
    De kern van dit bestand: onvolledig hoort onvolledig te heten. Een dossier
    waarin de helft van de inkoopprijzen ontbreekt, geeft een te hoge marge,
    en dat is precies de kant op waarin niemand de fout merkt.
  */
  it('heet onvolledig zodra er een bedrag ontbreekt', () => {
    const uit = margeVan({
      ...volledig,
      bestellijst: [{ item: 'Brood', bestellen: 10 }],
      tarieven: { flexi: 18 },
    })
    expect(uit.volledig).toBe(false)
    expect(uit.ontbreekt.map((o) => o.soort).sort()).toEqual(['inkoopprijs', 'tarief'])
  })

  it('merkt op wanneer er geen ploeg aan het event hangt', () => {
    const uit = margeVan({ ...volledig, shifts: [] })
    expect(uit.ontbreekt.map((o) => o.soort)).toContain('geen_ploeg')
    expect(uit.loon.kost).toBe(0)
  })

  it('gaat om met een leeg event', () => {
    const uit = margeVan()
    expect(uit.kost).toBe(0)
    expect(uit.volledig).toBe(false)
  })
})
