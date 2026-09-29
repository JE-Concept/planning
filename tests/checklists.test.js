import { afterEach, describe, expect, it } from 'vitest'
import { zetHuidigeTaal } from '../src/lib/i18n'
import { zetLocale } from '../src/lib/dates'
import {
  CHECKLIST_TEMPLATES,
  CLOSING,
  FAVV,
  OPENING,
  POETSPLAN,
  afdelingLabel,
  dueOn,
  grensTekst,
  isWeekend,
  meetOordeel,
  repeatLabel,
  requiredItems,
  runId,
  runProgress,
  visibleTo,
} from '../src/lib/checklist-templates.js'

const MAANDAG = new Date('2026-09-28T12:00:00')
const ZATERDAG = new Date('2026-09-26T12:00:00')
const EERSTE = new Date('2026-10-01T12:00:00')
const BAAS = { role: 'owner' }

describe('de lijsten zelf', () => {
  it('heeft openen, sluiten, de FAVV-registraties en het poetsplan', () => {
    expect(CHECKLIST_TEMPLATES.map((c) => c.id)).toEqual(['openen', 'sluiten', 'favv', 'poetsplan'])
    expect(OPENING.kind).toBe('open')
    expect(CLOSING.kind).toBe('close')
    expect(FAVV.kind).toBe('register')
    expect(POETSPLAN.kind).toBe('register')
  })

  it('zegt bij elk punt wie het ziet', () => {
    const geldig = ['iedereen', 'verantwoordelijke', 'keuken', 'zaal']
    for (const t of CHECKLIST_TEMPLATES) {
      for (const item of t.sections.flatMap((s) => s.items)) {
        expect(geldig).toContain(item.who ?? 'iedereen')
      }
    }
  })

  it('geeft elk punt een eigen id — de afvinkingen hangen eraan', () => {
    for (const template of CHECKLIST_TEMPLATES) {
      const ids = template.sections.flatMap((s) => s.items).map((i) => i.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.every(Boolean)).toBe(true)
    }
  })

  it('houdt de toegangscodes achter de secret-vlag', () => {
    const all = CHECKLIST_TEMPLATES.flatMap((t) => t.sections.flatMap((s) => s.items))
    const metCode = all.filter((i) => /\b\d{4}\b/.test(`${i.label} ${i.hint ?? ''}`))
    expect(metCode.length).toBeGreaterThan(0)
    for (const item of metCode) expect(item.secret).toBe(true)
    // En nooit in het label zelf: dat staat altijd op het scherm.
    for (const item of all) expect(item.label).not.toMatch(/\b\d{4}\b/)
  })
})

