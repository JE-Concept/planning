import { describe, expect, it } from 'vitest'
import {
  aantalDagen,
  beginVan,
  dagenVan,
  eindeVan,
  isMeerdaags,
  raaktPeriode,
  valtOpDag,
  zetEinddatum,
  zetMeerdaags,
} from '../src/lib/eventdagen'

const dag = (tekst) => new Date(`${tekst}T12:00:00`)

describe('een event van één dag', () => {
  it('begint en eindigt op dezelfde dag', () => {
    const ev = { eventDate: dag('2026-10-12') }
    expect(beginVan(ev)).toEqual(dag('2026-10-12'))
    expect(eindeVan(ev)).toEqual(dag('2026-10-12'))
    expect(isMeerdaags(ev)).toBe(false)
    expect(dagenVan(ev)).toEqual(['2026-10-12'])
  })

  it('valt alleen op die ene dag', () => {
    const ev = { eventDate: dag('2026-10-12') }
    expect(valtOpDag(ev, '2026-10-12')).toBe(true)
    expect(valtOpDag(ev, '2026-10-13')).toBe(false)
    expect(valtOpDag(ev, '2026-10-11')).toBe(false)
  })

  it('zonder datum beslaat het niets', () => {
    expect(dagenVan({})).toEqual([])
    expect(aantalDagen({})).toBe(0)
    expect(valtOpDag({}, '2026-10-12')).toBe(false)
    expect(isMeerdaags({})).toBe(false)
  })
})

describe('een meerdaags event', () => {
  const ev = { eventDate: dag('2026-10-12'), eventEndDate: dag('2026-10-14') }

  it('beslaat elke dag ertussen, grenzen inbegrepen', () => {
    expect(dagenVan(ev)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
    expect(aantalDagen(ev)).toBe(3)
    expect(isMeerdaags(ev)).toBe(true)
  })

  it('valt op elke dag van de reeks en niet daarbuiten', () => {
    for (const d of ['2026-10-12', '2026-10-13', '2026-10-14']) {
      expect(valtOpDag(ev, d)).toBe(true)
    }
    expect(valtOpDag(ev, '2026-10-11')).toBe(false)
    expect(valtOpDag(ev, '2026-10-15')).toBe(false)
  })

  /*
    De zomeruurwissel. 25 oktober 2026 duurt 25 uur; een lus die per 24 uur
    optelt, slaat die dag over of telt hem dubbel. Vandaar dat `dagenVan` met
    kalenderdagen rekent en niet met milliseconden.
  */
  it('telt over de zomeruurwissel heen elke dag precies één keer', () => {
    const over = { eventDate: dag('2026-10-24'), eventEndDate: dag('2026-10-26') }
    expect(dagenVan(over)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
  })

  it('telt over een maand- en jaargrens heen', () => {
    const oud = { eventDate: dag('2026-12-30'), eventEndDate: dag('2027-01-02') }
    expect(dagenVan(oud)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })
})

describe('een einddatum die niet kan', () => {
  it('voor de begindag telt niet mee', () => {
    const ev = { eventDate: dag('2026-10-12'), eventEndDate: dag('2026-10-10') }
    expect(eindeVan(ev)).toEqual(dag('2026-10-12'))
    expect(isMeerdaags(ev)).toBe(false)
    expect(dagenVan(ev)).toEqual(['2026-10-12'])
  })

  /*
    Een tikfout in het jaartal mag geen kalender van dertien jaar tekenen. De
    bovengrens is er om het tabblad te redden, niet om de gegevens te keuren.
  */
  it('loopt niet eindeloos door bij een tikfout in het jaartal', () => {
    const ev = { eventDate: dag('2026-10-12'), eventEndDate: dag('2062-10-12') }
    expect(dagenVan(ev).length).toBe(400)
  })
})

describe('raaktPeriode', () => {
  const ev = { eventDate: dag('2026-10-12'), eventEndDate: dag('2026-10-14') }

  it('ziet een event dat de periode binnenloopt', () => {
    expect(raaktPeriode(ev, '2026-10-14', '2026-10-20')).toBe(true)
    expect(raaktPeriode(ev, '2026-10-01', '2026-10-12')).toBe(true)
    expect(raaktPeriode(ev, '2026-10-13', '2026-10-13')).toBe(true)
  })

  it('en laat er een liggen die er net buiten valt', () => {
    expect(raaktPeriode(ev, '2026-10-15', '2026-10-20')).toBe(false)
    expect(raaktPeriode(ev, '2026-10-01', '2026-10-11')).toBe(false)
  })
})

describe('de patches', () => {
  it('meerdaags aanzetten geeft de dag erna, niet dezelfde dag', () => {
    const ev = { eventDate: dag('2026-10-12') }
    expect(zetMeerdaags(ev, true)).toEqual({ eventEndDate: dag('2026-10-13') })
  })

  it('meerdaags uitzetten wist de einddatum', () => {
    const ev = { eventDate: dag('2026-10-12'), eventEndDate: dag('2026-10-14') }
    expect(zetMeerdaags(ev, false)).toEqual({ eventEndDate: null })
  })

  it('zonder begindag valt er niets aan te zetten', () => {
    expect(zetMeerdaags({}, true)).toEqual({ eventEndDate: null })
  })

  it('een einddatum voor de begindag schuift op naar de begindag', () => {
    const ev = { eventDate: dag('2026-10-12') }
    expect(zetEinddatum(ev, dag('2026-10-09'))).toEqual({ eventEndDate: dag('2026-10-12') })
  })

  it('een lege einddatum maakt het event weer eendaags', () => {
    const ev = { eventDate: dag('2026-10-12'), eventEndDate: dag('2026-10-14') }
    expect(zetEinddatum(ev, null)).toEqual({ eventEndDate: null })
  })
})
