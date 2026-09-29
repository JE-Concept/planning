/**
 * De statuspijplijn van een event, zoals het design ze toont.
 *
 * In de database blijven de statussen heten wat ze in ClickUp heetten
 * (`request`, `create offer`, …): automatisaties, het socialbord en de
 * migratie rekenen op die namen. Wat het team ziet is het Nederlandse label.
 * Beheerders kunnen dat label hernoemen in Instellingen → Pijplijn; het
 * wordt als `label` op de status in de lijst bewaard, de naam blijft staan.
 */

export const PIPELINE = [
  { key: 'request', label: 'Aanvraag', tone: 'neutral' },
  { key: 'create offer', label: 'Offerte maken', tone: 'accent' },
  { key: 'offer send', label: 'Offerte verstuurd', tone: 'accent' },
  { key: 'offer accepted', label: 'Akkoord', tone: 'solid' },
  { key: 'planning ongoing', label: 'Planning loopt', tone: 'accent' },
  { key: 'planning ready', label: 'Planning klaar', tone: 'success' },
  { key: 'ready to invoice', label: 'Te factureren', tone: 'warning' },
  { key: 'invoiced', label: 'Gefactureerd', tone: 'neutral' },
  { key: 'complete', label: 'Afgerond', tone: 'neutral' },
]

const BY_KEY = Object.fromEntries(PIPELINE.map((p, i) => [p.key, { ...p, index: i }]))

/** De drie fasen waarin de lijstweergave de events groepeert. */
export const PHASES = [
  { label: 'Verkoop', sub: 'Aanvraag tot offerte', keys: ['request', 'create offer', 'offer send'] },
  { label: 'Voorbereiding', sub: 'Akkoord tot draaiboek', keys: ['offer accepted', 'planning ongoing', 'planning ready'] },
  { label: 'Facturatie', sub: 'Event voorbij', keys: ['ready to invoice', 'invoiced'] },
]

/** Uitleg per stap in Instellingen → Pijplijn. */
export const STEP_RULES = {
  request: 'Vereist: klant, datum, gasten, offerte',
  'ready to invoice': 'Start facturatie-opvolging',
  complete: 'Naar archief',
}

/**
 * Herkent de eventlijst: de lijst waarvan de statussen de pijplijn zijn.
 * Zo werkt het met de gemigreerde gegevens zonder dat er een id vast moet
 * staan in de code.
 */
export function isPipelineList(list) {
  const names = new Set((list?.statuses ?? []).map((s) => s.name))
  return names.has('request') && names.has('ready to invoice') && names.has('invoiced')
}

export function stepOf(statusName) {
  return BY_KEY[statusName] ?? null
}

export function indexOf(statusName) {
  return BY_KEY[statusName]?.index ?? -1
}

export function toneOf(statusName) {
  return BY_KEY[statusName]?.tone ?? 'neutral'
}

/** Het label zoals het team het wil zien: eigen naam, anders de standaard. */
export function labelOf(status, statuses = []) {
  if (!status) return ''
  const name = typeof status === 'string' ? status : status.name
  const found = statuses.find((s) => s.name === name)
  return found?.label || BY_KEY[name]?.label || name
}

/**
 * De ene regel die het verschil maakt (briefing §9): een aanvraag wordt pas
 * een offerte als klant, datum, gasten en offertebedrag gekend zijn.
 */
export function missingForOffer(event) {
  const missing = []
  if (!event.customerName) missing.push('klant')
  if (!event.eventDate) missing.push('datum')
  if (!event.pax) missing.push('gasten')
  if (!event.quoteAmount) missing.push('offertebedrag')
  return missing
}

export function blockedTransition(event, targetName) {
  if (event.statusName !== 'request') return null
  if (indexOf(targetName) <= 0) return null
  const missing = missingForOffer(event)
  return missing.length ? missing : null
}
