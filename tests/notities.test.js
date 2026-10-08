import { describe, expect, it } from 'vitest'
import { koppelsleutel, raakt, routeVan, schoneKoppeling, voegSamen, zetKoppelingen } from '../src/lib/koppelingen'
import { kiezerKandidaten, kiezerResultaten } from '../src/lib/objectkiezer'
import { zoekVerslagen } from '../src/lib/verslag-zoek'

/**
 * Notities hangen aan wat ze raken. Twee dingen mogen daarbij nooit uit
 * elkaar lopen: de koppelingen die je ziet en de sleutels waarop Firestore
 * zoekt — anders staat een notitie op het scherm "over Blum" maar vindt de
 * fiche van Blum ze niet.
 */

describe('koppelingen op een notitie', () => {
  it('rekent de zoeksleutels uit de koppelingen', () => {
    const uit = zetKoppelingen([
      { soort: 'klant', id: 'k-blum', label: 'Blum België' },
      { soort: 'event', id: 't-blum', label: 'Blum personeelsfeest' },
    ])
    expect(uit.koppelsleutels).toEqual(['klant:k-blum', 'event:t-blum'])
    expect(uit.koppelingen).toHaveLength(2)
  })

  it('laat dubbels en onbekende soorten weg', () => {
    const uit = zetKoppelingen([
      { soort: 'klant', id: 'k-blum', label: 'Blum' },
      { soort: 'klant', id: 'k-blum', label: 'Blum (nog eens)' },
      { soort: 'factuur', id: 'f1', label: 'bestaat niet' },
      { soort: 'event', label: 'zonder id' },
      null,
    ])
    expect(uit.koppelsleutels).toEqual(['klant:k-blum'])
  })

  it('bewaart geen schermvelden in de database', () => {
    const k = schoneKoppeling({ soort: 'taak', id: 't1', titel: 'Tent bevestigen', score: 0.9, sub: 'x', eventId: 't-trouw' })
    expect(k).toEqual({ soort: 'taak', id: 't1', label: 'Tent bevestigen', eventId: 't-trouw' })
  })

  it('weet of een notitie een object raakt', () => {
    const n = zetKoppelingen([{ soort: 'materiaal', id: 'm-tent', label: 'Tent' }])
    expect(raakt(n, { soort: 'materiaal', id: 'm-tent' })).toBe(true)
    expect(raakt(n, { soort: 'klant', id: 'm-tent' })).toBe(false)
    expect(raakt({}, { soort: 'klant', id: 'x' })).toBe(false)
  })

  it('kent een adres voor elke soort', () => {
    expect(routeVan({ soort: 'event', id: 't1' })).toBe('/events/t1')
    expect(routeVan({ soort: 'klant', id: 'k1' })).toBe('/klanten?klant=k1')
    expect(routeVan({ soort: 'taak', id: 'x', eventId: 't1' })).toBe('/events/t1?taak=x')
    expect(routeVan({ soort: 'onbekend', id: 'x' })).toBeNull()
    expect(koppelsleutel({ soort: 'uren', id: 'u1' })).toBe('uren:u1')
  })
})

describe('open en private notities samen', () => {
  it('telt een notitie die in beide stapels zit één keer, nieuwste eerst', () => {
    const open = [{ id: 'a', datum: '2026-09-01' }, { id: 'b', datum: '2026-10-01' }]
    const prive = [{ id: 'b', datum: '2026-10-01' }, { id: 'c', datum: '2026-09-15' }]
    expect(voegSamen(open, prive).map((n) => n.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('de objectkiezer', () => {
  const bronnen = {
    klanten: [
      { id: 'k-blum', name: 'Blum België', address: { city: 'Hasselt' } },
      { id: 'k-oud', name: 'Blumenhof', archived: true },
    ],
    events: [{ id: 't-blum', name: 'Blum personeelsfeest', customerName: 'Blum België' }],
    taken: [{ id: 't-blum-1', title: 'Tafelschikking Blum doorgeven', parentId: 't-blum' }],
    materiaal: [{ id: 'm-tent', naam: 'Partytent 6 × 12 m', categorie: 'Tenten' }],
    uren: [{ id: 'u1', taskTitle: 'Blum personeelsfeest', profileId: 'u-elke', startedAt: '2026-10-01T09:00:00', durationSeconds: 3600 }],
    offertes: [{ id: 'o1', nummer: '2026-014', eventNaam: 'Blum personeelsfeest', klantNaam: 'Blum België', eventId: 't-blum' }],
    profileById: { 'u-elke': { fullName: 'Elke Motmans' } },
  }
  const kandidaten = kiezerKandidaten(bronnen)

  it('vindt over alle soorten heen, zonder gearchiveerde klanten', () => {
    const soorten = new Set(kiezerResultaten(kandidaten, 'blum').map((r) => r.soort))
    expect(soorten).toEqual(new Set(['klant', 'event', 'taak', 'uren', 'offerte']))
    expect(kiezerResultaten(kandidaten, 'blumenhof')).toEqual([])
  })

  it('vindt een urenboeking op wie ze deed', () => {
    const [r] = kiezerResultaten(kandidaten, 'elke', { soorten: ['uren'] })
    expect(r?.id).toBe('u1')
  })

  it('beperkt zich tot de gevraagde soort', () => {
    const r = kiezerResultaten(kandidaten, 'blum', { soorten: ['klant'] })
    expect(r.map((x) => x.id)).toEqual(['k-blum'])
  })

  it('biedt niet opnieuw aan wat al gekozen is', () => {
    const r = kiezerResultaten(kandidaten, 'blum', { gekozen: [{ soort: 'klant', id: 'k-blum' }] })
    expect(r.some((x) => x.id === 'k-blum')).toBe(false)
  })

  it('geeft een taak haar event mee, zodat de link ernaar werkt', () => {
    const taak = kandidaten.find((k) => k.soort === 'taak')
    expect(schoneKoppeling(taak)).toEqual({
      soort: 'taak',
      id: 't-blum-1',
      label: 'Tafelschikking Blum doorgeven',
      eventId: 't-blum',
    })
  })
})

describe('zoeken in notities', () => {
  it('vindt een notitie op haar tekst en op wat ze raakt', () => {
    const notities = [
      { id: 'n1', titel: 'Facturatie', tekst: 'Eén factuur per kwartaal met PO-nummers.', ...zetKoppelingen([{ soort: 'klant', id: 'k', label: 'Blum België' }]) },
      { id: 'n2', titel: 'Zijzeil', tekst: 'Scheur van 30 cm.' },
    ]
    expect(zoekVerslagen({ verslagen: notities, term: 'kwartaal' }).map((n) => n.id)).toEqual(['n1'])
    expect(zoekVerslagen({ verslagen: notities, term: 'blum' }).map((n) => n.id)).toEqual(['n1'])
    const [treffer] = zoekVerslagen({ verslagen: notities, term: 'scheur' })
    expect(treffer.treffers[0]).toMatchObject({ soort: 'tekst' })
  })
})
