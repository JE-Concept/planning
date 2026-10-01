import { describe, expect, it } from 'vitest'
import {
  BEWUST_NIET,
  OVERGENOMEN,
  herkenBlad,
  parsePersoneel,
  planPersoneel,
  sleutelVan,
  statuutUitWoorden,
  telefoonNetjes,
} from '../functions/aapi/personeel'
import { ImportFout } from '../functions/aapi/parser'

/*
  De rijen staan hier verzonnen en niet als bestand in de repo.

  Het echte exportbestand bevat van tweeëndertig mensen hun
  rijksregisternummer, rekeningnummer, thuisadres en geboortedatum. Zoiets in
  een git-geschiedenis zetten is onomkeerbaar — er is geen "weghalen" dat ook
  geldt voor elke kloon die er al is. De vorm van het bestand is wat we moeten
  testen, en die is na te maken.
*/
const KOP = {
  A: 'Soc.sec. N°', B: 'Naam', C: 'Straat', D: 'N°', E: 'Postcode', F: 'Gemeente',
  G: 'Mobiel', H: 'Email', I: 'INSZ', J: 'Geboortedatum', K: 'Geslacht',
  L: 'Rekeningnummer', M: 'Burgerlijke stand', N: 'Kinderen ten laste',
  O: 'Dimona type', P: 'Vestiging', Q: 'Afdeling', R: 'Anciënniteit',
}

const rij = (over = {}) => ({
  A: '11', B: 'LIEKE  VERMEULEN', C: 'Teststraat', D: '1', E: '3800', F: 'Sint-Truiden',
  G: '0032477000000', H: 'Lieke.Vermeulen@example.be', I: '00000000097',
  J: '2001-01-01', K: 'Vrouwelijk', L: 'BE00000000000000', M: 'Ongehuwd', N: '0',
  O: 'Student COT', P: 'Meer-Bistro Het Vinne', Q: 'Bar ☕', R: '2026-08-15',
  ...over,
})

describe('welk bestand is dit', () => {
  // Eén uploadvak en één mailadres voor allebei: de tool kijkt zelf wat ze
  // gekregen heeft, in plaats van een keuzelijst waarin iemand zich vergist.
  it('herkent de personeelslijst aan haar kolommen', () => {
    expect(herkenBlad([KOP, rij()])).toBe('personeel')
  })

  it('herkent de planningsexport', () => {
    expect(herkenBlad([{ A: 'Planning Id', B: 'Start Datetime', C: 'Naam' }])).toBe('planning')
  })

  it('zegt niets over een blad dat geen van beide is', () => {
    expect(herkenBlad([{ A: 'Omzet', B: 'Maand' }])).toBeNull()
    expect(herkenBlad([])).toBeNull()
  })
})

