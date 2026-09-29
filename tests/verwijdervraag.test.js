import { afterEach, describe, expect, it } from 'vitest'
import { zetHuidigeTaal } from '../src/lib/i18n'
import { verwijderVraag } from '../src/lib/verwijdervraag'

describe('verwijderVraag', () => {
  afterEach(() => zetHuidigeTaal('nl'))

  it('noemt de taak bij naam', () => {
    const vraag = verwijderVraag({ task: { title: 'Trouw Niels en Inez' } })
    expect(vraag).toContain('“Trouw Niels en Inez” definitief verwijderen?')
  })

  it('somt op wat er mee verdwijnt', () => {
    const vraag = verwijderVraag({
      task: { title: 'Blum België', commentCount: 2 },
      subtaken: 3,
      bijlagen: 1,
    })
    expect(vraag).toContain('Weg zijn dan ook: 3 subtaken, 1 bijlage en 2 reacties.')
  })

  it('zegt ook wat er blijft, zodat niemand bang hoeft te zijn voor zijn uren', () => {
    const vraag = verwijderVraag({ task: { title: 'Kerstmarkt', trackedSeconds: 20700 } })
    expect(vraag).toContain('5u 45m geboekte tijd blijft bestaan')
  })

  it('houdt het kort bij een lege taak', () => {
    const vraag = verwijderVraag({ task: { title: 'Los punt' } })
    expect(vraag).not.toContain('Weg zijn dan ook')
    expect(vraag).not.toContain('geboekte tijd')
    expect(vraag).toContain('Archiveren bewaart alles.')
  })

  it('wijst altijd op de onomkeerbaarheid en op het alternatief', () => {
    expect(verwijderVraag({ task: {} })).toContain('kan niet ongedaan gemaakt worden')
  })

  it('valt terug op een naam als de titel leeg is', () => {
    expect(verwijderVraag({ task: { title: '   ' } })).toContain('“Deze taak”')
  })

  // De titel komt uit de database en blijft staan; het enkelvoud en meervoud
  // eromheen volgt de taal.
  it('stelt dezelfde vraag in het Engels', () => {
    zetHuidigeTaal('en')
    const vraag = verwijderVraag({
      task: { title: 'Blum België', commentCount: 1 },
      subtaken: 3,
      bijlagen: 2,
    })
    expect(vraag).toContain('Permanently delete “Blum België”?')
    expect(vraag).toContain('Also gone: 3 subtasks, 2 attachments and 1 comment.')
    expect(vraag).toContain('This cannot be undone. Archiving keeps everything.')
  })
})
