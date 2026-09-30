import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  kaartIngesteld,
  kaartLink,
  leegLocatie,
  locatieDetails,
  vergeetKaartstoring,
  vrijeLocatie,
  zoekLocaties,
} from '../src/lib/kaart'

const SLEUTEL = 'VITE_GOOGLE_MAPS_API_KEY'

/** Eén antwoord van Google, zonder er echt naartoe te gaan. */
const antwoord = (body, { ok = true, status = 200 } = {}) =>
  vi.fn().mockResolvedValue({ ok, status, json: async () => body })

beforeEach(() => {
  vergeetKaartstoring()
  vi.stubEnv(SLEUTEL, 'test-sleutel')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('of er met een kaart gewerkt kan worden', () => {
  it('zonder sleutel niet — dan is het veld gewoon tekst', () => {
    vi.stubEnv(SLEUTEL, '')
    expect(kaartIngesteld()).toBe(false)
  })

  it('met sleutel wel', () => {
    expect(kaartIngesteld()).toBe(true)
  })
})

describe('adressen zoeken', () => {
  it('vraagt niets bij minder dan drie letters: dat levert toch geen adres op', async () => {
    const fetch = antwoord({})
    vi.stubGlobal('fetch', fetch)
    expect(await zoekLocaties('Ho')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('vraagt niets zonder sleutel', async () => {
    vi.stubEnv(SLEUTEL, '')
    const fetch = antwoord({})
    vi.stubGlobal('fetch', fetch)
    expect(await zoekLocaties('Hoeve Vanhove')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('geeft naam en adres apart terug, want zo leest de lijst', async () => {
    vi.stubGlobal(
      'fetch',
      antwoord({
        suggestions: [
          {
            placePrediction: {
              placeId: 'plek-1',
              text: { text: 'Hoeve Vanhove, Kortessem' },
              structuredFormat: {
                mainText: { text: 'Hoeve Vanhove' },
                secondaryText: { text: 'Kortessem, België' },
              },
            },
          },
        ],
      })
    )
    expect(await zoekLocaties('Hoeve Vanhove')).toEqual([
      { id: 'plek-1', tekst: 'Hoeve Vanhove, Kortessem', hoofd: 'Hoeve Vanhove', onder: 'Kortessem, België' },
    ])
  })

  // Een voorstel zonder id kan je niet kiezen; dan hoort het ook niet in de
  // lijst te staan.
  it('laat voorstellen zonder plek weg', async () => {
    vi.stubGlobal('fetch', antwoord({ suggestions: [{ queryPrediction: { text: { text: 'zalen' } } }] }))
    expect(await zoekLocaties('zalen in de buurt')).toEqual([])
  })

  it('zoekt in de landen waar er gewerkt wordt en in de taal van het scherm', async () => {
    const fetch = antwoord({ suggestions: [] })
    vi.stubGlobal('fetch', fetch)
    await zoekLocaties('Grote Markt', { taal: 'en' })
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.includedRegionCodes).toContain('be')
    expect(body.languageCode).toBe('en')
    expect(fetch.mock.calls[0][1].headers['X-Goog-Api-Key']).toBe('test-sleutel')
  })
})

describe('als Google nee zegt', () => {
  it('zet een geweigerde sleutel het veld terug op tekst', async () => {
    vi.stubGlobal('fetch', antwoord({}, { ok: false, status: 403 }))
    await expect(zoekLocaties('Hoeve Vanhove')).rejects.toThrow()
    expect(kaartIngesteld()).toBe(false)
  })

  // Een server die het even niet doet, is geen reden om het kiezen voorgoed uit
  // te zetten: de volgende aanslag mag het gewoon opnieuw proberen.
  it('blijft na een storing aan de kant van Google gewoon werken', async () => {
    vi.stubGlobal('fetch', antwoord({}, { ok: false, status: 503 }))
    await expect(zoekLocaties('Hoeve Vanhove')).rejects.toThrow()
    expect(kaartIngesteld()).toBe(true)
  })
})

describe('de gekozen plek', () => {
  it('zet de naam vóór het adres en houdt de coördinaten bij', async () => {
    vi.stubGlobal(
      'fetch',
      antwoord({
        id: 'plek-1',
        displayName: { text: 'Hoeve Vanhove' },
        formattedAddress: 'Vanhovestraat 1, 3720 Kortessem, België',
        location: { latitude: 50.856, longitude: 5.383 },
      })
    )
    expect(await locatieDetails('plek-1')).toEqual({
      location: 'Hoeve Vanhove, Vanhovestraat 1, 3720 Kortessem, België',
      locationPlaceId: 'plek-1',
      locationLat: 50.856,
      locationLng: 5.383,
    })
  })

  // Bij een gewoon huisnummer is de naam van de plek het adres; twee keer
  // hetzelfde op de offerte zetten leest als een fout.
  it('herhaalt de naam niet als hij het adres is', async () => {
    vi.stubGlobal(
      'fetch',
      antwoord({
        id: 'plek-2',
        displayName: { text: 'Industrieweg 12' },
        formattedAddress: 'Industrieweg 12',
        location: { latitude: 50.8, longitude: 5.2 },
      })
    )
    expect((await locatieDetails('plek-2')).location).toBe('Industrieweg 12')
  })

  it('geeft niets terug zonder sleutel of zonder plek', async () => {
    const fetch = antwoord({})
    vi.stubGlobal('fetch', fetch)
    expect(await locatieDetails('')).toBe(null)
    vi.stubEnv(SLEUTEL, '')
    expect(await locatieDetails('plek-1')).toBe(null)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('de kaartlink', () => {
  it('opent precies de gekozen plek als die er is', () => {
    const url = new URL(
      kaartLink({ location: 'Hoeve Vanhove', locationPlaceId: 'plek-1', locationLat: 50.856, locationLng: 5.383 })
    )
    expect(url.searchParams.get('query')).toBe('Hoeve Vanhove')
    expect(url.searchParams.get('query_place_id')).toBe('plek-1')
  })

  it('zoekt op de tekst wanneer er niets gekozen is', () => {
    const url = new URL(kaartLink({ location: 'Grote Markt, Borgloon' }))
    expect(url.searchParams.get('query')).toBe('Grote Markt, Borgloon')
    expect(url.searchParams.has('query_place_id')).toBe(false)
  })

  it('valt terug op de coördinaten als er geen tekst is', () => {
    const url = new URL(kaartLink({ locationLat: 50.856, locationLng: 5.383 }))
    expect(url.searchParams.get('query')).toBe('50.856,5.383')
  })

  it('is er niet zonder locatie: een knop die nergens heen gaat is erger dan geen knop', () => {
    expect(kaartLink(null)).toBe(null)
    expect(kaartLink({})).toBe(null)
    expect(kaartLink({ location: '   ' })).toBe(null)
  })

  // De link werkt ook zonder sleutel: een adres als zoekterm heeft Google niet
  // van ons nodig.
  it('werkt zonder sleutel', () => {
    vi.stubEnv(SLEUTEL, '')
    expect(kaartLink({ location: 'Geel' })).toContain('Geel')
  })
})

describe('wat er bewaard wordt', () => {
  it('maakt alle vier de velden leeg, niet alleen de tekst', () => {
    expect(leegLocatie()).toEqual({
      location: null,
      locationPlaceId: null,
      locationLat: null,
      locationLng: null,
    })
  })

  // Wie de tekst met de hand overtypt, bedoelt een andere plek. Coördinaten
  // die bij de vorige horen, sturen het team naar het verkeerde adres.
  it('laat zelf getypte tekst geen oude coördinaten meeslepen', () => {
    expect(vrijeLocatie('  bij de klant thuis  ')).toEqual({
      location: 'bij de klant thuis',
      locationPlaceId: null,
      locationLat: null,
      locationLng: null,
    })
    expect(vrijeLocatie('   ').location).toBe(null)
  })
})
