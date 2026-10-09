import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leesBtwNummer, leesViesAntwoord, netjes, viesAdres, viesUrl } from '../functions/vies.js'

/**
 * Het leeswerk achter "btw-nummer ingeven, naam en adres ophalen".
 *
 * VIES geeft per land een andere opmaak terug, en een fout in dat leeswerk
 * zie je niet in een test van het scherm: dan staat er gewoon een postcode in
 * het veld van de straat, op een offerte die de deur uit gaat.
 */

describe('leesBtwNummer', () => {
  it('leest alle Belgische schrijfwijzen als hetzelfde nummer', () => {
    for (const ruw of ['BE 0207.474.981', 'be0207474981', '0207474981', '207474981', 'BE-0207-474-981']) {
      expect(leesBtwNummer(ruw)).toEqual({ land: 'BE', nummer: '0207474981' })
    }
  })

  it('kent buitenlandse nummers, en Griekenland als EL', () => {
    expect(leesBtwNummer('NL 0044.95.445.B01')).toEqual({ land: 'NL', nummer: '004495445B01' })
    expect(leesBtwNummer('FR 40 303 265 045')).toEqual({ land: 'FR', nummer: '40303265045' })
    expect(leesBtwNummer('GR094014201')).toEqual({ land: 'EL', nummer: '094014201' })
  })

  it('vraagt niets op wat geen btw-nummer uit de EU is', () => {
    expect(leesBtwNummer('')).toBeNull()
    expect(leesBtwNummer(null)).toBeNull()
    expect(leesBtwNummer('US 123456789')).toBeNull()
    expect(leesBtwNummer('BE 12345')).toBeNull()
    expect(leesBtwNummer('Blum')).toBeNull()
    // Alles wat naar het adres gaat, is letters en cijfers.
    expect(leesBtwNummer('NL123/../x?y')).toBeNull()
  })

  it('bouwt het adres van de dienst uit land en nummer', () => {
    expect(viesUrl({ land: 'BE', nummer: '0207474981' })).toBe(
      'https://ec.europa.eu/taxation_customs/vies/rest-api/ms/BE/vat/0207474981'
    )
  })
})

describe('viesAdres', () => {
  it('splitst een Belgisch adres in straat, postcode en gemeente', () => {
    expect(viesAdres('Kempische Steenweg 293\n3500 Hasselt', 'BE')).toEqual({
      street: 'Kempische Steenweg 293',
      postalCode: '3500',
      city: 'Hasselt',
    })
  })

  it('zet een adres in hoofdletters gewoon, en ruimt witruimte op', () => {
    expect(viesAdres('  GROTE MARKT   1 \n\n1000  BRUSSEL\n', 'BE')).toEqual({
      street: 'Grote Markt 1',
      postalCode: '1000',
      city: 'Brussel',
    })
  })

  it('kent de Nederlandse postcode met letters', () => {
    expect(viesAdres('DORPSSTRAAT 00012\n1234AB AMSTERDAM', 'NL')).toEqual({
      street: 'Dorpsstraat 00012',
      postalCode: '1234 AB',
      city: 'Amsterdam',
    })
  })

  it('leest een Frans lidwoord niet als postcode', () => {
    expect(viesAdres('12 RUE DE LA GARE\n72000 LE MANS', 'FR')).toEqual({
      street: '12 Rue De La Gare',
      postalCode: '72000',
      city: 'Le Mans',
    })
  })

  it('leest straat en gemeente op één regel met een komma', () => {
    expect(viesAdres('Rue de la Loi 16, 1000 Bruxelles', 'BE')).toEqual({
      street: 'Rue de la Loi 16',
      postalCode: '1000',
      city: 'Bruxelles',
    })
  })

  it('zet alles in de straat wanneer er geen postcode te vinden is', () => {
    expect(viesAdres('Ergens in de Kempen', 'BE')).toEqual({ street: 'Ergens in de Kempen', postalCode: '', city: '' })
    expect(viesAdres('---', 'DE')).toEqual({ street: '', postalCode: '', city: '' })
  })
})

describe('netjes', () => {
  it('laat de rechtsvorm in hoofdletters', () => {
    expect(netjes('BROUWERIJ HET ANKER NV')).toBe('Brouwerij Het Anker NV')
    expect(netjes('D\'IETEREN SA')).toBe("D'Ieteren SA")
  })

  it('laat met rust wat al gemengd geschreven is', () => {
    expect(netjes('deBuren vzw')).toBe('deBuren vzw')
  })
})

describe('leesViesAntwoord', () => {
  it('geeft naam en adres van een geldig nummer', () => {
    const uit = leesViesAntwoord(
      {
        isValid: true,
        userError: 'VALID',
        name: 'STAD BORGLOON',
        address: 'MARKT 1\n3840 BORGLOON',
        vatNumber: '0207474981',
      },
      'BE'
    )
    expect(uit).toEqual({
      geldig: true,
      naam: 'Stad Borgloon',
      adres: { street: 'Markt 1', postalCode: '3840', city: 'Borgloon', country: 'België' },
      reden: null,
    })
  })

  it('zegt eerlijk dat een land naam en adres niet vrijgeeft', () => {
    const uit = leesViesAntwoord({ isValid: true, userError: 'VALID', name: '---', address: '---' }, 'DE')
    expect(uit).toEqual({ geldig: true, naam: '', adres: null, reden: 'geheim' })
  })

  it('houdt ongeldig en onbereikbaar uit elkaar', () => {
    expect(leesViesAntwoord({ isValid: false, userError: 'INVALID' }).geldig).toBe(false)
    expect(leesViesAntwoord({ isValid: false, userError: 'MS_UNAVAILABLE' })).toMatchObject({
      geldig: null,
      reden: 'onbereikbaar',
    })
    expect(leesViesAntwoord({ actionSucceed: false, errorWrappers: [{ error: 'INVALID_INPUT' }] })).toMatchObject({
      geldig: null,
      reden: 'vorm',
    })
    expect(leesViesAntwoord(null).geldig).toBe(false)
  })
})

describe('vies.js blijft zonder imports', () => {
  it('want CI heeft geen functions/node_modules', () => {
    const bron = readFileSync(new URL('../functions/vies.js', import.meta.url), 'utf8')
    expect(bron).not.toMatch(/^\s*import\s/m)
    expect(bron).not.toMatch(/\brequire\(/)
  })
})