describe('wanneer een punt valt', () => {
  it('herkent zaterdag en zondag', () => {
    expect(isWeekend(ZATERDAG)).toBe(true)
    expect(isWeekend(MAANDAG)).toBe(false)
  })

  it('laat een punt zonder herhaling elke dag gelden', () => {
    expect(dueOn({ id: 'x' }, MAANDAG)).toBe(true)
    expect(dueOn({ id: 'x', repeat: { kind: 'dagelijks' } }, ZATERDAG)).toBe(true)
  })

  it('leest weekendOnly uit oudere lijsten als een weekendherhaling', () => {
    const oud = { id: 'x', weekendOnly: true }
    expect(dueOn(oud, ZATERDAG)).toBe(true)
    expect(dueOn(oud, MAANDAG)).toBe(false)
  })

  it('legt wekelijks op één dag', () => {
    const item = { id: 'x', repeat: { kind: 'wekelijks', days: [1] } }
    expect(dueOn(item, MAANDAG)).toBe(true)
    expect(dueOn(item, ZATERDAG)).toBe(false)
  })

  it('legt maandelijks op een dag van de maand', () => {
    const item = { id: 'x', repeat: { kind: 'maandelijks', dayOfMonth: 1 } }
    expect(dueOn(item, EERSTE)).toBe(true)
    expect(dueOn(item, MAANDAG)).toBe(false)
  })

  it('schuift een maanddag die niet bestaat naar de laatste dag', () => {
    // De 31e in februari zou elf maanden per jaar overgeslagen worden.
    const item = { id: 'x', repeat: { kind: 'maandelijks', dayOfMonth: 31 } }
    expect(dueOn(item, new Date('2026-02-28T12:00:00'))).toBe(true)
    expect(dueOn(item, new Date('2026-02-27T12:00:00'))).toBe(false)
    expect(dueOn(item, new Date('2026-03-31T12:00:00'))).toBe(true)
  })

  it('legt een kwartaalpunt op januari, april, juli en oktober', () => {
    const item = { id: 'x', repeat: { kind: 'kwartaal', dayOfMonth: 1 } }
    expect(dueOn(item, EERSTE)).toBe(true)
    expect(dueOn(item, new Date('2026-11-01T12:00:00'))).toBe(false)
  })

  it('maakt de lijst in het weekend langer dan doordeweeks', () => {
    const week = requiredItems(CLOSING, { date: MAANDAG, person: BAAS }).length
    const weekend = requiredItems(CLOSING, { date: ZATERDAG, person: BAAS }).length
    expect(weekend).toBeGreaterThan(week)
  })

  it('beschrijft elke herhaling in gewone taal', () => {
    expect(repeatLabel({ repeat: { kind: 'weekdag', days: [0, 6] } })).toBe('weekend')
    expect(repeatLabel({ repeat: { kind: 'wekelijks', days: [1] } })).toBe('elke maandag')
    expect(repeatLabel({ repeat: { kind: 'maandelijks', dayOfMonth: 1 } })).toBe('de 1e van de maand')
    expect(repeatLabel({})).toBe('elke dag')
  })
})

describe('wie ziet wat', () => {
  const item = (who) => ({ id: 'x', who })

  it('toont wat voor iedereen is aan iedereen', () => {
    expect(visibleTo(item('iedereen'), { department: 'zaal' })).toBe(true)
    expect(visibleTo({ id: 'x' }, { department: 'keuken' })).toBe(true)
  })

  it('houdt een keukentaak weg bij de zaal', () => {
    expect(visibleTo(item('keuken'), { department: 'zaal' })).toBe(false)
    expect(visibleTo(item('keuken'), { department: 'keuken' })).toBe(true)
  })

  it('laat de verantwoordelijke alles zien', () => {
    expect(visibleTo(item('keuken'), { department: 'verantwoordelijke' })).toBe(true)
    expect(visibleTo(item('zaal'), { department: 'verantwoordelijke' })).toBe(true)
  })

  it('laat beheerders alles zien, want zij beheren de lijsten', () => {
    expect(visibleTo(item('keuken'), { role: 'owner' })).toBe(true)
    expect(visibleTo(item('zaal'), { role: 'admin' })).toBe(true)
  })

  it('geeft wie geen afdeling heeft alleen wat voor iedereen is', () => {
    expect(visibleTo(item('keuken'), { department: null })).toBe(false)
    expect(visibleTo(item('iedereen'), { department: null })).toBe(true)
  })

  it('maakt de lijst korter voor wie maar één afdeling doet', () => {
    const alles = requiredItems(OPENING, { date: MAANDAG, person: BAAS }).length
    const keuken = requiredItems(OPENING, { date: MAANDAG, person: { department: 'keuken' } }).length
    expect(keuken).toBeLessThan(alles)
    expect(keuken).toBeGreaterThan(0)
  })
})

describe('runProgress', () => {
  const run = (ids) => ({ items: Object.fromEntries(ids.map((id) => [id, { done: true }])) })

  it('is nul zonder run', () => {
    const p = runProgress(OPENING, undefined, { date: MAANDAG, person: BAAS })
    expect(p.done).toBe(0)
    expect(p.ratio).toBe(0)
    expect(p.total).toBeGreaterThan(0)
  })

  it('telt alleen de punten die vandaag gelden', () => {
    // Een weekendpunt afvinken op een weekdag telt niet mee in de noemer,
    // anders staat de lijst nooit op 100%.
    const p = runProgress(OPENING, run(['toiletten-open']), { date: MAANDAG, person: BAAS })
    expect(p.done).toBe(0)
    expect(p.total).toBe(requiredItems(OPENING, { date: MAANDAG, person: BAAS }).length)
  })

  it('komt op 1 als alles wat geldt afgevinkt is', () => {
    const ids = requiredItems(OPENING, { date: MAANDAG, person: BAAS }).map((i) => i.id)
    const p = runProgress(OPENING, run(ids), { date: MAANDAG, person: BAAS })
    expect(p.done).toBe(p.total)
    expect(p.ratio).toBe(1)
  })

  it('negeert een uitgevinkt punt', () => {
    const p = runProgress(OPENING, { items: { sleutel: { done: false } } }, { date: MAANDAG, person: BAAS })
    expect(p.done).toBe(0)
  })
})