describe('wat er meegaat naar JE Plan', () => {
  it('neemt alleen over wat je nodig hebt om iemand in te plannen en te bereiken', () => {
    const { mensen } = parsePersoneel([KOP, rij()])
    expect(mensen).toHaveLength(1)
    expect(mensen[0]).toEqual({
      naam: 'Lieke Vermeulen',
      ruweNaam: 'LIEKE  VERMEULEN',
      email: 'lieke.vermeulen@example.be',
      gsm: '+32 477 00 00 00',
      statuut: 'student',
      dimonaType: 'Student COT',
      vestiging: 'Meer-Bistro Het Vinne',
      afdeling: 'bar',
      inDienstSinds: new Date('2026-08-14T22:00:00.000Z'),
      bronRij: 2,
    })
  })

  /*
    De kern van dit bestand. Een rijksregisternummer, een rekeningnummer of een
    thuisadres heeft in een planningstool geen enkele functie, en elke kopie
    ervan is er een die ooit ergens belandt waar niemand hem gezocht heeft.
    Deze test valt om zodra een van die velden alsnog meegaat.
  */
  it('neemt het rijksregisternummer, het rekeningnummer en het adres niet over', () => {
    const { mensen } = parsePersoneel([KOP, rij()])
    const alles = JSON.stringify(mensen[0]).toLowerCase()
    for (const geheim of ['00000000097', 'be00000000000000', 'teststraat', '2001-01-01', 'vrouwelijk', 'ongehuwd']) {
      expect(alles).not.toContain(geheim)
    }
  })

  it('houdt de twee lijsten uit elkaar', () => {
    for (const veld of OVERGENOMEN) expect(BEWUST_NIET).not.toContain(veld)
  })

  it('zegt in het rapport wat het heeft laten liggen', () => {
    const { rapport } = planPersoneel({ rijen: [KOP, rij()] })
    expect(rapport.weggelaten).toContain('INSZ')
    expect(rapport.weggelaten).toContain('Rekeningnummer')
    expect(rapport.weggelaten).toContain('Geboortedatum')
    // En niets dat er niet in stond.
    expect(rapport.weggelaten).not.toContain('Professioneel mobiel')
  })

  it('stopt met een reden bij een bestand dat geen personeelslijst is', () => {
    expect(() => parsePersoneel([{ A: 'Naam' }, { A: 'Iemand' }])).toThrow(ImportFout)
    expect(() => parsePersoneel([{ A: 'Naam' }, { A: 'Iemand' }])).toThrow(/Dimona type/)
  })

  it('slaat een rij zonder naam over en gaat door', () => {
    const { mensen, fouten } = parsePersoneel([KOP, rij(), rij({ B: '' }), rij({ B: 'TWEEDE  PERSOON', H: 'tweede@example.be' })])
    expect(mensen.map((m) => m.naam)).toEqual(['Lieke Vermeulen', 'Tweede Persoon'])
    expect(fouten).toEqual([{ rij: 3, reden: 'geen naam' }])
  })
})

describe('het statuut', () => {
  /*
    De planningsexport schrijft codes (`STU_COT`), deze lijst schrijft het
    voluit ("Student COT"). Komt het op hetzelfde neer, dan hoort er hetzelfde
    woord uit te komen — anders staat dezelfde persoon in de kalender als
    "flexi" en in de lijst als "flex dag".
  */
  it('komt op hetzelfde woord uit als de planningsexport', () => {
    expect(statuutUitWoorden('Student COT')).toBe('student')
    expect(statuutUitWoorden('Flex Dag')).toBe('flexi')
    expect(statuutUitWoorden('Arbeider/Bediende')).toBe('vast')
    expect(statuutUitWoorden('Zelfstandige')).toBe('zelfstandig')
  })

  it('verstaat ook de code, mocht die er toch staan', () => {
    expect(statuutUitWoorden('STU_COT')).toBe('student')
    expect(statuutUitWoorden('FLX_DAY')).toBe('flexi')
  })

  it('houdt iets onbekends zichtbaar', () => {
    expect(statuutUitWoorden('Nieuw Soort')).toBe('nieuw soort')
    expect(statuutUitWoorden('')).toBe('onbekend')
  })
})

describe('het telefoonnummer', () => {
  // Dit nummer bestaat om gebeld te worden door iemand die om elf uur 's avonds
  // vaststelt dat er iemand niet is komen opdagen.
  it('wordt leesbaar', () => {
    expect(telefoonNetjes('0032477201707')).toBe('+32 477 20 17 07')
    expect(telefoonNetjes('0477 20 17 07')).toBe('+32 477 20 17 07')
    expect(telefoonNetjes('+32477201707')).toBe('+32 477 20 17 07')
  })

  it('laat staan wat het niet herkent, in plaats van het te verminken', () => {
    expect(telefoonNetjes('+31612345678')).toBe('+31612345678')
    expect(telefoonNetjes('')).toBeNull()
  })
})

