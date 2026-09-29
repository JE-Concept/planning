import { afterEach, describe, expect, it } from 'vitest'
import { zetHuidigeTaal } from '../src/lib/i18n'
import { zetLocale } from '../src/lib/dates'
import {
  botsingen,
  duurVan,
  geplandTegenoverGeboekt,
  naarKlok,
  naarMinuten,
  overlapt,
  roosterVan,
  urenTekst,
  weekDagen,
} from '../src/lib/rooster'

const shift = (over) => ({ profileId: 'u1', date: '2026-09-29', start: '17:00', end: '23:00', ...over })

describe('naarMinuten en naarKlok', () => {
  it('leest een klokuur', () => {
    expect(naarMinuten('17:30')).toBe(1050)
    expect(naarMinuten('00:00')).toBe(0)
    expect(naarMinuten('9:05')).toBe(545)
  })

  it('weigert wat geen klokuur is', () => {
    expect(naarMinuten('25:00')).toBeNull()
    expect(naarMinuten('17:75')).toBeNull()
    expect(naarMinuten('avond')).toBeNull()
    expect(naarMinuten('')).toBeNull()
  })

  it('schrijft het terug zoals het op de deur hangt', () => {
    expect(naarKlok(1050)).toBe('17:30')
    expect(naarKlok(0)).toBe('00:00')
    expect(naarKlok(null)).toBe('')
  })
})

describe('duurVan', () => {
  it('rekent een gewone dienst', () => {
    expect(duurVan(shift())).toBe(360)
  })

  // De avondbar tot drie uur is hier geen uitzondering maar de regel.
  it('rekent een dienst die over middernacht loopt', () => {
    expect(duurVan(shift({ start: '22:00', end: '03:00' }))).toBe(300)
  })

  it('trekt de pauze eraf', () => {
    expect(duurVan(shift({ start: '12:00', end: '20:00', breakMinutes: 30 }))).toBe(450)
  })

  it('geeft nul op een onvolledige dienst', () => {
    expect(duurVan(shift({ end: '' }))).toBe(0)
    expect(duurVan(null)).toBe(0)
  })

  it('wordt nooit negatief door een te lange pauze', () => {
    expect(duurVan(shift({ start: '12:00', end: '13:00', breakMinutes: 120 }))).toBe(0)
  })
})

describe('weekDagen', () => {
  // De dagnaam komt sinds de tweetaligheid uit de opmaaktaal. Daarom zet deze
  // test hem zelf: anders zou de uitkomst afhangen van welke taal er elders
  // gekozen werd, en dat is geen test maar een gok.
  afterEach(() => zetLocale('nl-BE'))

  it('begint op maandag', () => {
    zetLocale('nl-BE')
    const dagen = weekDagen(new Date('2026-10-01T12:00:00'))
    expect(dagen).toHaveLength(7)
    expect(dagen[0].naam).toBe('ma')
    expect(dagen[0].sleutel).toBe('2026-09-28')
    expect(dagen[6].sleutel).toBe('2026-10-04')
  })

  // Wie in het Engels werkt, hoort boven de kolom "Mon" te zien. De sleutel
  // blijft de datum, want daar wordt op gegroepeerd.
  it('geeft de dagnaam in de taal waarin iemand werkt', () => {
    zetLocale('en-GB')
    const dagen = weekDagen(new Date('2026-10-01T12:00:00'))
    expect(dagen[0].naam).toBe('Mon')
    expect(dagen[0].sleutel).toBe('2026-09-28')
  })
})

