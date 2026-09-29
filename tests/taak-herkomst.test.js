import { afterEach, describe, expect, it } from 'vitest'
import { zetHuidigeTaal } from '../src/lib/i18n'
import { herkomstVanTaak } from '../src/lib/taak-herkomst'

describe('herkomstVanTaak', () => {
  afterEach(() => zetHuidigeTaal('nl'))

  it('noemt een taak die hier gemaakt is gewoon aangemaakt', () => {
    const herkomst = herkomstVanTaak({ createdAt: new Date(2026, 8, 3) })
    expect(herkomst.soort).toBe('aangemaakt')
    expect(herkomst.tekst).toBe('Aangemaakt 03/09/2026')
  })

  it('zegt bij een overgenomen taak waar de datum vandaan komt', () => {
    // Alle taken uit de migratie dragen de dag van de verhuizing; "aangemaakt"
    // zou daar een onwaarheid van maken.
    const herkomst = herkomstVanTaak({ createdAt: new Date(2026, 8, 28), clickupId: '86b1x' })
    expect(herkomst.soort).toBe('clickup')
    expect(herkomst.tekst).toBe('Overgenomen uit ClickUp op 28/09/2026')
    expect(herkomst.uitleg).toMatch(/verhuizing/)
  })

  it('laat het weg als er geen datum is, in plaats van iets te verzinnen', () => {
    expect(herkomstVanTaak({})).toBe(null)
    expect(herkomstVanTaak(null)).toBe(null)
    expect(herkomstVanTaak({ createdAt: 'geen datum' })).toBe(null)
  })

  it('leest een Firestore-Timestamp die nog niet omgezet is', () => {
    const stempel = { toDate: () => new Date(2026, 0, 15) }
    expect(herkomstVanTaak({ createdAt: stempel }).tekst).toBe('Aangemaakt 15/01/2026')
  })

  // ClickUp blijft ClickUp; de zin eromheen niet.
  it('zegt het in het Engels wanneer iemand zo werkt', () => {
    zetHuidigeTaal('en')
    expect(herkomstVanTaak({ createdAt: new Date(2026, 8, 3) }).tekst).toBe('Created 03/09/2026')

    const overgenomen = herkomstVanTaak({ createdAt: new Date(2026, 8, 28), clickupId: '86b1x' })
    expect(overgenomen.tekst).toBe('Brought over from ClickUp on 28/09/2026')
    expect(overgenomen.uitleg).toBe('The date of the move, not of the task itself.')
  })
})
