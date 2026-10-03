import { describe, expect, it } from 'vitest'
import { AVATARMAAT, FOTOMAAT, MAX_BYTES, keurBestand, verkleinPlan, vierkantPlan } from '../src/lib/beeld'

/*
  Een profielfoto komt van een telefoon en is staand. Het rekenwerk van het
  bijknippen staat los van de browser, juist zodat het hier nagerekend kan
  worden in plaats van beoordeeld op een screenshot.
*/
describe('het vierkant uit een foto', () => {
  it('knipt een staande foto in het midden', () => {
    expect(vierkantPlan(720, 960)).toEqual({ x: 0, y: 120, zijde: 720, uit: 256 })
  })

  it('knipt een liggende foto in het midden', () => {
    expect(vierkantPlan(1600, 900)).toEqual({ x: 350, y: 0, zijde: 900, uit: 256 })
  })

  it('laat een vierkante foto staan', () => {
    const plan = vierkantPlan(800, 800)
    expect([plan.x, plan.y]).toEqual([0, 0])
    expect(plan.zijde).toBe(800)
  })

  // Opblazen voegt geen scherpte toe, alleen bytes.
  it('vergroot een kleine foto niet', () => {
    expect(vierkantPlan(120, 180).uit).toBe(120)
  })

  it('schrijft de avatarmaat van 256 niet stilletjes om', () => {
    expect(AVATARMAAT).toBe(256)
    expect(vierkantPlan(4000, 3000).uit).toBe(256)
  })

  // Een afbeelding zonder afmetingen is een stuk kapot bestand; dan liever een
  // nette foutmelding dan een canvas van 0 bij 0.
  it('weigert een afbeelding zonder afmetingen', () => {
    expect(() => vierkantPlan(0, 500)).toThrow()
    expect(() => vierkantPlan(undefined, undefined)).toThrow()
  })
})

describe('wat er door mag', () => {
  const bestand = (type, size) => ({ type, size })

  it('laat de gewone fotosoorten door', () => {
    for (const soort of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
      expect(keurBestand(bestand(soort, 1000))).toBeNull()
    }
  })

  it('zegt welke klacht het is in plaats van alleen nee', () => {
    expect(keurBestand(null)).toBe('geen_bestand')
    expect(keurBestand(bestand('application/pdf', 1000))).toBe('geen_beeld')
    expect(keurBestand(bestand('image/jpeg', MAX_BYTES + 1))).toBe('te_groot')
  })

  // Safari geeft 'IMAGE/JPEG' terug op een foto uit de bibliotheek.
  it('trekt zich niets aan van hoofdletters in het type', () => {
    expect(keurBestand(bestand('IMAGE/JPEG', 1000))).toBeNull()
  })
})

describe('een productfoto verkleinen', () => {
  it('maakt alleen kleiner, nooit groter', () => {
    expect(verkleinPlan(800, 600)).toEqual({ breedte: 800, hoogte: 600 })
    expect(verkleinPlan(1600, 1200)).toEqual({ breedte: 1600, hoogte: 1200 })
  })

  /*
    De verhouding blijft: een tent die 4:3 gefotografeerd is, blijft 4:3. De
    kaart op de site snijdt zelf bij; de opslag hoort niets te vervormen.
  */
  it('houdt de verhouding en zet de langste zijde op de maat', () => {
    expect(verkleinPlan(4000, 3000)).toEqual({ breedte: FOTOMAAT, hoogte: 1200 })
    expect(verkleinPlan(3000, 4000)).toEqual({ breedte: 1200, hoogte: FOTOMAAT })
    expect(verkleinPlan(5000, 1000, 1000)).toEqual({ breedte: 1000, hoogte: 200 })
  })
})
