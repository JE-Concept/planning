import { describe, expect, it } from 'vitest'
import { BTW_VERHUUR, huurTotaal, isLosTeHuren, isWeekend, prijsVoorPeriode, regelPrijs } from '../src/lib/huurprijs'

/**
 * Wat een huur kost.
 *
 * Dit is de enige rekensom in de tool die een klant zelf naleest, met zijn
 * telefoon erbij. Hij moet dus niet alleen kloppen maar ook uit te leggen
 * zijn: zes dagen mag niet duurder zijn dan een week, en een weekend mag
 * niet duurder zijn dan drie losse dagen.
 */

const bar = {
  id: 'm-bar',
  naam: 'Mobiele bar Vue',
  prijsPerDag: 185,
  prijsWeekend: 260,
  prijsWeek: 650,
  waarborg: 150,
  directTeHuren: false,
}

/** Maart 2027: de 12e is een vrijdag. */
const vr = '2027-03-12'
const za = '2027-03-13'
const zo = '2027-03-14'
const ma = '2027-03-15'
const di = '2027-03-16'
const wo = '2027-03-17'

describe('weekend herkennen', () => {
  it('ziet vrijdag tot maandag als weekend', () => {
    expect(isWeekend([vr, za, zo, ma])).toBe(true)
    expect(isWeekend([za, zo])).toBe(true)
  })

  /*
    Het weekendtarief is geen duur maar een plek op de kalender. Drie dagen
    midden in de week zijn geen weekend, hoe lang ze ook duren.
  */
  it('ziet drie dagen midden in de week niet als weekend', () => {
    expect(isWeekend([ma, di, wo])).toBe(false)
  })

  it('ziet een periode die over het weekend heen loopt niet als weekend', () => {
    expect(isWeekend([vr, za, zo, ma, di])).toBe(false)
  })
})

describe('de prijs voor een periode', () => {
  it('rekent losse dagen tegen de dagprijs', () => {
    expect(prijsVoorPeriode(bar, [di, wo]).bedrag).toBe(370)
  })

  it('neemt het weekendtarief wanneer dat goedkoper is', () => {
    // Drie losse dagen zou 555 zijn; het weekend kost 260.
    const uit = prijsVoorPeriode(bar, [vr, za, zo])
    expect(uit.bedrag).toBe(260)
    expect(uit.opbouw[0].wat).toBe('weekend')
  })

  it('rekent een hele week tegen het weektarief', () => {
    expect(prijsVoorPeriode(bar, [vr, za, zo, ma, di, wo, '2027-03-18']).bedrag).toBe(650)
  })

  /*
    De regel die het geheel geloofwaardig houdt. Zes dagen zou 6 × 185 = 1110
    zijn, en dat is meer dan een week. Een klant die dat narekent, belt — en
    hij heeft gelijk.
  */
  it('laat zes dagen nooit duurder zijn dan een week', () => {
    const uit = prijsVoorPeriode(bar, [ma, di, wo, '2027-03-18', '2027-03-19', '2027-03-20'])
    expect(uit.bedrag).toBe(650)
    expect(uit.opbouw[0].plafond).toBe(true)
  })

  it('rekent negen dagen als een week plus de rest', () => {
    // Maandag starten: de rest zijn dinsdag en woensdag, twee gewone dagen.
    const negen = Array.from({ length: 9 }, (_, i) => `2027-03-${String(15 + i).padStart(2, '0')}`)
    // 650 + 2 × 185 = 1020, en dat is minder dan twee weken (1300).
    expect(prijsVoorPeriode(bar, negen).bedrag).toBe(1020)
  })

  /*
    Valt de rest ná de volle week zelf in een weekend, dan geldt daar ook het
    weekendtarief voor. Dat is geen uitzondering maar dezelfde regel: de klant
    krijgt de goedkoopste geldige combinatie, waar in de reeks ze ook valt.
  */
  it('geeft ook de rest na een volle week het weekendtarief', () => {
    const negen = [vr, za, zo, ma, di, wo, '2027-03-18', '2027-03-19', '2027-03-20']
    // De dagen 8 en 9 zijn vrijdag en zaterdag: 650 + 260 in plaats van 650 + 370.
    expect(prijsVoorPeriode(bar, negen).bedrag).toBe(910)
  })

  it('laat dertien dagen nooit duurder zijn dan twee weken', () => {
    const dertien = Array.from({ length: 13 }, (_, i) => `2027-03-${String(12 + i).padStart(2, '0')}`)
    // 650 + 6 × 185 = 1760 zou meer zijn dan twee weken (1300).
    expect(prijsVoorPeriode(bar, dertien).bedrag).toBe(1300)
  })

  it('rekent niets zonder dagen', () => {
    expect(prijsVoorPeriode(bar, []).bedrag).toBe(0)
  })

  /*
    Geen dagprijs is niet gratis. Net als bij de inkoopprijs op de
    bestellijst: een ontbrekend bedrag dat als nul meetelt, maakt een
    offerte stilletjes te goedkoop.
  */
  it('meldt een artikel zonder dagprijs in plaats van het gratis te maken', () => {
    const uit = prijsVoorPeriode({ naam: 'Onbekend stuk' }, [di, wo])
    expect(uit.bedrag).toBe(0)
    expect(uit.geenTarief).toBe(true)
  })

  it('redt zich zonder weekend- en weektarief', () => {
    expect(prijsVoorPeriode({ prijsPerDag: 10 }, [vr, za, zo]).bedrag).toBe(30)
  })
})

