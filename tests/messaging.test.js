import { describe, expect, it } from 'vitest'
import { BEWAAR_MAANDEN, STANDAARD_SOORT, berichtId, bewaarTot, bronVanToken, kenmerkVan, leesEnvelop, leesTokens, maakLimiet, wintermoodsNaarEnvelop } from '../functions-messaging/envelop.js'
import { BRONNEN, KAART_VOOR_SOORT, kaartId, kaartVelden, leesAanvraag, leesDatum, leesWintermoods, omschrijving, titelVan, wordtKaart } from '../functions/messaging-kaart.js'
import { BEWAAR_MAANDEN as BEWAAR_MAANDEN_FUNCTIES, HERKANSING_DAGEN, MAX_POGINGEN, RELAY_MINUTEN, WACHTTIJD_MINUTEN, herkansbaar, isVastgelopen, samenvatting, wachtOpDeBus } from '../functions/messaging-stand.js'
import { BUS_VERSIE, TOPIC_BERICHTEN, TOPIC_VASTGELOPEN, busBericht, isVoor, leesBusBericht, vastgelopenBericht } from '../functions/messaging-bus.js'

/*
  Messaging: de ene ingang voor berichten van buiten, en de verwerker die er
  een kaart van maakt. Alleen de delen zonder imports, want CI installeert enkel
  de wortel — dezelfde reden waarom `order.js` in functions-betaling los staat.
*/
const gelijk = (a, b) => a === b

describe('de envelop', () => {
  const goed = { soort: 'reservatie.aangevraagd', sleutel: 'abc-123', taal: 'fr', tijdstip: '2026-12-01T10:00:00Z', inhoud: { naam: 'Lies' } }

  it('neemt precies de velden over die in de log horen, en niets anders', () => {
    const { envelop, fout } = leesEnvelop({ ...goed, iets: 'anders' }, { bron: 'wintermoods' })
    expect(fout).toBeUndefined()
    expect(envelop).toEqual({
      bron: 'wintermoods', soort: 'reservatie.aangevraagd', sleutel: 'abc-123',
      tijdstip: '2026-12-01T10:00:00.000Z', taal: 'fr', inhoud: { naam: 'Lies' },
    })
    expect(Object.keys(envelop)).not.toContain('iets')
  })

  it('weigert zonder bron, met een verkeerde soort of sleutel, of zonder inhoud — elk met een eigen code', () => {
    expect(leesEnvelop(goed, {})).toEqual({ fout: 'geen_bron' })
    expect(leesEnvelop({ ...goed, soort: 'Reservatie' }, { bron: 'wintermoods' })).toEqual({ fout: 'geen_soort' })
    expect(leesEnvelop({ ...goed, sleutel: 'met spatie' }, { bron: 'wintermoods' })).toEqual({ fout: 'geen_sleutel' })
    expect(leesEnvelop({ ...goed, inhoud: 'tekst' }, { bron: 'wintermoods' })).toEqual({ fout: 'geen_inhoud' })
    expect(leesEnvelop({ ...goed, inhoud: [1] }, { bron: 'wintermoods' })).toEqual({ fout: 'geen_inhoud' })
    expect(leesEnvelop({ ...goed, inhoud: {} }, { bron: 'wintermoods' })).toEqual({ fout: 'geen_inhoud' })
    expect(leesEnvelop({ ...goed, inhoud: { bericht: 'x'.repeat(30000) } }, { bron: 'wintermoods' })).toEqual({ fout: 'te_groot' })
  })

  it('neemt een plat formulier aan, zoals een webhook van WordPress of Wix het stuurt', () => {
    const { envelop } = leesEnvelop({ 'your-name': 'An', 'your-email': 'an@example.be', datum: '12/12/2026' }, { bron: 'barvue' })
    expect(envelop.soort).toBe(STANDAARD_SOORT)
    expect(envelop.inhoud).toEqual({ 'your-name': 'An', 'your-email': 'an@example.be', datum: '12/12/2026' })
    expect(envelop.sleutel).toMatch(/^h[a-z0-9]+$/)
  })

  it('geeft dezelfde inzending zonder eigen kenmerk toch hetzelfde kenmerk, ook in een andere volgorde', () => {
    expect(kenmerkVan({ a: 1, b: { c: 2, d: 3 } })).toBe(kenmerkVan({ b: { d: 3, c: 2 }, a: 1 }))
    expect(kenmerkVan({ a: 1 })).not.toBe(kenmerkVan({ a: 2 }))
  })

  it('laat een onleesbaar tijdstip weg en valt terug op Nederlands', () => {
    const { envelop } = leesEnvelop({ ...goed, tijdstip: 'gisteren', taal: 'de' }, { bron: 'barvue' })
    expect(envelop.tijdstip).toBeNull()
    expect(envelop.taal).toBe('nl')
  })

  it('geeft dezelfde inzending hetzelfde id, zodat een herhaling één rij blijft', () => {
    expect(berichtId({ bron: 'wintermoods', sleutel: 'abc-123' })).toBe('wintermoods-abc-123')
  })

  it('steekt het oude platte Wintermoods-formulier in de envelop', () => {
    const { envelop } = wintermoodsNaarEnvelop({ aanvraagId: '0f1c', taal: 'nl', naam: 'Jasper', email: 'j@example.be', personen: 24, bron: 'wintermoods' })
    expect(envelop.bron).toBe('wintermoods')
    expect(envelop.soort).toBe('reservatie.aangevraagd')
    expect(envelop.sleutel).toBe('0f1c')
    expect(envelop.inhoud).toEqual({ naam: 'Jasper', email: 'j@example.be', personen: 24 })
    expect(wintermoodsNaarEnvelop({ naam: 'zonder id' })).toEqual({ fout: 'geen_sleutel' })
  })
})

