import { describe, expect, it } from 'vitest'
import { imapFoutVoorLog, imapInstellingen, postbusVan } from '../functions-mail/imap-instellingen'

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

describe('welke map de ophaler leest', () => {
  it('zonder pad INBOX, met pad die map (een Gmail-label)', () => {
    expect(postbusVan('imaps://a%40b.be:x@imap.gmail.com:993')).toBe('INBOX')
    expect(postbusVan('imaps://a%40b.be:x@imap.gmail.com:993/')).toBe('INBOX')
    expect(postbusVan('imaps://a%40b.be:x@imap.gmail.com:993/JE%20Plan')).toBe('JE Plan')
  })
})

/*
  Live stond er enkel "Command failed". Wat de server antwoordde, hoort in de
  log; de opdracht zelf niet, want bij LOGIN staat het wachtwoord erin.
*/
describe('een IMAP-fout in de log', () => {
  it('neemt het antwoord van de server mee en laat de opdracht weg', () => {
    const err = Object.assign(new Error('Command failed'), {
      responseText: 'Invalid credentials (Failure)',
      serverResponseCode: 'AUTHENTICATIONFAILED',
      authenticationFailed: true,
      responseStatus: 'NO',
      executedCommand: '1 LOGIN plan@jeconcept.be geheim123',
    })
    const log = imapFoutVoorLog(err)
    expect(log).toEqual({
      melding: 'Command failed',
      antwoord: 'Invalid credentials (Failure)',
      code: 'AUTHENTICATIONFAILED',
      loginMislukt: true,
      status: 'NO',
    })
    expect(JSON.stringify(log)).not.toContain('geheim123')
  })
})
