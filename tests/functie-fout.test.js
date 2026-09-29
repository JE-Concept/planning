import { describe, expect, it } from 'vitest'
import { leesFunctieFout } from '../src/lib/functie-fout'

describe('leesFunctieFout', () => {
  // Dit was de melding die Jasper zag: "internal", zonder enige aanwijzing.
  it('legt uit dat een niet-uitgerolde functie op de sleutel wacht', () => {
    const tekst = leesFunctieFout({ code: 'functions/internal' }, 'Het samenvatten')
    expect(tekst).toContain('Het samenvatten')
    expect(tekst).toContain('ANTHROPIC_API_KEY')
  })

  it('zegt hetzelfde bij een functie die helemaal niet bestaat', () => {
    expect(leesFunctieFout({ code: 'functions/not-found' })).toContain('ANTHROPIC_API_KEY')
  })

  it('stuurt iemand die afgemeld is naar het herladen', () => {
    expect(leesFunctieFout({ code: 'functions/unauthenticated' })).toContain('Herlaad')
  })

  it('geeft de melding van de server door wanneer die er is', () => {
    expect(leesFunctieFout({ code: 'functions/permission-denied', message: 'Enkel voor het team.' })).toBe(
      'Enkel voor het team.'
    )
  })

  it('zegt bij een te lang transcript wat je eraan kunt doen', () => {
    expect(leesFunctieFout({ code: 'functions/deadline-exceeded' })).toContain('korter transcript')
  })

  it('valt terug op de oorspronkelijke melding', () => {
    expect(leesFunctieFout({ message: 'Iets anders' })).toBe('Iets anders')
    expect(leesFunctieFout(null)).toBe('Er ging iets mis.')
  })
})
