import { describe, expect, it } from 'vitest'
import {
  kanVoorvertonen,
  mapnaamVoorEvent,
  mapnaamVoorKlant,
  rijVanDriveBestand,
  soortVan,
  veiligeMapnaam,
  voorvertoningVan,
} from '../functions/drive-naam'

/**
 * Hoe de mappen in Drive heten en wat er van een bestand in Firestore komt.
 *
 * Een mapnaam zie je elke dag in Drive; een fout erin is er een die iemand
 * met de hand gaat herstellen, en dan lopen Drive en de app uit elkaar.
 */

describe('een mapnaam', () => {
  it('haalt eruit wat Drive weigert en houdt de rest', () => {
    expect(veiligeMapnaam('Trouw: Niels / Inez?')).toBe('Trouw Niels Inez')
    expect(veiligeMapnaam('  Blum   België  ')).toBe('Blum België')
  })
  it('valt terug op iets herkenbaars en niet op leeg', () => {
    expect(veiligeMapnaam('', 'Event')).toBe('Event')
    expect(veiligeMapnaam('///', 'Event')).toBe('Event')
    expect(veiligeMapnaam(null)).toBe('Zonder naam')
  })
  it('wordt niet langer dan Drive prettig vindt', () => {
    expect(veiligeMapnaam('x'.repeat(300)).length).toBe(120)
  })
})

describe('de map van een event', () => {
  /*
    Datum vooraan: Drive sorteert op naam, en zo staan de mappen op volgorde
    van het seizoen in plaats van op alfabet van de klant.
  */
  it('begint met de dag, zodat Drive op volgorde van het seizoen sorteert', () => {
    expect(mapnaamVoorEvent({ title: 'Trouw Niels en Inez', eventDate: new Date('2027-03-12T12:00:00') })).toBe('2027-03-12 — Trouw Niels en Inez')
  })
  it('neemt de deadline als er geen eventdatum is, en anders alleen de titel', () => {
    expect(mapnaamVoorEvent({ title: 'Beurs', dueDate: new Date('2027-05-01T12:00:00') })).toBe('2027-05-01 — Beurs')
    expect(mapnaamVoorEvent({ title: 'Beurs' })).toBe('Beurs')
    expect(mapnaamVoorEvent({})).toBe('Event')
  })
  it('leest ook een Firestore-tijdstempel', () => {
    const ts = { toDate: () => new Date('2027-03-12T12:00:00') }
    expect(mapnaamVoorEvent({ title: 'Feest', eventDate: ts })).toBe('2027-03-12 — Feest')
  })
})

describe('de map van een klant', () => {
  it('is de naam, of het id als er geen naam is', () => {
    expect(mapnaamVoorKlant({ name: 'Blum België' }, 'c1')).toBe('Blum België')
    expect(mapnaamVoorKlant({}, 'c1')).toBe('Klant c1')
  })
})

describe('wat voor soort bestand', () => {
  it('kent de soorten die Drive kan voorvertonen', () => {
    expect(soortVan('image/jpeg')).toBe('afbeelding')
    expect(soortVan('application/pdf')).toBe('pdf')
    expect(soortVan('application/vnd.google-apps.document')).toBe('google')
    expect(soortVan('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('kantoor')
    expect(soortVan('video/mp4')).toBe('video')
    expect(soortVan('application/zip')).toBe('bestand')
    expect(kanVoorvertonen('application/zip')).toBe(false)
    expect(kanVoorvertonen('application/pdf')).toBe(true)
  })
  it('bouwt de ingesloten weergave van Drive', () => {
    expect(voorvertoningVan('abc 1')).toBe('https://drive.google.com/file/d/abc%201/preview')
  })
})

describe('wat er van een Drive-bestand in Firestore komt', () => {
  const b = { id: 'f1', name: 'Grondplan.pdf', mimeType: 'application/pdf', size: '12345', webViewLink: 'https://drive.google.com/file/d/f1/view', iconLink: 'https://i/x.png', modifiedTime: '2026-10-01T10:00:00Z', owners: [{ emailAddress: 'x@y' }], permissions: [] }

  it('is een selectie en geen doorgeefluik', () => {
    const rij = rijVanDriveBestand(b, { taskId: 't1' })
    expect(rij).toMatchObject({ bron: 'drive', driveId: 'f1', name: 'Grondplan.pdf', soort: 'pdf', size: 12345, taskId: 't1', customerId: null })
    expect(rij.voorvertoning).toBe('https://drive.google.com/file/d/f1/preview')
    expect(rij).not.toHaveProperty('owners')
    expect(rij).not.toHaveProperty('permissions')
  })
  it('heeft geen voorvertoning voor wat Drive niet toont', () => {
    expect(rijVanDriveBestand({ ...b, mimeType: 'application/zip' }).voorvertoning).toBe(null)
  })
  it('bouwt een link als Drive er geen gaf', () => {
    expect(rijVanDriveBestand({ id: 'f2', name: 'x' }).url).toBe('https://drive.google.com/file/d/f2/view')
  })
})
