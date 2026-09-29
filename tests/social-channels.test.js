import { describe, expect, it } from 'vitest'
import {
  CHANNELS,
  GEEN_KANAAL,
  channelMeta,
  hoofdKanaal,
  kanaalRijen,
  kanalenVan,
} from '../src/lib/social-channels.js'

/**
 * Een post kan op meerdere kanalen tegelijk, en elk kanaal toont beeld in een
 * andere verhouding. Wat hier misgaat, gaat mis in de preview: een beeld dat
 * bijgesneden online komt merk je pas als het er staat.
 */

describe('de kanalen zelf', () => {
  it('heeft voor elk kanaal een verhouding, een kleur en een korte naam', () => {
    for (const kanaal of CHANNELS) {
      expect(kanaal.ratio, kanaal.key).toMatch(/^[\d.]+ \/ [\d.]+$/)
      expect(kanaal.color, kanaal.key).toMatch(/^#[0-9a-f]{6}$/)
      expect(kanaal.short.length, kanaal.key).toBeLessThanOrEqual(2)
    }
  })

  it('geeft Instagram staand beeld en Facebook liggend', () => {
    expect(channelMeta('instagram').ratio).toBe('4 / 5')
    expect(channelMeta('facebook').ratio).toBe('1.91 / 1')
  })

  it('maakt van een onbekende sleutel nog steeds iets toonbaars', () => {
    const onbekend = channelMeta('pinterest')
    expect(onbekend.label).toBe('pinterest')
    expect(onbekend.ratio).toBeTruthy()
  })

  it('kent de rij voor posts zonder kanaal', () => {
    expect(channelMeta(GEEN_KANAAL).label).toBe('Nog geen kanaal')
  })
})

describe('de kanalen van een post', () => {
  it('houdt de vaste volgorde aan, niet de klikvolgorde', () => {
    expect(kanalenVan({ channels: ['facebook', 'instagram'] })).toEqual(['instagram', 'facebook'])
  })

  it('ontdubbelt en gooit onbekende kanalen weg', () => {
    expect(kanalenVan({ channels: ['instagram', 'instagram', 'myspace'] })).toEqual(['instagram'])
  })

  it('kan tegen een post zonder kanalen', () => {
    expect(kanalenVan({})).toEqual([])
    expect(kanalenVan(null)).toEqual([])
  })

  it('kiest het strengste formaat als hoofdkanaal', () => {
    expect(hoofdKanaal({ channels: ['facebook', 'instagram'] })).toBe('instagram')
    expect(hoofdKanaal({ channels: [] })).toBe(GEEN_KANAAL)
  })
})

describe('de rijen van de weekweergave', () => {
  it('toont alleen de kanalen die deze week voorkomen', () => {
    const posts = [{ channels: ['instagram'] }, { channels: ['linkedin', 'instagram'] }]
    expect(kanaalRijen(posts)).toEqual(['instagram', 'linkedin'])
  })

  it('zet posts zonder kanaal achteraan in een eigen rij', () => {
    const posts = [{ channels: ['facebook'] }, { channels: [] }]
    expect(kanaalRijen(posts)).toEqual(['facebook', GEEN_KANAAL])
  })

  it('valt bij een lege week terug op de twee kanalen waar alles op gaat', () => {
    expect(kanaalRijen([])).toEqual(['instagram', 'facebook'])
  })
})
