import { describe, expect, it } from 'vitest'
import {
  dagVerslag,
  dagenVanMaand,
  lijstTeltOp,
  maandVerslag,
  meetStand,
  meetpunten,
  metPeriode,
  metSluitingsdagen,
  naarCsv,
  puntenOpDag,
  puntenOpSluitingsdag,
  reeksVoorPunt,
  sluitingOp,
  sluitingsdagenVan,
  zonderPeriode,
} from '../src/lib/checklist-report'
import { CLOSING, FAVV, OPENING, POETSPLAN } from '../src/lib/checklist-templates'

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

/*
  U16: "Registraties kloppen niet." Drie klachten, elk met een eigen blok:
  sluitingsdagen telden als "niet begonnen", hetzelfde lijstje telde niet elke
  dag evenveel punten, en "alles binnen de grens" stond er zonder één meting.
*/

describe('het aantal punten per dag', () => {
  // Precies de getallen uit de melding. Ze verschillen omdat de punten een
  // herhaling hebben, en dat is juist — maar dan moet het verslag het zeggen.
  it('volgt de herhaling, en dat verklaart de getallen uit de melding', () => {
    const donderdag = '2026-10-08'
    const zaterdag = '2026-10-10'
    const eerste = '2026-10-01'
    expect(puntenOpDag(OPENING, donderdag)).toHaveLength(24)
    expect(puntenOpDag(OPENING, zaterdag)).toHaveLength(25)
    expect(puntenOpDag(CLOSING, donderdag)).toHaveLength(36)
    expect(puntenOpDag(CLOSING, zaterdag)).toHaveLength(39)
    expect(puntenOpDag(FAVV, donderdag)).toHaveLength(12)
    expect(puntenOpDag(FAVV, eerste)).toHaveLength(15)
    expect(puntenOpDag(POETSPLAN, donderdag)).toHaveLength(5)
    expect(puntenOpDag(POETSPLAN, eerste)).toHaveLength(12)
  })

  it('zegt welke punten er periodiek bij kwamen', () => {
    expect(dagVerslag(OPENING, null, '2026-10-08').periodiek).toEqual([])
    expect(dagVerslag(OPENING, null, '2026-10-10').periodiek.map((p) => p.id)).toEqual(['toiletten-open'])
    expect(dagVerslag(POETSPLAN, null, '2026-10-01').periodiek).toHaveLength(7)
  })

  // Een punt van vandaag mag de vorige maand niet achteraf onvolledig maken.
  it('telt een later toegevoegd punt pas vanaf de dag dat het erbij kwam', () => {
    const lijst = {
      id: 'x',
      name: 'X',
      sections: [{ title: 'A', items: [{ id: 'oud', label: 'Oud' }, { id: 'nieuw', label: 'Nieuw', sinds: '2026-10-05' }] }],
    }
    expect(puntenOpDag(lijst, '2026-10-04').map((p) => p.id)).toEqual(['oud'])
    expect(puntenOpDag(lijst, '2026-10-05').map((p) => p.id)).toEqual(['oud', 'nieuw'])
  })

  it('laat een lijst uit gebruik alleen meetellen tot ze uit gebruik ging', () => {
    const weg = { id: 'w', archived: true, archivedOn: '2026-10-05' }
    expect(lijstTeltOp(weg, '2026-10-04', null)).toBe(true)
    expect(lijstTeltOp(weg, '2026-10-05', null)).toBe(false)
    // Zonder datum weten we niet wanneer ze stopte: alleen wat toch gebruikt werd.
    expect(lijstTeltOp({ id: 'w', archived: true }, '2026-10-01', null)).toBe(false)
    expect(lijstTeltOp({ id: 'w', archived: true }, '2026-10-01', { id: 'r' })).toBe(true)
    expect(lijstTeltOp({ id: 'a', archived: false }, '2026-10-01', null)).toBe(true)
  })
})

