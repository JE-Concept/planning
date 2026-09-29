import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agendaVan, dagErna, dagVan, eventRegels, ontsnap, vouw } from '../src/lib/ical'

const NU = new Date('2026-09-30T06:00:00Z')
const event = (over) => ({
  id: 't-trouw',
  name: 'Trouw Niels en Inez',
  date: new Date('2026-10-17T12:00:00'),
  location: 'Kasteel van Ordingen',
  customerName: 'Familie Vanhees',
  guests: 120,
  ...over,
})

const regelsVan = (tekst) => tekst.split('\r\n')

describe('ontsnappen', () => {
  // Een klantnaam met een komma erin brak anders het hele item: de agenda las
  // wat erachter stond als een tweede veld.
  it('ontsnapt wat in iCalendar een betekenis heeft', () => {
    expect(ontsnap('Blum, België')).toBe('Blum\\, België')
    expect(ontsnap('a;b')).toBe('a\\;b')
    expect(ontsnap('a\\b')).toBe('a\\\\b')
    expect(ontsnap('een\ntwee')).toBe('een\\ntwee')
  })

  it('maakt van niets een lege tekst in plaats van "undefined"', () => {
    expect(ontsnap(null)).toBe('')
    expect(ontsnap(undefined)).toBe('')
  })
})

describe('vouwen op 75 tekens', () => {
  it('laat een korte regel met rust', () => {
    expect(vouw('SUMMARY:Kort')).toBe('SUMMARY:Kort')
  })

  it('vouwt met een regeleinde en een spatie', () => {
    const uit = vouw(`SUMMARY:${'a'.repeat(200)}`)
    const stukken = uit.split('\r\n')
    expect(stukken[0]).toHaveLength(75)
    expect(stukken.slice(1).every((r) => r.startsWith(' ') && r.length <= 75)).toBe(true)
    expect(uit.replace(/\r\n /g, '')).toBe(`SUMMARY:${'a'.repeat(200)}`)
  })
})

describe('de dag van een event', () => {
  // Een event staat op het midden van de dag bewaard; op UTC lezen zou het in
  // de winter een dag naar voren schuiven.
  it('leest de lokale dag', () => {
    expect(dagVan(new Date('2026-10-17T12:00:00'))).toBe('2026-10-17')
    expect(dagVan('2026-01-02T23:30:00')).toBe('2026-01-02')
  })

  it('leest ook een Firestore-tijdstip', () => {
    expect(dagVan({ toDate: () => new Date('2026-10-17T12:00:00') })).toBe('2026-10-17')
  })

  it('geeft niets terug op wat geen datum is', () => {
    expect(dagVan(null)).toBeNull()
    expect(dagVan('')).toBeNull()
    expect(dagVan('een dag in oktober')).toBeNull()
  })

  it('telt over een maand- en jaargrens heen', () => {
    expect(dagErna('2026-10-31')).toBe('2026-11-01')
    expect(dagErna('2026-12-31')).toBe('2027-01-01')
  })
})

describe('een event als agenda-item', () => {
  const regels = eventRegels(event(), { nu: NU, basis: 'https://planning.jeconcept.be' })

  it('staat als dagvullend item op de juiste dag', () => {
    expect(regels).toContain('DTSTART;VALUE=DATE:20261017')
    // DTEND is exclusief: zonder de dag erna staat het item er niet.
    expect(regels).toContain('DTEND;VALUE=DATE:20261018')
  })

  // Zonder een vast UID maakt elke ophaalbeurt een tweede item naast het eerste.
  it('houdt hetzelfde UID vast', () => {
    expect(regels).toContain('UID:t-trouw@jeplan.jeconcept.be')
  })

  it('zet de naam, de plek en de weg terug', () => {
    expect(regels).toContain('SUMMARY:Trouw Niels en Inez')
    expect(regels).toContain('LOCATION:Kasteel van Ordingen')
    expect(regels.join('\n')).toContain('Familie Vanhees')
    expect(regels).toContain('URL:https://planning.jeconcept.be/#/events/t-trouw')
  })

  it('laat een event zonder datum weg in plaats van het op vandaag te zetten', () => {
    expect(eventRegels(event({ date: null }), { nu: NU })).toBeNull()
  })

  it('valt niet om op een event zonder naam', () => {
    expect(eventRegels(event({ name: '' }), { nu: NU })).toContain('SUMMARY:Event zonder naam')
  })
})

describe('de hele agenda', () => {
  const tekst = agendaVan([event(), event({ id: 'x', date: null })], { nu: NU, naam: 'JE Plan — events' })

  it('begint en eindigt zoals een agenda hoort', () => {
    const regels = regelsVan(tekst)
    expect(regels[0]).toBe('BEGIN:VCALENDAR')
    expect(regels.filter((r) => r === 'END:VCALENDAR')).toHaveLength(1)
    expect(tekst.endsWith('\r\n')).toBe(true)
  })

  // Sommige agenda's weigeren een bestand met gewone regeleindes.
  it('gebruikt CRLF', () => {
    expect(tekst.includes('\n')).toBe(true)
    expect(tekst.split('\n').every((r) => r === '' || r.endsWith('\r'))).toBe(true)
  })

  it('geeft het abonnement een naam in plaats van een adres', () => {
    expect(tekst).toContain('X-WR-CALNAME:JE Plan — events')
  })

  it('slaat de events zonder datum over', () => {
    expect(regelsVan(tekst).filter((r) => r === 'BEGIN:VEVENT')).toHaveLength(1)
  })

  it('valt niet om op een lege lijst', () => {
    expect(agendaVan([], { nu: NU })).toContain('END:VCALENDAR')
    expect(agendaVan(null, { nu: NU })).toContain('END:VCALENDAR')
  })
})

describe('de kopie voor de functions', () => {
  // `functions/` wordt apart verpakt en kan niets uit `src/` importeren, dus
  // staat er een kopie. Twee kopieën die uit elkaar lopen zijn erger dan één
  // bestand op een lelijke plek: dan klopt de agenda die het team ziet niet
  // meer met de agenda die verstuurd wordt.
  it('is gelijk aan het origineel, op de uitleg bovenaan na', () => {
    const zonderKop = (tekst) => tekst.slice(tekst.indexOf('const SOORT'))
    expect(zonderKop(readFileSync(new URL('../functions/ical.js', import.meta.url), 'utf8'))).toBe(
      zonderKop(readFileSync(new URL('../src/lib/ical.js', import.meta.url), 'utf8'))
    )
  })
})
