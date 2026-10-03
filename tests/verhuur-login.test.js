import { describe, expect, it } from 'vitest'
import {
  LINK_MINUTEN,
  bearerVan,
  beoordeelLink,
  hashVan,
  leesEmail,
  loginMail,
  nieuwToken,
  sessieGeldig,
} from '../functions/verhuur-login'

/**
 * De inloglink van de verhuursite.
 *
 * Het stuk dat zonder database te zeggen is: wat een geldige link is, wat een
 * geldige sessie is, en wat er in de database staat (de hash, niet het token).
 */

const nu = new Date('2027-03-01T12:00:00Z')
const over = (min) => new Date(nu.getTime() + min * 60 * 1000)

describe('tokens', () => {
  it('zijn lang, willekeurig en URL-veilig', () => {
    const a = nieuwToken()
    const b = nieuwToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(40)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  /*
    Wie de database leest, mag er niet mee kunnen inloggen. Dus staat er een
    hash, en die is niet terug te rekenen — maar wel steeds dezelfde voor
    hetzelfde token, anders vindt de server de sessie niet terug.
  */
  it('staan als hash in de database, niet als zichzelf', () => {
    const t = nieuwToken()
    expect(hashVan(t)).not.toBe(t)
    expect(hashVan(t)).toBe(hashVan(t))
    expect(hashVan(t)).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('het adres uit het formulier', () => {
  it('wordt klein en zonder spaties', () => {
    expect(leesEmail({ email: '  Lies@Voorbeeld.BE ' })).toBe('lies@voorbeeld.be')
  })
  it('is niets wanneer het geen adres is', () => {
    expect(leesEmail({ email: 'lies' })).toBe(null)
    expect(leesEmail({})).toBe(null)
    expect(leesEmail(null)).toBe(null)
  })
})

describe('een link beoordelen', () => {
  const vers = { linkVervalt: over(LINK_MINUTEN), gebruiktOp: null }

  it('laat een verse link door', () => {
    expect(beoordeelLink(vers, nu)).toEqual({ ok: true })
  })

  /*
    Eén keer. Een mail die rondgaat of in een log blijft hangen, mag geen deur
    blijven — en "al gebruikt" is een ander antwoord dan "verlopen": bij het
    eerste weet de klant dat hij een nieuwe moet vragen.
  */
  it('weigert een link die al gebruikt is, met dat als reden', () => {
    expect(beoordeelLink({ ...vers, gebruiktOp: over(-1) }, nu)).toEqual({ ok: false, reden: 'al_gebruikt' })
  })

  it('weigert een verlopen link', () => {
    expect(beoordeelLink({ ...vers, linkVervalt: over(-1) }, nu)).toEqual({ ok: false, reden: 'verlopen' })
    expect(beoordeelLink({ ...vers, linkVervalt: nu }, nu).ok).toBe(false)
  })

  it('weigert wat er niet is of kapot is', () => {
    expect(beoordeelLink(null, nu)).toEqual({ ok: false, reden: 'onbekend' })
    expect(beoordeelLink({ linkVervalt: 'ooit' }, nu).reden).toBe('verlopen')
  })
})

describe('een sessie', () => {
  it('geldt alleen na gebruik van de link en vóór de vervaldag', () => {
    expect(sessieGeldig({ gebruiktOp: over(-10), sessieVervalt: over(60) }, nu)).toBe(true)
    expect(sessieGeldig({ gebruiktOp: null, sessieVervalt: over(60) }, nu)).toBe(false)
    expect(sessieGeldig({ gebruiktOp: over(-10), sessieVervalt: over(-1) }, nu)).toBe(false)
    expect(sessieGeldig(null, nu)).toBe(false)
  })
})

describe('de Authorization-kop', () => {
  it('leest een Bearer-token en niets anders', () => {
    const t = nieuwToken()
    expect(bearerVan(`Bearer ${t}`)).toBe(t)
    expect(bearerVan(`bearer ${t}`)).toBe(null)
    expect(bearerVan('Bearer kort')).toBe(null)
    expect(bearerVan('')).toBe(null)
    expect(bearerVan(undefined)).toBe(null)
  })
})

describe('de mail', () => {
  it('zet de link op een eigen regel en zegt hoe lang ze werkt', () => {
    const { onderwerp, tekst } = loginMail({ link: 'https://rental.jeconcept.be/login/abc' })
    expect(onderwerp).toContain('inloglink')
    expect(tekst.split('\n')).toContain('https://rental.jeconcept.be/login/abc')
    expect(tekst).toContain(`${LINK_MINUTEN} minuten`)
    expect(tekst).toContain('negeren')
  })
})
