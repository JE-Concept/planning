import { asDate, formatDate } from './dates'

/**
 * Wat de aanmaakdatum van een taak waard is.
 *
 * Onderaan de taakfiche stond "Aangemaakt 28/09/2026", en bij zowat elke taak
 * dezelfde datum: dat is de dag waarop de inhoud van ClickUp is overgezet, niet
 * de dag waarop iemand die taak bedacht. De migratie neemt `date_created` over
 * als ClickUp die meegaf en valt anders terug op het moment van importeren, dus
 * voor een overgenomen taak zegt die datum alleen iets over de verhuizing.
 *
 * Daarom drie antwoorden in plaats van één zin: kwam de taak uit ClickUp, dan
 * staat er bij wát die datum is; is ze hier gemaakt, dan klopt "aangemaakt"; en
 * is er geen datum, dan staat er niets. Liever een lege plek dan een getal dat
 * niet waar is.
 *
 * Een taak uit de migratie herken je aan `clickupId` — dat veld zet alleen
 * `scripts/migrate-clickup.mjs`.
 */
export function herkomstVanTaak(task) {
  const datum = asDate(task?.createdAt)
  if (!datum || Number.isNaN(datum.getTime())) return null

  if (task?.clickupId) {
    return {
      soort: 'clickup',
      datum,
      tekst: `Overgenomen uit ClickUp op ${formatDate(datum)}`,
      uitleg: 'De datum van de verhuizing, niet van de taak zelf.',
    }
  }

  return { soort: 'aangemaakt', datum, tekst: `Aangemaakt ${formatDate(datum)}`, uitleg: null }
}
