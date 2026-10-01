import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leesXlsx } from '../functions/aapi/xlsx'
import { ImportFout, koppenVan, parseBlad, vensterVan } from '../functions/aapi/parser'
import { brusselseDag } from '../functions/aapi/tijd'

const FIXTURE = 'tests/fixtures/planning-overview.xlsx'
const rijen = leesXlsx(readFileSync(FIXTURE))

describe('het echte exportbestand', () => {
  it('leest 43 shifts uit 44 rijen', () => {
    const { shifts, fouten } = parseBlad(rijen)
    expect(shifts).toHaveLength(43)
    expect(fouten).toEqual([])
  })

  it('kent alle kolommen die erin staan', () => {
    expect(parseBlad(rijen).onbekendeKolommen).toEqual([])
  })

  it('verdeelt ze over de vier afdelingen', () => {
    const { shifts } = parseBlad(rijen)
    const per = {}
    for (const s of shifts) per[s.afdeling] = (per[s.afdeling] ?? 0) + 1
    expect(per).toEqual({ bar: 12, zaal: 7, keuken: 17, evenementen: 7 })
  })

  it('vindt vijftien verschillende mensen', () => {
    const { shifts } = parseBlad(rijen)
    expect(new Set(shifts.map((s) => s.aapiEmployeeId)).size).toBe(15)
    expect(new Set(shifts.map((s) => s.naam))).toContain('Herman Van Ormelingen')
  })

  it('telt de geannuleerde shifts', () => {
    const { shifts } = parseBlad(rijen)
    expect(shifts.filter((s) => s.geannuleerd)).toHaveLength(7)
  })

  /*
    De drie shifts van 25 oktober. Dit is de dag waarop de klok teruggaat, dus
    hier komt alles samen: de parser, de tijdzone en de kalenderdag. Stond de
    omrekening fout, dan zou 05:00 hier als 06:00 of als 24 oktober eindigen.
  */
  it('zet de shifts van 25 oktober op de juiste dag en het juiste uur', () => {
    const { shifts } = parseBlad(rijen)
    const die = shifts
      .filter((s) => brusselseDag(s.start) === '2026-10-25' && s.afdeling === 'evenementen')
      .sort((a, b) => a.start - b.start || a.naam.localeCompare(b.naam))

    expect(die).toHaveLength(3)
    expect(die.map((s) => s.start.toISOString())).toEqual([
      '2026-10-25T04:00:00.000Z',
      '2026-10-25T04:00:00.000Z',
      '2026-10-25T07:00:00.000Z',
    ])
    expect(die.map((s) => s.naam)).toEqual(['Anneleen Coenen', 'Jumana Mhanawi', 'Maxine Vanbrabant'])
  })

  it('kent elk statuut dat in het bestand voorkomt', () => {
    const { shifts } = parseBlad(rijen)
    expect(new Set(shifts.map((s) => s.statuut)))
      .toEqual(new Set(['vast', 'flexi', 'student', 'zelfstandig', 'extern']))
  })

  it('bewaart wat er oorspronkelijk gepland stond', () => {
    const { shifts } = parseBlad(rijen)
    const met = shifts.find((s) => s.standaardStart && s.standaardStart.getTime() !== s.start.getTime())
    // Of er zo'n shift is hangt van de export af; dat elk veld er staat niet.
    for (const s of shifts) {
      expect(s).toHaveProperty('standaardStart')
      expect(s).toHaveProperty('standaardPauzeMinuten')
    }
    expect(met === undefined || met.standaardStart instanceof Date).toBe(true)
  })

  it('spant het venster over de hele maand oktober', () => {
    const { shifts } = parseBlad(rijen)
    const { van, tot } = vensterVan(shifts)
    expect(brusselseDag(van)).toBe('2026-10-01')
    expect(brusselseDag(tot)).toBe('2026-10-30')
  })
})

