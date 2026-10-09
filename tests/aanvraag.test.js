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
  leesEmail,
  leesTelefoon,
  leesZaal,
  naamVoorEvent,
  ontleedTitel,
  zoekKlant,
  zelfdeMail,
  afzenderUitKop,
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
    expect(leesPersonen('We denken aan een 40-tal personen')).toMatchObject({ personen: 40, tot: null, vork: false })
  })

  it('leest "ongeveer 40 personen"', () => {
    expect(leesPersonen('een groep van ongeveer 40 personen').personen).toBe(40)
  })

  // Wie op 50 rekent en er 40 krijgt, heeft te veel ingekocht.
  it('neemt bij een vork het laagste getal en zegt dat het er een is', () => {
    expect(leesPersonen('40 à 50 gasten')).toMatchObject({ personen: 40, tot: 50, vork: true })
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

/*
  Twee mails die live verkeerd gelezen werden (U7 en U8 in de overdracht).
  De zinnen tussen aanhalingstekens in de melding staan er letterlijk in; de
  rest is verzonnen, zoals alle gegevens in deze tests.
*/
const MAIL_SOFIE = `Dag,

Wij zouden graag een feest organiseren op zaterdag 14 november 2026 voor 45 personen in Het Vinne.
Kunnen jullie ons een voorstel doen met een walking dinner?

Groetjes,
Sofie Peeters
sofie.peeters@example.be
0470 12 34 56`

const MAIL_OKRA = `Beste,

Voor onze ORKA wandeldagen op 23, 24 en 25 februari verwachten we 200 à 250 bezoekers in het Vinne.
Zouden jullie daar soep en broodjes kunnen voorzien?

Met vriendelijke groeten,
Marc Janssens
OKRA Zoutleeuw`

describe('de mail van Sofie Peeters (U7)', () => {
  const uit = leesAanvraag(MAIL_SOFIE, { nu: NU, formules: FORMULES, plekken: PLEKKEN })

  // Het jaartal staat er wél; dan is de datum geen gok en zegt het scherm dat
  // ook niet.
  it('leest de datum met het jaartal en noemt dat geen gok', () => {
    expect(uit.datum.getFullYear()).toBe(2026)
    expect(uit.datum.getMonth()).toBe(10)
    expect(uit.datum.getDate()).toBe(14)
    expect(uit.jaarGegeven).toBe(true)
    expect(uit.onzeker).not.toContain('datum')
  })

  it('leest de gasten en de formule', () => {
    expect(uit.personen).toBe(45)
    expect(uit.formule.id).toBe('f-walking')
  })

  it('leest de afzender, het adres en het nummer', () => {
    expect(uit.afzender).toBe('Sofie Peeters')
    expect(uit.klant).toBe('Sofie Peeters')
    expect(uit.email).toBe('sofie.peeters@example.be')
    expect(uit.telefoon).toBe('0470 12 34 56')
  })

  it('zet Het Vinne als locatie én als concept', () => {
    expect(uit.zaal).toEqual({ naam: 'Het Vinne', adres: 'Het Vinne, Zoutleeuw' })
    expect(uit.plek.id).toBe('b-vinne')
  })

  it('geeft het event een naam', () => {
    expect(naamVoorEvent(uit, { standaard: 'Aanvraag' })).toBe('Walking dinner — Sofie Peeters')
  })

  it('stelt de klant voor die al in de lijst staat, op het e-mailadres', () => {
    const klanten = [
      { id: 'k-1', name: 'Peeters BV', email: 'info@peeters.example' },
      { id: 'k-2', name: 'Sofie Peeters', contacts: [{ email: 'Sofie.Peeters@example.be' }] },
    ]
    expect(zoekKlant(uit, klanten)?.id).toBe('k-2')
  })
})

describe('de aanvraag van OKRA (U8)', () => {
  const uit = leesAanvraag(`ORKA wandeldagen\n\n${MAIL_OKRA}`, { nu: NU, formules: FORMULES, plekken: PLEKKEN })

  // Drie wandeldagen zijn een meerdaags event, geen dag.
  it('leest "23, 24 en 25 februari" als een reeks van drie dagen', () => {
    expect(uit.datum.getFullYear()).toBe(2027)
    expect(uit.datum.getMonth()).toBe(1)
    expect(uit.datum.getDate()).toBe(23)
    expect(uit.tot.getMonth()).toBe(1)
    expect(uit.tot.getDate()).toBe(25)
  })

  it('leest "200 à 250 bezoekers" als gasten, met de vork erbij', () => {
    expect(uit.personen).toBe(200)
    expect(uit.personenTot).toBe(250)
    expect(uit.onzeker).toContain('personen')
  })

  it('zet het concept op Meer', () => {
    expect(uit.plek.id).toBe('b-vinne')
  })

  it('vindt Het Vinne ook wanneer het merk live gewoon "Meer" heet', () => {
    expect(leesZaal('in het Vinne', [{ id: 'meer', name: 'Meer' }])?.plek?.id).toBe('meer')
  })

  it('neemt het onderwerp als naam', () => {
    expect(naamVoorEvent(uit, { onderwerp: 'Re: ORKA wandeldagen' })).toBe('ORKA wandeldagen')
  })
})

describe('een datumreeks', () => {
  it('leest "3 tot 5 mei" en "3-5 mei" als reeks', () => {
    for (const tekst of ['van 3 tot 5 mei', 'op 3-5 mei', 'van 3 mei tot 5 mei']) {
      const uit = leesDatum(tekst, { nu: NU })
      expect(uit.datum.getDate()).toBe(3)
      expect(uit.tot?.getDate()).toBe(5)
    }
  })

  // Losse dagen zijn geen meerdaags event; dan blijft het bij de eerste, en
  // staat erbij dat er meer gevraagd is.
  it('maakt van losse dagen geen reeks', () => {
    const uit = leesDatum('op 3 en 10 mei', { nu: NU })
    expect(uit.datum.getDate()).toBe(3)
    expect(uit.tot).toBe(null)
    expect(uit.losseDagen).toBe(true)
  })

  it('loopt over de jaarwisseling', () => {
    const uit = leesDatum('van 30 december tot 2 januari', { nu: NU })
    expect(uit.datum.getFullYear()).toBe(2026)
    expect(uit.tot.getFullYear()).toBe(2027)
  })

  it('leest een jaartal achter een datum in cijfers', () => {
    const uit = leesDatum('datum: 14/11/2026', { nu: NU })
    expect(uit.datum.getDate()).toBe(14)
    expect(uit.jaarGegeven).toBe(true)
  })

  // Een telefoonnummer in de ondertekening is geen datum.
  it('ziet een telefoonnummer niet aan voor een datum', () => {
    expect(leesDatum('bel me op 0470 04 12 34', { nu: NU })).toBe(null)
  })

  // Een jaartal elders in de mail zegt niets over wanneer het feest is.
  it('telt een jaartal elders in de mail niet als jaartal van de datum', () => {
    const uit = leesAanvraag('Klant sinds 2019. Graag op 28 november.', { nu: NU })
    expect(uit.onzeker).toContain('datum')
  })
})

describe('gasten en klant in een titel (U8)', () => {
  it.each([
    ['Verjaardag 13 personen', 'Verjaardag', 13],
    ['BBQ 8 Pers', 'BBQ', 8],
    ['Lunch (4 personen)', 'Lunch', 4],
    ['Wintermoods — An Peeters (24p)', 'Wintermoods — An Peeters', 24],
  ])('haalt de gasten uit "%s"', (titel, naam, personen) => {
    expect(ontleedTitel(titel)).toMatchObject({ naam, personen })
  })

  it('haalt de klant uit "Klant: Jolien en Bernd"', () => {
    expect(ontleedTitel('Trouwfeest — Klant: Jolien en Bernd')).toMatchObject({
      naam: 'Trouwfeest',
      klant: 'Jolien en Bernd',
    })
  })

  it('laat een naam zonder velden ongemoeid', () => {
    expect(ontleedTitel('ORKA wandeldagen')).toEqual({ naam: 'ORKA wandeldagen', personen: null, personenTot: null, klant: null })
  })

  it('leest "Klant:" ook in de mail zelf', () => {
    expect(leesAanvraag('Klant: Jolien en Bernd\nDatum: 12/06/2027', { nu: NU }).klant).toBe('Jolien en Bernd')
  })
})

describe('wie er schrijft, zonder nette groet', () => {
  it('leest een naam op de regel van de groet', () => {
    expect(leesAfzender('Kan dit?\n\nMvg, Sofie Peeters')).toBe('Sofie Peeters')
  })

  it('leest een kop "Naam:"', () => {
    expect(leesAfzender('Naam: Sofie Peeters\nE-mail: sofie@example.be')).toBe('Sofie Peeters')
  })

  it('leest een ondertekening zonder groet', () => {
    expect(leesAfzender('Graag een offerte.\n\nSofie Peeters\nsofie@example.be')).toBe('Sofie Peeters')
  })

  it('neemt een zin na "dank u" niet voor een naam', () => {
    expect(leesAfzender('Dank u voor uw snelle reactie')).toBe(null)
  })
})

describe('contactgegevens', () => {
  it('neemt ons eigen adres niet voor dat van de klant', () => {
    expect(leesEmail('Aan: info@jeconcept.be\nVan: Sofie <sofie@example.be>')).toBe('sofie@example.be')
  })

  it('leest Belgische nummers in hun gewone vormen', () => {
    expect(leesTelefoon('GSM: 0470/12.34.56')).toBe('0470/12.34.56')
    expect(leesTelefoon('bel +32 470 12 34 56')).toBe('+32 470 12 34 56')
  })

  it('neemt een ondernemingsnummer niet voor een telefoonnummer', () => {
    expect(leesTelefoon('BTW BE 0123.456.789')).toBe(null)
  })
})

describe('een mail die al in het postvak staat', () => {
  const POSTVAK = [{ id: 'm-sofie', tekst: MAIL_SOFIE.replace(/\n/g, '\r\n') }]

  // Wie uit zijn eigen mailbox plakt, plakt vaak wat al via info@ binnenkwam.
  it('vindt ze terug, ook met andere regeleinden en een kop erboven', () => {
    expect(zelfdeMail(`Van: Sofie Peeters\nOnderwerp: feest\n\n${MAIL_SOFIE}`, POSTVAK)?.id).toBe('m-sofie')
  })

  it('verwart een andere mail er niet mee', () => {
    expect(zelfdeMail(MAIL_OKRA, POSTVAK)).toBe(null)
  })
})

describe('de kop van een opgehaalde mail', () => {
  it('splitst naam en adres', () => {
    expect(afzenderUitKop('Sofie Peeters <Sofie@Example.be>')).toEqual({ naam: 'Sofie Peeters', email: 'sofie@example.be' })
    expect(afzenderUitKop('sofie@example.be')).toEqual({ naam: null, email: 'sofie@example.be' })
  })

  it('neemt ons eigen adres niet voor de klant', () => {
    expect(afzenderUitKop('Plan <plan@jeconcept.be>').email).toBe(null)
  })
})

describe('het concept', () => {
  // "Meer" is een merk, "meer informatie" niet.
  it('neemt het woord "meer" niet voor het merk Meer', () => {
    expect(leesLocatie('We ontvangen graag wat meer informatie', [{ id: 'meer', name: 'Meer' }])).toBe(null)
    expect(leesLocatie('Kan dit bij Meer?', [{ id: 'meer', name: 'Meer' }])?.id).toBe('meer')
  })
})
