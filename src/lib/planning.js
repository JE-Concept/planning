import { tekst } from './i18n'

/**
 * Hoe ver de planning van een event staat.
 *
 * ── Waarom een eigen veld en geen taak ────────────────────────────────────
 * Dit stond als subtaak in de templates ("Personeelsplanning"), en dat werkte
 * niet: een taak is af of niet af, terwijl planning een toestand is die weken
 * duurt. Erger nog, een taak zie je alleen als je het event opent — precies
 * niet waar je hem nodig hebt. Wie op maandag naar het bord kijkt, wil in één
 * blik weten welke events nog niemand hebben staan.
 *
 * ── Waarom naast de pijplijn en niet erin ─────────────────────────────────
 * De pijplijn zegt waar het dossier staat tegenover de klant: aanvraag,
 * offerte, akkoord, factuur. De planning zegt of het intern rond is. Die twee
 * lopen niet gelijk — een event kan gefactureerd zijn terwijl het personeel al
 * lang rond was, en een event kan nog op "offerte verstuurd" staan terwijl het
 * materiaal al besproken is. Ze in elkaar schuiven zou betekenen dat je er één
 * kwijtspeelt.
 *
 * ── Waarom er geen standaardwaarde is ─────────────────────────────────────
 * Leeg is leeg. Zou elk event bij het aanmaken op "nog te plannen" staan, dan
 * kreeg elk afgelopen dossier uit de migratie diezelfde badge, en dan zegt de
 * badge niets meer. Ze verschijnt zodra iemand ze zet, en dan betekent ze iets.
 */

const STANDEN = [
  { key: 'te_plannen', tone: 'warning' },
  { key: 'bezig', tone: 'accent' },
  { key: 'rond', tone: 'success' },
  { key: 'nvt', tone: 'neutral' },
]

/*
  Het label is een getter, net als bij de pijplijn: zo wordt het opgezocht op
  het moment van tekenen en neemt een taalwissel het mee. Een vaste waarde zou
  na het omzetten de oude taal blijven tonen tot iemand de pagina herlaadt.
*/
export const PLANNING = STANDEN.map(({ key, tone }) => ({
  key,
  tone,
  get label() {
    return tekst(`planning.${key}`)
  },
}))

const BY_KEY = Object.fromEntries(PLANNING.map((p) => [p.key, p]))

/** De stand van dit event, of niets wanneer er nog niemand iets koos. */
export function planningVan(event) {
  return BY_KEY[event?.planning] ?? null
}

/** Of dit een stand is die we kennen. Alles daarbuiten telt als leeg. */
export const isPlanning = (waarde) => Boolean(BY_KEY[waarde])

/*
  De kleur die bij een stand hoort, voor plekken waar geen badge past — een
  kalenderchip van tachtig pixels bijvoorbeeld. Dezelfde tonen als de badge,
  zodat het bord en de kalender over hetzelfde ding hetzelfde zeggen.
*/
const KLEUR = {
  warning: 'var(--warning)',
  accent: 'var(--accent)',
  success: 'var(--success)',
  neutral: 'var(--text-3)',
}

/** De kleur van de planningstand, of niets wanneer er geen stand is. */
export function planningKleur(event) {
  const stand = planningVan(event)
  return stand ? KLEUR[stand.tone] ?? KLEUR.neutral : null
}

/** De keuzes voor een lijstje, met "nog niet ingevuld" vooraan. */
export function planningKeuzes() {
  return [{ value: '', label: tekst('planning.leeg') }, ...PLANNING.map((p) => ({ value: p.key, label: p.label }))]
}
