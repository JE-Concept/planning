import { isOverdue } from './dates'

/**
 * Wanneer iets écht te laat is.
 *
 * Dit stond op vijf schermen los, elk als `isOverdue(t.dueDate)`, en dat klopt
 * niet voor een event. Een event dat op "ready to invoice" staat is uitgevoerd —
 * het feest is geweest, alleen de factuur loopt nog. Toch kleurde het rood met
 * "31 dagen te laat", omdat de datum voorbij is en de kaart nog openstaat. Dat
 * leest als een fout waar er geen is, en het maakt de rode kleur waardeloos:
 * wie elke dag drie valse alarmen ziet, kijkt over het echte heen.
 *
 * Te laat betekent hier: er stond een datum, er is niet aan voldaan, en er valt
 * nog iets te doen.
 */

/**
 * De stappen waarop het werk gedaan is.
 *
 * Ze staan als naam en niet als soort, omdat de kolommen van een bord door het
 * team gezet worden en niet elk een `kind` meekrijgen. Wie de namen verandert,
 * verandert ze ook hier — vandaar dat ze in Instellingen te zien zijn en niet
 * verstopt in code die niemand openslaat.
 */
export const UITGEVOERD = ['ready to invoice', 'invoiced', 'complete', 'closed', 'done']

/** Een status die zegt dat er niets meer te doen is. */
export function isAfgerond(task) {
  if (!task) return false
  if (task.open === false) return true
  const soort = String(task.statusKind ?? '').toLowerCase()
  if (soort === 'closed' || soort === 'done') return true
  return UITGEVOERD.includes(String(task.statusName ?? '').toLowerCase())
}

export function isTeLaat(task) {
  if (!task?.dueDate) return false
  if (isAfgerond(task)) return false
  return isOverdue(task.dueDate)
}
