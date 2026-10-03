import { describe, expect, it } from 'vitest'
import {
  bezetPerDag,
  conflicten,
  dagenVanReservatie,
  kanErbij,
  reeks,
  teltMee,
  vrijInPeriode,
  vrijOp,
} from '../src/lib/voorraad'

/**
 * De voorraad van verhuurmateriaal.
 *
 * De fout die deze tests moeten tegenhouden is niet een verkeerde optelling
 * maar een verkeerde vraag: beschikbaarheid over een periode is het minimum
 * over de dagen, niet het gemiddelde en niet de eerste dag. Vier vrij op
 * maandag en nul op dinsdag is niet "gemiddeld twee" — het is niet vrij.
 */

const NU = new Date('2027-03-01T10:00:00')
const bar = { id: 'm-bar', naam: 'Mobiele bar Vue', aantal: 4, uitloopDagen: 1 }

const res = (extra = {}) => ({
  id: 'r1',
  materiaalId: 'm-bar',
  aantal: 1,
  van: '2027-03-12',
  tot: '2027-03-14',
  status: 'vast',
  ...extra,
})

describe('welke reservaties meetellen', () => {
  it('telt een vaste reservatie', () => {
    expect(teltMee(res(), NU)).toBe(true)
  })

  it('telt een afgezegde niet', () => {
    expect(teltMee(res({ status: 'geannuleerd' }), NU)).toBe(false)
  })

  it('telt een optie die nog loopt', () => {
    expect(teltMee(res({ status: 'optie', optieVervalt: '2027-03-08' }), NU)).toBe(true)
  })

  /*
    Een verlopen optie hoort vanzelf los te laten. Zou ze blijven staan, dan
    houdt één prijsvrager van vorig jaar een weekend bezet en belt er niemand
    over, want niemand kijkt in een lijst waar niets mis mee lijkt.
  */
  it('laat een verlopen optie los', () => {
    expect(teltMee(res({ status: 'optie', optieVervalt: '2027-02-20' }), NU)).toBe(false)
  })
})

describe('de dagen die een reservatie bezet houdt', () => {
  it('rekent van en tot allebei mee', () => {
    expect(dagenVanReservatie(res(), 0)).toEqual(['2027-03-12', '2027-03-13', '2027-03-14'])
  })

  it('telt de uitlooptijd erbij', () => {
    expect(dagenVanReservatie(res(), 1)).toEqual(['2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15'])
  })

  it('maakt van één dag één dag', () => {
    expect(dagenVanReservatie({ van: '2027-03-12' }, 0)).toEqual(['2027-03-12'])
  })

  it('gaat om met een lege reservatie', () => {
    expect(dagenVanReservatie({}, 1)).toEqual([])
    expect(dagenVanReservatie(null)).toEqual([])
  })

  it('loopt over een maandgrens', () => {
    const dagen = dagenVanReservatie({ van: '2027-03-30', tot: '2027-04-01' }, 0)
    expect(dagen).toEqual(['2027-03-30', '2027-03-31', '2027-04-01'])
  })
})

describe('wat er per dag bezet is', () => {
  const perDag = bezetPerDag(
    [
      res({ id: 'r1', aantal: 2 }),
      res({ id: 'r2', aantal: 1, van: '2027-03-13', tot: '2027-03-13', status: 'optie', optieVervalt: '2027-03-10' }),
      res({ id: 'r3', aantal: 9, status: 'geannuleerd' }),
    ],
    { uitloopDagen: 1, nu: NU }
  )

  it('houdt vast en optie uit elkaar', () => {
    expect(perDag.get('2027-03-13')).toEqual({ vast: 2, optie: 1 })
    expect(perDag.get('2027-03-12')).toEqual({ vast: 2, optie: 0 })
  })

  it('laat de uitloopdag meetellen als bezet', () => {
    expect(perDag.get('2027-03-15')).toEqual({ vast: 2, optie: 0 })
  })

  it('laat een afgezegde reservatie helemaal weg', () => {
    expect(perDag.get('2027-03-12').vast).toBe(2)
  })
})

