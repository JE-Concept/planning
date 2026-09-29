import { asDate } from './dates'

/**
 * Wanneer een event van het bord af mag.
 *
 * De aanleiding: het eventbord slibt dicht. Elk event blijft in zijn laatste
 * kolom staan, ook als er al een jaar niets meer aan te doen valt, en zo moet
 * je langs drie jaar afgehandelde feesten scrollen om het werk van deze week te
 * zien.
 *
 * De regel is met opzet twee regels, want "klaar" gebeurt hier op twee
 * manieren:
 *
 * 1. Status `complete`. Iemand heeft het event bewust afgesloten. Dat is een
 *    uitspraak, en die volgen we meteen.
 * 2. Status `invoiced` en de factuur is oud. Dit is de stille manier waarop het
 *    in de praktijk gaat: er wordt gefactureerd en daarna kijkt niemand er nog
 *    naar. Een factuur bij JE Concept staat op dertig dagen; na het dubbele
 *    daarvan is een openstaande betaling geen planningswerk meer maar een zaak
 *    voor de boekhouding, en hoort het event niet langer op het bord.
 *
 * Wat er níét in staat: `ready to invoice`. Daar moet nog iemand iets doen, hoe
 * lang het er ook staat — dat verstoppen zou de factuur verstoppen.
 *
 * Archiveren is hier alleen een kwestie van waar iets getoond wordt. Er wordt
 * niets geschreven, niets verplaatst en zeker niets gewist: een event draagt
 * offertebedragen en facturatiegegevens, en die horen te blijven bestaan, ook
 * als niemand ze nog nodig heeft.
 */

export const ARCHIEF_NA_DAGEN = 60

const DAG = 86400000

/** De datum waarop dit event "voorbij" is: de eventdag, anders de deadline. */
export function afsluitDatum(event) {
  return asDate(event?.eventDate) ?? asDate(event?.completedAt) ?? asDate(event?.dueDate) ?? null
}

export function isGearchiveerd(event, { nu = new Date(), naDagen = ARCHIEF_NA_DAGEN } = {}) {
  const status = (event?.statusName ?? '').toString().trim().toLowerCase()
  if (status === 'complete') return true
  if (status !== 'invoiced') return false

  // Een gefactureerd event zonder enige datum blijft staan. Liever een kaart te
  // veel op het bord dan een dossier dat wegvalt omdat er een veld leeg was.
  const datum = afsluitDatum(event)
  if (!datum) return false
  return nu.getTime() - datum.getTime() > naDagen * DAG
}

/** Het jaar waaronder een event in het archief terug te vinden is. */
export function jaarVan(event) {
  const datum = afsluitDatum(event) ?? asDate(event?.createdAt)
  return datum ? datum.getFullYear() : null
}

/**
 * Het bord en het archief uit elkaar.
 *
 * Eén doorloop over dezelfde lijst, want beide schermen kijken naar dezelfde
 * events en twee keer filteren is twee keer dezelfde regel onderhouden.
 */
export function splitsArchief(events = [], opties = {}) {
  const actief = []
  const archief = []
  for (const event of events) {
    ;(isGearchiveerd(event, opties) ? archief : actief).push(event)
  }
  return { actief, archief }
}

/** De jaren waarin er iets in het archief zit, recentste eerst. */
export function jarenIn(events = []) {
  const jaren = new Set()
  for (const event of events) {
    const jaar = jaarVan(event)
    if (jaar) jaren.add(jaar)
  }
  return [...jaren].sort((a, b) => b - a)
}
