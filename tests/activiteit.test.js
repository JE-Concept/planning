import { afterEach, describe, expect, it } from 'vitest'
import { zetHuidigeTaal } from '../src/lib/i18n'
import { beschrijf, raaktLog, verloopVan, wijzigingen } from '../src/lib/activiteit'

const NAMEN = { 'u-jasper': 'Jasper Hansen', 'u-elke': 'Elke Motmans' }
const naamVan = (uid) => NAMEN[uid] ?? null

const taak = (extra = {}) => ({
  title: 'Trouw Niels en Inez',
  statusName: 'create offer',
  open: true,
  dueDate: new Date('2026-10-04T12:00:00'),
  assignees: ['u-jasper'],
  priority: null,
  archived: false,
  ...extra,
})

describe('raaktLog', () => {
  it('herkent een wijziging die gelogd hoort te worden', () => {
    expect(raaktLog({ dueDate: new Date() })).toBe(true)
    expect(raaktLog({ statusName: 'invoiced' })).toBe(true)
  })

  // Zonder dit zou elke getypte letter in de omschrijving een extra leesbeurt
  // uit Firestore kosten voor een logregel die er toch niet komt.
  it('slaat een wijziging over die niets logbaars raakt', () => {
    expect(raaktLog({ description: 'meer tekst', updatedAt: 'nu' })).toBe(false)
    expect(raaktLog(null)).toBe(false)
  })
})

describe('wijzigingen', () => {
  it('ziet niets wanneer er niets veranderde', () => {
    expect(wijzigingen(taak(), taak())).toEqual([])
  })

  // Dit is de belangrijkste: een kaart die je oppakt en weer op dezelfde plek
  // laat vallen, of twee mensen die dezelfde knop indrukken.
  it('logt dezelfde waarde niet opnieuw', () => {
    const voor = taak()
    expect(wijzigingen(voor, { ...voor, statusName: 'create offer', position: 900 })).toEqual([])
  })

  it('leest een datum die als tekst terugkomt als dezelfde datum', () => {
    const voor = taak()
    expect(wijzigingen(voor, { ...voor, dueDate: '2026-10-04T12:00:00' })).toEqual([])
  })

  it('logt een verzette deadline', () => {
    const regels = wijzigingen(taak(), taak({ dueDate: new Date('2026-10-11T12:00:00') }))
    expect(regels).toHaveLength(1)
    expect(regels[0].veld).toBe('dueDate')
  })

  it('logt een statuswijziging als één regel', () => {
    const regels = wijzigingen(taak(), taak({ statusName: 'offer send' }))
    expect(regels).toEqual([{ veld: 'status', van: 'create offer', naar: 'offer send' }])
  })

  // Status en afvinken zijn één handeling; twee regels eronder maakt het log
  // dubbel zo lang zonder dat er iets bij staat.
  it('noemt een taak die dichtgaat afgerond, niet verzet', () => {
    const regels = wijzigingen(taak(), taak({ statusName: 'complete', open: false }))
    expect(regels).toHaveLength(1)
    expect(regels[0].veld).toBe('afgerond')
  })

  it('noemt een taak die weer opengaat heropend', () => {
    const voor = taak({ statusName: 'complete', open: false })
    const regels = wijzigingen(voor, taak({ statusName: 'planning ongoing', open: true }))
    expect(regels[0].veld).toBe('heropend')
  })

  it('logt uitvoerders die erbij komen en die eraf gaan', () => {
    const regels = wijzigingen(taak(), taak({ assignees: ['u-elke'] }))
    expect(regels).toEqual([{ veld: 'assignees', van: ['u-jasper'], naar: ['u-elke'] }])
  })

  it('logt niets als dezelfde mensen in een andere volgorde staan', () => {
    const voor = taak({ assignees: ['u-jasper', 'u-elke'] })
    expect(wijzigingen(voor, taak({ assignees: ['u-elke', 'u-jasper'] }))).toEqual([])
  })

  it('logt titel, prioriteit en archiveren', () => {
    const regels = wijzigingen(
      taak(),
      taak({ title: 'Trouw Niels & Inez', priority: 1, archived: true })
    )
    expect(regels.map((r) => r.veld).sort()).toEqual(['archived', 'priority', 'title'])
  })

  it('logt meerdere wijzigingen uit één schrijfbeurt apart', () => {
    const regels = wijzigingen(taak(), taak({ statusName: 'offer send', priority: 2 }))
    expect(regels).toHaveLength(2)
  })

  it('gaat om met een taak die er niet is', () => {
    expect(wijzigingen(null, taak())).toEqual([])
    expect(wijzigingen(taak(), null)).toEqual([])
  })
})

