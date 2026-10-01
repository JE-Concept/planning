import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PIPELINE } from '../src/lib/pipeline'
import { leesXlsx } from '../functions/aapi/xlsx'
import { parseBlad } from '../functions/aapi/parser'
import { brusselNaarInstant, brusselseDag } from '../functions/aapi/tijd'
import {
  DREMPEL,
  MARGE_NA_MS,
  MARGE_VOOR_MS,
  NIET_BEVESTIGD,
  VOORSPRONG,
  beslis,
  eventVenster,
  kandidatenVoor,
  komtInAanmerking,
  matchShift,
  scoreVan,
} from '../functions/aapi/matcher'

/*
  De statuslijst staat twee keer: hier in `functions/` omdat die codebase niets
  uit `src/` kan importeren. Deze test is de draad ertussen — hernoemt iemand een
  status in de pijplijn, dan valt dit om in plaats van dat de matcher stilletjes
  events gaat meenemen die nog niet bevestigd zijn.
*/
describe('de twee lijsten statussen spreken elkaar niet tegen', () => {
  it('kent elke niet-bevestigde status ook in de pijplijn', () => {
    const bekend = PIPELINE.map((p) => p.key)
    for (const status of NIET_BEVESTIGD) expect(bekend).toContain(status)
  })

  it('sluit precies de verkoopfase uit', () => {
    expect(NIET_BEVESTIGD).toEqual(['request', 'create offer', 'offer send'])
    expect(PIPELINE.map((p) => p.key).slice(0, 3)).toEqual(NIET_BEVESTIGD)
  })
})

const shift = (dag, van, tot, over = {}) => ({
  aapiPlanningId: `p-${dag}-${van}`,
  afdeling: 'evenementen',
  geannuleerd: false,
  start: brusselNaarInstant(`${dag} ${van}:00`),
  eind: brusselNaarInstant(`${dag} ${tot}:00`),
  ...over,
})

const event = (id, dag, over = {}) => ({
  id,
  dag,
  statusName: 'planning ready',
  archived: false,
  eventDate: brusselNaarInstant(`${dag} 12:00:00`),
  ...over,
})

describe('welke events meedoen', () => {
  it('neemt een bevestigd event mee', () => {
    expect(komtInAanmerking(event('e1', '2026-10-25'))).toBe(true)
  })

  // Zolang er geen offerte aanvaard is, is er geen event maar een kans.
  it('laat de verkoopfase buiten beschouwing', () => {
    for (const status of NIET_BEVESTIGD) {
      expect(komtInAanmerking(event('e1', '2026-10-25', { statusName: status }))).toBe(false)
    }
  })

  it('laat een gearchiveerd event en een event zonder datum buiten beschouwing', () => {
    expect(komtInAanmerking(event('e1', '2026-10-25', { archived: true }))).toBe(false)
    expect(komtInAanmerking(event('e1', '2026-10-25', { eventDate: null, startDate: null }))).toBe(false)
  })
})

describe('het venster van een event', () => {
  // Het draaiboek is het echte verhaal: opbouw om 09:00, avondbar om 22:00.
  it('komt uit het draaiboek als dat er is', () => {
    const v = eventVenster(
      event('e1', '2026-10-25', {
        draaiboek: [{ tijd: '09:00', wat: 'Opbouw' }, { tijd: '16:30', wat: 'Receptie' }, { tijd: '22:00', wat: 'Avondbar' }],
      }),
      '2026-10-25'
    )
    expect(v.bron).toBe('draaiboek')
    expect(v.van.toISOString()).toBe('2026-10-25T08:00:00.000Z') // 09:00 Brussel, winteruur
    expect(v.tot.toISOString()).toBe('2026-10-25T21:00:00.000Z') // 22:00 Brussel
  })

  it('valt terug op het beginuur met een standaardduur', () => {
    const v = eventVenster(event('e1', '2026-07-04', { startDate: brusselNaarInstant('2026-07-04 17:00:00') }), '2026-07-04')
    expect(v.bron).toBe('beginuur')
    expect(v.van.toISOString()).toBe('2026-07-04T15:00:00.000Z')
    expect(v.tot.getTime() - v.van.getTime()).toBe(6 * 3600 * 1000)
  })

  // 12:00 en 00:00 staan in de gegevens maar betekenen niets; zie `parts.jsx`.
  it('trapt niet in een plaatshoudertijd', () => {
    expect(eventVenster(event('e1', '2026-07-04'), '2026-07-04')).toBeNull()
    expect(eventVenster(event('e1', '2026-07-04', { eventDate: brusselNaarInstant('2026-07-04 00:00:00') }), '2026-07-04')).toBeNull()
  })
})

