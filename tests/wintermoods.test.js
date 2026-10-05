import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GELEGENHEDEN, kaartId, leesAanvraag, omschrijving, titelVan } from '../functions-wintermoods/aanvraag.js'

/*
  De ontvanger van Wintermoods-aanvragen. Alleen het deel zonder imports:
  `wintermoods.js` zelf hangt aan de functies-SDK, en CI installeert enkel de
  wortel — dezelfde reden waarom `order.js` in functions-betaling los staat.
*/
describe('een Wintermoods-aanvraag', () => {
  const body = {
    bron: 'wintermoods', aanvraagId: '0f1c-test', taal: 'fr',
    naam: 'Jasper Eyckmans', email: 'jasper@example.be', telefoon: '012 28 01 00',
    datum: '2026-12-19', moment: 'avond', personen: '24', formule: 'bbq',
    formuleLabel: 'Winter BBQ (€ 44,50)', gelegenheid: 'bedrijf', dieet: '2 vegetarisch', bericht: 'Teamfeest.',
  }

  it('wordt nagekeken en genormaliseerd', () => {
    const { velden, fout } = leesAanvraag(body)
    expect(fout).toBeUndefined()
    expect(velden.personen).toBe(24)
    expect(velden.datum).toBe('2026-12-19')
    expect(velden.taal).toBe('fr')
    expect(velden.aanvraagId).toBe('0f1c-test')
  })

  it('weigert zonder e-mailadres: daar hangt de klant aan', () => {
    expect(leesAanvraag({ ...body, email: 'geen adres' })).toEqual({ fout: 'geen_email' })
  })

  it('laat een lege datum leeg — "geen datum gekozen" is niet vandaag', () => {
    expect(leesAanvraag({ ...body, datum: null }).velden.datum).toBeNull()
    expect(leesAanvraag({ ...body, datum: '19/12/2026' }).velden.datum).toBeNull()
  })

  it('houdt het aantal personen binnen de perken', () => {
    expect(leesAanvraag({ ...body, personen: 0 }).velden.personen).toBeNull()
    expect(leesAanvraag({ ...body, personen: 'veel' }).velden.personen).toBeNull()
    expect(leesAanvraag({ ...body, personen: 5000 }).velden.personen).toBe(1000)
  })

  it('valt terug op Nederlands bij een taal die de site niet kent', () => {
    expect(leesAanvraag({ ...body, taal: 'de' }).velden.taal).toBe('nl')
  })

  it('krijgt één kaart per inzending, ook als ze twee keer aankomt', () => {
    const { velden } = leesAanvraag(body)
    expect(kaartId(velden)).toBe('wm-0f1c-test')
    expect(kaartId({ ...velden, aanvraagId: null })).toBeNull()
  })

  it('heet naar de klant en het aantal', () => {
    const { velden } = leesAanvraag(body)
    expect(titelVan(velden)).toBe('Wintermoods — Jasper Eyckmans (24p)')
    expect(titelVan({ ...velden, naam: '', personen: null })).toBe('Wintermoods — jasper@example.be')
  })

  it('zet alles wat de klant invulde in de omschrijving, en laat lege regels weg', () => {
    const tekst = omschrijving(leesAanvraag(body).velden)
    expect(tekst).toContain('(FR)')
    expect(tekst).toContain('Formule: Winter BBQ')
    expect(tekst).toContain('Gelegenheid: Bedrijfsfeest')
    expect(tekst).toContain('Dieet of allergieën: 2 vegetarisch')
    const kaal = omschrijving(leesAanvraag({ ...body, taal: 'nl', dieet: '', bericht: '', formule: null, formuleLabel: null }).velden)
    expect(kaal).not.toContain('Dieet')
    expect(kaal).not.toContain('(NL)')
    expect(kaal).toContain('Formule: Nog niet beslist')
  })

  it('kent "op locatie": het enige antwoord dat de keuken iets anders laat doen', () => {
    expect(GELEGENHEDEN.locatie).toBeTruthy()
  })
})

describe('de eventlijst-herkenning', () => {
  it('is in functions-wintermoods letterlijk dezelfde als in functions', () => {
    // Twee codebases kunnen niets uit elkaar importeren; dus een kopie, en
    // deze test die meldt wanneer de twee uit elkaar lopen.
    const origineel = readFileSync(new URL('../functions/events-bron.js', import.meta.url), 'utf8')
    const kopie = readFileSync(new URL('../functions-wintermoods/events-bron.js', import.meta.url), 'utf8')
    expect(kopie).toBe(origineel)
  })
})
