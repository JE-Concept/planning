import { afterEach, describe, expect, it } from 'vitest'
import { isSchrijffout, leesSchrijffout } from '../src/lib/schrijffout'
import { zetHuidigeTaal } from '../src/lib/i18n'

describe('welke fouten hier thuishoren', () => {
  it('herkent een weigering van de database', () => {
    expect(isSchrijffout({ code: 'permission-denied' })).toBe(true)
    expect(isSchrijffout({ code: 'not-found' })).toBe(true)
  })

  it('herkent een fout van een Cloud Function', () => {
    expect(isSchrijffout({ code: 'functions/internal' })).toBe(true)
  })

  // Een programmeerfout hoort in de console en niet als melding bij iemand die
  // aan het werk is — die kan er niets mee.
  it('laat een gewone fout met rust', () => {
    expect(isSchrijffout(new TypeError('x is not a function'))).toBe(false)
    expect(isSchrijffout(null)).toBe(false)
    expect(isSchrijffout({ message: 'iets' })).toBe(false)
  })
})

describe('wat er op het scherm komt', () => {
  afterEach(() => zetHuidigeTaal('nl'))

  // Elke zin zegt eerst dát het niet bewaard is: dat is wat iemand moet weten.
  it('begint met "niet bewaard"', () => {
    for (const code of ['permission-denied', 'not-found', 'failed-precondition', 'resource-exhausted', 'iets-anders']) {
      expect(leesSchrijffout({ code })).toMatch(/^Niet bewaard/)
    }
  })

  // Behalve wanneer dat onwaar zou zijn: zonder verbinding is het geen
  // weigering maar een wachtrij.
  it('zegt bij geen verbinding dat het nog komt', () => {
    expect(leesSchrijffout({ code: 'unavailable' })).toMatch(/nog niet verstuurd/i)
  })

  it('stuurt een afgemelde gebruiker naar het herladen', () => {
    expect(leesSchrijffout({ code: 'unauthenticated' })).toMatch(/afgemeld/i)
  })

  it('leest het voorvoegsel van de functions-SDK weg', () => {
    expect(leesSchrijffout({ code: 'functions/permission-denied' })).toBe(
      leesSchrijffout({ code: 'permission-denied' })
    )
  })

  it('zegt het ook in het Engels', () => {
    zetHuidigeTaal('en')
    expect(leesSchrijffout({ code: 'permission-denied' })).toMatch(/^Not saved/)
  })
})