describe('een regel met aantal en korting', () => {
  it('vermenigvuldigt met het aantal', () => {
    expect(regelPrijs({ materiaal: bar, aantal: 3, dagen: [di, wo] }).bruto).toBe(1110)
  })

  it('trekt de korting van de klant af', () => {
    const r = regelPrijs({ materiaal: bar, aantal: 2, dagen: [di, wo], kortingPercent: 10 })
    expect(r.bruto).toBe(740)
    expect(r.korting).toBe(74)
    expect(r.netto).toBe(666)
  })

  it('telt de waarborg per stuk', () => {
    expect(regelPrijs({ materiaal: bar, aantal: 3, dagen: [di] }).waarborg).toBe(450)
  })

  it('negeert een onzinnig kortingspercentage', () => {
    expect(regelPrijs({ materiaal: bar, aantal: 1, dagen: [di], kortingPercent: 500 }).netto).toBe(0)
    expect(regelPrijs({ materiaal: bar, aantal: 1, dagen: [di], kortingPercent: -20 }).korting).toBe(0)
  })
})

describe('het totaal van een huur', () => {
  const regels = [
    regelPrijs({ materiaal: bar, aantal: 1, dagen: [vr, za, zo], kortingPercent: 10 }),
    regelPrijs({ materiaal: { id: 'm-koeling', naam: 'Koelkast', prijsPerDag: 45, waarborg: 50 }, aantal: 2, dagen: [vr, za, zo] }),
  ]

  it('telt netto, btw en waarborg apart op', () => {
    const t = huurTotaal(regels)
    // Bar: weekend 260 min 10% = 234. Koeling: 2 × 3 × 45 = 270.
    expect(t.exclBtw).toBe(504)
    expect(t.btw).toBe(105.84)
    expect(t.inclBtw).toBe(609.84)
    expect(t.waarborg).toBe(250)
  })

  /*
    De waarborg staat buiten de btw en buiten de omzet: het is geld dat je
    vasthoudt en teruggeeft. Bij het factuurbedrag optellen is een fout die
    pas bij de afsluiting opvalt.
  */
  it('houdt de waarborg buiten de btw maar binnen wat er afgerekend wordt', () => {
    const t = huurTotaal(regels)
    expect(t.btw).toBe(Math.round(t.exclBtw * (BTW_VERHUUR / 100) * 100) / 100)
    expect(t.teBetalen).toBe(859.84)
  })

  it('noemt zichzelf onvolledig wanneer een artikel geen tarief heeft', () => {
    const t = huurTotaal([...regels, regelPrijs({ materiaal: { naam: 'Onbekend' }, aantal: 1, dagen: [vr] })])
    expect(t.onvolledig).toBe(true)
  })
})

describe('wat zonder offerte te huren is', () => {
  it('alleen wat uitdrukkelijk zo gezet is én een prijs heeft', () => {
    expect(isLosTeHuren({ directTeHuren: true, prijsPerDag: 9 })).toBe(true)
    expect(isLosTeHuren({ directTeHuren: true })).toBe(false)
    expect(isLosTeHuren({ prijsPerDag: 9 })).toBe(false)
    expect(isLosTeHuren(bar)).toBe(false)
  })
})
