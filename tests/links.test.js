import { describe, expect, it } from 'vitest'
import { hostNetjes, linksIn, stukkenMetLinks } from '../src/lib/links'

describe('links uit een notitie halen', () => {
  it('vindt een gewone link', () => {
    expect(linksIn('kijk eens op https://jeconcept.be/offerte')).toEqual(['https://jeconcept.be/offerte'])
  })

  it('vindt er meerdere, in volgorde en zonder dubbels', () => {
    expect(linksIn('https://a.be en https://b.be en nog eens https://a.be'))
      .toEqual(['https://a.be', 'https://b.be'])
  })

  /*
    Het einde van een link is niet in een patroon te vangen: een punt kan bij
    het adres horen of bij de zin. Daarom wordt de staart teruggeknipt.
  */
  it('laat de punt van de zin erbuiten', () => {
    expect(linksIn('zie https://jeconcept.be.')).toEqual(['https://jeconcept.be'])
    expect(linksIn('zie https://jeconcept.be, en dan?')).toEqual(['https://jeconcept.be'])
  })

  it('maar houdt een punt die bij het adres hoort', () => {
    expect(linksIn('https://jeconcept.be/offerte.pdf')).toEqual(['https://jeconcept.be/offerte.pdf'])
  })

  it('knipt een sluithaakje dat bij de zin hoort', () => {
    expect(linksIn('(zie https://jeconcept.be)')).toEqual(['https://jeconcept.be'])
  })

  it('maar houdt er een die bij het adres hoort', () => {
    expect(linksIn('https://nl.wikipedia.org/wiki/Kat_(dier)')).toEqual(['https://nl.wikipedia.org/wiki/Kat_(dier)'])
  })

  // Een notitie is tekst die iemand anders aanklikt; dit zijn de twee die je
  // dan niet wil, en een e-mailadres is geen knop.
  it('pakt alleen http en https', () => {
    expect(linksIn('javascript:alert(1)')).toEqual([])
    expect(linksIn('data:text/html,<b>x</b>')).toEqual([])
    expect(linksIn('mail naar info@jeconcept.be')).toEqual([])
    expect(linksIn('ftp://oud.example.be/map')).toEqual([])
  })

  it('verdraagt een lege tekst', () => {
    expect(linksIn('')).toEqual([])
    expect(linksIn(null)).toEqual([])
  })
})

describe('de tekst opknippen langs de links', () => {
  it('geeft tekst en link uit elkaar', () => {
    expect(stukkenMetLinks('zie https://jeconcept.be nu')).toEqual([
      { soort: 'tekst', tekst: 'zie ' },
      { soort: 'link', tekst: 'https://jeconcept.be', href: 'https://jeconcept.be' },
      { soort: 'tekst', tekst: ' nu' },
    ])
  })

  // De som van de stukken is de tekst: anders verdwijnt er een letter uit een
  // notitie, en dat merkt niemand tot het over een bedrag gaat.
  it('laat geen letter vallen', () => {
    for (const bron of ['', 'geen link', 'zie https://a.be.', '(https://a.be) en https://b.be/x?y=1']) {
      expect(stukkenMetLinks(bron).map((s) => s.tekst).join('')).toBe(bron)
    }
  })
})

describe('het adres op een kaartje', () => {
  it('toont de host zonder www', () => {
    expect(hostNetjes('https://www.jeconcept.be/offerte')).toBe('jeconcept.be')
    expect(hostNetjes('https://nl.wikipedia.org/wiki/Kat')).toBe('nl.wikipedia.org')
  })

  it('verdraagt onzin', () => {
    expect(hostNetjes('niet eens een adres')).toBe('')
  })
})
