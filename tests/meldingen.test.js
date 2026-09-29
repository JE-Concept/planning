import { describe, expect, it } from 'vitest'
import {
  STANDAARD,
  bepaalOntvangers,
  dagSleutel,
  isTeLaat,
  perPersoon,
  teLaat,
  vervaltMorgen,
  voorkeurenVan,
  wieBijReactie,
} from '../functions/notify.js'
import {
  mailVoorDeadline,
  mailVoorReactie,
  mailVoorTeLaat,
  mailVoorToewijzing,
} from '../functions/mail.js'
import { ontbrekendeVertalingen, taalVan } from '../functions/teksten.js'

/**
 * Wie een bericht krijgt, gaat stil fout. Een bericht te veel merkt iemand
 * meteen — en zet daarna alles uit. Een bericht te weinig merkt niemand, tot
 * het werk dat erin stond niet gebeurd is.
 */

const TEAM = [
  { id: 'u-jasper', email: 'jasper@jeconcept.be', fullName: 'Jasper Hansen', role: 'owner', active: true },
  { id: 'u-elke', email: 'elke@kenjeklanten.be', fullName: 'Elke Motmans', role: 'admin', active: true },
  { id: 'u-charish', email: 'charish@gmail.com', fullName: 'Charish', role: 'member', active: true },
  // Vertrokken; haar naam staat nog op oude taken.
  { id: 'u-maxine', email: 'maxine@jeconcept.be', fullName: 'Maxine', role: 'member', active: false },
  // Zaalpersoneel: mag het takenbord niet eens openen.
  { id: 'u-lotte', email: 'lotte@barvue.be', fullName: 'Lotte', role: 'staff', active: true },
  // Iemand zonder adres — kan wel gepusht worden, niet gemaild.
  { id: 'u-stagiair', email: '', fullName: 'Stagiair', role: 'member', active: true },
]

const ids = (rijen) => rijen.map((r) => r.id)

describe('voorkeuren van één persoon', () => {
  it('geeft de standaard voor wie niets instelde', () => {
    expect(voorkeurenVan({ id: 'u-elke' })).toEqual(STANDAARD)
    expect(voorkeurenVan(null).toewijzing.push).toBe(true)
  })

  it('de ochtendmail staat standaard uit', () => {
    // Een mail die op de meeste dagen niets nieuws zegt, leert men wegklikken.
    expect(STANDAARD.telaat).toEqual({ push: false, email: false })
  })

  it('bewaart wat iemand instelde en houdt de rest op de standaard', () => {
    const profiel = { prefs: { meldingen: { telaat: { email: true } } } }
    const uit = voorkeurenVan(profiel)
    expect(uit.telaat).toEqual({ push: false, email: true })
    expect(uit.toewijzing).toEqual(STANDAARD.toewijzing)
  })

  it('negeert onzin in de database in plaats van om te vallen', () => {
    const profiel = { prefs: { meldingen: { toewijzing: { push: 'ja' }, onbekend: { push: true } } } }
    expect(voorkeurenVan(profiel).toewijzing.push).toBe(true)
    expect(voorkeurenVan(profiel).onbekend).toBeUndefined()
  })
})

describe('wie een bericht krijgt', () => {
  const bepaal = (kandidaten, extra = {}) =>
    bepaalOntvangers({ soort: 'toewijzing', kandidaten, profielen: TEAM, ...extra })

  it('stuurt naar beide kanalen van wie niets instelde', () => {
    const uit = bepaal(['u-elke'])
    expect(ids(uit.push)).toEqual(['u-elke'])
    expect(uit.email).toEqual([{ id: 'u-elke', adres: 'elke@kenjeklanten.be', taal: 'nl' }])
  })

  it('nooit naar wie het zelf deed', () => {
    expect(ids(bepaal(['u-elke', 'u-jasper'], { behalve: 'u-elke' }).push)).toEqual(['u-jasper'])
  })

  it('één bericht per persoon, ook als hij twee keer in de lijst staat', () => {
    expect(ids(bepaal(['u-elke', 'u-elke']).push)).toEqual(['u-elke'])
  })

  it('niet naar een gearchiveerd profiel', () => {
    // Maxine is vertrokken maar staat nog op oude taken.
    const uit = bepaal(['u-maxine'])
    expect(uit.push).toEqual([])
    expect(uit.email).toEqual([])
  })

  it('niet naar personeel: hun login toont het takenbord niet', () => {
    expect(bepaal(['u-lotte']).push).toEqual([])
  })

  it('niet naar iemand zonder profiel', () => {
    expect(bepaal(['u-bestaat-niet']).push).toEqual([])
  })

  it('geen mail zonder adres, maar wel een melding', () => {
    const uit = bepaal(['u-stagiair'])
    expect(ids(uit.push)).toEqual(['u-stagiair'])
    expect(uit.email).toEqual([])
  })

  it('laat het kanaal weg dat iemand uitzette', () => {
    const profielen = TEAM.map((p) =>
      p.id === 'u-elke' ? { ...p, prefs: { meldingen: { toewijzing: { email: false } } } } : p
    )
    const uit = bepaalOntvangers({ soort: 'toewijzing', kandidaten: ['u-elke'], profielen })
    expect(ids(uit.push)).toEqual(['u-elke'])
    expect(uit.email).toEqual([])
  })

  it('stuurt de ochtendmail alleen naar wie hem aanzette', () => {
    const profielen = TEAM.map((p) =>
      p.id === 'u-jasper' ? { ...p, prefs: { meldingen: { telaat: { email: true } } } } : p
    )
    const uit = bepaalOntvangers({ soort: 'telaat', kandidaten: ['u-jasper', 'u-elke'], profielen })
    expect(ids(uit.email)).toEqual(['u-jasper'])
    expect(uit.push).toEqual([])
  })
})

