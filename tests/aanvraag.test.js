import { describe, expect, it } from 'vitest'
import {
  leesAanvraag,
  leesAfzender,
  leesDatum,
  leesFormule,
  leesLocatie,
  leesPersonen,
  leesSoort,
  leesVragen,
} from '../src/lib/aanvraag'

// Woensdag 30 september 2026, zoals de rest van de tests.
const NU = new Date(2026, 8, 30, 9, 0)

// De mail waar dit voor gebouwd is, woord voor woord.
const MAIL = `Beste,

Mijn mama wordt op zaterdag 28 november 65 jaar en we zouden dit graag samen met familie en vrienden vieren.

We denken aan een 40-tal personen en hadden het idee om er een gezellige winterbarbecue van te maken. Omdat jullie ook Het Vinne uitbaten, vroeg ik me af of het mogelijk is om dit feest in het zaaltje van Het Vinne te organiseren.

Indien dit niet mogelijk is, horen we ook graag of jullie een andere geschikte locatie kunnen aanraden voor een groep van ongeveer 40 personen.

Werken jullie voor dergelijke feesten met vaste formules of arrangementen? We ontvangen graag wat meer informatie over de mogelijkheden en richtprijzen.

Alvast bedankt!

met vriendelijke groet,


Architect Kristien Maris`

const FORMULES = [
  { id: 'f-winter', name: 'Winter BBQ' },
  { id: 'f-walking', name: 'Walking dinner' },
  { id: 'f-receptie', name: 'Receptie met hapjes' },
]

const PLEKKEN = [
  { id: 'b-vinne', name: 'Meer — Het Vinne' },
  { id: 'b-vue', name: 'Bar Vue' },
]

describe('de datum', () => {
  it('leest dag en maand, met het eerstvolgende jaar erbij', () => {
    const uit = leesDatum('op zaterdag 28 november', { nu: NU })
    expect(uit.datum.getFullYear()).toBe(2026)
    expect(uit.datum.getMonth()).toBe(10)
    expect(uit.datum.getDate()).toBe(28)
  })

  // De weekdag mag het jaar één keer opschuiven: 12 juni 2027 is een zaterdag,
  // 12 juni 2026 een vrijdag.
  it('schuift een jaar op wanneer de weekdag anders niet klopt', () => {
    const uit = leesDatum('zaterdag 12 juni', { nu: NU })
    expect(uit.datum.getFullYear()).toBe(2027)
    expect(uit.weekdagKlopt).toBe(true)
  })

  // Verder dan volgend jaar zoeken we niet: dan is het eerder een vergissing
  // van de klant dan een feest over vijf jaar. Zwijgen zou het ergste zijn.
  it('geeft de datum toch terug wanneer de weekdag er gewoon naast zit', () => {
    const uit = leesDatum('vrijdag 28 november', { nu: NU })
    expect(uit.datum.getFullYear()).toBe(2026)
    expect(uit.datum.getDay()).toBe(6)
    expect(uit.weekdagKlopt).toBe(false)
  })

  it('neemt een datum die al voorbij is voor volgend jaar', () => {
    const uit = leesDatum('15 maart', { nu: NU })
    expect(uit.datum.getFullYear()).toBe(2027)
  })

  it('gelooft een jaartal dat er zelf bij staat', () => {
    expect(leesDatum('12 juni 2028', { nu: NU }).datum.getFullYear()).toBe(2028)
  })

  it('leest ook 28/11', () => {
    const uit = leesDatum('op 28/11 graag', { nu: NU })
    expect(uit.datum.getMonth()).toBe(10)
    expect(uit.datum.getDate()).toBe(28)
  })

  // "Ergens in het voorjaar" is geen datum, en die gok mag niet op een offerte.
  it('verzint niets bij een vage tijdsaanduiding', () => {
    expect(leesDatum('ergens in het voorjaar', { nu: NU })).toBe(null)
    expect(leesDatum('', { nu: NU })).toBe(null)
  })

  it('valt niet voor een dag die niet bestaat', () => {
    expect(leesDatum('31 februari', { nu: NU })).toBe(null)
  })
})

