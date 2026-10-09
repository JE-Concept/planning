import { describe, expect, it } from 'vitest'
import {
  adresVan,
  adressenVan,
  antwoordAdres,
  berichtSleutel,
  draadVan,
  eventUitAdres,
  kiesEvent,
  geplakteMail,
  klantVanAdres,
  MAX_TEKST,
} from '../functions/mail-koppeling.js'

const KLANTEN = [
  { id: 'k-niels', email: 'niels@example.be', contacts: [{ email: 'inez@example.be' }] },
  { id: 'k-blum', email: 'events@blum.be', contacts: [] },
]

const EVENTS = [
  { id: 't-trouw', customerId: 'k-niels', archived: false },
  { id: 't-blum', customerId: 'k-blum', archived: false },
  { id: 't-blum-kerst', customerId: 'k-blum', archived: false },
  { id: 't-oud', customerId: 'k-niels', archived: true },
]

describe('adressen', () => {
  it('haalt het adres uit een naam met haakjes', () => {
    expect(adresVan('Kristien Maris <K.Maris@Example.BE>')).toBe('k.maris@example.be')
  })

  it('laat een kaal adres met rust', () => {
    expect(adresVan(' info@jeconcept.be ')).toBe('info@jeconcept.be')
  })

  it('geeft niets terug voor wat geen adres is', () => {
    expect(adresVan('geen adres')).toBe('')
    expect(adresVan(null)).toBe('')
  })

  it('splitst een kopregel met meer ontvangers', () => {
    expect(adressenVan('a@x.be, Bert <b@x.be>')).toEqual(['a@x.be', 'b@x.be'])
  })
})

describe('het antwoordadres', () => {
  // Alles achter de + negeert de mailserver bij het bezorgen, dus dit komt
  // gewoon in info@ terecht — met het event erin.
  it('draagt het event in het adres', () => {
    expect(antwoordAdres('info@jeconcept.be', 't-trouw')).toBe('info+et-trouw@jeconcept.be')
  })

  it('leest het event er weer uit', () => {
    expect(eventUitAdres('info+et-trouw@jeconcept.be')).toBe('t-trouw')
    expect(eventUitAdres('Info+ET-Trouw@jeconcept.be')).toBe('t-trouw')
  })

  it('vindt niets in een gewoon adres', () => {
    expect(eventUitAdres('info@jeconcept.be')).toBe(null)
    expect(eventUitAdres('info+nieuwsbrief@jeconcept.be')).toBe(null)
  })

  it('blijft het gewone adres wanneer er geen event is', () => {
    expect(antwoordAdres('info@jeconcept.be', null)).toBe('info@jeconcept.be')
  })
})

describe('de draad', () => {
  it('leest In-Reply-To en References, nieuwste eerst', () => {
    const uit = draadVan({ inReplyTo: '<c@mail>', references: '<a@mail> <b@mail>' })
    expect(uit).toEqual(['c@mail', 'b@mail', 'a@mail'])
  })

  it('noemt hetzelfde bericht één keer', () => {
    expect(draadVan({ inReplyTo: '<a@mail>', references: '<a@mail>' })).toEqual(['a@mail'])
  })

  it('valt niet om zonder koppen', () => {
    expect(draadVan({})).toEqual([])
  })
})

describe('de klant bij een afzender', () => {
  it('vindt de klant op zijn eigen adres', () => {
    expect(klantVanAdres('niels@example.be', KLANTEN)?.id).toBe('k-niels')
  })

  // De zaakvoerder staat op de fiche, maar het is de eventverantwoordelijke
  // die mailt.
  it('vindt de klant op het adres van een contactpersoon', () => {
    expect(klantVanAdres('Inez <inez@example.be>', KLANTEN)?.id).toBe('k-niels')
  })

  it('vindt niets bij een onbekend adres', () => {
    expect(klantVanAdres('iemand@anders.be', KLANTEN)).toBe(null)
  })
})