describe('de tokens per bron', () => {
  it('leest één geheim met een token per bron, en laat te korte of vreemde regels weg', () => {
    const tokens = leesTokens(JSON.stringify({ wintermoods: 'a'.repeat(32), barvue: 'kort', 'Raar Naam': 'b'.repeat(32) }))
    expect(Object.keys(tokens)).toEqual(['wintermoods'])
  })

  it('geeft niets terug op een kapot of leeg geheim, in plaats van te crashen', () => {
    expect(leesTokens('')).toEqual({})
    expect(leesTokens('{niet json')).toEqual({})
    expect(leesTokens('[1,2]')).toEqual({})
  })

  it('herkent de bron aan de token, met of zonder Bearer', () => {
    const tokens = { wintermoods: 'w'.repeat(32), barvue: 'b'.repeat(32) }
    expect(bronVanToken(tokens, `Bearer ${'b'.repeat(32)}`, gelijk)).toBe('barvue')
    expect(bronVanToken(tokens, 'w'.repeat(32), gelijk)).toBe('wintermoods')
    expect(bronVanToken(tokens, 'Bearer verkeerd', gelijk)).toBeNull()
    expect(bronVanToken(tokens, undefined, gelijk)).toBeNull()
  })

  it('aanvaardt twee tokens voor één bron, zodat een wissel geen stilstand geeft', () => {
    const oud = 'o'.repeat(32)
    const nieuw = 'n'.repeat(32)
    const tokens = leesTokens(JSON.stringify({ wintermoods: [oud, nieuw, 'kort'] }))
    expect(tokens).toEqual({ wintermoods: [oud, nieuw] })
    expect(bronVanToken(tokens, oud, gelijk)).toBe('wintermoods')
    expect(bronVanToken(tokens, nieuw, gelijk)).toBe('wintermoods')
    // De oude eruit: vanaf dan geldt alleen de nieuwe.
    const daarna = leesTokens(JSON.stringify({ wintermoods: [nieuw] }))
    expect(bronVanToken(daarna, oud, gelijk)).toBeNull()
  })

  it('laat een bron zonder één geldige token helemaal weg', () => {
    expect(leesTokens(JSON.stringify({ barvue: ['kort', 42] }))).toEqual({})
  })

  it('vergelijkt met elke token, ook na een treffer, zodat de tijd niets verraadt', () => {
    let vergeleken = 0
    const tellend = (a, b) => (vergeleken += 1) && a === b
    bronVanToken({ a: ['x'.repeat(16)], b: ['y'.repeat(16), 'z'.repeat(16)] }, 'x'.repeat(16), tellend)
    expect(vergeleken).toBe(3)
  })
})