describe('aan welk kaartje het hangt', () => {
  const bestaand = [
    { id: 'guid-1', aapiEmployeeId: 'guid-1', displayName: 'Lieke Vermeulen' },
    { id: 'guid-2', aapiEmployeeId: 'guid-2', displayName: 'Iemand Anders', email: 'anders@example.be' },
  ]

  /*
    De planningsexport geeft een `Employee Id`, deze lijst niet. Matchen op naam
    is bij de shifts verboden — daar zou het gewerkte uren samenvoegen — maar
    hier is er geen keuze, en de schade is anders: twee kaartjes in plaats van
    twee urenstaten.
  */
  it('vindt iemand terug die al uit de planning bekend is', () => {
    const { mutaties, rapport } = planPersoneel({ rijen: [KOP, rij()], bestaandeMedewerkers: bestaand })
    expect(mutaties).toHaveLength(1)
    expect(mutaties[0].id).toBe('guid-1')
    expect(mutaties[0].nieuw).toBe(false)
    expect(mutaties[0].patch.email).toBe('lieke.vermeulen@example.be')
    expect(rapport.employeesMatched).toBe(1)
  })

  it('vindt iemand terug op e-mail, ook als de naam anders geschreven staat', () => {
    const { mutaties } = planPersoneel({
      rijen: [KOP, rij({ B: 'IEMAND  ANDERS-VERMEULEN', H: 'anders@example.be' })],
      bestaandeMedewerkers: bestaand,
    })
    expect(mutaties[0].id).toBe('guid-2')
  })

  it('maakt een kaartje voor wie nog nooit ingepland stond', () => {
    const { mutaties, rapport } = planPersoneel({
      rijen: [KOP, rij({ B: 'NIEUWE  KRACHT', H: 'nieuw@example.be' })],
      bestaandeMedewerkers: bestaand,
    })
    expect(rapport.employeesCreated).toBe(1)
    expect(mutaties[0].id).toBe('mail-nieuw-example-be')
    expect(mutaties[0].patch.active).toBe(true)
  })

  it('laat de id uit de planning altijd voorgaan', () => {
    expect(sleutelVan({ aapiEmployeeId: 'guid-9', email: 'x@y.be' })).toBe('guid-9')
    expect(sleutelVan({ email: 'Voor.Naam@Example.BE' })).toBe('mail-voor-naam-example-be')
    expect(sleutelVan({})).toBeNull()
  })

  it('slaat iemand zonder naam én zonder adres over met een reden', () => {
    const { fouten } = planPersoneel({ rijen: [KOP, rij({ H: '' })], bestaandeMedewerkers: [] })
    expect(fouten[0].reden).toMatch(/geen e-mailadres/)
  })
})

describe('hetzelfde bestand een tweede keer', () => {
  // Net als bij de planning: niet "bijna niets", maar nul schrijfbeurten.
  it('verandert niets', () => {
    const rijen = [KOP, rij(), rij({ B: 'TWEEDE  PERSOON', H: 'tweede@example.be', O: 'Flex Dag' })]
    const eerste = planPersoneel({ rijen, nu: new Date('2026-10-01T08:00:00Z') })
    expect(eerste.rapport.employeesCreated).toBe(2)

    const stand = eerste.mutaties.map((m) => ({ id: m.id, aapiEmployeeId: null, ...m.patch }))
    const tweede = planPersoneel({ rijen, bestaandeMedewerkers: stand, nu: new Date('2026-10-02T08:00:00Z') })

    expect(tweede.mutaties).toEqual([])
    expect(tweede.rapport.employeesUnchanged).toBe(2)
    expect(tweede.rapport.employeesCreated).toBe(0)
  })

  it('schrijft wél wanneer er iets verandert', () => {
    const rijen = [KOP, rij()]
    const eerste = planPersoneel({ rijen })
    const stand = eerste.mutaties.map((m) => ({ id: m.id, aapiEmployeeId: null, ...m.patch }))

    const verhuisd = planPersoneel({ rijen: [KOP, rij({ Q: 'Keuken 🍳' })], bestaandeMedewerkers: stand })
    expect(verhuisd.mutaties).toHaveLength(1)
    expect(verhuisd.mutaties[0].patch).toMatchObject({ afdeling: 'keuken' })
    // En niet de rest opnieuw.
    expect(Object.keys(verhuisd.mutaties[0].patch).sort()).toEqual(['afdeling', 'importRunId', 'uitPersoneelslijst'])
  })
})
