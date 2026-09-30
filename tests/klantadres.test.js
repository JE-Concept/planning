import { afterEach, describe, expect, it, vi } from 'vitest'
import { klantAdres } from '../src/lib/klantadres'

afterEach(() => vi.unstubAllEnvs())

describe('het adres van een klantenpagina', () => {
  // Deze link gaat in een mail; dan hoort er niet "localhost" in te staan
  // omdat iemand hem vanaf zijn laptop kopieerde.
  it('gebruikt het adres van de tool en niet dat van de adresbalk', () => {
    vi.stubEnv('VITE_APP_URL', 'https://planning.jeconcept.be')
    expect(klantAdres('offerte/abc')).toBe('https://planning.jeconcept.be/offerte/abc')
  })

  it('laat geen dubbele schuine streep staan', () => {
    vi.stubEnv('VITE_APP_URL', 'https://planning.jeconcept.be/')
    expect(klantAdres('klant/xyz')).toBe('https://planning.jeconcept.be/klant/xyz')
  })

  // De demo draait onder een submap en dus op een hashrouter. Een link met een
  // `#` erin werkt lokaal wel en live niet, of andersom — en dat merk je pas
  // wanneer een klant hem al gekregen heeft.
  it('zet er in de demo een hash in', () => {
    vi.stubEnv('MODE', 'demo')
    vi.stubEnv('VITE_APP_URL', 'https://voorbeeld.be')
    expect(klantAdres('offerte/abc')).toBe('https://voorbeeld.be/#/offerte/abc')
  })
})