describe('de limiet per bron', () => {
  it('laat er zoveel per minuut door en weigert de volgende', () => {
    const binnen = maakLimiet(3)
    const t = 1_000_000
    expect([binnen('wm', t), binnen('wm', t + 1), binnen('wm', t + 2), binnen('wm', t + 3)]).toEqual([true, true, true, false])
  })

  it('telt per bron: een lek bij de ene legt de andere niet stil', () => {
    const binnen = maakLimiet(1)
    expect(binnen('wm', 0)).toBe(true)
    expect(binnen('wm', 1)).toBe(false)
    expect(binnen('barvue', 1)).toBe(true)
  })

  it('gaat na een minuut weer open', () => {
    const binnen = maakLimiet(1)
    expect(binnen('wm', 0)).toBe(true)
    expect(binnen('wm', 59_999)).toBe(false)
    expect(binnen('wm', 60_000)).toBe(true)
  })
})

describe('de bewaartermijn', () => {
  it('is twee jaar na ontvangst', () => {
    expect(bewaarTot(new Date('2026-10-06T12:00:00Z')).toISOString()).toBe('2028-10-06T12:00:00.000Z')
  })

  it('is dezelfde in de ingang en in de spiegel van de verhuursite', () => {
    // Twee codebases, twee kopieën van het getal: dit houdt ze gelijk.
    expect(BEWAAR_MAANDEN_FUNCTIES).toBe(BEWAAR_MAANDEN)
  })

  it('staat als TTL-regel op de log', async () => {
    const { readFileSync } = await import('node:fs')
    const json = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'))
    expect(json.fieldOverrides).toContainEqual(expect.objectContaining({ collectionGroup: 'messaging', fieldPath: 'bewaarTot', ttl: true }))
  })
})

describe('de kaart uit een Wintermoods-aanvraag', () => {
  const bericht = {
    bron: 'wintermoods', soort: 'reservatie.aangevraagd', sleutel: '0f1c', taal: 'fr',
    inhoud: { naam: 'Jasper Eyckmans', email: 'jasper@example.be', telefoon: '012 28 01 00', datum: '2026-12-19', moment: 'avond', personen: '24', formule: 'bbq', formuleLabel: 'Winter BBQ (€ 44,50)', gelegenheid: 'bedrijf', dieet: '2 vegetarisch', bericht: 'Teamfeest.' },
  }

  it('wordt een kaart in request, met een afleidbaar id', () => {
    expect(KAART_VOOR_SOORT[bericht.soort]).toBe('request')
    expect(kaartId(bericht)).toBe('wm-0f1c')
    expect(kaartId({ ...bericht, bron: 'barvue' })).toBe('msg-barvue-0f1c')
    expect(kaartId({ ...bericht, sleutel: '' })).toBeNull()
  })

  it('normaliseert de inhoud: aantal, datum, grenzen', () => {
    const a = leesWintermoods(bericht.inhoud, 'fr')
    expect(a.personen).toBe(24)
    expect(a.datum).toBe('2026-12-19')
    expect(leesWintermoods({ ...bericht.inhoud, personen: 5000 }).personen).toBe(1000)
    expect(leesWintermoods({ ...bericht.inhoud, datum: 'volgende week' }).datum).toBeNull()
  })

  it('heet naar de klant en het aantal, en leest in de omschrijving wat de klant invulde', () => {
    const a = leesWintermoods(bericht.inhoud, 'fr')
    expect(titelVan(a)).toBe('Wintermoods — Jasper Eyckmans (24p)')
    const tekst = omschrijving(a)
    expect(tekst).toContain('(FR)')
    expect(tekst).toContain('Formule: Winter BBQ')
    expect(tekst).toContain('Gelegenheid: Bedrijfsfeest')
    expect(omschrijving(leesWintermoods({ ...bericht.inhoud, dieet: '', bericht: '', formule: null, formuleLabel: null }, 'nl'))).not.toContain('Dieet')
  })

  it('zet "op locatie" op de kaart als plek, want dat laat de keuken iets anders doen', () => {
    expect(kaartVelden(bericht).location).toBe('Het Vinne, Zoutleeuw')
    expect(kaartVelden({ ...bericht, inhoud: { ...bericht.inhoud, gelegenheid: 'locatie' } }).location).toBe('Op locatie, bij de klant')
  })

  it('draagt het bericht mee waar het van komt', () => {
    const velden = kaartVelden(bericht)
    expect(velden.bron).toBe('wintermoods')
    expect(velden.berichtId).toBe('wintermoods-0f1c')
    expect(velden.pax).toBe(24)
    expect(velden.eventDate).toEqual(new Date('2026-12-19T12:00:00'))
    expect(velden.tags).toEqual(['wintermoods'])
  })
})

