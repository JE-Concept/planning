import { afterEach, describe, expect, it } from 'vitest'
import { AUDIT, kort, regelVan, teOud, verschillen } from '../functions/audit.js'
import { filter, mensenIn, naarCsv, perDag, veldNaam, waardeTekst, zinVan } from '../src/lib/logboek'
import { zetHuidigeTaal } from '../src/lib/i18n'

const NU = new Date('2026-09-30T10:00:00Z')

describe('wat er gelogd wordt', () => {
  it('logt niets wanneer er aan de gevolgde velden niets veranderde', () => {
    // Een stempel van de regelengine of een bijgewerkte teller is geen regel
    // voor het logboek; anders leest niemand het nog door.
    const voor = { title: 'Trouw', statusName: 'create offer', trackedSeconds: 10 }
    const na = { title: 'Trouw', statusName: 'create offer', trackedSeconds: 900 }
    expect(regelVan({ collectie: 'tasks', id: 't1', voor, na, nu: NU })).toBeNull()
  })

  it('logt een wijziging met de oude en de nieuwe waarde', () => {
    const regel = regelVan({
      collectie: 'tasks',
      id: 't1',
      voor: { title: 'Trouw', quoteAmount: 16399, updatedBy: 'u-elke' },
      na: { title: 'Trouw', quoteAmount: 17200, updatedBy: 'u-elke' },
      nu: NU,
    })
    expect(regel).toMatchObject({ soort: 'taak', actie: 'gewijzigd', actorId: 'u-elke', actorZeker: true })
    expect(regel.wijzigingen).toEqual([{ veld: 'quoteAmount', van: '16399', naar: '17200' }])
  })

  it('logt aanmaken en verwijderen', () => {
    const aan = regelVan({ collectie: 'customers', id: 'k1', voor: null, na: { name: 'Blum', createdBy: 'u-jasper' }, nu: NU })
    expect(aan).toMatchObject({ actie: 'aangemaakt', naam: 'Blum', soort: 'klant' })

    const weg = regelVan({ collectie: 'customers', id: 'k1', voor: { name: 'Blum', updatedBy: 'u-jasper' }, na: null, nu: NU })
    expect(weg.actie).toBe('verwijderd')
    // Bij een verwijdering is de schrijver er niet meer om te zeggen wie het
    // deed; dan is dit wie het als laatste bewerkte, en dat staat erbij.
    expect(weg.actorZeker).toBe(false)
  })

  it('houdt de rol en de toegang van een profiel bij', () => {
    const regel = regelVan({
      collectie: 'profiles',
      id: 'u-charish',
      voor: { fullName: 'Charish', role: 'member' },
      na: { fullName: 'Charish', role: 'admin', updatedBy: 'u-jasper' },
      nu: NU,
    })
    expect(regel.wijzigingen).toEqual([{ veld: 'role', van: 'member', naar: 'admin' }])
  })

  // Een token in het logboek is een token dat gelekt is.
  it('zet nooit een sleutel of token in het logboek', () => {
    const regel = regelVan({
      collectie: 'offertes',
      id: 'o1',
      voor: { status: 'concept', token: 'geheim-een' },
      na: { status: 'verstuurd', token: 'geheim-twee' },
      nu: NU,
    })
    expect(JSON.stringify(regel)).not.toContain('geheim')
    expect(regel.wijzigingen.map((w) => w.veld)).toEqual(['status'])
  })

  it('maakt van iets groots één woord in plaats van een halve database', () => {
    expect(kort({ a: 1, b: 2 })).toBe('aangepast')
    expect(kort([{ id: 1 }, { id: 2 }])).toBe('2 regels')
    expect(kort(['u-elke', 'u-jasper'])).toEqual(['u-elke', 'u-jasper'])
    expect(kort('x'.repeat(200)).length).toBe(120)
  })

  it('kijkt niet naar velden die niemand terugleest', () => {
    expect(verschillen({ description: 'a' }, { description: 'b' }, AUDIT.tasks.velden)).toEqual([])
  })

  it('kent een collectie die er niet in staat niet', () => {
    expect(regelVan({ collectie: 'comments', id: 'c1', voor: null, na: { body: 'hoi' } })).toBeNull()
  })

  it('ruimt op wat ouder is dan twee jaar', () => {
    expect(teOud({ at: new Date('2024-01-01') }, NU)).toBe(true)
    expect(teOud({ at: new Date('2026-01-01') }, NU)).toBe(false)
  })
})

