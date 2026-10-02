import { describe, expect, it } from 'vitest'
import { absoluut, isPrivaatIp, leesVoorbeeld, mag, ontsnapTerug } from '../functions/og.js'

/*
  De lezer staat los van firebase-admin zodat deze test kan draaien zonder dat
  `functions/node_modules` bestaat — in CI is dat zo. Zie `herhaling-datum.js`
  voor hetzelfde patroon.
*/

const pagina = (kop) => `<!doctype html><html><head>${kop}</head><body><p>niet lezen</p></body></html>`

describe('wat er van een pagina op het kaartje komt', () => {
  it('leest Open Graph', () => {
    const uit = leesVoorbeeld(pagina(`
      <meta property="og:title" content="Hoeve Vanhove">
      <meta property="og:description" content="Feestzaal in Borgloon">
      <meta property="og:image" content="https://hoeve.be/og.jpg">
      <meta property="og:site_name" content="Hoeve Vanhove">
    `))
    expect(uit).toEqual({
      titel: 'Hoeve Vanhove',
      omschrijving: 'Feestzaal in Borgloon',
      afbeelding: 'https://hoeve.be/og.jpg',
      site: 'Hoeve Vanhove',
    })
  })

  // Attributen staan in willekeurige volgorde; wie op `property="og:title"
  // content=` matcht, mist de helft van het web.
  it('verdraagt attributen in omgekeerde volgorde', () => {
    const uit = leesVoorbeeld(pagina('<meta content="Andersom" property="og:title">'))
    expect(uit.titel).toBe('Andersom')
  })

  it('valt terug op title en description', () => {
    const uit = leesVoorbeeld(pagina('<title>Gewone titel</title><meta name="description" content="Gewone uitleg">'))
    expect(uit.titel).toBe('Gewone titel')
    expect(uit.omschrijving).toBe('Gewone uitleg')
  })

  it('maar Open Graph wint van title', () => {
    const uit = leesVoorbeeld(pagina('<title>Hele site</title><meta property="og:title" content="Deze pagina">'))
    expect(uit.titel).toBe('Deze pagina')
  })

  it('leest ook de Twitter-velden', () => {
    const uit = leesVoorbeeld(pagina('<meta name="twitter:title" content="Via Twitter">'))
    expect(uit.titel).toBe('Via Twitter')
  })

  it('geeft niets terug bij een pagina zonder kop', () => {
    expect(leesVoorbeeld('<html><body>niets</body></html>')).toEqual({
      titel: null, omschrijving: null, afbeelding: null, site: null,
    })
    expect(leesVoorbeeld('')).toEqual({ titel: null, omschrijving: null, afbeelding: null, site: null })
  })

  // De body kan een megabyte zijn, en er staat geen metadata in.
  it('kijkt niet in de body', () => {
    const html = '<html><head><title>Echt</title></head><body><meta property="og:title" content="Nep"></body></html>'
    expect(leesVoorbeeld(html).titel).toBe('Echt')
  })

  it('vouwt witruimte op en kapt een roman af', () => {
    const uit = leesVoorbeeld(pagina(`<title>  twee\n   regels  </title><meta name="description" content="${'x'.repeat(500)}">`))
    expect(uit.titel).toBe('twee regels')
    expect(uit.omschrijving.length).toBe(300)
  })

  it('zet entiteiten terug om', () => {
    expect(ontsnapTerug('Ken &amp; je klanten &#39;26')).toBe("Ken & je klanten '26")
    expect(leesVoorbeeld(pagina('<title>Caf&eacute;s &amp; bars</title>')).titel).toBe('Cafés & bars')
    // Wat niet in de lijst staat, blijft staan: lelijk is beter dan weg.
    expect(ontsnapTerug('&zwnj;iets')).toBe('&zwnj;iets')
  })
})