describe('de score', () => {
  it('is 1 voor een shift die helemaal binnen het venster past', () => {
    const e = event('e1', '2026-07-04', { startDate: brusselNaarInstant('2026-07-04 14:00:00') })
    expect(scoreVan(shift('2026-07-04', '13:00', '18:00'), e, '2026-07-04')).toBe(1)
  })

  it('is 1 voor elk event op een dag waarvan we alleen de datum kennen', () => {
    expect(scoreVan(shift('2026-07-04', '05:00', '12:00'), event('e1', '2026-07-04'), '2026-07-04')).toBe(1)
  })

  it('zakt naar rato van wat er buiten valt', () => {
    // Event 14:00–20:00, met marge 11:00–23:00. Shift 09:00–13:00 (4 u) valt er
    // twee uur in.
    const e = event('e1', '2026-07-04', { startDate: brusselNaarInstant('2026-07-04 14:00:00') })
    expect(scoreVan(shift('2026-07-04', '09:00', '13:00'), e, '2026-07-04')).toBeCloseTo(0.5, 4)
  })

  it('is 0 voor een shift die het venster helemaal mist', () => {
    const e = event('e1', '2026-07-04', { startDate: brusselNaarInstant('2026-07-04 20:00:00') })
    expect(scoreVan(shift('2026-07-04', '05:00', '09:00'), e, '2026-07-04')).toBe(0)
  })

  it('rekent met de marges die als constante vastliggen', () => {
    expect(MARGE_VOOR_MS).toBe(3 * 3600 * 1000)
    expect(MARGE_NA_MS).toBe(3 * 3600 * 1000)
  })
})

describe('de beslissing', () => {
  it('koppelt één kandidaat die goed genoeg is', () => {
    expect(beslis([{ eventId: 'e1', score: 0.9 }])).toMatchObject({ linkStatus: 'auto', eventId: 'e1', linkScore: 0.9 })
  })

  it('koppelt niets als de enige kandidaat te zwak is', () => {
    expect(beslis([{ eventId: 'e1', score: 0.4 }])).toMatchObject({ linkStatus: 'ambiguous' })
  })

  // De grenzen zelf, want daar gaat zoiets fout.
  it('koppelt precies op de drempel', () => {
    expect(beslis([{ eventId: 'e1', score: DREMPEL }]).linkStatus).toBe('auto')
    expect(beslis([{ eventId: 'e1', score: DREMPEL - 0.0001 }]).linkStatus).toBe('ambiguous')
  })

  it('koppelt precies op de vereiste voorsprong', () => {
    expect(beslis([{ eventId: 'e1', score: 0.9 }, { eventId: 'e2', score: 0.9 - VOORSPRONG }]).linkStatus).toBe('auto')
    expect(beslis([{ eventId: 'e1', score: 0.9 }, { eventId: 'e2', score: 0.9 - VOORSPRONG + 0.0001 }]).linkStatus).toBe('ambiguous')
  })

  it('bewaart alle kandidaten als het twijfelachtig blijft', () => {
    const uit = beslis([{ eventId: 'e1', score: 0.8 }, { eventId: 'e2', score: 0.7 }])
    expect(uit.linkStatus).toBe('ambiguous')
    expect(uit.linkCandidates).toHaveLength(2)
    expect(uit.eventId).toBeNull()
  })

  it('koppelt niets zonder kandidaten', () => {
    expect(beslis([])).toMatchObject({ linkStatus: 'unlinked', eventId: null })
  })
})

describe('shifts die niet meedoen', () => {
  it('geeft bar, zaal en keuken notApplicable en niet none', () => {
    for (const afdeling of ['bar', 'zaal', 'keuken']) {
      expect(matchShift(shift('2026-10-25', '09:00', '17:00', { afdeling }), [event('e1', '2026-10-25')]).linkStatus)
        .toBe('notApplicable')
    }
  })

  it('koppelt een geannuleerde shift niet opnieuw', () => {
    expect(matchShift(shift('2026-10-25', '09:00', '17:00', { geannuleerd: true }), [event('e1', '2026-10-25')]).linkStatus)
      .toBe('unlinked')
  })
})

