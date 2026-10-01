import { describe, expect, it } from 'vitest'
import { eventOndertitel, eventTijd } from '../src/components/events/parts'

/*
  De tijden staan met hun Brusselse offset erbij.

  De app toont elke tijd in `Europe/Brussels` — dat is waar de events zijn —
  en deze test draait op een machine in UTC. Zonder offset zou "12:00" hier
  14:00 worden en zou de test iets anders nakijken dan wat het team ziet.
  Oktober 2026 is zomertijd, dus +02:00.
*/
const metDatum = (tijd, extra = {}) => ({ eventDate: new Date(`2026-10-10T${tijd}+02:00`), ...extra })

describe('de tijd op een eventkaart', () => {
  // Een event dat in de tool aangemaakt wordt, krijgt twaalf uur 's middags.
  // Dat is een plaatshouder en geen aanvangsuur.
  it('toont twaalf uur niet: dat is de plaatshouder', () => {
    expect(eventTijd(metDatum('12:00:00'))).toBe(null)
  })

  // "Het feest begint om 00:00" is wat een kaart anders zou zeggen.
  it('toont middernacht evenmin', () => {
    expect(eventTijd(metDatum('00:00:00'))).toBe(null)
  })

  it('toont een uur dat iemand echt gezet heeft', () => {
    expect(eventTijd(metDatum('18:30:00'))).toBe('18:30')
  })

  // `startDate` is het veld waar een aanvangsuur in hoort; dat gaat voor.
  it('neemt het aanvangsuur boven de datum', () => {
    const uit = eventTijd({
      startDate: new Date('2026-10-10T16:00:00+02:00'),
      eventDate: new Date('2026-10-10T12:00:00+02:00'),
    })
    expect(uit).toBe('16:00')
  })

  it('valt niet om zonder datum', () => {
    expect(eventTijd({})).toBe(null)
    expect(eventTijd(null)).toBe(null)
  })
})

describe('de ondertitel van een eventkaart', () => {
  // Dit is waar het om begonnen was: "Los event" stond op de helft van alle
  // kaarten, en dat is de afwezigheid van een merk — geen eigenschap van het
  // feest.
  it('zegt niets over een ontbrekend concept', () => {
    const uit = eventOndertitel(metDatum('12:00:00'))
    expect(uit).not.toMatch(/los/i)
    expect(uit).toBe('za 10 okt')
  })

  it('zet het concept erbij wanneer er een is', () => {
    const uit = eventOndertitel(metDatum('12:00:00', { concept: 'Meer — Het Vinne' }))
    expect(uit).toBe('za 10 okt · Meer')
  })

  it('zet de tijd tussen de datum en het concept', () => {
    const uit = eventOndertitel(metDatum('18:30:00', { concept: 'Bar Vue' }))
    expect(uit).toBe('za 10 okt · 18:30 · Bar Vue')
  })

  it('blijft leeg wanneer er nog geen datum is', () => {
    expect(eventOndertitel({})).toBe('')
  })
})
