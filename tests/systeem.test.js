import { describe, expect, it } from 'vitest'
import { STIL_NA_UREN, oordeel, postvakAchterSinds } from '../src/lib/systeem'

const NU = new Date('2026-09-30T09:00:00')
const urenGeleden = (n) => new Date(NU.getTime() - n * 3600000)

describe('doet de tool het nog', () => {
  it('zegt "goed" wanneer de post net nog binnenkwam', () => {
    const uit = oordeel({ postvak: { laatsteKeer: urenGeleden(0.2) }, nu: NU })
    expect(uit.postStaat).toBe('goed')
    expect(uit.stand).toBe('goed')
  })

  it('slaat aan zodra het langer stil is dan de grens', () => {
    const uit = oordeel({ postvak: { laatsteKeer: urenGeleden(STIL_NA_UREN + 1) }, nu: NU })
    expect(uit.postStaat).toBe('stil')
    expect(uit.urenStil).toBe(STIL_NA_UREN + 1)
    expect(uit.stand).toBe('let_op')
  })

  // Nog nooit gedraaid is een taak en geen storing: dan staat de sleutel er
  // gewoon nog niet, en daar hoort geen alarm bij.
  it('houdt "nog nooit gedraaid" apart van "gestopt"', () => {
    const uit = oordeel({ postvak: null, nu: NU })
    expect(uit.postStaat).toBe('nooit')
    expect(uit.stand).toBe('onbekend')
  })

  it('telt mislukte mails mee', () => {
    const uit = oordeel({ postvak: { laatsteKeer: urenGeleden(0.1) }, mislukt: [{ id: 'a' }, { id: 'b' }], nu: NU })
    expect(uit.mislukteMails).toBe(2)
    expect(uit.stand).toBe('let_op')
  })

  it('leest ook een Firestore-tijdstempel', () => {
    const uit = oordeel({ postvak: { laatsteKeer: { toDate: () => urenGeleden(1) } }, nu: NU })
    expect(uit.postStaat).toBe('goed')
  })

  it('valt niet om op niets', () => {
    expect(oordeel({}).stand).toBe('onbekend')
  })
})

describe('loopt het postvak achter', () => {
  const nu = new Date('2026-10-07T03:00:00Z')
  const minuten = (m) => ({ laatsteKeer: new Date(nu.getTime() - m * 60000) })
  it('bij is bij: een run van tien minuten geleden', () => {
    expect(postvakAchterSinds(minuten(10), nu)).toBeNull()
  })
  it('na twintig minuten zonder run zegt het scherm het', () => {
    expect(postvakAchterSinds(minuten(25), nu)?.toISOString()).toBe('2026-10-07T02:35:00.000Z')
  })
  it('nog nooit gedraaid is geen achterstand maar een taak', () => {
    expect(postvakAchterSinds(null, nu)).toBeNull()
  })
})
