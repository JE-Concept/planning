import { describe, expect, it } from 'vitest'
import { DREMPELS, standVan } from '../src/lib/eventstand'
import { maakRegel } from '../src/lib/offerte'

/**
 * De stand van een event: het oordeel dat bovenaan het overzicht staat.
 *
 * Dit is getest omdat het een uitspraak is die fout kan zijn. Een
 * waarschuwing die te vaak komt, leert iedereen wegklikken — en dan is ook de
 * ene waarschuwing weg die wél klopte.
 */

const nu = new Date('2026-10-01T09:00:00+02:00')
const overDagen = (n) => new Date(new Date(nu).setDate(nu.getDate() + n))

const basis = {
  id: 't-1',
  name: 'Trouw',
  statusName: 'request',
  customerId: 'k-1',
  customerName: 'Blum',
  pax: 40,
  location: 'Het Vinne',
  eventDate: overDagen(90),
}

describe('het aftellen', () => {
  it('telt de dagen tot het event', () => {
    expect(standVan({ event: basis, nu }).dagen).toBe(90)
  })

  it('telt negatief na afloop', () => {
    expect(standVan({ event: { ...basis, eventDate: overDagen(-3) }, nu }).dagen).toBe(-3)
  })

  it('zegt niets wanneer er geen datum is', () => {
    expect(standVan({ event: { ...basis, eventDate: null }, nu }).dagen).toBeNull()
  })
})

describe('wat aandacht vraagt', () => {
  it('zwijgt over een gat dat nog ver weg is', () => {
    const ver = { ...basis, location: '', pax: 0, eventDate: overDagen(90) }
    expect(standVan({ event: ver, nu }).aandacht).not.toContain('overzicht.let.geen_locatie')
  })

  it('maar klaagt erover zodra het event dichtbij komt', () => {
    const dichtbij = { ...basis, location: '', eventDate: overDagen(DREMPELS.gegevens - 1) }
    expect(standVan({ event: dichtbij, nu }).aandacht).toContain('overzicht.let.geen_locatie')
  })

  it('vraagt om een offerte zodra het dossier op de offertestap staat', () => {
    const stand = standVan({ event: { ...basis, statusName: 'create offer' }, nu })
    expect(stand.aandacht).toContain('overzicht.let.geen_offerte')
  })

  it('zegt dat een concept de klantenpagina nog niet opent', () => {
    const stand = standVan({
      event: { ...basis, statusName: 'offer send' },
      offerte: { status: 'concept', regels: [] },
      nu,
    })
    expect(stand.aandacht).toContain('overzicht.let.offerte_concept')
  })

  it('klaagt niet over een concept zolang het dossier nog een aanvraag is', () => {
    const stand = standVan({ event: basis, offerte: { status: 'concept', regels: [] }, nu })
    expect(stand.aandacht).not.toContain('overzicht.let.offerte_concept')
  })

  it('merkt een verlopen offerte op', () => {
    const stand = standVan({
      event: basis,
      offerte: { status: 'verstuurd', regels: [], geldigTot: overDagen(-1) },
      nu,
    })
    expect(stand.aandacht).toContain('overzicht.let.offerte_verlopen')
  })

  it('merkt een niet-gefactureerd event op, maar pas na een week', () => {
    const net = standVan({ event: { ...basis, eventDate: overDagen(-2) }, nu })
    expect(net.aandacht).not.toContain('overzicht.let.niet_gefactureerd')

    const later = standVan({ event: { ...basis, eventDate: overDagen(-DREMPELS.facturatie - 1) }, nu })
    expect(later.aandacht).toContain('overzicht.let.niet_gefactureerd')
  })

  it('zwijgt over facturatie wanneer er al gefactureerd is', () => {
    const stand = standVan({
      event: { ...basis, statusName: 'invoiced', eventDate: overDagen(-30) },
      nu,
    })
    expect(stand.aandacht).not.toContain('overzicht.let.niet_gefactureerd')
  })

  it('vraagt naar de planning wanneer het event binnen drie weken valt', () => {
    const stand = standVan({ event: { ...basis, eventDate: overDagen(DREMPELS.planning - 1) }, nu })
    expect(stand.aandacht).toContain('overzicht.let.planning_open')
  })

  it('zwijgt wanneer de planning rond is', () => {
    const stand = standVan({
      event: { ...basis, planning: 'rond', eventDate: overDagen(DREMPELS.planning - 1) },
      nu,
    })
    expect(stand.aandacht).not.toContain('overzicht.let.planning_open')
  })
})

describe('de cijfers', () => {
  it('telt de taken en hun verhouding', () => {
    const taken = [{ open: false }, { open: true }, { open: true }]
    const stand = standVan({ event: basis, tasks: taken, nu })
    expect(stand.taken).toMatchObject({ totaal: 3, af: 1, open: 2 })
    expect(stand.taken.deel).toBeCloseTo(1 / 3)
  })

  it('rekent het offertebedrag uit de regels en bewaart het niet', () => {
    const offerte = {
      status: 'verstuurd',
      regels: [maakRegel({ rubriek: 'catering', eenheidExcl: 10, aantal: 10, eenheid: 'pp' })],
    }
    const stand = standVan({ event: basis, offerte, nu })
    expect(stand.offerte.excl).toBe(100)
    expect(stand.offerte.incl).toBe(112)
  })
})

describe('het ene woord bovenaan', () => {
  it('is "rond" wanneer er niets te melden valt', () => {
    expect(standVan({ event: basis, nu }).stand).toBe('rond')
  })

  it('is "dringend" wanneer er iets mist en het event dichtbij is', () => {
    const stand = standVan({ event: { ...basis, pax: 0, eventDate: overDagen(3) }, nu })
    expect(stand.stand).toBe('dringend')
  })
})
