import { describe, expect, it } from 'vitest'
import {
  STANDAARD_TERMIJN,
  beginstatus,
  kiesTakenlijst,
  standaardDeadline,
  taakUitAgendapunt,
} from '../src/lib/agenda-taak'
import { groepeerActies, past, plat, verslagTekst, zoekVerslagen } from '../src/lib/verslag-zoek'

/**
 * Twee dingen die een overleg pas nuttig maken: wat afgesproken werd komt als
 * taak op iemands naam, en wat besproken werd is een half jaar later nog terug
 * te vinden.
 */

const EVENTS = {
  id: 'l-overview',
  name: 'Events',
  kind: 'tasks',
  statuses: [
    { id: 's1', name: 'request', kind: 'open', position: 0 },
    { id: 's2', name: 'ready to invoice', kind: 'active', position: 1 },
    { id: 's3', name: 'invoiced', kind: 'active', position: 2 },
  ],
}
const TAKEN = {
  id: 'l-overleg',
  name: 'Tasks',
  kind: 'tasks',
  statuses: [
    { id: 'o2', name: 'on going', kind: 'active', position: 1 },
    { id: 'o1', name: 'open', kind: 'open', position: 0 },
    { id: 'o3', name: 'closed', kind: 'closed', position: 2 },
  ],
}
const SOCIALS = { id: 'l-socials', name: 'Socials', kind: 'social', statuses: [] }

describe('op welk bord een actiepunt terechtkomt', () => {
  it('op de takenlijst, niet op de eventpijplijn', () => {
    // "Prijzen verhuurmateriaal herzien" is geen dossier van aanvraag tot factuur.
    expect(kiesTakenlijst([EVENTS, SOCIALS, TAKEN])?.id).toBe('l-overleg')
  })

  it('nooit op een socialbord', () => {
    expect(kiesTakenlijst([SOCIALS])).toBeNull()
  })

  it('laat gearchiveerde lijsten links liggen', () => {
    expect(kiesTakenlijst([{ ...TAKEN, archived: true }, EVENTS])?.id).toBe('l-overview')
  })

  it('geeft niets terug wanneer er nog geen lijst is', () => {
    expect(kiesTakenlijst([])).toBeNull()
    expect(kiesTakenlijst(null)).toBeNull()
  })
})

describe('in welke kolom een actiepunt begint', () => {
  it('in de eerste kolom die open betekent, ongeacht de volgorde in de database', () => {
    expect(beginstatus(TAKEN).name).toBe('open')
  })

  it('valt terug op de eerste kolom als er geen open kolom is', () => {
    const zonder = { statuses: [{ id: 'x', name: 'doing', kind: 'active', position: 0 }] }
    expect(beginstatus(zonder).name).toBe('doing')
  })

  it('geeft niets terug op een bord zonder kolommen', () => {
    expect(beginstatus({ statuses: [] })).toBeNull()
    expect(beginstatus(null)).toBeNull()
  })
})

describe('van agendapunt naar taak', () => {
  const PUNT = {
    id: 'a1',
    titel: 'Prijzen verhuurmateriaal herzien',
    omschrijving: 'De tarieven staan sinds 2024 stil.',
    ownerId: 'u-jasper',
  }

  it('neemt titel, omschrijving, eigenaar en deadline mee', () => {
    const taak = taakUitAgendapunt({
      item: PUNT,
      lijst: TAKEN,
      status: beginstatus(TAKEN),
      eigenaar: 'u-elke',
      deadline: '2026-10-07',
    })

    expect(taak.title).toBe('Prijzen verhuurmateriaal herzien')
    expect(taak.assignees).toEqual(['u-elke'])
    expect(taak.description).toContain('De tarieven staan sinds 2024 stil.')
    expect(taak.agendaItemId).toBe('a1')
    expect(taak.status.name).toBe('open')
  })

  it('bewaart de deadline als het midden van die dag', () => {
    // Middernacht in UTC is hier de dag ervoor; dat verzet een deadline stil.
    const taak = taakUitAgendapunt({
      item: PUNT,
      lijst: TAKEN,
      status: beginstatus(TAKEN),
      deadline: '2026-10-07',
    })
    expect(taak.dueDate.getFullYear()).toBe(2026)
    expect(taak.dueDate.getMonth()).toBe(9)
    expect(taak.dueDate.getDate()).toBe(7)
    expect(taak.dueDate.getHours()).toBe(12)
  })

  it('mag zonder eigenaar en zonder deadline', () => {
    const taak = taakUitAgendapunt({ item: PUNT, lijst: TAKEN, status: null, deadline: '' })
    expect(taak.assignees).toEqual([])
    expect(taak.dueDate).toBeNull()
  })

  it('een aangepaste titel wint van die van het punt', () => {
    const taak = taakUitAgendapunt({
      item: PUNT,
      lijst: TAKEN,
      status: null,
      titel: 'Tarieven +8% vanaf november',
    })
    expect(taak.title).toBe('Tarieven +8% vanaf november')
  })

  it('maakt geen taak zonder titel of zonder bord', () => {
    expect(taakUitAgendapunt({ item: { ...PUNT, titel: '  ' }, lijst: TAKEN, status: null })).toBeNull()
    expect(taakUitAgendapunt({ item: PUNT, lijst: null, status: null })).toBeNull()
  })

  it('stelt een deadline op het volgende overleg voor', () => {
    const nu = new Date('2026-09-30T09:00:00')
    expect(standaardDeadline(nu)).toBe('2026-10-07')
    expect(STANDAARD_TERMIJN).toBe(7)
  })
})

