import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leesEnvelop, wintermoodsNaarEnvelop } from '../functions-messaging/envelop.js'
import { kaartId, kaartVelden, wordtKaart } from '../functions/messaging-kaart.js'

/**
 * De gedeelde voorbeelden: één bestand per site, identiek in deze repo en in
 * Kenjeklanten/feestbeest (functions/_lib/jeplan-voorbeeld.json en
 * wintermoods/functions/_lib/jeplan-voorbeeld.json).
 *
 * Daar bewijst de test dat de site uit `invoer` precies `verzonden` bouwt.
 * Hier bewijst deze test dat JE Plan uit `verzonden` de kaart maakt die het
 * team verwacht. Samen dekken ze de naad tussen twee repo's die elk apart
 * groen konden zijn terwijl ze elkaar niet meer verstonden. Verandert een
 * voorbeeld, dan aan beide kanten tegelijk.
 */

const voorbeeld = (naam) => JSON.parse(readFileSync(new URL(`./voorbeelden/${naam}.json`, import.meta.url), 'utf8'))

describe('het voorbeeld van Feestbeest', () => {
  const v = voorbeeld('feestbeest')
  const { envelop, fout } = leesEnvelop(v.verzonden, { bron: v.bron })

  it('is een geldige envelop, met een kenmerk uit de inhoud omdat de site er geen stuurt', () => {
    expect(fout).toBeUndefined()
    expect(envelop).toMatchObject({ bron: 'feestbeest', soort: 'reservatie.aangevraagd', taal: 'fr' })
    expect(envelop.sleutel).toMatch(/^h[0-9a-z]+$/)
    // Dezelfde inzending twee keer geeft hetzelfde kenmerk, en dus één kaart.
    expect(leesEnvelop(structuredClone(v.verzonden), { bron: v.bron }).envelop.sleutel).toBe(envelop.sleutel)
  })

  it('wordt een kinderfeest in request, met alles wat de ouder invulde', () => {
    expect(wordtKaart(envelop)).toBe(true)
    expect(kaartId(envelop)).toBe(`msg-feestbeest-${envelop.sleutel}`)
    const kaart = kaartVelden(envelop)
    expect(kaart).toMatchObject({ title: 'Feestbeest — Lou Peeters (12p)', eventType: 'Kinderfeest', pax: 12, customerName: 'Lou Peeters' })
    expect(kaart.eventDate.toISOString().slice(0, 10)).toBe('2026-11-21')
    for (const regel of ['lou@example.be', '0470 00 00 00', 'Gelegenheid: Pyjamaparty', 'Thema: Licornes', 'Bericht: Pour ses 8 ans', '(FR)']) {
      expect(kaart.description).toContain(regel)
    }
  })

  it('een cadeaubon van dezelfde site komt in de log maar niet op het bord', () => {
    const bon = leesEnvelop({ soort: 'cadeaubon.besteld', taal: 'nl', inhoud: { naam: 'Mia', email: 'mia@example.be', bericht: '€ 50' } }, { bron: 'feestbeest' })
    expect(wordtKaart(bon.envelop)).toBe(false)
  })
})

describe('het voorbeeld van Wintermoods', () => {
  const v = voorbeeld('wintermoods')
  const { envelop, fout } = wintermoodsNaarEnvelop(v.verzonden)

  it('komt via het oude adres binnen als envelop, met het aanvraag-id van de site als kenmerk', () => {
    expect(v.adres).toBe('/api/wintermoods')
    expect(fout).toBeUndefined()
    expect(envelop).toMatchObject({ bron: 'wintermoods', soort: 'reservatie.aangevraagd', sleutel: 'wm-voorbeeld-1', taal: 'fr' })
    expect(kaartId(envelop)).toBe('wm-wm-voorbeeld-1')
  })

  it('wordt een Wintermoods-event op Het Vinne, met formule, moment en dieet', () => {
    const kaart = kaartVelden(envelop)
    expect(kaart).toMatchObject({ title: 'Wintermoods — An Peeters (24p)', eventType: 'Wintermoods', pax: 24, location: 'Het Vinne, Zoutleeuw', formule: 'Winter BBQ' })
    for (const regel of ['Moment: Avond', 'Formule: Winter BBQ', 'Gelegenheid: Bedrijfsfeest', 'Dieet of allergieën: 2 vegetarisch', 'Bericht: Teamfeest.']) {
      expect(kaart.description).toContain(regel)
    }
  })
})
