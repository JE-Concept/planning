import { koppelsleutel } from './koppelingen'
import { rangschik } from './zoeken'

/**
 * Wat de objectkiezer kan vinden, in één vorm.
 *
 * De kiezer is het ene veld waarmee je "dit gaat over…" zegt, waar dat ook
 * staat: een notitie aan een klant hangen, aan een event, aan een urenboeking.
 * Elk scherm een eigen keuzelijst geven betekent zes keer een andere manier
 * van zoeken, en een keuzelijst met tweehonderd klanten is geen keuze maar
 * scrollen.
 *
 * Elke kandidaat heeft de vorm die `@lib/zoeken` rangschikt (`titel`, `extra`,
 * `soort`, `gewicht`) plus wat er na het kiezen op de notitie komt (`id`,
 * `label`, eventueel `eventId`). Het rangschikken zelf is dat van de zoekbalk
 * bovenaan, zodat "blum" hier dezelfde volgorde geeft als daar.
 *
 * Opmaak (een datum, een duur) komt van buiten via `fmt`: dit bestand moet
 * zonder browser te testen zijn, en de datumopmaak hangt aan de taal.
 */

const samen = (...stukken) => stukken.filter(Boolean).join(' · ')

/** Tiebreaker bij een gelijke score — dezelfde gedachte als in de zoekbalk. */
const GEWICHT = { event: 6, klant: 5, taak: 4, materiaal: 3, offerte: 2, uren: 1 }

export function kiezerKandidaten(
  { klanten = [], events = [], taken = [], materiaal = [], uren = [], offertes = [], profileById = {} } = {},
  fmt = {}
) {
  const dag = fmt.dag ?? ((d) => (d ? String(d).slice(0, 10) : null))
  const duur = fmt.duur ?? ((s) => `${Math.round((s ?? 0) / 60)} min`)
  const eventNaam = Object.fromEntries(events.map((e) => [e.id, e.name]))

  const uit = [
    ...klanten
      .filter((k) => !k.archived)
      .map((k) => ({
        soort: 'klant',
        id: k.id,
        titel: k.name ?? '',
        extra: [k.email, k.vatNumber, k.address?.city, ...(k.contacts ?? []).map((c) => c.name)],
        sub: samen(k.address?.city, k.vatNumber),
      })),
    ...events.map((e) => ({
      soort: 'event',
      id: e.id,
      titel: e.name ?? '',
      extra: [e.customerName, e.location, e.concept],
      sub: samen(e.eventDate ? dag(e.eventDate) : null, e.customerName),
    })),
    ...taken.map((taak) => ({
      soort: 'taak',
      id: taak.id,
      titel: taak.title ?? '',
      extra: [eventNaam[taak.parentId], taak.description],
      sub: samen(eventNaam[taak.parentId], taak.dueDate ? dag(taak.dueDate) : null),
      eventId: taak.parentId && eventNaam[taak.parentId] ? taak.parentId : null,
    })),
    ...materiaal
      .filter((m) => !m.archived)
      .map((m) => ({
        soort: 'materiaal',
        id: m.id,
        titel: m.naam ?? '',
        extra: [m.categorie, m.leverancier],
        sub: samen(m.categorie, m.aantal != null ? `× ${m.aantal}` : null),
      })),
    ...offertes.map((o) => ({
      soort: 'offerte',
      id: o.id,
      titel: samen(o.nummer, o.eventNaam) || o.id,
      extra: [o.klantNaam, o.eventNaam],
      sub: o.klantNaam ?? '',
      eventId: o.eventId ?? null,
    })),
    /*
      Een urenboeking heeft geen naam. Wat je ervan onthoudt is wie, waarop en
      wanneer — dus dat wordt de titel, en dan vind je "Elke Blum" terug.
    */
    ...uren.map((u) => {
      const wie = profileById[u.profileId]?.fullName ?? ''
      const titel = samen(u.taskTitle, wie, u.startedAt ? dag(u.startedAt) : null)
      return {
        soort: 'uren',
        id: u.id,
        titel,
        extra: [u.description, u.listName],
        sub: samen(duur(u.durationSeconds), u.description),
      }
    }),
  ]

  return uit.map((k) => ({ ...k, label: k.titel, gewicht: GEWICHT[k.soort] ?? 0 }))
}

/**
 * De lijst onder het veld.
 *
 * Wat al gekozen is, staat er niet meer in — anders kies je het een tweede
 * keer en gebeurt er niets, en dat leest als een kapotte knop. Een beperking
 * op soort (alleen klanten, bijvoorbeeld) gaat vóór het rangschikken, zodat
 * het plafond per soort niet opgaat aan wat toch niet getoond wordt.
 */
export function kiezerResultaten(kandidaten, vraag, { soorten = null, gekozen = [], max = 12 } = {}) {
  const weg = new Set(gekozen.map(koppelsleutel))
  const mag = kandidaten.filter(
    (k) => (!soorten || soorten.includes(k.soort)) && !weg.has(koppelsleutel(k))
  )
  // Eén soort: dan is het plafond per soort het hele plafond.
  const perSoort = soorten?.length === 1 ? max : 4
  return rangschik(mag, vraag, { perSoort, totaal: max })
}