describe('runId', () => {
  it('is dezelfde voor iedereen op dezelfde dag — daarom kan je samen afvinken', () => {
    expect(runId('openen', '2026-09-28')).toBe('openen_2026-09-28')
    expect(runId('openen', '2026-09-28')).toBe(runId('openen', '2026-09-28'))
  })

  it('scheidt lijsten en dagen', () => {
    expect(runId('openen', '2026-09-28')).not.toBe(runId('sluiten', '2026-09-28'))
    expect(runId('openen', '2026-09-28')).not.toBe(runId('openen', '2026-09-29'))
  })
})

// De demobuild draait op een eigen in-memory Firestore. Als die ondiep zou
// mergen, zou wie afvinkt de vinkjes van zijn collega's wissen — precies wat
// deze lijst níét mag doen. Dit pint het gedrag vast op wat Firestore doet.
describe('samen afvinken in dezelfde run', () => {
  it('houdt de vinkjes van een ander bij een merge', async () => {
    const { doc, setDoc, getDoc, arrayUnion } = await import('../demo/firestore.js')
    const ref = doc(null, 'checklistRuns', 'openen_2026-09-28')

    await setDoc(ref, { day: '2026-09-28', items: { sleutel: { done: true, byName: 'Charish' } }, participants: arrayUnion('u-charish') }, { merge: true })
    await setDoc(ref, { items: { alarm: { done: true, byName: 'Elke' } }, participants: arrayUnion('u-elke') }, { merge: true })

    const data = (await getDoc(ref)).data()
    expect(data.items.sleutel.byName).toBe('Charish')
    expect(data.items.alarm.byName).toBe('Elke')
    expect(data.participants.sort()).toEqual(['u-charish', 'u-elke'])
  })

  it('laat een uitvinking het punt van de ander ongemoeid', async () => {
    const { doc, setDoc, getDoc } = await import('../demo/firestore.js')
    const ref = doc(null, 'checklistRuns', 'sluiten_2026-09-28')

    await setDoc(ref, { items: { tap_dicht: { done: true, byName: 'Elke' }, glazen: { done: true, byName: 'Charish' } } }, { merge: true })
    await setDoc(ref, { items: { glazen: { done: false, byName: null } } }, { merge: true })

    const data = (await getDoc(ref)).data()
    expect(data.items.tap_dicht.done).toBe(true)
    expect(data.items.glazen.done).toBe(false)
  })
})

