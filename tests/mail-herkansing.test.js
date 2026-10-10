import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MAX_LEEFTIJD_MS, MAX_POGINGEN, herkansing, isAanmeldfout, redenVan } from '../functions-mail/herkansing.js'

/**
 * De wachtrij met post mag niet stilletjes vollopen, maar ook geen week oude
 * melding nog versturen. En een geweigerde aanmelding moet zeggen wat er te
 * doen is, in plaats van zeventig keer dezelfde ruwe fout.
 */
const NU = new Date('2026-10-10T08:00:00Z').getTime()
const geleden = (uur) => new Date(NU - uur * 3600 * 1000)

describe('herkansing', () => {
  it('stuurt een wachtende rij van vandaag alsnog', () => {
    expect(herkansing({ aan: 'a@b.be', status: 'wachtend', createdAt: geleden(2) }, NU)).toBe('versturen')
  })

  it('herkanst een mislukte rij tot de pogingen op zijn', () => {
    expect(herkansing({ aan: 'a@b.be', status: 'mislukt', pogingen: 1, createdAt: geleden(1) }, NU)).toBe('versturen')
    expect(
      herkansing({ aan: 'a@b.be', status: 'mislukt', pogingen: MAX_POGINGEN, createdAt: geleden(1) }, NU)
    ).toBeNull()
  })

  it('laat wat ouder is dan een etmaal verlopen, in plaats van het laat te sturen', () => {
    expect(herkansing({ aan: 'a@b.be', status: 'wachtend', createdAt: new Date(NU - MAX_LEEFTIJD_MS - 1) }, NU)).toBe(
      'verlopen'
    )
    expect(herkansing({ aan: 'a@b.be', status: 'mislukt', createdAt: geleden(240) }, NU)).toBe('verlopen')
  })

  it('behandelt een rij zonder datum als verlopen', () => {
    expect(herkansing({ aan: 'a@b.be', status: 'wachtend' }, NU)).toBe('verlopen')
  })

  it('raakt verstuurde of verlopen rijen niet aan', () => {
    expect(herkansing({ aan: 'a@b.be', status: 'verstuurd', createdAt: geleden(1) }, NU)).toBeNull()
    expect(herkansing({ aan: 'a@b.be', status: 'verlopen', createdAt: geleden(1) }, NU)).toBeNull()
    expect(herkansing({ status: 'wachtend', createdAt: geleden(1) }, NU)).toBeNull()
  })

  it('leest een Firestore-tijdstempel', () => {
    const ts = { toDate: () => geleden(3) }
    expect(herkansing({ aan: 'a@b.be', status: 'wachtend', createdAt: ts }, NU)).toBe('versturen')
  })
})

describe('een geweigerde aanmelding', () => {
  it('wordt herkend aan de code of de tekst van Gmail', () => {
    expect(isAanmeldfout({ code: 'EAUTH' })).toBe(true)
    expect(isAanmeldfout({ responseCode: 534 })).toBe(true)
    expect(isAanmeldfout(new Error('Invalid login: 534-5.7.9 Application-specific password required'))).toBe(true)
    expect(isAanmeldfout(new Error('connect ETIMEDOUT'))).toBe(false)
  })

  it('krijgt een uitleg met wat er te doen is, en nooit een wachtwoord', () => {
    const reden = redenVan({ code: 'EAUTH', message: 'Invalid login' })
    expect(reden).toMatch(/app-wachtwoord/)
    expect(reden).toContain('<app-wachtwoord>')
  })

  it('laat een andere fout kort, zoals ze was', () => {
    expect(redenVan(new Error('x'.repeat(400)))).toHaveLength(300)
  })
})

describe('herkansing.js', () => {
  // CI installeert de functions-afhankelijkheden niet voor deze map; met een
  // import erin slaagt deze test lokaal en faalt hij daar.
  it('heeft nul imports', () => {
    const bron = readFileSync(new URL('../functions-mail/herkansing.js', import.meta.url), 'utf8')
    expect(bron).not.toMatch(/^\s*import\s/m)
  })
})
