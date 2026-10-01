import { describe, expect, it } from 'vitest'
import { portretVan, portretVoor } from '../src/lib/portret'

/*
  De avatars komen uit de e-mailhandtekeningen, en in die ZIP klopten de
  bestandsnamen niet met de inhoud: de handtekening in "Maxine Vanbrabant (2)"
  draagt de naam en het adres van Elke. Dat is één keer verkeerd gegaan en dan
  staat er een foto van de verkeerde persoon naast iemands werk.

  Deze test legt de koppeling vast op het adres, niet op een bestandsnaam.
*/
describe('het portret bij een adres', () => {
  it('kent Jasper, Elke en Maxine', () => {
    expect(portretVan('jasper@jeconcept.be')).toBe('/team/jasper.jpg')
    expect(portretVan('elke@jeconcept.be')).toBe('/team/elke.jpg')
    expect(portretVan('maxine@jeconcept.be')).toBe('/team/maxine.jpg')
  })

  // De ploeg werkt onder twee domeinen door elkaar: Elkes handtekening staat op
  // jeconcept.be en haar profiel op kenjeklanten.be, en Maxine zit helemaal op
  // kenjeklanten.be. Beide tellen.
  it('kent beide huisdomeinen', () => {
    expect(portretVan('elke@kenjeklanten.be')).toBe('/team/elke.jpg')
    expect(portretVan('maxine@kenjeklanten.be')).toBe('/team/maxine.jpg')
    expect(portretVan('jasper@kenjeklanten.be')).toBe('/team/jasper.jpg')
  })

  it('trekt zich niets aan van hoofdletters of spaties', () => {
    expect(portretVan('  Jasper@JEConcept.be ')).toBe('/team/jasper.jpg')
  })

  /*
    Hier stond eerst een vaste lijst adressen, en die werkte precies voor de
    adressen die ik gegokt had: live stonden Elke en Maxine zonder gezicht.
    Nu telt het eerste stuk van het adres, dus ook een punt of een plusje erin.
  */
  it('herkent een adres met een punt of een plusje erin', () => {
    expect(portretVan('elke.motmans@jeconcept.be')).toBe('/team/elke.jpg')
    expect(portretVan('maxine+planning@jeconcept.be')).toBe('/team/maxine.jpg')
  })

  // Een gmail-adres van een flexi zegt niets over wie het is.
  it('kijkt alleen binnen onze eigen domeinen', () => {
    expect(portretVan('elke@gmail.com')).toBeNull()
    expect(portretVan('jasper@example.org')).toBeNull()
  })

  // Wie er niet in staat houdt zijn initialen; null en niet een pad dat 404't.
  it('geeft niets terug voor de rest', () => {
    expect(portretVan('anneleen@kenjeklanten.be')).toBeNull()
    expect(portretVan(undefined)).toBeNull()
    expect(portretVan('')).toBeNull()
    expect(portretVan('geen-adres')).toBeNull()
  })
})

describe('het portret bij een profiel', () => {
  it('neemt het adres wanneer dat iets zegt', () => {
    expect(portretVoor({ email: 'elke@jeconcept.be', fullName: 'Elke Motmans' })).toBe('/team/elke.jpg')
  })

  // Iemand kan met een privéadres aangemeld zijn en heet dan nog altijd Elke.
  it('valt terug op de voornaam', () => {
    expect(portretVoor({ email: 'elke.motmans@hotmail.com', fullName: 'Elke Motmans' })).toBe('/team/elke.jpg')
    expect(portretVoor({ fullName: 'Maxine Vanbrabant' })).toBe('/team/maxine.jpg')
  })

  it('geeft niets terug voor wie we niet kennen', () => {
    expect(portretVoor({ email: 'lotte@barvue.be', fullName: 'Lotte Vrijsen' })).toBeNull()
    expect(portretVoor(null)).toBeNull()
    expect(portretVoor({})).toBeNull()
  })
})