describe('wat er vrij is', () => {
  const perDag = bezetPerDag([res({ aantal: 2 })], { uitloopDagen: 1, nu: NU })

  it('trekt het bezette van het bezit af', () => {
    expect(vrijOp(bar, '2027-03-13', perDag)).toBe(2)
    expect(vrijOp(bar, '2027-03-20', perDag)).toBe(4)
  })

  it('wordt nooit negatief', () => {
    expect(vrijOp({ aantal: 1 }, '2027-03-13', perDag)).toBe(0)
  })

  /*
    De kern van dit bestand. Drie dagen huren kan alleen als het stuk alle
    drie de dagen vrij is.
  */
  it('neemt over een periode het minimum, niet het gemiddelde', () => {
    const druk = bezetPerDag(
      [
        res({ id: 'a', aantal: 1, van: '2027-03-12', tot: '2027-03-12' }),
        res({ id: 'b', aantal: 4, van: '2027-03-13', tot: '2027-03-13' }),
      ],
      { uitloopDagen: 0, nu: NU }
    )
    expect(vrijOp(bar, '2027-03-12', druk)).toBe(3)
    expect(vrijOp(bar, '2027-03-13', druk)).toBe(0)
    expect(vrijInPeriode(bar, { van: '2027-03-12', tot: '2027-03-14' }, druk)).toBe(0)
  })

  it('geeft het hele bezit terug zonder periode', () => {
    expect(vrijInPeriode(bar, {}, perDag)).toBe(4)
  })
})

describe('conflicten', () => {
  it('meldt de dagen waarop er meer beloofd is dan er staat', () => {
    const perDag = bezetPerDag(
      [res({ id: 'a', aantal: 3 }), res({ id: 'b', aantal: 3, van: '2027-03-13', tot: '2027-03-13' })],
      { uitloopDagen: 0, nu: NU }
    )
    expect(conflicten(bar, perDag)).toEqual([{ dag: '2027-03-13', bezet: 6, aantal: 4, tekort: 2 }])
  })

  it('zwijgt wanneer alles past', () => {
    expect(conflicten(bar, bezetPerDag([res()], { nu: NU }))).toEqual([])
  })
})

describe('de reeks voor een balk', () => {
  it('geeft een rij dagen met wat er vrij is', () => {
    const perDag = bezetPerDag([res({ aantal: 4 })], { uitloopDagen: 1, nu: NU })
    const rij = reeks(bar, { van: '2027-03-11', dagen: 6 }, perDag)
    expect(rij.map((d) => d.vrij)).toEqual([4, 0, 0, 0, 0, 4])
    expect(rij.map((d) => d.over)).toEqual([false, false, false, false, false, false])
  })

  it('merkt een overboeking op', () => {
    const perDag = bezetPerDag([res({ aantal: 5 })], { uitloopDagen: 0, nu: NU })
    expect(reeks(bar, { van: '2027-03-12', dagen: 1 }, perDag)[0]).toMatchObject({ vrij: 0, over: true })
  })
})

describe('kan deze erbij', () => {
  const bestaand = [res({ id: 'r1', aantal: 3 })]

  it('zegt ja zolang er genoeg vrij is', () => {
    expect(kanErbij({ materiaal: bar, van: '2027-03-12', tot: '2027-03-14', aantal: 1, reservaties: bestaand, nu: NU }))
      .toEqual({ kan: true, vrij: 1, gevraagd: 1 })
  })

  it('zegt nee met het aantal erbij, zodat het scherm een zin kan maken', () => {
    expect(kanErbij({ materiaal: bar, van: '2027-03-12', tot: '2027-03-14', aantal: 2, reservaties: bestaand, nu: NU }))
      .toEqual({ kan: false, vrij: 1, gevraagd: 2 })
  })

  /*
    Een bestaande reservatie wijzigen mag niet op zichzelf stuklopen: wie van
    drie naar vier gaat, vraagt er één bij en niet vier.
  */
  it('telt een reservatie die gewijzigd wordt niet tegen zichzelf', () => {
    const uit = kanErbij({
      materiaal: bar,
      van: '2027-03-12',
      tot: '2027-03-14',
      aantal: 4,
      reservaties: bestaand,
      behalve: 'r1',
      nu: NU,
    })
    expect(uit).toEqual({ kan: true, vrij: 4, gevraagd: 4 })
  })

  it('houdt rekening met de uitlooptijd van het artikel', () => {
    // De bar komt de veertiende terug en is de vijftiende nog niet inzetbaar.
    const uit = kanErbij({ materiaal: bar, van: '2027-03-15', tot: '2027-03-15', aantal: 4, reservaties: bestaand, nu: NU })
    expect(uit.kan).toBe(false)
    expect(uit.vrij).toBe(1)
  })
})
