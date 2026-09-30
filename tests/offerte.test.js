import { afterEach, describe, expect, it } from 'vitest'
import {
  BTW,
  annulatieDeel,
  annulatieKosten,
  btwVoor,
  drankenPrijs,
  foodcostOordeel,
  geldigTot,
  isVerlopen,
  kinderprijs,
  maakRegel,
  offerteNummer,
  offerteVanEvent,
  ontbrekend,
  perRubriek,
  personeelsPrijs,
  splitsAllIn,
  totalenVan,
  voorschotVan,
} from '../src/lib/offerte'
import { zetHuidigeTaal } from '../src/lib/i18n'

describe('welk btw-tarief', () => {
  // De fout die in de oude Canva-offertes stond: 6% op catering.
  it('zet spijzen van een cateringdienst op 12 en niet op 6', () => {
    expect(btwVoor('catering')).toBe(12)
    expect(BTW.spijzen_dienst).toBe(12)
  })

  it('zet spijzen van een pure levering wél op 6', () => {
    expect(btwVoor('catering', { levering: true })).toBe(6)
  })

  it('zet dranken, materiaal en personeel op 21', () => {
    expect(btwVoor('dranken')).toBe(21)
    expect(btwVoor('basis')).toBe(21)
    expect(btwVoor('personeel')).toBe(21)
    expect(btwVoor('bestaat-niet')).toBe(21)
  })
})

describe('een all-inprijs splitsen', () => {
  // Zonder splitsen wordt het geheel aan 21% belast; met 70/30 klopt het.
  it('maakt van 49,50 per persoon 34,65 spijzen en 14,85 dranken', () => {
    const [spijzen, dranken] = splitsAllIn({ perPersoon: 49.5, personen: 50 })
    expect(spijzen.eenheidExcl).toBe(34.65)
    expect(spijzen.btwPercent).toBe(12)
    expect(dranken.eenheidExcl).toBe(14.85)
    expect(dranken.btwPercent).toBe(21)
  })

  // De tweede lijn is de rest en geen tweede percentage: anders valt er bij een
  // oneven bedrag een cent tussen de twee door.
  it('laat geen cent vallen bij een oneven bedrag', () => {
    const [spijzen, dranken] = splitsAllIn({ perPersoon: 33.33, personen: 1 })
    expect(spijzen.eenheidExcl + dranken.eenheidExcl).toBe(33.33)
  })

  it('geeft niets terug zonder prijs of zonder personen', () => {
    expect(splitsAllIn({ perPersoon: 0, personen: 50 })).toEqual([])
    expect(splitsAllIn({ perPersoon: 49.5, personen: 0 })).toEqual([])
  })
})

describe('de totalen', () => {
  const regels = [
    maakRegel({ rubriek: 'catering', eenheidExcl: 34.65, aantal: 50, btwPercent: 12 }),
    maakRegel({ rubriek: 'dranken', eenheidExcl: 14.85, aantal: 50, btwPercent: 21 }),
    maakRegel({ rubriek: 'personeel', eenheidExcl: 28, aantal: 10, btwPercent: 21 }),
  ]

  it('telt per tarief op en rekent daarna pas de btw', () => {
    const uit = totalenVan(regels)
    expect(uit.excl).toBe(1732.5 + 742.5 + 280)
    expect(uit.btwRegels.map((r) => r.percent)).toEqual([12, 21])
    expect(uit.btwRegels[0].btw).toBe(207.9)
    expect(uit.btwRegels[1].btw).toBe(214.73)
    expect(uit.incl).toBe(uit.excl + uit.btw)
  })

  // Optioneel staat er om te kiezen, niet om te betalen: telde het mee, dan
  // schrikt het bedrag de klant af voor hij de keuze gelezen heeft.
  it('laat wat optioneel is buiten het totaal, maar telt het wel apart', () => {
    const met = [...regels, maakRegel({ rubriek: 'optioneel', eenheidExcl: 250, aantal: 1 })]
    expect(totalenVan(met).excl).toBe(totalenVan(regels).excl)
    expect(totalenVan(met).optioneelExcl).toBe(250)
  })

  it('valt niet om op een lege offerte', () => {
    expect(totalenVan([]).excl).toBe(0)
    expect(totalenVan().incl).toBe(0)
  })
})

describe('de tabel', () => {
  it('houdt de rubrieken in de volgorde van het papier en laat lege weg', () => {
    const groepen = perRubriek([
      maakRegel({ rubriek: 'dranken' }),
      maakRegel({ rubriek: 'basis' }),
      maakRegel({ rubriek: 'catering' }),
    ])
    expect(groepen.map((g) => g.rubriek)).toEqual(['basis', 'catering', 'dranken'])
  })
})

describe('de vaste prijsregels van het huis', () => {
  it('rekent de drankenformule per uur boven de twee', () => {
    expect(drankenPrijs(2)).toBe(15)
    expect(drankenPrijs(1)).toBe(15)
    expect(drankenPrijs(4)).toBe(25)
    expect(drankenPrijs(0)).toBe(0)
  })

  it('rekent bediening aan 28 euro per uur per persoon', () => {
    expect(personeelsPrijs(5, 2)).toBe(280)
    expect(personeelsPrijs(0, 2)).toBe(0)
  })

  // 1,50 per levensjaar, maar nooit meer dan wat een volwassene betaalt.
  it('rekent de kinderprijs per levensjaar', () => {
    expect(kinderprijs(7, 49.5)).toBe(10.5)
    expect(kinderprijs(12, 49.5)).toBe(18)
    expect(kinderprijs(13, 49.5)).toBe(49.5)
  })

  it('laat een kind nooit meer betalen dan een volwassene', () => {
    // Het ontbijtbuffet: daar loopt de regel van 1,50 per jaar overheen.
    expect(kinderprijs(12, 14.5)).toBe(14.5)
    expect(kinderprijs(12, 14.5, { vast: 9.9 })).toBe(9.9)
  })

  it('zegt of de foodcost klopt', () => {
    expect(foodcostOordeel(50, 15).oordeel).toBe('goed')
    expect(foodcostOordeel(50, 25).oordeel).toBe('hoog')
    expect(foodcostOordeel(50, 8).oordeel).toBe('laag')
    expect(foodcostOordeel(0, 15)).toBeNull()
  })
})

