import { describe, expect, it } from 'vitest'
import {
  addressLine,
  amountOf,
  billingAddressOf,
  billingEmailOf,
  customerHistory,
  formatVat,
  primaryContact,
  setPrimaryContact,
  vatHint,
  vatIsValid,
  viesVoorstel,
} from '../src/lib/klanten'

// Het nummer van Stad Borgloon uit de demogegevens. De laatste twee cijfers
// zijn de controle op de eerste acht, dus dit nummer moet overal doorkomen.
const BORGLOON = 'BE 0207.474.981'

describe('formatVat', () => {
  it('maakt van alle schrijfwijzen dezelfde', () => {
    for (const getypt of ['BE0207474981', '0207.474.981', 'be 0207 474 981', '0207-474-981']) {
      expect(formatVat(getypt)).toBe(BORGLOON)
    }
  })

  // Het ondernemingsnummer had vroeger negen cijfers; oude visitekaartjes en
  // oude boekhoudingen dragen die versie nog.
  it('zet de ontbrekende nul voor een nummer van negen cijfers', () => {
    expect(formatVat('207.474.981')).toBe(BORGLOON)
  })

  it('laat een buitenlands nummer staan zoals het getypt is', () => {
    expect(formatVat('NL123456789B01')).toBe('NL123456789B01')
    expect(formatVat('FR 40 303 265 045')).toBe('FR 40 303 265 045')
  })

  it('laat leeg leeg en weigert niets', () => {
    expect(formatVat('')).toBe('')
    expect(formatVat(null)).toBe('')
    // Halve invoer mag: iemand typt verder na het verlaten van het veld.
    expect(formatVat('BE 0207')).toBe('BE 0207')
  })
})

describe('vatIsValid en vatHint', () => {
  it('herkent een kloppend nummer', () => {
    expect(vatIsValid(BORGLOON)).toBe(true)
    expect(vatHint(BORGLOON)).toBe(null)
  })

  it('ziet een typefout in de controlecijfers', () => {
    expect(vatIsValid('BE 0207.474.980')).toBe(false)
    expect(vatHint('BE 0207.474.980')).toMatch(/controlecijfers/)
  })

  // Niets wordt geweigerd: een opmerking is geen blokkade.
  it('geeft bij een buitenlands nummer een opmerking, geen fout', () => {
    expect(vatHint('NL123456789B01')).toMatch(/blijft staan/)
  })

  it('zegt bij een leeg veld wat dat betekent', () => {
    expect(vatHint('')).toMatch(/particulier/)
  })
})

describe('contactpersonen', () => {
  const contacten = [
    { id: 'a', name: 'Karen' },
    { id: 'b', name: 'Tom', primary: true },
  ]

  it('neemt de aangeduide hoofdcontactpersoon', () => {
    expect(primaryContact({ contacts: contacten }).name).toBe('Tom')
  })

  // Anders zou een klant met één contactpersoon eerst een vinkje moeten krijgen
  // voor er ergens een naam verschijnt.
  it('valt terug op de eerste als niemand aangeduid is', () => {
    expect(primaryContact({ contacts: [{ id: 'a', name: 'Karen' }] }).name).toBe('Karen')
    expect(primaryContact({ contacts: [] })).toBe(null)
    expect(primaryContact(null)).toBe(null)
  })

  it('laat er maar één hoofdcontactpersoon over', () => {
    const uit = setPrimaryContact(contacten, 'a')
    expect(uit.map((c) => c.primary)).toEqual([true, false])
  })
})

describe('facturatiegegevens', () => {
  const klant = {
    email: 'events@blum.be',
    address: { street: 'Industrieweg 12', postalCode: '3800', city: 'Sint-Truiden', country: 'België' },
  }

  it('valt terug op het bezoekadres zolang er geen apart factuuradres is', () => {
    expect(billingAddressOf(klant)).toEqual({ adres: klant.address, eigen: false })
    // Een adres met alleen lege velden is geen adres.
    const leeg = { ...klant, billingAddress: { street: '', postalCode: '', city: '', country: '' } }
    expect(billingAddressOf(leeg).eigen).toBe(false)
  })

  it('gebruikt het factuuradres zodra er iets in staat', () => {
    const boekhouder = { street: 'Kantoorstraat 1', postalCode: '3500', city: 'Hasselt', country: 'België' }
    const uit = billingAddressOf({ ...klant, billingAddress: boekhouder })
    expect(uit).toEqual({ adres: boekhouder, eigen: true })
  })

  it('kiest het factuur-e-mailadres boven het gewone', () => {
    expect(billingEmailOf(klant)).toEqual({ email: 'events@blum.be', eigen: false })
    expect(billingEmailOf({ ...klant, billingEmail: 'facturen@blum.be' })).toEqual({
      email: 'facturen@blum.be',
      eigen: true,
    })
  })

  it('zet een adres op één regel', () => {
    expect(addressLine(klant.address)).toBe('Industrieweg 12, 3800 Sint-Truiden, België')
    expect(addressLine(null)).toBe('')
  })
})