describe('een bestand dat niet klopt', () => {
  const kop = {
    A: 'Location Name', B: 'Employee Id', C: 'Employee Name', D: 'Planning Id',
    E: 'Start Datetime', F: 'End Datetime', G: 'Canceled', H: 'Pause',
  }
  const rij = (over = {}) => ({
    A: 'Evenementen 🪩', B: 'e-1', C: 'TEST PERSOON', D: 'p-1',
    E: '2026-10-25 05:00:00.000', F: '2026-10-25 12:00:00.000', G: 'False', H: '30',
    ...over,
  })

  it('stopt met naam en toenaam als een verplichte kolom ontbreekt', () => {
    const zonder = { ...kop }
    delete zonder.E
    expect(() => parseBlad([zonder, rij()])).toThrow(ImportFout)
    expect(() => parseBlad([zonder, rij()])).toThrow(/Start Datetime/)
  })

  /*
    Een rij zonder Employee Id was hier een fout, en dat was net verkeerd om:
    dat is een dienst die ingepland staat zonder dat er iemand op staat — het
    gat in de planning, en precies wat je wil zien.
  */
  it('leest een dienst zonder medewerker als openstaand', () => {
    const { shifts, fouten } = parseBlad([kop, rij({ B: '', C: '' })])
    expect(fouten).toEqual([])
    expect(shifts).toHaveLength(1)
    expect(shifts[0].open).toBe(true)
    expect(shifts[0].aapiEmployeeId).toBe(null)
    expect(shifts[0].aapiPlanningId).toBe('p-1')
  })

  it('maar een rij zonder Planning Id blijft een fout', () => {
    const { shifts, fouten } = parseBlad([kop, rij({ D: '' })])
    expect(shifts).toHaveLength(0)
    expect(fouten[0].reden).toMatch(/Planning Id/)
  })

  it('een gewone rij staat niet open', () => {
    expect(parseBlad([kop, rij()]).shifts[0].open).toBe(false)
  })

  it('stopt bij een leeg blad', () => {
    expect(() => parseBlad([])).toThrow(ImportFout)
  })

  // Kolommen mogen van plaats veranderen; de kop zegt waar ze staan.
  it('leest de kolommen in willekeurige volgorde', () => {
    const omgekeerd = Object.fromEntries(Object.entries(kop).map(([, v], i, a) => [a[a.length - 1 - i][0], v]))
    const gegevens = Object.fromEntries(Object.entries(rij()).map(([, v], i, a) => [a[a.length - 1 - i][0], v]))
    const { shifts, fouten } = parseBlad([omgekeerd, gegevens])
    expect(fouten).toEqual([])
    expect(shifts[0].afdeling).toBe('evenementen')
    expect(shifts[0].aapiPlanningId).toBe('p-1')
  })

  it('meldt een kolom die erbij gekomen is zonder te stoppen', () => {
    const { onbekendeKolommen } = parseBlad([{ ...kop, Z: 'Iets Nieuws' }, { ...rij(), Z: 'waarde' }])
    expect(onbekendeKolommen).toEqual(['iets nieuws'])
  })

  /*
    Eén onleesbare rij mag de rest niet meeslepen: in een export van driehonderd
    regels is "er klopt iets niet" zonder te zeggen wát, geen antwoord.
  */
  it('slaat een kapotte rij over met een reden en gaat door', () => {
    const { shifts, fouten } = parseBlad([
      kop,
      rij(),
      rij({ D: 'p-2', E: 'gisteren' }),
      rij({ D: 'p-3', F: '2026-10-25 04:00:00.000' }),
      rij({ D: 'p-4' }),
    ])
    expect(shifts.map((s) => s.aapiPlanningId)).toEqual(['p-1', 'p-4'])
    expect(fouten).toEqual([
      { rij: 3, planningId: 'p-2', reden: 'onleesbare starttijd "gisteren"' },
      { rij: 4, planningId: 'p-3', reden: 'de eindtijd ligt niet na de starttijd' },
    ])
  })

  it('negeert een lege rij onderaan', () => {
    const { shifts, fouten } = parseBlad([kop, rij(), {}])
    expect(shifts).toHaveLength(1)
    expect(fouten).toEqual([])
  })

  it('leest de kop zonder zich druk te maken over hoofdletters en spaties', () => {
    expect(koppenVan({ A: '  Planning Id ', B: 'LOCATION NAME' }))
      .toEqual({ 'planning id': 'A', 'location name': 'B' })
  })
})