describe('meetOordeel', () => {
  const koelkast = { kind: 'getal', label: 'Temperatuur', eenheid: '°C', max: 7 }
  const diepvries = { kind: 'getal', label: 'Temperatuur', eenheid: '°C', max: -18 }
  const kern = { kind: 'getal', label: 'Kerntemperatuur', eenheid: '°C', min: 75 }

  it('keurt goed wat binnen de grens ligt', () => {
    expect(meetOordeel(koelkast, 4).staat).toBe('ok')
    expect(meetOordeel(koelkast, 7).staat).toBe('ok')
  })

  // Het punt van de hele oefening: een vinkje zegt dat er gekeken is, niet dat
  // het koud genoeg was.
  it('keurt af wat erboven ligt', () => {
    const uit = meetOordeel(koelkast, 9)
    expect(uit.staat).toBe('buiten')
    expect(uit.richting).toBe('boven')
    expect(uit.grens).toBe(7)
  })

  it('rekent met negatieve grenzen zoals een diepvries die heeft', () => {
    expect(meetOordeel(diepvries, -20).staat).toBe('ok')
    expect(meetOordeel(diepvries, -15).staat).toBe('buiten')
  })

  it('keurt af wat eronder ligt', () => {
    const uit = meetOordeel(kern, 68)
    expect(uit.staat).toBe('buiten')
    expect(uit.richting).toBe('onder')
  })

  // "Niet gemeten" en "te warm" vragen iets anders van wie het leest.
  it('houdt niet gemeten en buiten de grens uit elkaar', () => {
    expect(meetOordeel(koelkast, '').staat).toBe('leeg')
    expect(meetOordeel(koelkast, null).staat).toBe('leeg')
    expect(meetOordeel(koelkast, 'warm').staat).toBe('onleesbaar')
  })

  it('zegt niets over een punt zonder getalveld', () => {
    expect(meetOordeel(null, 4).staat).toBe('nvt')
    expect(meetOordeel({ kind: 'datum' }, '2026-09-01').staat).toBe('nvt')
  })

  it('leest nul als een waarde en niet als leeg', () => {
    expect(meetOordeel(koelkast, 0).staat).toBe('ok')
  })
})

describe('grensTekst', () => {
  it('schrijft een bovengrens uit', () => {
    expect(grensTekst({ kind: 'getal', max: 7, eenheid: '°C' })).toBe('max 7 °C')
  })
  it('schrijft een bereik uit', () => {
    expect(grensTekst({ kind: 'getal', min: 0, max: 7, eenheid: '°C' })).toBe('tussen 0 en 7 °C')
  })
  it('zwijgt over een veld zonder grens', () => {
    expect(grensTekst({ kind: 'getal' })).toBe('')
  })
})

describe('in het Engels', () => {
  // De dag- en maandnamen komen van `Intl` en volgen de opmaaktaal; de zinnen
  // eromheen komen uit de catalogus en volgen de gekozen taal. Vandaar allebei.
  afterEach(() => {
    zetHuidigeTaal('nl')
    zetLocale('nl-BE')
  })

  const engels = () => {
    zetHuidigeTaal('en')
    zetLocale('en-GB')
  }

  it('beschrijft de herhaling in het Engels', () => {
    engels()
    expect(repeatLabel({ repeat: { kind: 'wekelijks', days: [1] } })).toBe('every Monday')
    expect(repeatLabel({ repeat: { kind: 'weekdag', days: [0, 6] } })).toBe('weekend')
    expect(repeatLabel({ repeat: { kind: 'weekdag', days: [2, 4] } })).toBe('Tuesday, Thursday')
    expect(repeatLabel({})).toBe('every day')
  })

  // Het rangtelwoord komt van `Intl.PluralRules`: 1st, 2nd, 3rd, 21st — waar het
  // Nederlands overal een "e" zet.
  it('kiest het juiste rangtelwoord bij een dag van de maand', () => {
    engels()
    expect(repeatLabel({ repeat: { kind: 'maandelijks', dayOfMonth: 1 } })).toBe('the 1st of the month')
    expect(repeatLabel({ repeat: { kind: 'maandelijks', dayOfMonth: 3 } })).toBe('the 3rd of the month')
    expect(repeatLabel({ repeat: { kind: 'maandelijks', dayOfMonth: 15 } })).toBe('the 15th of the month')
    expect(repeatLabel({ repeat: { kind: 'kwartaal', dayOfMonth: 2 } })).toBe('every quarter, the 2nd')
    expect(repeatLabel({ repeat: { kind: 'jaarlijks', month: 2, dayOfMonth: 1 } })).toBe('every year in March')
  })

  it('schrijft de grens en de afdeling in het Engels', () => {
    engels()
    expect(grensTekst({ kind: 'getal', max: 7, eenheid: '°C' })).toBe('max 7 °C')
    expect(grensTekst({ kind: 'getal', min: 0, max: 7, eenheid: '°C' })).toBe('between 0 and 7 °C')
    expect(afdelingLabel('zaal')).toBe('Front of house')
    expect(afdelingLabel()).toBe('Everyone')
  })
})