describe('welk event', () => {
  it('gelooft het antwoordadres', () => {
    const uit = kiesEvent({
      bericht: { van: 'vreemde@elders.be', aan: 'info+et-trouw@jeconcept.be' },
      events: EVENTS,
      klanten: KLANTEN,
    })
    expect(uit).toEqual({ eventId: 't-trouw', customerId: 'k-niels', reden: 'adres' })
  })

  it('negeert een antwoordadres van een event dat niet meer bestaat', () => {
    const uit = kiesEvent({
      bericht: { van: 'vreemde@elders.be', aan: 'info+et-weg@jeconcept.be' },
      events: EVENTS,
      klanten: KLANTEN,
    })
    expect(uit.eventId).toBe(null)
  })

  it('volgt de draad van een bericht dat we al kennen', () => {
    const uit = kiesEvent({
      bericht: { van: 'iemand@anders.be', aan: 'info@jeconcept.be', inReplyTo: '<m1@plan>' },
      bekend: [{ messageId: 'm1@plan', eventId: 't-blum', customerId: 'k-blum' }],
      events: EVENTS,
      klanten: KLANTEN,
    })
    expect(uit).toEqual({ eventId: 't-blum', customerId: 'k-blum', reden: 'draad' })
  })

  it('koppelt een klant met precies één lopend dossier', () => {
    const uit = kiesEvent({
      bericht: { van: 'niels@example.be', aan: 'info@jeconcept.be' },
      events: EVENTS,
      klanten: KLANTEN,
    })
    expect(uit).toEqual({ eventId: 't-trouw', customerId: 'k-niels', reden: 'klant' })
  })

  // Kiezen tussen twee dossiers van dezelfde klant is precies waar het misgaat.
  it('kiest niet wanneer een klant meer dan één lopend dossier heeft', () => {
    const uit = kiesEvent({
      bericht: { van: 'events@blum.be', aan: 'info@jeconcept.be' },
      events: EVENTS,
      klanten: KLANTEN,
    })
    expect(uit.eventId).toBe(null)
    expect(uit.customerId).toBe('k-blum')
    expect(uit.reden).toBe('klant_meerdere')
  })

  it('koppelt een nieuwe klant nergens aan: er is nog geen event', () => {
    const uit = kiesEvent({
      bericht: { van: 'kristien@example.be', aan: 'info@jeconcept.be' },
      events: EVENTS,
      klanten: KLANTEN,
    })
    expect(uit).toEqual({ eventId: null, customerId: null, reden: null })
  })

  /*
    De draad wint van het adres, en het adres van de klant.

    De draad staat vooraan sinds info@ een groep bleek te zijn: een groep kent
    geen plusadressering, dus het adres draagt daar zelden nog een event. De
    koppen van het mailprogramma overleven de groep wél.
  */
  it('houdt de volgorde van zeker naar waarschijnlijk aan', () => {
    const uit = kiesEvent({
      bericht: {
        van: 'niels@example.be',
        aan: 'info+et-blum@jeconcept.be',
        inReplyTo: '<m1@plan>',
      },
      bekend: [{ messageId: 'm1@plan', eventId: 't-blum-kerst' }],
      events: EVENTS,
      klanten: KLANTEN,
    })
    expect(uit.eventId).toBe('t-blum-kerst')
  })

  // En zonder draad doet het plusadres nog gewoon zijn werk — voor het geval
  // er ooit rechtstreeks naar de postbus van de tool geschreven wordt.
  it('valt zonder draad terug op het plusadres', () => {
    const uit = kiesEvent({
      bericht: { van: 'niels@example.be', aan: 'plan+et-blum@jeconcept.be' },
      events: EVENTS,
      klanten: KLANTEN,
    })
    expect(uit).toEqual({ eventId: 't-blum', customerId: 'k-blum', reden: 'adres' })
  })
})

describe('de sleutel van een bericht', () => {
  // Schrijft de ophaler er twee keer dezelfde weg, dan is het hetzelfde
  // document en staat het één keer in de draad.
  it('maakt van een Message-ID een documentnaam', () => {
    expect(berichtSleutel('<CAF=abc123@mail.gmail.com>')).toBe('CAF_abc123@mail.gmail.com')
  })

  it('valt terug op iets anders wanneer er geen Message-ID is', () => {
    expect(berichtSleutel('', 'uid-4711')).toBe('uid-4711')
    expect(berichtSleutel(null, null)).toBe('')
  })
})

describe('een geplakte aanvraag (U8)', () => {
  const NU = new Date(2026, 9, 8, 10, 0)
  const rij = geplakteMail({
    tekst: '  Voor onze ORKA wandeldagen op 23, 24 en 25 februari…  ',
    van: 'Marc Janssens',
    eventId: 't-orka',
    door: 'u-jasper',
    nu: NU,
  })

  // Op het tabblad Mail, en niet als omschrijving: daar leest de draad, en
  // daar telt de tegel Post.
  it('hangt aan het event, zoals de draad leest', () => {
    expect(rij.data).toMatchObject({ richting: 'in', eventId: 't-orka', datum: NU, tekst: expect.stringMatching(/^Voor onze ORKA/) })
  })

  // De draad is bewijs; wat niet van de mailserver kwam, staat er als zodanig.
  it('zegt dat hij geplakt is, en door wie', () => {
    expect(rij.data).toMatchObject({ bron: 'geplakt', koppeling: 'geplakt', geplaktDoor: 'u-jasper', messageId: null })
  })

  it('geeft dezelfde tekst bij hetzelfde event dezelfde naam', () => {
    const nogEens = geplakteMail({ tekst: 'Voor onze ORKA wandeldagen op 23, 24 en 25 februari…', eventId: 't-orka', door: 'u-ander' })
    expect(nogEens.id).toBe(rij.id)
    expect(geplakteMail({ tekst: 'iets anders', eventId: 't-orka', door: 'u-jasper' }).id).not.toBe(rij.id)
  })

  it('bewaart niets zonder tekst, event of wie', () => {
    expect(geplakteMail({ tekst: '   ', eventId: 't-orka', door: 'u-jasper' })).toBe(null)
    expect(geplakteMail({ tekst: 'dag', eventId: '', door: 'u-jasper' })).toBe(null)
    expect(geplakteMail({ tekst: 'dag', eventId: 't-orka', door: null })).toBe(null)
  })

  it('kapt af zoals de ophaler', () => {
    expect(geplakteMail({ tekst: 'x'.repeat(MAX_TEKST + 10), eventId: 't', door: 'u' }).data.tekst).toHaveLength(MAX_TEKST)
  })
})
