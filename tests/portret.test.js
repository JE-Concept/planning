import { describe, expect, it } from 'vitest'
import { portretVan } from '../src/lib/portret'

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

  // Elke werkt onder twee domeinen; haar profiel staat op het ene en haar
  // handtekening op het andere.
  it('kent Elke ook op kenjeklanten.be', () => {
    expect(portretVan('elke@kenjeklanten.be')).toBe('/team/elke.jpg')
  })

  it('trekt zich niets aan van hoofdletters of spaties', () => {
    expect(portretVan('  Jasper@JEConcept.be ')).toBe('/team/jasper.jpg')
  })

  // Wie er niet in staat houdt zijn initialen; null en niet een pad dat 404't.
  it('geeft niets terug voor de rest', () => {
    expect(portretVan('anneleen@kenjeklanten.be')).toBeNull()
    expect(portretVan(undefined)).toBeNull()
    expect(portretVan('')).toBeNull()
  })
})