describe('twee events op één dag', () => {
  const overdag = event('e-dag', '2026-07-04', { startDate: brusselNaarInstant('2026-07-04 11:00:00') })
  const avond = event('e-avond', '2026-07-04', { startDate: brusselNaarInstant('2026-07-04 19:00:00') })

  it('kiest het event waar de shift bij hoort', () => {
    expect(matchShift(shift('2026-07-04', '09:00', '14:00'), [overdag, avond]))
      .toMatchObject({ linkStatus: 'auto', eventId: 'e-dag' })
    expect(matchShift(shift('2026-07-04', '18:00', '23:30'), [overdag, avond]))
      .toMatchObject({ linkStatus: 'auto', eventId: 'e-avond' })
  })

  // Twee events die over elkaar heen lopen: dan is "de hoogste" toeval, en
  // hoort er een mens naar te kijken.
  it('vraagt het aan een mens als twee events over elkaar vallen', () => {
    const een = event('e1', '2026-07-04', { startDate: brusselNaarInstant('2026-07-04 12:00:00') })
    const twee = event('e2', '2026-07-04', { startDate: brusselNaarInstant('2026-07-04 13:00:00') })
    const uit = matchShift(shift('2026-07-04', '11:00', '19:00'), [een, twee])
    expect(uit.linkStatus).toBe('ambiguous')
    expect(uit.linkCandidates.map((k) => k.eventId).sort()).toEqual(['e1', 'e2'])
  })

  // Alleen datums bekend én twee events: dan weten we het echt niet.
  it('vraagt het ook als geen van beide een uur heeft', () => {
    expect(matchShift(shift('2026-07-04', '10:30', '16:00'), [event('e1', '2026-07-04'), event('e2', '2026-07-04')]).linkStatus)
      .toBe('ambiguous')
  })
})

describe('de shifts uit het echte bestand', () => {
  const { shifts } = parseBlad(leesXlsx(readFileSync('tests/fixtures/planning-overview.xlsx')))
  const evenementen = shifts.filter((s) => s.afdeling === 'evenementen' && !s.geannuleerd)

  /*
    Het geval uit de briefing: op 25 oktober staan drie Evenementen-shifts
    (05:00–12:00, 05:00–12:00, 08:00–15:00) en in JE Plan hoort daar de
    Wandelzondag bij. Alledrie moeten ze vanzelf koppelen.
  */
  it('koppelt de drie shifts van de Wandelzondag', () => {
    const wandelzondag = event('e-wandel', '2026-10-25', {
      draaiboek: [{ tijd: '06:00', wat: 'Opbouw' }, { tijd: '10:00', wat: 'Start wandeling' }, { tijd: '14:00', wat: 'Afbraak' }],
    })
    const die = evenementen.filter((s) => brusselseDag(s.start) === '2026-10-25')
    expect(die).toHaveLength(3)
    for (const s of die) {
      expect(matchShift(s, [wandelzondag])).toMatchObject({ linkStatus: 'auto', eventId: 'e-wandel' })
    }
  })

  it('koppelt de twee shifts van 4 oktober aan het event van die dag', () => {
    const e = event('e-okt4', '2026-10-04')
    const die = evenementen.filter((s) => brusselseDag(s.start) === '2026-10-04')
    expect(die).toHaveLength(2)
    for (const s of die) expect(matchShift(s, [e])).toMatchObject({ linkStatus: 'auto', eventId: 'e-okt4' })
  })

  it('laat een shift zonder event die dag ongekoppeld', () => {
    const die = evenementen.find((s) => brusselseDag(s.start) === '2026-10-25')
    expect(matchShift(die, [event('e-elders', '2026-11-11')]).linkStatus).toBe('unlinked')
  })

  it('zoekt kandidaten alleen op de dagen die de shift raakt', () => {
    const die = evenementen.find((s) => brusselseDag(s.start) === '2026-10-04')
    const kandidaten = kandidatenVoor(die, [event('e-okt4', '2026-10-04'), event('e-okt5', '2026-10-05')])
    expect(kandidaten.map((k) => k.eventId)).toEqual(['e-okt4'])
  })
})