describe('beschrijf', () => {
  it('schrijft een statuswijziging in het Nederlands, met het label van het team', () => {
    const zin = beschrijf({ veld: 'status', van: 'create offer', naar: 'offer send' })
    expect(zin).toBe('verzette de status van Offerte maken naar Offerte verstuurd')
  })

  it('gebruikt de hernoemde kolomnaam als het team er een koos', () => {
    const statuses = [{ name: 'offer send', label: 'Bij de klant' }]
    const zin = beschrijf({ veld: 'status', van: 'create offer', naar: 'offer send' }, { statuses })
    expect(zin).toContain('Bij de klant')
  })

  it('noemt mensen bij naam', () => {
    const zin = beschrijf(
      { veld: 'assignees', van: ['u-jasper'], naar: ['u-elke'] },
      { naamVan }
    )
    expect(zin).toBe('zette Elke Motmans op de taak, en haalde Jasper Hansen van de taak')
  })

  it('valt terug op "iemand" voor een profiel dat niet meer bestaat', () => {
    expect(beschrijf({ veld: 'assignees', van: [], naar: ['u-weg'] }, { naamVan })).toContain('iemand')
  })

  it('zegt het wanneer een deadline weggehaald wordt', () => {
    const zin = beschrijf({ veld: 'dueDate', van: '2026-10-04T12:00:00', naar: null })
    expect(zin).toContain('haalde de deadline weg')
  })

  it('beschrijft afronden, heropenen, prioriteit en archiveren', () => {
    expect(beschrijf({ veld: 'afgerond', naar: 'complete' })).toContain('rondde de taak af')
    expect(beschrijf({ veld: 'heropend', naar: 'request' })).toContain('heropende de taak')
    expect(beschrijf({ veld: 'priority', naar: 1 })).toBe('zette de prioriteit op Urgent')
    expect(beschrijf({ veld: 'priority', naar: null })).toBe('haalde de prioriteit weg')
    expect(beschrijf({ veld: 'archived', naar: true })).toBe('archiveerde de taak')
    expect(beschrijf({ veld: 'archived', naar: false })).toBe('haalde de taak uit het archief')
  })

  it('valt niet om over een regel die het niet kent', () => {
    expect(beschrijf({ veld: 'onbekend' })).toBe('wijzigde de taak')
    expect(beschrijf(null)).toBe('')
  })
})

describe('beschrijf in het Engels', () => {
  afterEach(() => zetHuidigeTaal('nl'))

  // Het statuslabel, de titel en de naam van een collega komen uit de database
  // en blijven staan; alleen de zin eromheen wordt Engels.
  it('schrijft de zin in het Engels en laat de namen staan', () => {
    zetHuidigeTaal('en')
    expect(beschrijf({ veld: 'status', van: 'create offer', naar: 'offer send' })).toBe(
      'moved the status from Offerte maken to Offerte verstuurd'
    )
    expect(beschrijf({ veld: 'title', van: 'Trouw Niels', naar: 'Trouw Niels en Inez' })).toBe(
      'renamed “Trouw Niels” to “Trouw Niels en Inez”'
    )
    expect(beschrijf({ veld: 'assignees', van: ['u-jasper'], naar: ['u-elke'] }, { naamVan })).toBe(
      'put Elke Motmans on the task, and took Jasper Hansen off the task'
    )
    expect(beschrijf({ veld: 'priority', naar: 1 })).toBe('set the priority to Urgent')
    expect(beschrijf({ veld: 'archived', naar: true })).toBe('archived the task')
    expect(beschrijf({ veld: 'dueDate', van: '2026-10-04T12:00:00', naar: null })).toContain(
      'removed the deadline'
    )
    expect(beschrijf({ veld: 'onbekend' })).toBe('changed the task')
  })

  it('valt terug op "someone" voor een profiel dat niet meer bestaat', () => {
    zetHuidigeTaal('en')
    expect(beschrijf({ veld: 'assignees', van: [], naar: ['u-weg'] }, { naamVan })).toBe(
      'put someone on the task'
    )
  })
})

describe('verloopVan', () => {
  it('zet reacties en logregels door elkaar, oudste eerst', () => {
    const items = verloopVan({
      reacties: [{ id: 'c1', createdAt: new Date('2026-09-20T10:00:00') }],
      activiteit: [
        { id: 'a1', createdAt: new Date('2026-09-19T10:00:00') },
        { id: 'a2', createdAt: new Date('2026-09-21T10:00:00') },
      ],
    })
    expect(items.map((i) => i.id)).toEqual(['a-a1', 'c-c1', 'a-a2'])
  })

  // Een regel die net geschreven is, heeft nog geen tijdstip van de server.
  it('zet wat nog geen tijdstip heeft onderaan', () => {
    const items = verloopVan({
      reacties: [{ id: 'c1', createdAt: null }],
      activiteit: [{ id: 'a1', createdAt: new Date('2026-09-19T10:00:00') }],
    })
    expect(items.map((i) => i.id)).toEqual(['a-a1', 'c-c1'])
  })

  it('gaat om met niets', () => {
    expect(verloopVan()).toEqual([])
  })
})