// ── De verslagen doorzoekbaar ───────────────────────────────────────────────

const VERSLAG = {
  id: 't-overleg-1',
  taskId: 't-overleg-1',
  titel: 'Weekstart events',
  datum: '2026-09-21',
  deelnemers: ['Jasper Hansen', 'Aïcha Van Roy'],
  samenvatting: [
    { onderwerp: 'Trouw Niels en Inez', tekst: 'De drankenlijst moet nog afgewerkt worden.' },
    { onderwerp: 'Blum personeelsfeest', tekst: 'De klant verhoogde naar 220 personen.' },
  ],
}
const TWEEDE = {
  id: 't-overleg-2',
  taskId: 't-overleg-2',
  titel: 'Weekstart events',
  datum: '2026-09-14',
  deelnemers: ['Elke Motmans'],
  samenvatting: [{ onderwerp: 'Kerstmenu', tekst: 'De kaart gaat naar de drukker.' }],
}
const ACTIES = [
  { id: 't1', meetingId: 't-overleg-2', title: 'Offerte Vandenberghe vergelijken', description: '' },
  { id: 't2', meetingId: 't-overleg-1', title: 'Standenplan naar de stad sturen', description: '' },
  { id: 't3', meetingId: null, title: 'Losse taak', description: '' },
]

describe('zoeken in de verslagen', () => {
  const zoek = (term) =>
    zoekVerslagen({
      verslagen: [VERSLAG, TWEEDE],
      actiesPerVerslag: groepeerActies(ACTIES),
      term,
    })

  it('vindt een woord uit de samenvatting', () => {
    expect(zoek('drankenlijst').map((v) => v.id)).toEqual(['t-overleg-1'])
  })

  it('vindt ook een woord dat alleen in een actiepunt staat', () => {
    // Dit is het halve punt van de zoekfunctie: wat afgesproken werd staat vaak
    // alleen in het actiepunt, niet in de samenvatting erboven.
    expect(zoek('vandenberghe').map((v) => v.id)).toEqual(['t-overleg-2'])
  })

  it('trekt zich niets aan van hoofdletters of accenten', () => {
    expect(zoek('AICHA').map((v) => v.id)).toEqual(['t-overleg-1'])
    expect(plat('Aïcha Van Roy')).toBe('aicha van roy')
  })

  it('alle woorden moeten voorkomen, in welke volgorde dan ook', () => {
    expect(zoek('blum personen').map((v) => v.id)).toEqual(['t-overleg-1'])
    expect(zoek('blum kerstmenu')).toEqual([])
  })

  it('een lege zoekterm geeft alles terug', () => {
    expect(zoek('   ').map((v) => v.id)).toEqual(['t-overleg-1', 't-overleg-2'])
    expect(zoek('').every((v) => v.treffers.length === 0)).toBe(true)
  })

  it('zegt erbij waarom een verslag in de lijst staat', () => {
    const [gevonden] = zoek('standenplan')
    expect(gevonden.treffers).toEqual([
      { soort: 'actiepunt', tekst: 'Standenplan naar de stad sturen', detail: '' },
    ])
  })

  it('telt een actiepunt van een ander overleg niet mee', () => {
    expect(past(VERSLAG, [], 'vandenberghe')).toBe(false)
  })

  it('zet alles van één verslag in dezelfde hooiberg', () => {
    const tekst = verslagTekst(VERSLAG, groepeerActies(ACTIES)['t-overleg-1'])
    expect(tekst).toContain('standenplan')
    expect(tekst).toContain('jasper hansen')
    expect(tekst).toContain('2026-09-21')
  })

  it('groepeert alleen taken die uit een overleg komen', () => {
    expect(Object.keys(groepeerActies(ACTIES)).sort()).toEqual(['t-overleg-1', 't-overleg-2'])
  })
})