describe('de stand per verwerker', () => {
  const dag = 86400000
  const nu = Date.parse('2026-10-06T12:00:00Z')
  const bericht = (verwerking, dagenGeleden = 1) => ({
    bron: 'wintermoods', soort: 'reservatie.aangevraagd', sleutel: 'x', inhoud: { naam: 'Lies' },
    ontvangen: new Date(nu - dagenGeleden * dag), verwerking,
  })

  it('herkanst alleen wat op fout staat', () => {
    expect(herkansbaar(bericht({}), 'event', nu)).toBe(false)
    expect(herkansbaar(bericht({ event: { stand: 'klaar' } }), 'event', nu)).toBe(false)
    expect(herkansbaar(bericht({ event: { stand: 'overgeslagen' } }), 'event', nu)).toBe(false)
    expect(herkansbaar(bericht({ event: { stand: 'fout', pogingen: 1 } }), 'event', nu)).toBe(true)
  })

  it('geeft het op na drie pogingen, en zegt dan dat het vastgelopen is', () => {
    expect(herkansbaar(bericht({ event: { stand: 'fout', pogingen: 2 } }), 'event', nu)).toBe(true)
    expect(herkansbaar(bericht({ event: { stand: 'fout', pogingen: MAX_POGINGEN } }), 'event', nu)).toBe(false)
    expect(isVastgelopen(bericht({ event: { stand: 'fout', pogingen: MAX_POGINGEN } }), 'event')).toBe(true)
    expect(isVastgelopen(bericht({ event: { stand: 'fout', pogingen: 1 } }), 'event')).toBe(false)
  })

  it('laat een oud bericht met rust: wie dat nog wil, herspeelt met de hand', () => {
    expect(herkansbaar(bericht({ event: { stand: 'fout', pogingen: 1 } }, HERKANSING_DAGEN + 1), 'event', nu)).toBe(false)
    expect(herkansbaar(bericht({ event: { stand: 'fout', pogingen: 1 } }, HERKANSING_DAGEN - 1), 'event', nu)).toBe(true)
  })

  it('vat een bericht in één regel samen, met de klant erbij als die er is', () => {
    expect(samenvatting(bericht({}))).toBe('wintermoods · reservatie.aangevraagd · x · Lies')
    expect(samenvatting({ bron: 'barvue', soort: 'a.b', sleutel: '1', inhoud: {} })).toBe('barvue · a.b · 1')
  })
})

