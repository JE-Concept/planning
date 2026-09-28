/**
 * Wie krijgt een melding, en waarover.
 *
 * Puur rekenwerk, los van Firebase, zodat het na te rekenen is in een test. De
 * regel die het meeste werk doet staat hieronder twee keer: wie de wijziging
 * zelf maakte, krijgt er geen melding van. Een telefoon die trilt omdat je net
 * zelf een taak naar jezelf zette, is hoe mensen meldingen uitzetten.
 */

const lijst = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])

/** Wie er nieuw op de taak kwam te staan — de dader niet meegerekend. */
export function nieuweToegewezenen(voor, na, actor = null) {
  const oud = new Set(lijst(voor?.assignees))
  return lijst(na?.assignees).filter((uid) => !oud.has(uid) && uid !== actor)
}

/**
 * Aan wie er net een review gevraagd is.
 *
 * Alleen op de overgang naar "requested", en alleen wanneer er een naam bij
 * staat: een review die aan niemand in het bijzonder gevraagd is, hoort in de
 * kalender thuis en niet op iemands telefoon.
 */
export function nieuweReviewer(voor, na) {
  if (na?.reviewState !== 'requested') return null
  const opnieuw = voor?.reviewState === 'requested' && (voor?.reviewRound ?? 0) === (na?.reviewRound ?? 0)
  if (opnieuw) return null

  const reviewer = na.reviewerId ?? null
  if (!reviewer || reviewer === (na.reviewRequestedBy ?? null)) return null
  return reviewer
}

/** Eén zin, kort genoeg voor een vergrendelscherm. */
export function kort(tekst, max = 80) {
  const schoon = (tekst ?? '').toString().trim().replace(/\s+/g, ' ')
  return schoon.length > max ? `${schoon.slice(0, max - 1)}…` : schoon
}