describe('customerHistory', () => {
  const taak = (over) => ({ id: 'x', title: 'Event', statusName: 'request', open: true, ...over })

  const taken = [
    taak({ id: 'oud', title: 'Kerstborrel 2025', eventDate: '2025-12-18', statusName: 'invoiced', quoteAmount: 6800 }),
    taak({ id: 'nieuw', title: '20-jarig bestaan', eventDate: '2026-12-19', statusName: 'offer accepted', budget: 24800 }),
    taak({ id: 'factureren', title: 'Teambuilding', eventDate: '2026-08-30', statusName: 'ready to invoice', quoteAmount: 4150 }),
    // Een subtaak van een event: hangt aan dezelfde klant en komt dus mee uit
    // de query, maar telt niet als event mee — anders staat hetzelfde bedrag er
    // twee keer in.
    taak({ id: 'subtaak', parentId: 'nieuw', title: 'Voorschot factureren', quoteAmount: 24800 }),
  ]

  it('geeft de events nieuwste eerst, zonder de subtaken', () => {
    const { events, aantal } = customerHistory(taken)
    expect(events.map((e) => e.id)).toEqual(['nieuw', 'factureren', 'oud'])
    expect(aantal).toBe(3)
  })

  it('telt de offertebedragen op', () => {
    expect(customerHistory(taken).totaal).toBe(6800 + 24800 + 4150)
  })

  it('houdt wat er te factureren valt apart', () => {
    const { teFactureren } = customerHistory(taken)
    expect(teFactureren.events.map((e) => e.id)).toEqual(['factureren'])
    expect(teFactureren.totaal).toBe(4150)
  })

  // Een aanvraag zonder dag hoort niet bovenaan een historiek te staan.
  it('zet een event zonder datum onderaan', () => {
    const { events } = customerHistory([taak({ id: 'geen-datum' }), ...taken])
    expect(events.at(-1).id).toBe('geen-datum')
  })

  it('laat gearchiveerde events weg', () => {
    const { aantal } = customerHistory([...taken, taak({ id: 'weg', archived: true, quoteAmount: 999 })])
    expect(aantal).toBe(3)
  })

  it('valt bij het bedrag terug op het oude budgetveld', () => {
    expect(amountOf({ budget: 1250 })).toBe(1250)
    expect(amountOf({ quoteAmount: 0, budget: 1250 })).toBe(0)
    expect(amountOf({})).toBe(null)
  })

  it('rekent een event zonder bedrag als nul in plaats van als NaN', () => {
    expect(customerHistory([taak({ id: 'leeg' })]).totaal).toBe(0)
  })
})

describe('viesVoorstel', () => {
  const gevonden = {
    geldig: true,
    naam: 'Blum België BV',
    adres: { street: 'Kempische Steenweg 293', postalCode: '3500', city: 'Hasselt', country: 'België' },
  }
  const leeg = { street: '', postalCode: '', city: '', country: 'België' }

  it('vult wat leeg is zonder te vragen', () => {
    const { patch, vragen } = viesVoorstel({ name: '', address: leeg }, gevonden)
    expect(patch).toEqual({ name: 'Blum België BV', address: gevonden.adres })
    expect(vragen).toEqual([])
  })

  it('vraagt eerst voor het overschrijft wat er al staat', () => {
    const klant = { name: 'Blum', address: { street: 'Oude baan 1', postalCode: '3500', city: 'Hasselt' } }
    const { patch, vragen } = viesVoorstel(klant, gevonden)
    expect(patch).toEqual({})
    expect(vragen.map((v) => v.veld)).toEqual(['name', 'address'])
    expect(vragen[0]).toEqual({ veld: 'name', nu: 'Blum', nieuw: 'Blum België BV' })
    expect(vragen[1].nu).toBe('Oude baan 1, 3500 Hasselt')
  })

  it('vraagt niets over wat al hetzelfde is', () => {
    const klant = { name: 'blum belgië bv', address: { ...gevonden.adres, street: 'Kempische  steenweg 293' } }
    expect(viesVoorstel(klant, gevonden)).toEqual({ patch: {}, vragen: [] })
  })

  it('neemt het adres als één blok: een half adres wordt niet aangevuld', () => {
    const klant = { name: 'Blum', address: { ...leeg, city: 'Genk' } }
    const { patch, vragen } = viesVoorstel(klant, gevonden)
    expect(patch.address).toBeUndefined()
    expect(vragen.find((v) => v.veld === 'address')?.nieuw).toEqual(gevonden.adres)
  })

  it('doet niets met een ongeldig nummer of een land dat niets vrijgeeft', () => {
    expect(viesVoorstel({ name: '' }, { geldig: false })).toEqual({ patch: {}, vragen: [] })
    expect(viesVoorstel({ name: '' }, { geldig: null })).toEqual({ patch: {}, vragen: [] })
    expect(viesVoorstel({ name: '', address: leeg }, { geldig: true, naam: '', adres: null })).toEqual({
      patch: {},
      vragen: [],
    })
  })
})