describe('elke bron op het bord', () => {
  it('kent elke site van JE Concept, en de verhuursite krijgt geen tweede kaart', () => {
    for (const bron of ['wintermoods', 'feestbeest', 'jeconcept', 'barvue', 'meer', 'kenjeklanten']) {
      expect(wordtKaart({ bron, soort: 'offerte.aangevraagd' }), bron).toBe(true)
    }
    expect(wordtKaart({ bron: 'verhuur', soort: 'offerte.aangevraagd' })).toBe(false)
    expect(wordtKaart({ bron: 'onbekend', soort: 'offerte.aangevraagd' })).toBe(false)
    expect(wordtKaart({ bron: 'barvue', soort: 'huur.betaald' })).toBe(false)
    expect(BRONNEN.barvue.merk).toBe('Bar Vue')
  })

  it('leest de velden van een formulier onder hun gewone namen, in drie talen', () => {
    const a = leesAanvraag({ 'your-name': 'An Peeters', 'your-email': 'an@example.be', gsm: '0470 00 00 00', 'Aantal personen': '35 personen', Date: '2026-11-07', 'your-message': 'Verjaardag', Budget: '1500' })
    expect(a.naam).toBe('An Peeters')
    expect(a.email).toBe('an@example.be')
    expect(a.telefoon).toBe('0470 00 00 00')
    expect(a.personen).toBe(35)
    expect(a.datum).toBe('2026-11-07')
    expect(a.bericht).toBe('Verjaardag')
    // Wat geen vaste plek heeft, gaat niet verloren.
    expect(a.extra).toEqual([['Budget', '1500']])
    expect(leesAanvraag({ Prénom: 'Marie', 'Nom de famille': 'Dubois', Courriel: 'm@example.be' }).naam).toBe('Marie Dubois')
  })

  it('leest een datum in de Belgische vorm', () => {
    expect(leesDatum('7/11/2026')).toBe('2026-11-07')
    expect(leesDatum('07.11.2026')).toBe('2026-11-07')
    expect(leesDatum('2026-11-07T18:00:00Z')).toBe('2026-11-07')
    expect(leesDatum('zaterdag')).toBeNull()
  })

  it('maakt van een Bar Vue-aanvraag een kaart met het merk, de plek en wat de klant invulde', () => {
    const b = { bron: 'barvue', soort: 'offerte.aangevraagd', sleutel: 'h1', taal: 'nl', inhoud: { naam: 'An', email: 'an@example.be', personen: 40, Budget: '1500' } }
    const v = kaartVelden(b, { brandId: 'bar-vue' })
    expect(v.title).toBe('Bar Vue — An (40p)')
    expect(v.location).toBe('Bar Vue')
    expect(v.brandId).toBe('bar-vue')
    expect(v.tags).toEqual(['barvue'])
    expect(v.berichtId).toBe('barvue-h1')
    expect(v.description).toContain('Aanvraag via barvue.be.')
    expect(v.description).toContain('Budget: 1500')
    expect(kaartVelden(b).brandId).toBeUndefined()
  })

  it('zet een Feestbeest-aanvraag op het bord als kinderfeest', () => {
    const v = kaartVelden({ bron: 'feestbeest', soort: 'reservatie.aangevraagd', sleutel: 'x', taal: 'fr', inhoud: { naam: 'Lou', 'aantal kinderen': 12, gelegenheid: 'slaapfeest' } })
    expect(v.eventType).toBe('Kinderfeest')
    expect(v.pax).toBe(12)
    expect(v.title).toBe('Feestbeest — Lou (12p)')
    expect(omschrijving(leesAanvraag({ naam: 'Lou' }, 'fr'), 'feestbeest')).toContain('feest-beest.be (FR)')
  })
})

describe('de token beslist de bron', () => {
  it('negeert wat de afzender zelf in bron zet', () => {
    // Er is geen platform meer dat voor andere sites mag spreken: een gelekte
    // token kan nooit namens een andere site afleveren.
    const { envelop } = leesEnvelop({ bron: 'barvue', soort: 'offerte.aangevraagd', sleutel: 'x1', inhoud: { naam: 'An' } }, { bron: 'feestbeest' })
    expect(envelop.bron).toBe('feestbeest')
    expect(envelop.via).toBeUndefined()
  })
})