describe('overlapt', () => {
  it('ziet twee diensten die elkaar raken', () => {
    expect(overlapt(shift(), shift({ start: '20:00', end: '23:30' }))).toBe(true)
  })

  it('laat aansluitende diensten met rust', () => {
    expect(overlapt(shift({ start: '09:00', end: '17:00' }), shift({ start: '17:00', end: '23:00' }))).toBe(false)
  })

  it('kijkt niet naar iemand anders of een andere dag', () => {
    expect(overlapt(shift(), shift({ profileId: 'u2' }))).toBe(false)
    expect(overlapt(shift(), shift({ date: '2026-09-30' }))).toBe(false)
  })

  // Zonder de dienst in twee stukken te rekenen zou een nachtdienst met bijna
  // alles overlappen.
  it('rekent een nachtdienst in twee stukken', () => {
    const nacht = shift({ start: '22:00', end: '03:00' })
    expect(overlapt(nacht, shift({ start: '12:00', end: '18:00' }))).toBe(false)
    expect(overlapt(nacht, shift({ start: '01:00', end: '05:00' }))).toBe(true)
  })

  it('vindt de botsingen in een lijst', () => {
    const uit = botsingen([shift(), shift({ start: '20:00', end: '23:30' }), shift({ profileId: 'u2' })])
    expect(uit).toHaveLength(1)
  })
})

describe('roosterVan', () => {
  const profiles = [
    { id: 'u1', fullName: 'Lotte' },
    { id: 'u2', fullName: 'Sam' },
  ]
  const rooster = roosterVan({
    datum: new Date('2026-10-01T12:00:00'),
    profiles,
    shifts: [
      shift({ date: '2026-09-29' }),
      shift({ date: '2026-10-01', start: '09:00', end: '17:00' }),
      shift({ profileId: 'u2', date: '2026-10-03', start: '18:00', end: '02:00' }),
      // Buiten de week: telt niet mee.
      shift({ date: '2026-10-20' }),
    ],
  })

  it('zet de diensten op de juiste persoon en dag', () => {
    const lotte = rooster.rijen.find((r) => r.persoon.id === 'u1')
    expect(lotte.perDag['2026-09-29']).toHaveLength(1)
    expect(lotte.perDag['2026-10-01']).toHaveLength(1)
    expect(lotte.diensten).toBe(2)
  })

  it('laat wat buiten de week valt weg', () => {
    expect(rooster.rijen.flatMap((r) => Object.values(r.perDag).flat())).toHaveLength(3)
  })

  // Een rooster met alleen de ingeplande mensen laat niet zien wie er vrij is.
  it('houdt mensen zonder dienst in de lijst', () => {
    const rooster2 = roosterVan({ datum: new Date('2026-10-01T12:00:00'), profiles, shifts: [] })
    expect(rooster2.rijen).toHaveLength(2)
    expect(rooster2.rijen[0].diensten).toBe(0)
  })

  it('telt de uren per persoon, per dag en voor de week', () => {
    expect(rooster.rijen.find((r) => r.persoon.id === 'u1').minuten).toBe(360 + 480)
    expect(rooster.perDag['2026-10-03'].minuten).toBe(480)
    expect(rooster.minuten).toBe(360 + 480 + 480)
  })
})

describe('geplandTegenoverGeboekt', () => {
  it('zet naast elkaar wat de bedoeling was en wat er gebeurde', () => {
    const rooster = roosterVan({
      datum: new Date('2026-10-01T12:00:00'),
      profiles: [{ id: 'u1', fullName: 'Lotte' }],
      shifts: [shift({ date: '2026-10-01', start: '09:00', end: '17:00' })],
    })
    const uit = geplandTegenoverGeboekt({
      rooster,
      entries: [{ profileId: 'u1', durationSeconds: 9 * 3600 }],
    })
    expect(uit[0].geplandeMinuten).toBe(480)
    expect(uit[0].geboekteMinuten).toBe(540)
    expect(uit[0].verschilMinuten).toBe(60)
  })
})

describe('urenTekst', () => {
  afterEach(() => zetHuidigeTaal('nl'))

  it('schrijft uren zoals de urenregistratie dat doet', () => {
    zetHuidigeTaal('nl')
    expect(urenTekst(510)).toBe('8u30')
    expect(urenTekst(480)).toBe('8u')
    expect(urenTekst(45)).toBe('45m')
    expect(urenTekst(0)).toBe('0m')
  })

  // Het formaat blijft hetzelfde, alleen de letter achter het uur verandert:
  // "u" zegt een Engelse lezer niets.
  it('schrijft dezelfde vorm met een h in het Engels', () => {
    zetHuidigeTaal('en')
    expect(urenTekst(510)).toBe('8h30')
    expect(urenTekst(45)).toBe('45m')
  })
})
