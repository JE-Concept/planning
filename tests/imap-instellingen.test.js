import { describe, expect, it } from 'vitest'
import { imapInstellingen } from '../functions-mail/imap-instellingen'

/*
  Op 7 oktober kreeg ImapFlow het geheim als `url` mee, een optie die het niet
  kent. Het verbond dan met localhost:143 en de post van info@ bleef weg. Deze
  test legt vast dat het geheim, zoals de handover het zet, omgezet wordt naar
  wat ImapFlow wel leest.
*/
describe('imapInstellingen', () => {
  it('zet het geheim uit de handover om naar host, poort, secure en login', () => {
    expect(imapInstellingen('imaps://plan%40jeconcept.be:abcd%20efgh%20ijkl%20mnop@imap.gmail.com:993')).toEqual({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: 'plan@jeconcept.be', pass: 'abcdefghijklmnop' },
    })
  })

  it('kiest de standaardpoort als die ontbreekt', () => {
    expect(imapInstellingen('imaps://a%40b.be:x@imap.gmail.com').port).toBe(993)
    const gewoon = imapInstellingen('imap://a%40b.be:x@mail.voorbeeld.be')
    expect(gewoon.port).toBe(143)
    expect(gewoon.secure).toBe(false)
  })

  it('verbindt nooit stil met localhost: een onvolledig of verkeerd geheim is een fout', () => {
    expect(() => imapInstellingen('')).toThrow(/geen geldig adres/)
    expect(() => imapInstellingen('https://imap.gmail.com')).toThrow(/imaps:\/\//)
    expect(() => imapInstellingen('imaps://imap.gmail.com:993')).toThrow(/mist/)
  })

  it('zet het wachtwoord nergens in de foutmelding', () => {
    try {
      imapInstellingen('smtps://plan%40jeconcept.be:geheim123@smtp.gmail.com:465')
    } catch (err) {
      expect(err.message).not.toContain('geheim123')
    }
  })
})
