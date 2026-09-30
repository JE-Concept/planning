/**
 * De statuspijplijn van een event, zoals het design ze toont.
 *
 * In de database blijven de statussen heten wat ze in ClickUp heetten
 * (`request`, `create offer`, …): automatisaties, het socialbord en de
 * migratie rekenen op die namen. Wat het team ziet is het Nederlandse label.
 * Beheerders kunnen dat label hernoemen in Instellingen → Pijplijn; het
 * wordt als `label` op de status in de lijst bewaard, de naam blijft staan.
 */

/*
  De naam die een status krijgt wanneer niemand er zelf een koos, is een getter:
  zo wordt hij opgezocht op het moment van tekenen en neemt een taalwissel hem
  mee. Een vaste waarde zou na het omzetten de oude taal blijven tonen tot
  iemand de pagina herlaadt.

  Het label dat een beheerder in Instellingen bewaart, wint hier altijd van —
  zie `labelOf`. Dat is één naam voor het hele team, in welke taal ze ook
  werken, en dat hoort zo: ze praten met elkaar over dezelfde kolom.
*/
import { tekst } from './i18n'

const STAPPEN = [
  { key: 'request', tone: 'neutral' },
  { key: 'create offer', tone: 'accent' },
  { key: 'offer send', tone: 'accent' },
  { key: 'offer accepted', tone: 'solid' },
  { key: 'planning ongoing', tone: 'accent' },
  { key: 'planning ready', tone: 'success' },
  { key: 'ready to invoice', tone: 'warning' },
  { key: 'invoiced', tone: 'neutral' },
  { key: 'complete', tone: 'neutral' },
]

export const PIPELINE = STAPPEN.map(({ key, tone }) => ({
  key,
  tone,
  get label() {
    return tekst(`pijplijn.${key}`)
  },
}))

// Dezelfde stap, met zijn plaats in de rij erbij. Het label blijft een getter
// en wordt hier dus niet uitgelezen — anders stond de taal van het moment van
// laden erin vast.
const BY_KEY = Object.fromEntries(
  PIPELINE.map((p, i) => [
    p.key,
    {
      key: p.key,
      tone: p.tone,
      index: i,
      get label() {
        return p.label
      },
    },
  ])
)

/** De drie fasen waarin de lijstweergave de events groepeert. */
export const PHASES = [
  { label: 'Verkoop', sub: 'Aanvraag tot offerte', keys: ['request', 'create offer', 'offer send'] },
  { label: 'Voorbereiding', sub: 'Akkoord tot draaiboek', keys: ['offer accepted', 'planning ongoing', 'planning ready'] },
  { label: 'Facturatie', sub: 'Event voorbij', keys: ['ready to invoice', 'invoiced'] },
]

/** Uitleg per stap in Instellingen → Pijplijn. */
export const STEP_RULES = {
  request: 'Herinnering: klant, datum, gasten, offerte',
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
 * Wat er nog niet ingevuld is voor de offertestap.
 *
 * Dit wás een slot: een aanvraag kon niet naar de offertestap zolang klant,
 * datum, gasten en bedrag niet gekend waren. In de praktijk staat een event
 * vaak op de offertestap juist omdát die dingen nog uitgezocht worden — de
 * klant belt, je zet het dossier aan, en dan pas wordt er gerekend. Een tool
 * die dan "nee" zegt, wordt omzeild en niet gevolgd.
 *
 * Het blijft wel staan als herinnering op de fiche: wat ontbreekt hoort zicht-
 * baar te zijn, maar het werk niet tegen te houden.
 */
export function missingForOffer(event) {
  const missing = []
  if (!event.customerName) missing.push('klant')
  if (!event.eventDate) missing.push('datum')
  if (!event.pax) missing.push('gasten')
  if (!event.quoteAmount) missing.push('offertebedrag')
  return missing
}
