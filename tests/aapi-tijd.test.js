import { describe, expect, it } from 'vitest'
import { beginVanDag, brusselNaarInstant, brusselseDag, dagenTussen, eindeVanDag, offsetMinuten } from '../functions/aapi/tijd'

const iso = (d) => d.toISOString()

describe('een klokstand uit AAPI omzetten', () => {
  it('rekent een zomertijdstip om op +02:00', () => {
    expect(iso(brusselNaarInstant('2026-10-01 09:30:00.000'))).toBe('2026-10-01T07:30:00.000Z')
  })

  it('rekent een wintertijdstip om op +01:00', () => {
    expect(iso(brusselNaarInstant('2026-12-24 18:00:00.000'))).toBe('2026-12-24T17:00:00.000Z')
  })

  /*
    De dag waar het op aankomt. 25 oktober 2026 is de nacht waarin de klok
    teruggaat; de drukste eventdag in het voorbeeldbestand ligt er bovenop.
    Een shift van 05:00 staat die dag op +01:00. Wie dat mist zet elke shift van
    die dag een uur verkeerd, en matcht met het verkeerde event of met geen.
  */
  it('kent de dag waarop de klok teruggaat', () => {
    expect(iso(brusselNaarInstant('2026-10-25 05:00:00.000'))).toBe('2026-10-25T04:00:00.000Z')
    expect(iso(brusselNaarInstant('2026-10-25 12:00:00.000'))).toBe('2026-10-25T11:00:00.000Z')
    // Vóór de omschakeling diezelfde nacht geldt nog +02:00.
    expect(iso(brusselNaarInstant('2026-10-25 01:30:00.000'))).toBe('2026-10-24T23:30:00.000Z')
  })

  it('kent de dag waarop de klok vooruitgaat', () => {
    // 29 maart 2026: 02:00 bestaat niet, 03:00 is het eerste uur op +02:00.
    expect(iso(brusselNaarInstant('2026-03-29 01:30:00.000'))).toBe('2026-03-29T00:30:00.000Z')
    expect(iso(brusselNaarInstant('2026-03-29 03:00:00.000'))).toBe('2026-03-29T01:00:00.000Z')
  })

  it('verdraagt een T, een ontbrekende seconde en rommel eromheen', () => {
    expect(iso(brusselNaarInstant('2026-07-01T08:00'))).toBe('2026-07-01T06:00:00.000Z')
    expect(iso(brusselNaarInstant('  2026-07-01 08:00:00  '))).toBe('2026-07-01T06:00:00.000Z')
  })

  it('geeft niets terug voor wat geen tijdstip is', () => {
    for (const rommel of ['', null, undefined, 'morgen', '01/10/2026']) {
      expect(brusselNaarInstant(rommel)).toBeNull()
    }
  })

  it('noemt de offset bij naam', () => {
    expect(offsetMinuten(new Date('2026-07-01T00:00:00Z'))).toBe(120)
    expect(offsetMinuten(new Date('2026-12-01T00:00:00Z'))).toBe(60)
  })
})

describe('de Brusselse kalenderdag', () => {
  // Om 23:30 UTC is het in Brussel al de volgende dag; een shift die om 00:30
  // 's nachts begint hoort bij die nacht en niet bij de dag ervoor.
  it('is niet de UTC-dag', () => {
    expect(brusselseDag(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02')
    expect(brusselseDag(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-02')
  })

  it('loopt van middernacht tot middernacht, ook op een dag van 25 uur', () => {
    expect(iso(beginVanDag('2026-10-25'))).toBe('2026-10-24T22:00:00.000Z')
    expect(iso(eindeVanDag('2026-10-25'))).toBe('2026-10-25T22:59:59.999Z')
    // 25 oktober 2026 duurt 25 uur.
    expect(eindeVanDag('2026-10-25') - beginVanDag('2026-10-25') + 1).toBe(25 * 3600 * 1000)
  })

  it('somt de dagen in een bereik op, over een omschakeling heen', () => {
    expect(dagenTussen(new Date('2026-10-24T10:00:00Z'), new Date('2026-10-26T10:00:00Z')))
      .toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
  })

  it('geeft één dag voor een bereik binnen één dag', () => {
    expect(dagenTussen(new Date('2026-10-25T04:00:00Z'), new Date('2026-10-25T11:00:00Z')))
      .toEqual(['2026-10-25'])
  })
})