describe('sluitingsdagen', () => {
  const MAANDAG_DICHT = { weekdagen: [{ vanaf: null, ingesteld: '2026-10-08', dagen: [1] }], periodes: [] }

  it('kent de vaste weekdag, ook terug in de tijd voor de eerste regel', () => {
    expect(sluitingOp(MAANDAG_DICHT, '2026-09-07')).toEqual({ reden: null })
    expect(sluitingOp(MAANDAG_DICHT, '2026-09-08')).toBeNull()
    expect(sluitingOp(null, '2026-09-07')).toBeNull()
  })

  it('kent losse periodes met hun reden, grenzen inbegrepen', () => {
    const s = metPeriode(MAANDAG_DICHT, { van: '2026-12-24', tot: '2026-12-26', reden: ' Kerst ' })
    expect(sluitingOp(s, '2026-12-24')).toEqual({ reden: 'Kerst' })
    expect(sluitingOp(s, '2026-12-26')).toEqual({ reden: 'Kerst' })
    expect(sluitingOp(s, '2026-12-27')).toBeNull()
  })

  it('maakt van een periode zonder einde één dag, en zet een omgekeerde recht', () => {
    expect(metPeriode(null, { van: '2026-11-11' }).periodes).toEqual([{ van: '2026-11-11', tot: '2026-11-11', reden: null }])
    expect(metPeriode(null, { van: '2026-08-14', tot: '2026-08-01' }).periodes[0]).toMatchObject({
      van: '2026-08-01',
      tot: '2026-08-14',
    })
    expect(metPeriode(null, { van: '' })).toBeNull()
    const twee = metPeriode(metPeriode(null, { van: '2026-12-25' }), { van: '2026-11-11' })
    expect(twee.periodes.map((p) => p.van)).toEqual(['2026-11-11', '2026-12-25'])
    expect(zonderPeriode(twee, 0).periodes.map((p) => p.van)).toEqual(['2026-12-25'])
  })

  // Een afgesloten maand mag niet veranderen omdat de bistro nu op een andere
  // dag dicht is. Dat is het verschil tussen een verslag en een bewijsstuk.
  it('herschrijft vorige maanden niet als de vaste dagen veranderen', () => {
    const eerst = metSluitingsdagen(null, [1], '2026-09-01')
    expect(eerst.weekdagen[0].vanaf).toBeNull()

    const later = metSluitingsdagen(eerst, [2], '2026-10-05')
    expect(sluitingOp(later, '2026-09-28')).not.toBeNull() // maandag, toen dicht
    expect(sluitingOp(later, '2026-09-29')).toBeNull() // dinsdag, toen open
    expect(sluitingOp(later, '2026-10-05')).toBeNull() // maandag, nu open
    expect(sluitingOp(later, '2026-10-06')).not.toBeNull() // dinsdag, nu dicht
    expect(sluitingsdagenVan(later, '2026-10-08')).toEqual([2])
    expect(sluitingsdagenVan(later, '2026-09-08')).toEqual([1])
  })

  it('maakt van drie klikken op één dag geen drie regels geschiedenis', () => {
    let s = metSluitingsdagen(null, [1], '2026-10-08')
    s = metSluitingsdagen(s, [1, 2], '2026-10-08')
    s = metSluitingsdagen(s, [2, 1, 1], '2026-10-08')
    expect(s.weekdagen).toEqual([{ vanaf: null, ingesteld: '2026-10-08', dagen: [1, 2] }])
  })

  it('noemt punten die altijd op een sluitingsdag vallen', () => {
    const namen = puntenOpSluitingsdag([POETSPLAN, OPENING], [1]).map((p) => p.puntId)
    expect(namen).toContain('poets-friteuse')
    expect(namen).not.toContain('toiletten-open')
    expect(puntenOpSluitingsdag([OPENING], [0, 6]).map((p) => p.puntId)).toEqual(['toiletten-open'])
    expect(puntenOpSluitingsdag([{ ...POETSPLAN, archived: true }], [1])).toEqual([])
    expect(puntenOpSluitingsdag([POETSPLAN], [])).toEqual([])
  })

  describe('in het maandverslag', () => {
    // Week van ma 28 sep t/m zo 4 okt; de bistro is op maandag dicht.
    const runs = [run('2026-09-29', { koelkast: { done: true, waarde: '4' } })]
    const verslag = maandVerslag({
      maand: '2026-09',
      checklists: [LIJST],
      runs,
      sluiting: MAANDAG_DICHT,
      vandaag: new Date('2026-09-30T10:00:00'),
    })

    it('telt een gesloten dag niet als niet begonnen', () => {
      const maandag = verslag.dagen.find((d) => d.dag === '2026-09-28')
      expect(maandag.gesloten).toEqual({ reden: null })
      expect(maandag.lijsten).toEqual([])
      // Vier maandagen in september tot en met de 30e: 7, 14, 21, 28.
      expect(verslag.geslotenDagen).toBe(4)
      expect(verslag.dagenMetWerk).toBe(30 - 4)
    })

    it('telt wat er op een gesloten dag toch gedaan werd', () => {
      const metRun = maandVerslag({
        maand: '2026-09',
        checklists: [LIJST],
        runs: [run('2026-09-28', { koelkast: { done: true, waarde: '5' } })],
        sluiting: MAANDAG_DICHT,
        vandaag: new Date('2026-09-28T20:00:00'),
      })
      const maandag = metRun.dagen.at(-1)
      expect(maandag.gesloten).not.toBeNull()
      expect(maandag.lijsten).toHaveLength(1)
      expect(metRun.geslotenDagen).toBe(3)
    })

    it('zet een gesloten dag als één regel in de CSV', () => {
      const regel = naarCsv(verslag)
        .split('\n')
        .find((r) => r.startsWith('2026-09-28'))
      expect(regel).toBe('2026-09-28;;;Gesloten;;;;;')
    })
  })
})

describe('meetStand', () => {
  // "Overschrijdingen 0 · alles binnen de grens" terwijl er niets gemeten was.
  it('zegt "geen" als er niets gemeten is, niet "binnen"', () => {
    const verslag = maandVerslag({
      maand: '2026-10',
      checklists: [LIJST],
      runs: [],
      vandaag: new Date('2026-10-03T10:00:00'),
    })
    // Drie dagen, twee meetpunten per dag, nul getallen.
    expect(verslag.gemeten).toBe(0)
    expect(verslag.meetpunten).toBe(6)
    expect(meetStand(verslag)).toBe('geen')
  })

  it('zegt "binnen" pas als er iets gemeten is en alles goed lag', () => {
    const verslag = maandVerslag({
      maand: '2026-10',
      checklists: [LIJST],
      runs: [run('2026-10-01', { koelkast: { done: true, waarde: '3' } })],
      vandaag: new Date('2026-10-01T10:00:00'),
    })
    expect(verslag.gemeten).toBe(1)
    expect(meetStand(verslag)).toBe('binnen')
  })

  it('zegt "buiten" zodra er één overschrijding is', () => {
    const verslag = maandVerslag({
      maand: '2026-10',
      checklists: [LIJST],
      runs: [run('2026-10-01', { koelkast: { done: true, waarde: '12' } })],
      vandaag: new Date('2026-10-01T10:00:00'),
    })
    expect(meetStand(verslag)).toBe('buiten')
  })
})
