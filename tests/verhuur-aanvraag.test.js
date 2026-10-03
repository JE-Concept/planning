import { describe, expect, it } from 'vitest'
import { isEmail, leesAanvraag } from '../functions/verhuur-aanvraag'

/**
 * Wat er uit het offerteformulier binnenkomt.
 *
 * Dit is een openbaar formulier zonder drempel. Wat hier doorheen komt, staat
 * in de database en op het scherm van wie het postvak opent. Twee fouten die
 * allebei duur zijn: een echte aanvraag weigeren, en onzin doorlaten.
 */

const goed = {
  naam: 'Lotte Vrancken',
  email: 'lotte@voorbeeld.be',
  telefoon: '0479 12 34 56',
  datum: '2027-06-12',
  gasten: '60',
  wat: 'Tuinfeest voor zestig man, tent en statafels.',
}

describe('een gewone aanvraag', () => {
  it('komt er netjes uit', () => {
    const uit = leesAanvraag(goed)
    expect(uit.fout).toBeUndefined()
    expect(uit.lokvink).toBe(false)
    expect(uit.velden).toEqual({
      naam: 'Lotte Vrancken',
      email: 'lotte@voorbeeld.be',
      telefoon: '0479 12 34 56',
      datum: '2027-06-12',
      gasten: 60,
      wat: 'Tuinfeest voor zestig man, tent en statafels.',
    })
  })

  /*
    Alleen de velden die we gevraagd hebben. Een formulier dat alles doorlaat
    wat erin gestopt wordt, krijgt vroeg of laat een document van een megabyte
    met een veld dat niemand kent.
  */
  it('neemt geen velden mee die we niet gevraagd hebben', () => {
    const uit = leesAanvraag({ ...goed, isAdmin: true, status: 'afgehandeld', eventId: 'x' })
    expect(uit.velden).not.toHaveProperty('isAdmin')
    expect(uit.velden).not.toHaveProperty('status')
    expect(uit.velden).not.toHaveProperty('eventId')
  })
})

describe('wat geweigerd wordt, en wat niet', () => {
  /*
    Zonder e-mailadres kunnen we niet terug. Dat is de enige harde eis; al de
    rest vragen we straks aan de telefoon.
  */
  it('weigert alleen wat we echt niet kunnen gebruiken', () => {
    expect(leesAanvraag({ ...goed, email: '' }).fout).toBe('geen_email')
    expect(leesAanvraag({ ...goed, email: 'geen adres' }).fout).toBe('geen_email')
    expect(leesAanvraag({ ...goed, wat: 'ok' }).fout).toBe('geen_vraag')
    expect(leesAanvraag({ email: goed.email, wat: goed.wat }).fout).toBeUndefined()
  })

  /*
    Een te lang verhaal is geen aanval maar een enthousiaste klant. Afkappen,
    niet weigeren — een foutmelding kost hier een opdracht.
  */
  it('kapt af in plaats van te weigeren', () => {
    const uit = leesAanvraag({ ...goed, wat: 'x'.repeat(10_000), naam: 'y'.repeat(500) })
    expect(uit.fout).toBeUndefined()
    expect(uit.velden.wat).toHaveLength(4000)
    expect(uit.velden.naam).toHaveLength(120)
  })

  /*
    Leeg blijft leeg. "Geen datum gekozen" is iets anders dan 1 januari 1970,
    en "aantal personen onbekend" is iets anders dan nul.
  */
  it('laat een lege datum en een leeg aantal leeg', () => {
    const uit = leesAanvraag({ ...goed, datum: '', gasten: '' })
    expect(uit.velden.datum).toBe(null)
    expect(uit.velden.gasten).toBe(null)
    expect(leesAanvraag({ ...goed, datum: 'morgen' }).velden.datum).toBe(null)
    expect(leesAanvraag({ ...goed, gasten: '-4' }).velden.gasten).toBe(null)
  })

  it('verdraagt ontbrekende invoer zonder te vallen', () => {
    expect(leesAanvraag(undefined).fout).toBe('geen_email')
    expect(leesAanvraag(null).fout).toBe('geen_email')
    expect(leesAanvraag('tekst').fout).toBe('geen_email')
  })
})

describe('het lokvakje', () => {
  /*
    Een mens ziet het veld niet en vult het dus niet in. Iets dat het wél
    invult, is geen mens. We zeggen dan "dank u" en schrijven niets weg — een
    bot die een fout krijgt, probeert het opnieuw met een andere vorm.
  */
  it('herkent een ingevuld lokvakje zonder de aanvraag te weigeren', () => {
    const uit = leesAanvraag({ ...goed, bedrijfsnaam: 'Acme Corp' })
    expect(uit.fout).toBeUndefined()
    expect(uit.lokvink).toBe(true)
  })

  it('telt spaties niet als ingevuld', () => {
    expect(leesAanvraag({ ...goed, bedrijfsnaam: '   ' }).lokvink).toBe(false)
  })
})

describe('isEmail', () => {
  it('is streng genoeg en niet strenger', () => {
    expect(isEmail('a@b.be')).toBe(true)
    expect(isEmail(' a@b.be ')).toBe(true)
    expect(isEmail('a@b')).toBe(false)
    expect(isEmail('a b@c.be')).toBe(false)
    expect(isEmail('')).toBe(false)
    expect(isEmail(null)).toBe(false)
  })
})