describe('de bus', () => {
  const min = 60000
  const nu = Date.parse('2026-10-06T12:00:00Z')
  const rij = { bron: 'barvue', soort: 'offerte.aangevraagd', sleutel: 'h1', inhoud: { naam: 'An', email: 'an@example.be', telefoon: '0470' } }

  it('zet alleen een verwijzing op de bus, nooit de inhoud', () => {
    const { json, attributes } = busBericht('barvue-h1', rij)
    expect(json).toEqual({ v: BUS_VERSIE, id: 'barvue-h1', bron: 'barvue', soort: 'offerte.aangevraagd', sleutel: 'h1' })
    expect(JSON.stringify(json)).not.toContain('an@example.be')
    expect(attributes).toEqual({ id: 'barvue-h1', bron: 'barvue', soort: 'offerte.aangevraagd' })
    expect(Object.values(attributes).every((w) => typeof w === 'string')).toBe(true)
    expect(TOPIC_BERICHTEN).not.toBe(TOPIC_VASTGELOPEN)
  })

  it('stuurt een herkansing naar één verwerker, en de andere laten ze liggen', () => {
    const { json, attributes } = busBericht('barvue-h1', rij, { verwerker: 'event' })
    expect(attributes.verwerker).toBe('event')
    const gelezen = leesBusBericht(json)
    expect(isVoor(gelezen, 'event')).toBe(true)
    expect(isVoor(gelezen, 'boekhouding')).toBe(false)
    expect(isVoor(leesBusBericht(busBericht('x', rij).json), 'boekhouding')).toBe(true)
  })

  it('laat liggen wat het niet begrijpt', () => {
    expect(leesBusBericht(null)).toBeNull()
    expect(leesBusBericht({ v: 1 })).toBeNull()
    expect(leesBusBericht({ v: BUS_VERSIE + 1, id: 'x' })).toBeNull()
    expect(isVoor(null, 'event')).toBe(false)
  })

  it('geeft de dead-letter-topic de reden mee, begrensd', () => {
    const { json, attributes } = vastgelopenBericht('barvue-h1', 'event', 'x'.repeat(500))
    expect(json.fout).toHaveLength(200)
    expect(attributes).toEqual({ id: 'barvue-h1', verwerker: 'event' })
  })

  it('wacht steeds langer tussen twee pogingen', () => {
    expect(WACHTTIJD_MINUTEN(1)).toBe(5)
    expect(WACHTTIJD_MINUTEN(2)).toBe(15)
    const fout = (pogingen, minutenGeleden) => ({
      ontvangen: new Date(nu - 60 * min),
      verwerking: { event: { stand: 'fout', pogingen, op: new Date(nu - minutenGeleden * min) } },
    })
    expect(herkansbaar(fout(1, 4), 'event', nu)).toBe(false)
    expect(herkansbaar(fout(1, 5), 'event', nu)).toBe(true)
    expect(herkansbaar(fout(2, 10), 'event', nu)).toBe(false)
    expect(herkansbaar(fout(2, 15), 'event', nu)).toBe(true)
    expect(herkansbaar(fout(MAX_POGINGEN, 600), 'event', nu)).toBe(false)
  })

  it('zet zelf op de bus wat de relay miste, maar geeft de relay eerst de tijd', () => {
    const wacht = (minutenGeleden, stand = 'wacht') => ({ ontvangen: new Date(nu - minutenGeleden * min), bus: { stand } })
    expect(wachtOpDeBus(wacht(RELAY_MINUTEN - 1), nu)).toBe(false)
    expect(wachtOpDeBus(wacht(RELAY_MINUTEN), nu)).toBe(true)
    expect(wachtOpDeBus(wacht(30, 'gepubliceerd'), nu)).toBe(false)
    expect(wachtOpDeBus({ ontvangen: new Date(nu - 30 * min) }, nu)).toBe(false)
    expect(wachtOpDeBus(wacht((HERKANSING_DAGEN + 1) * 24 * 60), nu)).toBe(false)
  })
})