describe('wie een reactie moet zien', () => {
  const taak = { assignees: ['u-elke', 'u-jasper'] }

  it('de uitvoerders en wie er eerder op reageerde', () => {
    const uit = wieBijReactie({
      taak,
      eerdereReacties: [{ authorId: 'u-charish' }],
      auteur: 'u-jasper',
    })
    expect(uit).toEqual(['u-elke', 'u-charish'])
  })

  it('nooit de schrijver zelf, ook niet als hij eerder al reageerde', () => {
    const uit = wieBijReactie({
      taak,
      eerdereReacties: [{ authorId: 'u-elke' }, { authorId: 'u-elke' }],
      auteur: 'u-elke',
    })
    expect(uit).toEqual(['u-jasper'])
  })

  it('iemand die twee keer reageerde krijgt één bericht', () => {
    const uit = wieBijReactie({
      taak: { assignees: [] },
      eerdereReacties: [{ authorId: 'u-charish' }, { authorId: 'u-charish' }],
      auteur: 'u-jasper',
    })
    expect(uit).toEqual(['u-charish'])
  })

  it('valt niet om op een taak zonder uitvoerders of reacties', () => {
    expect(wieBijReactie({ taak: null, eerdereReacties: null, auteur: null })).toEqual([])
  })
})

describe('deadlines', () => {
  // Woensdag 30 september 2026, half acht 's ochtends in Brussel.
  const NU = new Date('2026-09-30T05:30:00Z')
  const opDag = (dag) => new Date(`${dag}T12:00:00`)

  it('rekent de dag in Brussel, niet in UTC', () => {
    // 1 oktober om 00u30 in Brussel is 30 september in UTC.
    expect(dagSleutel(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01')
  })

  it('vindt wat morgen vervalt en laat vandaag en overmorgen staan', () => {
    const taken = [
      { id: 'a', title: 'Morgen', dueDate: opDag('2026-10-01') },
      { id: 'b', title: 'Vandaag', dueDate: opDag('2026-09-30') },
      { id: 'c', title: 'Overmorgen', dueDate: opDag('2026-10-02') },
      { id: 'd', title: 'Geen datum', dueDate: null },
    ]
    expect(vervaltMorgen(taken, NU).map((t) => t.id)).toEqual(['a'])
  })

  it('zwijgt over een taak die morgen vervalt maar al af is', () => {
    const taken = [
      { id: 'a', title: 'Af', dueDate: opDag('2026-10-01'), statusName: 'closed' },
      { id: 'b', title: 'Gearchiveerd', dueDate: opDag('2026-10-01'), archived: true },
    ]
    expect(vervaltMorgen(taken, NU)).toEqual([])
  })

  it('een event dat alleen nog gefactureerd moet worden, staat niet te laat', () => {
    // Het feest is geweest; "31 dagen te laat" in het rood maakt de kleur waardeloos.
    const event = { id: 'e', dueDate: opDag('2026-08-30'), statusName: 'ready to invoice' }
    expect(isTeLaat(event, NU)).toBe(false)
  })

  it('haalt de te late taken eruit', () => {
    const taken = [
      { id: 'a', dueDate: opDag('2026-09-20') },
      { id: 'b', dueDate: opDag('2026-10-05') },
      { id: 'c', dueDate: opDag('2026-09-01'), open: false },
    ]
    expect(teLaat(taken, NU).map((t) => t.id)).toEqual(['a'])
  })
})

describe('één bericht per persoon', () => {
  it('groepeert per uitvoerder, oudste deadline eerst', () => {
    const taken = [
      { id: 'a', dueDate: new Date('2026-09-20T12:00:00'), assignees: ['u-elke'] },
      { id: 'b', dueDate: new Date('2026-09-10T12:00:00'), assignees: ['u-elke', 'u-jasper'] },
    ]
    const uit = perPersoon(taken)
    expect(uit.get('u-elke').map((t) => t.id)).toEqual(['b', 'a'])
    expect(uit.get('u-jasper').map((t) => t.id)).toEqual(['b'])
  })

  it('laat taken zonder uitvoerder weg — er is niemand om ze aan te sturen', () => {
    expect(perPersoon([{ id: 'a', assignees: [] }]).size).toBe(0)
  })
})

describe('de teksten', () => {
  const link = 'https://planning.jeconcept.be/#/tasks'
  const NU = new Date('2026-09-30T05:30:00Z')

  it('een toewijzing noemt de taak en de klant', () => {
    const mail = mailVoorToewijzing({
      taak: { title: 'Drankenlijst finaliseren', customerName: 'Blum België' },
      link,
    })
    expect(mail.onderwerp).toBe('Nieuwe taak voor jou: Drankenlijst finaliseren')
    expect(mail.tekst).toContain('Blum België')
    expect(mail.tekst).toContain(link)
  })

  it('een reactie zet de tekst van de reactie in de mail', () => {
    const mail = mailVoorReactie({
      taak: { title: 'Offerte Blum' },
      reactie: { authorName: 'Elke Motmans', body: 'De klant gaat naar 220 personen.' },
      link,
    })
    expect(mail.onderwerp).toBe('Elke Motmans reageerde op Offerte Blum')
    expect(mail.tekst).toContain('220 personen')
  })

  it('de deadlinemail telt de taken', () => {
    const mail = mailVoorDeadline({
      taken: [{ title: 'Een' }, { title: 'Twee' }],
      link,
      nu: NU,
    })
    expect(mail.onderwerp).toBe('Morgen vervallen 2 taken')
    expect(mail.tekst).toContain('• Een')
  })

  it('de ochtendmail zegt hoeveel dagen iets te laat is', () => {
    const mail = mailVoorTeLaat({
      taken: [{ title: 'Standenplan naar de stad', dueDate: new Date('2026-09-27T12:00:00') }],
      link,
      nu: NU,
    })
    expect(mail.onderwerp).toBe('1 taak staat te laat')
    expect(mail.tekst).toContain('3 dagen te laat')
  })

  it('en er gaat geen ochtendmail wanneer er niets te laat staat', () => {
    // Anders leert men de mail wegklikken, en dan gaat ook de echte mee weg.
    expect(mailVoorTeLaat({ taken: [], link, nu: NU })).toBeNull()
  })
})

describe('in welke taal de server schrijft', () => {
  const link = 'https://planning.jeconcept.be/#/tasks'
  const NU = new Date('2026-09-30T05:30:00Z')

  it('kent elke Nederlandse tekst ook in het Engels', () => {
    expect(ontbrekendeVertalingen('en')).toEqual([])
  })

  // Wie de tool op Engels zet en 's ochtends een Nederlandse mail krijgt over
  // zijn te-laat-lijst, heeft geen Engelse tool.
  it('zet de taal van de ontvanger bij de ontvangers', () => {
    const profielen = TEAM.map((p) => (p.id === 'u-elke' ? { ...p, prefs: { taal: 'en' } } : p))
    const uit = bepaalOntvangers({ soort: 'toewijzing', kandidaten: ['u-elke', 'u-jasper'], profielen })
    expect(uit.push).toEqual([
      { id: 'u-elke', taal: 'en' },
      { id: 'u-jasper', taal: 'nl' },
    ])
    expect(uit.email.map((r) => r.taal)).toEqual(['en', 'nl'])
  })

  it('valt terug op het Nederlands bij een taal die niet bestaat', () => {
    expect(taalVan({ prefs: { taal: 'de' } })).toBe('nl')
    expect(taalVan(null)).toBe('nl')
  })

  it('schrijft een toewijzing in het Engels', () => {
    const mail = mailVoorToewijzing({
      taak: { title: 'Drink list', customerName: 'Blum België' },
      link,
      taal: 'en',
    })
    expect(mail.onderwerp).toBe('A new task for you: Drink list')
    expect(mail.tekst).toContain('Customer: Blum België')
    expect(mail.tekst).toContain('Open: ')
  })

  it('telt de dagen te laat in het Engels', () => {
    const mail = mailVoorTeLaat({
      taken: [{ title: 'Floor plan', dueDate: new Date('2026-09-27T12:00:00') }],
      link,
      nu: NU,
      taal: 'en',
    })
    expect(mail.onderwerp).toBe('1 task is overdue')
    expect(mail.tekst).toContain('3 days overdue')
  })

  it('schrijft Nederlands wanneer er geen taal meegegeven is', () => {
    // Een aanroep die dit vergeet, hoort een leesbare mail te maken en niet geen.
    expect(mailVoorDeadline({ taken: [{ title: 'Een' }], link, nu: NU }).onderwerp).toBe('Morgen: Een')
  })
})