describe('de voorwaarden', () => {
  it('rekent een voorschot van 30 procent', () => {
    expect(voorschotVan(2755)).toBe(826.5)
  })

  it('houdt een offerte dertig dagen geldig', () => {
    expect(geldigTot(new Date('2026-09-30T12:00:00')).toISOString().slice(0, 10)).toBe('2026-10-30')
    expect(isVerlopen({ geldigTot: new Date('2026-09-01') }, new Date('2026-09-30'))).toBe(true)
    expect(isVerlopen({ geldigTot: new Date('2026-10-30') }, new Date('2026-09-30'))).toBe(false)
    expect(isVerlopen({}, new Date('2026-09-30'))).toBe(false)
  })

  it('leest de annulatietabel van boven naar beneden', () => {
    expect(annulatieDeel(90)).toBe(0.1)
    expect(annulatieDeel(45)).toBe(0.3)
    expect(annulatieDeel(20)).toBe(0.5)
    expect(annulatieDeel(10)).toBe(0.75)
    expect(annulatieDeel(3)).toBe(1)
    expect(annulatieKosten(1000, 45)).toBe(300)
  })

  it('rekent op de rand hetzelfde als de tabel zegt', () => {
    // "Meer dan 60 dagen" is meer dan, niet vanaf.
    expect(annulatieDeel(60)).toBe(0.3)
    expect(annulatieDeel(61)).toBe(0.1)
  })
})

describe('een offerte uit een event', () => {
  const event = {
    id: 't-trouw',
    name: 'Trouw Niels en Inez',
    customerName: 'Familie Vanhees',
    customerId: 'k-vanhees',
    location: 'Kasteel van Ordingen',
    date: new Date('2026-10-17T12:00:00'),
    pax: 120,
  }

  it('neemt de posten van de formule over met hun eigen tarief', () => {
    const offerte = offerteVanEvent({
      event,
      prijs: {
        regels: [
          { label: 'Winter BBQ', perPersoon: 29.9, vast: 0, btwPercent: 12 },
          { label: 'Dranken: 3 uur', perPersoon: 20, vast: 0, btwPercent: 21 },
          { label: 'Inkleding', perPersoon: 0, vast: 450, btwPercent: 21 },
        ],
      },
      nu: new Date('2026-09-30T09:00:00'),
    })

    expect(offerte.regels).toHaveLength(3)
    expect(offerte.regels[0]).toMatchObject({ rubriek: 'catering', aantal: 120, eenheid: 'pp', btwPercent: 12 })
    expect(offerte.regels[1]).toMatchObject({ rubriek: 'dranken', btwPercent: 21 })
    expect(offerte.regels[2]).toMatchObject({ aantal: 1, eenheid: 'st', eenheidExcl: 450 })
    expect(offerte.nummer).toBe('2026-001')
    expect(offerte.status).toBe('concept')
  })

  // Zonder formule is het offertebedrag één prijs die eten én drank dekt, en
  // die moet gesplitst — precies de regel waar het anders misloopt.
  it('splitst een kaal offertebedrag in spijzen en dranken', () => {
    const offerte = offerteVanEvent({ event: { ...event, quoteAmount: 5940 } })
    expect(offerte.regels).toHaveLength(2)
    expect(offerte.regels[0].btwPercent).toBe(12)
    expect(offerte.regels[1].btwPercent).toBe(21)
    expect(totalenVan(offerte.regels).excl).toBe(5940)
  })

  it('maakt een lege offerte van een event zonder prijs', () => {
    expect(offerteVanEvent({ event: { id: 'x' } }).regels).toEqual([])
  })

  it('nummert per jaar', () => {
    expect(offerteNummer(new Date('2026-01-02'), 7)).toBe('2026-007')
  })
})

describe('wat er nog gevraagd moet worden', () => {
  afterEach(() => zetHuidigeTaal('nl'))

  it('noemt wat ontbreekt en houdt het kort', () => {
    const uit = ontbrekend({ personen: 0, klantNaam: '', regels: [] })
    expect(uit).toContain('offerte.mist_personen')
    expect(uit).toContain('offerte.mist_klant')
    expect(uit).toContain('offerte.mist_regels')
  })

  // Een offerte zonder drankenlijn is meestal een vergeten drankenformule, en
  // dat is het eerste waar een klant naar vraagt.
  it('merkt een offerte zonder drankenlijn op', () => {
    const offerte = {
      personen: 50,
      klantNaam: 'Blum',
      eventDatum: new Date(),
      regels: [maakRegel({ rubriek: 'catering', eenheidExcl: 30, aantal: 50 })],
    }
    expect(ontbrekend(offerte)).toEqual(['offerte.mist_dranken'])
  })

  it('zegt niets wanneer alles er staat', () => {
    const offerte = {
      personen: 50,
      klantNaam: 'Blum',
      eventDatum: new Date(),
      regels: [
        maakRegel({ rubriek: 'catering', eenheidExcl: 30, aantal: 50 }),
        maakRegel({ rubriek: 'dranken', eenheidExcl: 15, aantal: 50 }),
      ],
    }
    expect(ontbrekend(offerte)).toEqual([])
  })
})
