import { describe, expect, it } from 'vitest'
import { isLaadfout, magHerladen } from '../src/components/layout/ErrorBoundary'

/*
  Het vangnet onder de app doet twee dingen die precies andersom fout kunnen
  gaan: een pagina die na een uitrol niet meer te laden is moet stil herladen,
  en elke andere fout moet blijven staan. Beide takken hangen aan deze twee
  functies, en ze zijn juist daarom apart geëxporteerd.
*/
describe('isLaadfout', () => {
  it('herkent een brok van de app die na een uitrol weg is', () => {
    expect(isLaadfout(new Error('Failed to fetch dynamically imported module: /assets/Tasks-a1b2.js'))).toBe(true)
    expect(isLaadfout(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isLaadfout(new Error('Importing a module script failed.'))).toBe(true)
    expect(isLaadfout(Object.assign(new Error('boem'), { name: 'ChunkLoadError' }))).toBe(true)
  })

  it('laat een gewone bug staan, want stil herladen verbergt die alleen', () => {
    expect(isLaadfout(new TypeError("Cannot read properties of null (reading 'map')"))).toBe(false)
    expect(isLaadfout(new Error('permission-denied'))).toBe(false)
  })

  // Het vangnet mag nooit zelf omvallen op wat erin gegooid wordt.
  it('valt niet om op iets dat geen fout is', () => {
    expect(isLaadfout(null)).toBe(false)
    expect(isLaadfout(undefined)).toBe(false)
    expect(isLaadfout({})).toBe(false)
    expect(isLaadfout('Failed to fetch dynamically imported module')).toBe(false)
  })
})

/** Een boekje dat zich als sessionStorage voordoet. */
function opslag(start = {}) {
  const inhoud = { ...start }
  return {
    getItem: (k) => (k in inhoud ? inhoud[k] : null),
    setItem: (k, v) => {
      inhoud[k] = String(v)
    },
  }
}

describe('magHerladen', () => {
  it('laat de eerste herlaadbeurt door', () => {
    expect(magHerladen(opslag(), 1_000_000)).toBe(true)
  })

  /*
    Dit is de rem op de lus. Helpt herladen niet — omdat het bestand écht weg
    is en niet alleen vervangen — dan valt de tweede poging binnen de minuut en
    blijft de melding staan in plaats van dat het tabblad blijft knipperen.
  */
  it('houdt een tweede beurt binnen de minuut tegen', () => {
    const boekje = opslag()
    expect(magHerladen(boekje, 1_000_000)).toBe(true)
    expect(magHerladen(boekje, 1_030_000)).toBe(false)
  })

  it('geeft een uitrol een uur later een nieuwe kans', () => {
    const boekje = opslag()
    expect(magHerladen(boekje, 1_000_000)).toBe(true)
    expect(magHerladen(boekje, 1_000_000 + 3_600_000)).toBe(true)
  })

  /*
    Safari in privémodus gooit hier. Dan liever niet herladen dan eindeloos
    herladen — en zeker niet de hele boom meenemen op een mededeling.
  */
  it('herlaadt niet wanneer de opslag weigert', () => {
    const stuk = {
      getItem: () => {
        throw new Error('QuotaExceededError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(magHerladen(stuk, 1_000_000)).toBe(false)
    expect(magHerladen(undefined, 1_000_000)).toBe(false)
  })
})
