import { describe, expect, it } from 'vitest'
import {
  dagVerslag,
  dagenVanMaand,
  maandVerslag,
  meetpunten,
  naarCsv,
  reeksVoorPunt,
} from '../src/lib/checklist-report'

const LIJST = {
  id: 'favv',
  name: 'FAVV-registraties',
  sections: [
    {
      id: 'temperaturen',
      title: 'Temperaturen',
      items: [
        { id: 'koelkast', label: 'Temperatuur koelkasten', veld: { kind: 'getal', eenheid: '°C', max: 7 } },
        { id: 'diepvries', label: 'Temperatuur diepvriezers', veld: { kind: 'getal', eenheid: '°C', max: -18 } },
      ],
    },
    {
      id: 'periodiek',
      title: 'Periodiek',
      items: [{ id: 'thermometer', label: 'Thermometers gecontroleerd', repeat: { kind: 'maandelijks', dayOfMonth: 1 } }],
    },
  ],
}

const run = (dag, items, extra = {}) => ({
  id: `favv_${dag}`,
  checklistId: 'favv',
  checklistName: 'FAVV-registraties',
  day: dag,
  items,
  participants: ['u-sam'],
  ...extra,
})

describe('dagenVanMaand', () => {
  it('geeft elke dag van de maand', () => {
    expect(dagenVanMaand('2026-09')).toHaveLength(30)
    expect(dagenVanMaand('2026-09')[0]).toBe('2026-09-01')
    expect(dagenVanMaand('2026-09').at(-1)).toBe('2026-09-30')
  })

  it('kent februari in een schrikkeljaar', () => {
    expect(dagenVanMaand('2028-02')).toHaveLength(29)
  })
})

describe('dagVerslag', () => {
  it('noemt wat er ontbreekt bij naam en niet alleen een aantal', () => {
    const verslag = dagVerslag(LIJST, run('2026-09-15', { koelkast: { done: true, byName: 'Sam' } }), '2026-09-15')
    expect(verslag.gedaan.map((p) => p.id)).toEqual(['koelkast'])
    expect(verslag.ontbreekt.map((p) => p.id)).toEqual(['diepvries'])
    expect(verslag.volledig).toBe(false)
  })

  // Een maandelijks punt hoort maar op één dag mee te tellen; anders lijkt elke
  // andere dag onvolledig.
  it('telt alleen wat die dag viel', () => {
    expect(dagVerslag(LIJST, null, '2026-09-15').verplicht).toBe(2)
    expect(dagVerslag(LIJST, null, '2026-09-01').verplicht).toBe(3)
  })

  it('houdt een dag zonder run apart van een lege dag', () => {
    const verslag = dagVerslag(LIJST, null, '2026-09-15')
    expect(verslag.begonnen).toBe(false)
    expect(verslag.ontbreekt).toHaveLength(2)
  })

  it('beoordeelt de metingen tegen hun grens', () => {
    const verslag = dagVerslag(
      LIJST,
      run('2026-09-15', {
        koelkast: { done: true, waarde: '9', waardeByName: 'Sam' },
        diepvries: { done: true, waarde: '-21' },
      }),
      '2026-09-15'
    )
    const koel = verslag.metingen.find((m) => m.puntId === 'koelkast')
    expect(koel.staat).toBe('buiten')
    expect(koel.richting).toBe('boven')
    expect(verslag.metingen.find((m) => m.puntId === 'diepvries').staat).toBe('ok')
  })

  it('bewaart wie afvinkte en wie de waarde invulde', () => {
    const verslag = dagVerslag(
      LIJST,
      run('2026-09-15', { koelkast: { done: true, byName: 'Lotte', waarde: '4', waardeByName: 'Sam' } }),
      '2026-09-15'
    )
    expect(verslag.gedaan[0].door).toBe('Lotte')
    expect(verslag.metingen.find((m) => m.puntId === 'koelkast').door).toBe('Sam')
  })
})

describe('maandVerslag', () => {
  const runs = [
    run('2026-09-01', {
      koelkast: { done: true, waarde: '4' },
      diepvries: { done: true, waarde: '-20' },
      thermometer: { done: true },
    }),
    run('2026-09-02', { koelkast: { done: true, waarde: '9' } }),
  ]
  const verslag = maandVerslag({
    maand: '2026-09',
    checklists: [LIJST],
    runs,
    vandaag: new Date('2026-09-03T10:00:00'),
  })

  // Een maand die nog loopt hoort niet te lezen als een maand vol gemiste dagen.
  it('kijkt niet vooruit', () => {
    expect(verslag.dagen).toHaveLength(3)
    expect(verslag.dagen.at(-1).dag).toBe('2026-09-03')
  })

  it('telt de dagen die helemaal rond waren', () => {
    expect(verslag.volledigeDagen).toBe(1)
    expect(verslag.dagenMetWerk).toBe(3)
  })

  it('verzamelt elke overschrijding met dag en lijst erbij', () => {
    expect(verslag.overschrijdingen).toHaveLength(1)
    expect(verslag.overschrijdingen[0].dag).toBe('2026-09-02')
    expect(verslag.overschrijdingen[0].lijst).toBe('FAVV-registraties')
  })

  it('rekent de verhouding over alles wat verplicht was', () => {
    // 1 sep: 3 punten, alle drie gedaan. 2 sep: 2 punten, één gedaan. 3 sep: 2, geen.
    expect(verslag.verplicht).toBe(7)
    expect(verslag.gedaan).toBe(4)
  })

  describe('reeksVoorPunt', () => {
    const reeks = reeksVoorPunt(verslag, 'koelkast')

    // Gaten weglaten zou een vloeiende lijn geven over dagen zonder meting heen,
    // en dat leest als een maand waarin elke dag gemeten is.
    it('houdt de dagen zonder meting in de reeks', () => {
      expect(reeks.punten).toHaveLength(3)
      expect(reeks.punten[2].meting).toBeNull()
    })

    it('rekent min, max en gemiddelde over wat gemeten is', () => {
      expect(reeks.min).toBe(4)
      expect(reeks.max).toBe(9)
      expect(reeks.gemiddelde).toBe(6.5)
      expect(reeks.aantal).toBe(2)
    })

    it('geeft geen getallen terug voor een punt zonder metingen', () => {
      expect(reeksVoorPunt(verslag, 'bestaat-niet').min).toBeNull()
    })
  })

  it('vindt de punten die om een getal vroegen', () => {
    expect(meetpunten(verslag).map((p) => p.id).sort()).toEqual(['diepvries', 'koelkast'])
  })

  describe('naarCsv', () => {
    const csv = naarCsv(verslag)
    const regels = csv.split('\n')

    it('zet een kop boven de kolommen', () => {
      expect(regels[0]).toContain('Datum;Lijst')
    })

    // Excel in het Nederlands leest een komma als decimaalteken.
    it('scheidt met puntkomma’s', () => {
      expect(regels[1].split(';')).toHaveLength(9)
    })

    it('neemt elk verplicht punt op, ook wat niet gedaan is', () => {
      expect(regels).toHaveLength(8)
      expect(csv).toContain(';nee;')
    })
  })
})