describe('het logboek voorlezen', () => {
  afterEach(() => zetHuidigeTaal('nl'))

  const regel = {
    at: new Date('2026-09-30T09:00:00'),
    soort: 'taak',
    naam: 'Trouw Niels en Inez',
    actorId: 'u-elke',
    actorNaam: 'Elke Motmans',
    actie: 'gewijzigd',
    wijzigingen: [{ veld: 'quoteAmount', van: '16399', naar: '17200' }],
  }

  it('maakt er een zin van in plaats van een veldnaam', () => {
    expect(zinVan(regel)).toBe(
      'Elke Motmans wijzigde het offertebedrag van Trouw Niels en Inez — van 16399 naar 17200'
    )
  })

  it('vat meerdere wijzigingen samen', () => {
    const zin = zinVan({ ...regel, wijzigingen: [{ veld: 'title' }, { veld: 'dueDate' }] })
    expect(zin).toContain('de titel, de deadline')
  })

  it('zegt het ook in het Engels', () => {
    zetHuidigeTaal('en')
    expect(zinVan({ ...regel, actie: 'aangemaakt' })).toBe('Elke Motmans created task Trouw Niels en Inez')
  })

  it('noemt een veld bij zijn naam uit de tool, niet uit de database', () => {
    expect(veldNaam('quoteAmount')).toBe('het offertebedrag')
    // `assignees` heet in de databank nog zo, maar draagt sinds de splitsing
    // één naam: wie verantwoordelijk is. De ploeg staat in `medewerkers`.
    expect(veldNaam('assignees')).toBe('de verantwoordelijke')
    expect(veldNaam('medewerkers')).toBe('de medewerkers')
    // Een veld dat nog geen naam heeft, blijft zichzelf — geen lege plek.
    expect(veldNaam('ietsNieuws')).toBe('ietsNieuws')
  })

  it('schrijft lege en booleaanse waarden voluit', () => {
    expect(waardeTekst(null)).toBe('leeg')
    expect(waardeTekst(true)).toBe('ja')
    expect(waardeTekst([])).toBe('leeg')
    expect(waardeTekst(['a', 'b'])).toBe('a, b')
  })
})

describe('filteren en groeperen', () => {
  const regels = [
    { at: new Date('2026-09-30T09:00:00'), soort: 'taak', naam: 'Blum', actorId: 'u-elke', actorNaam: 'Elke', wijzigingen: [] },
    { at: new Date('2026-09-30T08:00:00'), soort: 'klant', naam: 'Blum België', actorId: 'u-jasper', actorNaam: 'Jasper', wijzigingen: [] },
    { at: new Date('2026-09-28T08:00:00'), soort: 'taak', naam: 'Trouw', actorId: 'u-elke', actorNaam: 'Elke', wijzigingen: [] },
  ]

  it('filtert op wie en op soort', () => {
    expect(filter(regels, { wie: 'u-elke' })).toHaveLength(2)
    expect(filter(regels, { soort: 'klant' })).toHaveLength(1)
    expect(filter(regels, { wie: 'u-elke', soort: 'klant' })).toHaveLength(0)
  })

  it('zoekt in de naam, in wie het deed en in de velden', () => {
    expect(filter(regels, { zoek: 'blum' })).toHaveLength(2)
    expect(filter(regels, { zoek: 'jasper' })).toHaveLength(1)
    expect(filter(regels, { zoek: 'bestaat niet' })).toHaveLength(0)
  })

  it('filtert op periode', () => {
    expect(filter(regels, { vanaf: new Date('2026-09-29T00:00:00') })).toHaveLength(2)
  })

  it('groepeert per dag, nieuwste dag eerst', () => {
    const dagen = perDag(regels)
    expect(dagen).toHaveLength(2)
    expect(dagen[0].regels).toHaveLength(2)
    expect(dagen[0].sleutel > dagen[1].sleutel).toBe(true)
  })

  it('haalt de mensen uit het logboek, zonder dubbels', () => {
    expect(mensenIn(regels).map((m) => m.naam)).toEqual(['Elke', 'Jasper'])
  })
})

describe('de export', () => {
  it('schrijft een CSV die Excel hier kan lezen', () => {
    const csv = naarCsv([
      {
        at: new Date('2026-09-30T09:00:00Z'),
        soort: 'taak',
        naam: 'Trouw',
        actorNaam: 'Elke',
        actie: 'gewijzigd',
        wijzigingen: [{ veld: 'quoteAmount', van: '16399', naar: '17200' }],
      },
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain(';')
    expect(csv).toContain('het offertebedrag: 16399 → 17200')
  })

  it('ontsnapt aanhalingstekens in plaats van de kolom te breken', () => {
    expect(naarCsv([{ at: new Date(), naam: 'De "grote" zaal', wijzigingen: [] }])).toContain('De ""grote"" zaal')
  })
})