describe('het aantal personen', () => {
  it('leest "een 40-tal personen"', () => {
    expect(leesPersonen('We denken aan een 40-tal personen')).toEqual({ personen: 40, tot: null, vork: false })
  })

  it('leest "ongeveer 40 personen"', () => {
    expect(leesPersonen('een groep van ongeveer 40 personen').personen).toBe(40)
  })

  // Wie op 50 rekent en er 40 krijgt, heeft te veel ingekocht.
  it('neemt bij een vork het laagste getal en zegt dat het er een is', () => {
    expect(leesPersonen('40 à 50 gasten')).toEqual({ personen: 40, tot: 50, vork: true })
    expect(leesPersonen('tussen de 80 tot 100 personen').vork).toBe(true)
  })

  // De fout die niemand opmerkt tot de tafels besteld zijn.
  it('ziet een leeftijd niet aan voor een aantal gasten', () => {
    expect(leesPersonen('Mijn mama wordt 65 jaar')).toBe(null)
  })

  it('geeft niets terug als er geen aantal staat', () => {
    expect(leesPersonen('we vieren iets')).toBe(null)
  })
})

describe('het soort feest', () => {
  it('herkent een verjaardag', () => {
    expect(leesSoort('Mijn mama wordt 65 jaar en we willen dat vieren')).toBe('Verjaardag')
  })

  it('herkent een huwelijk', () => {
    expect(leesSoort('we trouwen in juni')).toBe('Huwelijk')
  })

  it('verzint niets', () => {
    expect(leesSoort('we willen iets organiseren')).toBe(null)
  })
})

describe('de formule', () => {
  // Barbecue en bbq zijn hetzelfde woord voor een klant, dus voor ons ook.
  it('herkent een winterbarbecue als de Winter BBQ', () => {
    expect(leesFormule('een gezellige winterbarbecue', FORMULES)?.id).toBe('f-winter')
  })

  it('herkent een walking dinner', () => {
    expect(leesFormule('walking dinner met dessertbuffet', FORMULES)?.id).toBe('f-walking')
  })

  it('kiest niets bij één toevallig woord', () => {
    expect(leesFormule('we willen graag een receptie', FORMULES)?.id).toBe(undefined)
  })
})

describe('de locatie', () => {
  it('herkent een eigen zaal', () => {
    expect(leesLocatie('in het zaaltje van Het Vinne', PLEKKEN)?.id).toBe('b-vinne')
  })

  // Een willekeurige plaatsnaam als locatie zetten geeft een adres waar
  // niemand ooit geweest is.
  it('zet geen willekeurige plaatsnaam op het event', () => {
    expect(leesLocatie('ergens in Hasselt', PLEKKEN)).toBe(null)
  })
})

describe('wat de klant vraagt', () => {
  it('haalt de vragen uit de mail', () => {
    const vragen = leesVragen(MAIL)
    expect(vragen).toContain('aanvraag.vraag.prijzen')
    expect(vragen).toContain('aanvraag.vraag.formules')
    expect(vragen).toContain('aanvraag.vraag.locatie')
  })
})

describe('wie er schrijft', () => {
  it('leest de naam uit de ondertekening', () => {
    expect(leesAfzender(MAIL)).toBe('Kristien Maris')
  })

  it('laat een titel weg', () => {
    expect(leesAfzender('groeten,\n\nDr. Jan Peeters')).toBe('Jan Peeters')
  })

  it('geeft niets terug zonder ondertekening', () => {
    expect(leesAfzender('Beste, kan dit op 3 mei? Dank.')).toBe(null)
  })
})

describe('de hele aanvraag van Kristien Maris', () => {
  const uit = leesAanvraag(MAIL, { nu: NU, formules: FORMULES, plekken: PLEKKEN })

  it('leest de datum', () => {
    expect(uit.datum.getDate()).toBe(28)
    expect(uit.datum.getMonth()).toBe(10)
    expect(uit.datum.getFullYear()).toBe(2026)
  })

  it('leest veertig personen en niet vijfenzestig', () => {
    expect(uit.personen).toBe(40)
  })

  it('leest de verjaardag, de formule, de zaal en de afzender', () => {
    expect(uit.soort).toBe('Verjaardag')
    expect(uit.formule.id).toBe('f-winter')
    expect(uit.plek.id).toBe('b-vinne')
    expect(uit.afzender).toBe('Kristien Maris')
  })

  it('zegt erbij wat het gokte', () => {
    // Het jaartal staat niet in de mail, en de formule is uit woorden afgeleid.
    expect(uit.onzeker).toContain('datum')
    expect(uit.onzeker).toContain('formule')
  })

  it('houdt de mail zelf bij', () => {
    expect(uit.tekst.startsWith('Beste,')).toBe(true)
  })
})