describe('een relatief plaatje', () => {
  it('wordt een adres waar een browser bij kan', () => {
    expect(absoluut('https://hoeve.be/zalen/grote', '/og.jpg')).toBe('https://hoeve.be/og.jpg')
    expect(absoluut('https://hoeve.be/zalen/grote', 'foto.jpg')).toBe('https://hoeve.be/zalen/foto.jpg')
  })

  it('laat een volledig adres met rust', () => {
    expect(absoluut('https://hoeve.be/', 'https://cdn.be/x.jpg')).toBe('https://cdn.be/x.jpg')
  })

  it('verdraagt onzin en niets', () => {
    expect(absoluut('https://hoeve.be/', null)).toBe(null)
    expect(absoluut('geen adres', '/x.jpg')).toBe(null)
  })
})

/*
  Dit is het stuk dat echt moet kloppen.

  De functie haalt een adres op dat iemand zelf getypt heeft, en ze draait
  binnen Google Cloud. Daar geeft `http://169.254.169.254/` de inloggegevens
  van de machine terug. Een fout hier is geen lelijk kaartje maar een lek.
*/
describe('welke adressen de server mag ophalen', () => {
  it('laat een gewone link door', () => {
    expect(mag('https://jeconcept.be/offerte')).toEqual({ ok: true, url: 'https://jeconcept.be/offerte' })
    expect(mag('http://example.com').ok).toBe(true)
  })

  it('houdt de metadata-server van de cloud tegen', () => {
    expect(mag('http://169.254.169.254/computeMetadata/v1/').ok).toBe(false)
    expect(mag('http://metadata.google.internal/').ok).toBe(false)
  })

  it('houdt deze machine en het interne netwerk tegen', () => {
    for (const adres of [
      'http://localhost:8080/',
      'http://127.0.0.1/',
      'http://127.1.2.3/',
      'http://10.0.0.5:8080/',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://[::1]/',
      'http://0.0.0.0/',
      'http://printer.local/',
    ]) {
      expect(mag(adres), adres).toMatchObject({ ok: false })
    }
  })

  it('laat een adres net buiten de privébereiken wél door', () => {
    for (const adres of ['http://172.15.0.1/', 'http://172.32.0.1/', 'http://11.0.0.1/', 'http://192.167.1.1/']) {
      expect(mag(adres), adres).toMatchObject({ ok: true })
    }
  })

  it('houdt andere protocollen tegen', () => {
    for (const adres of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://host/x', 'gopher://host/']) {
      expect(mag(adres), adres).toMatchObject({ ok: false })
    }
  })

  // `http://gebruiker:wachtwoord@host/` is de klassieke manier om een adres
  // er anders uit te laten zien dan het is.
  it('houdt inloggegevens in het adres tegen', () => {
    expect(mag('http://admin:geheim@jeconcept.be/').ok).toBe(false)
  })

  it('houdt onzin en te lange adressen tegen', () => {
    expect(mag('geen adres').ok).toBe(false)
    expect(mag('').ok).toBe(false)
    expect(mag(null).ok).toBe(false)
    expect(mag(`https://jeconcept.be/${'x'.repeat(2100)}`).ok).toBe(false)
  })

  // Twee ankers op dezelfde pagina zijn één pagina; anders staat ze twee keer
  // in de cache en wordt ze twee keer opgehaald.
  it('haalt het fragment eraf', () => {
    expect(mag('https://jeconcept.be/offerte#prijs').url).toBe('https://jeconcept.be/offerte')
  })
})

describe('welke IP-adressen privé zijn', () => {
  it('kent de bereiken uit het hoofd', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.0.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1']) {
      expect(isPrivaatIp(ip), ip).toBe(true)
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.1.1', '100.63.0.1', '2a00:1450::1']) {
      expect(isPrivaatIp(ip), ip).toBe(false)
    }
  })

  // `::ffff:127.0.0.1` is 127.0.0.1 met een hoedje op.
  it('ziet een ingepakt IPv4-adres', () => {
    expect(isPrivaatIp('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivaatIp('::ffff:8.8.8.8')).toBe(false)
  })

  it('noemt een naam geen privé-adres', () => {
    expect(isPrivaatIp('jeconcept.be')).toBe(false)
  })
})
