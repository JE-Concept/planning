import { describe, expect, it, vi } from 'vitest'
import { maakSyncboek, offlineBericht, telWachtend, uitCache } from '../src/lib/offline'

/** Een momentopname zoals Firestore ze geeft, zo klein als nuttig. */
const lijst = (...wachtend) => ({
  docs: wachtend.map((p) => ({ metadata: { hasPendingWrites: p } })),
  metadata: { hasPendingWrites: wachtend.some(Boolean), fromCache: false },
})

describe('telWachtend', () => {
  it('telt de documenten die nog niet bij de server zijn', () => {
    expect(telWachtend(lijst(false, true, true, false))).toBe(2)
    expect(telWachtend(lijst(false, false))).toBe(0)
  })

  it('telt één document als één', () => {
    expect(telWachtend({ metadata: { hasPendingWrites: true } })).toBe(1)
    expect(telWachtend({ metadata: { hasPendingWrites: false } })).toBe(0)
  })

  // De mededeling mag nooit de app omvergooien: een momentopname zonder
  // metadata (een stub, een oudere SDK) telt gewoon als niets open.
  it('overleeft een momentopname zonder metadata', () => {
    expect(telWachtend({ docs: [{}, {}] })).toBe(0)
    expect(telWachtend({})).toBe(0)
    expect(telWachtend(null)).toBe(0)
  })
})

describe('uitCache', () => {
  it('leest het van de momentopname', () => {
    expect(uitCache({ metadata: { fromCache: true } })).toBe(true)
    expect(uitCache({ metadata: { fromCache: false } })).toBe(false)
    expect(uitCache(undefined)).toBe(false)
  })
})

describe('maakSyncboek', () => {
  it('telt de bronnen bij elkaar op', () => {
    const boek = maakSyncboek()
    boek.meld('checklistRuns:2026-09-29', { wachtend: 2, uitCache: true })
    boek.meld('tasks:l-overview', { wachtend: 1, uitCache: false })
    expect(boek.stand()).toEqual({ wachtend: 3, uitCache: true, bronnen: 2 })
  })

  it('vervangt de regel van een bron in plaats van ze op te tellen', () => {
    const boek = maakSyncboek()
    boek.meld('a', { wachtend: 3 })
    boek.meld('a', { wachtend: 1 })
    expect(boek.stand().wachtend).toBe(1)
  })

  it('haalt een gestopt abonnement uit de stand', () => {
    const boek = maakSyncboek()
    boek.meld('a', { wachtend: 2 })
    boek.vergeet('a')
    expect(boek.stand()).toEqual({ wachtend: 0, uitCache: false, bronnen: 0 })
  })

  /**
   * Elk abonnement meldt bij élke momentopname, en dat zijn er op een druk bord
   * tientallen per minuut. Zou elke melding de kijkers wakker maken, dan
   * hertekent de hele schil mee terwijl er niets veranderd is.
   */
  it('maakt de kijkers niet wakker als er niets verandert', () => {
    const boek = maakSyncboek()
    const kijker = vi.fn()
    boek.abonneer(kijker)

    boek.meld('a', { wachtend: 1, uitCache: false })
    boek.meld('a', { wachtend: 1, uitCache: false })
    boek.meld('a', { wachtend: 1, uitCache: false })
    expect(kijker).toHaveBeenCalledTimes(1)

    boek.meld('a', { wachtend: 0, uitCache: false })
    expect(kijker).toHaveBeenCalledTimes(2)
  })

  it('zwijgt bij het vergeten van een bron die er niet was', () => {
    const boek = maakSyncboek()
    const kijker = vi.fn()
    boek.abonneer(kijker)
    boek.vergeet('bestaat-niet')
    expect(kijker).not.toHaveBeenCalled()
  })

  it('stopt met vertellen na afmelden', () => {
    const boek = maakSyncboek()
    const kijker = vi.fn()
    boek.abonneer(kijker)()
    boek.meld('a', { wachtend: 1 })
    expect(kijker).not.toHaveBeenCalled()
  })
})

describe('offlineBericht', () => {
  it('zwijgt als er verbinding is en niets openstaat', () => {
    expect(offlineBericht({ online: true, wachtend: 0 })).toBeNull()
    expect(offlineBericht()).toBeNull()
  })

  it('zegt zonder verbinding dat doorwerken mag', () => {
    const bericht = offlineBericht({ online: false, wachtend: 0 })
    expect(bericht.toon).toBe('offline')
    expect(bericht.tekst).toMatch(/geen verbinding/i)
    expect(bericht.detail).toMatch(/bereik/i)
  })

  it('noemt zonder verbinding hoeveel er nog op het toestel staat', () => {
    expect(offlineBericht({ online: false, wachtend: 1 }).detail).toContain('1 wijziging staat')
    expect(offlineBericht({ online: false, wachtend: 4 }).detail).toContain('4 wijzigingen staan')
  })

  it('blijft het zeggen zolang er na het terugkeren nog werk openstaat', () => {
    const bericht = offlineBericht({ online: true, wachtend: 2 })
    expect(bericht.toon).toBe('wachtend')
    expect(bericht.tekst).toBe('2 wijzigingen nog op dit toestel.')
  })

  // Alleen "uit de cache" is geen nieuws: bij het opstarten komt élk antwoord
  // van schijf. Daar een balk voor tonen leert mensen de balk negeren.
  it('zegt niets over een antwoord dat enkel uit de cache komt', () => {
    expect(offlineBericht({ online: true, wachtend: 0, uitCache: true })).toBeNull()
  })
})
