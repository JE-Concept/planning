import { asDate, formatDate } from './dates'
import { tekst } from './i18n'

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
 *
 * ClickUp heet in beide talen ClickUp; alleen de zin eromheen volgt de taal.
 */
export function herkomstVanTaak(task) {
  const datum = asDate(task?.createdAt)
  if (!datum || Number.isNaN(datum.getTime())) return null

  if (task?.clickupId) {
    return {
      soort: 'clickup',
      datum,
      tekst: tekst('taaklib.herkomst.clickup', { datum: formatDate(datum) }),
      uitleg: tekst('taaklib.herkomst.clickup_uitleg'),
    }
  }

  return {
    soort: 'aangemaakt',
    datum,
    tekst: tekst('taaklib.herkomst.aangemaakt', { datum: formatDate(datum) }),
    uitleg: null,
  }
}
