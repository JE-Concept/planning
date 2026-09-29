import { dueOn, repeatLabel } from './checklist-templates'
import { formatDate, startOfDay } from './dates'
import { tekst } from './i18n'

/**
 * Een herhaling die klopt zodra je ze kiest.
 *
 * In de lijsteditor stond het poetsplan op "elke dag", en wie er iets anders
 * van probeerde te maken kreeg iets anders terug dan hij aanwees. De editor
 * hield namelijk één `repeat`-object bij en plakte alleen het nieuwe soort
 * erop. Twee dingen liepen daardoor mis:
 *
 *   — De terugval voor een punt zonder herhaling was `{ days: [0, 6] }`, het
 *     weekend. Koos je "één keer per week", dan las `dueOn` daar dag 0 uit en
 *     stond de wekelijkse poetsbeurt ineens op zondag. Niemand vroeg daarom.
 *   — De velden die bij het nieuwe soort horen werden nooit geschreven. De
 *     editor tóónde "de 1e van de maand" omdat het invoerveld op 1 terugvalt,
 *     maar er stond niets in de database. Wat je ziet en wat bewaard wordt,
 *     liepen uiteen.
 *
 * Vandaar één plek die per soort een volledige herhaling opbouwt: alleen de
 * velden die dat soort gebruikt, met een bruikbare standaard, en met wat je
 * eerder koos alleen overgenomen waar het dezelfde betekenis houdt.
 */

/**
 * De herhaling van een punt, ook als het er geen draagt.
 *
 * Dezelfde terugval als `dueOn`: geen herhaling betekent elke dag, en het oude
 * `weekendOnly` betekent zaterdag en zondag. Eén plek, zodat het scherm en de
 * berekening niet elk hun eigen standaard kunnen krijgen.
 */
export const herhalingVan = (item) =>
  item?.repeat ?? (item?.weekendOnly ? { kind: 'weekdag', days: [0, 6] } : { kind: 'dagelijks' })

/** Maandag t/m vrijdag: de standaard voor "op bepaalde dagen". */
const WERKDAGEN = [1, 2, 3, 4, 5]

const klem = (getal, min, max, terugval) => {
  const n = Number(getal)
  if (!Number.isFinite(n)) return terugval
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function herhalingVoor(kind, vorige = {}) {
  const oud = vorige ?? {}

  switch (kind) {
    case 'weekdag': {
      // Alleen dagen overnemen die ook als "bepaalde dagen" bedoeld waren; de
      // ene dag van een wekelijkse herhaling is geen keuze uit zeven vakjes.
      const dagen = oud.kind === 'weekdag' ? (oud.days ?? []) : oud.weekendOnly ? [0, 6] : []
      return { kind: 'weekdag', days: dagen.length ? [...dagen].sort((a, b) => a - b) : WERKDAGEN }
    }
    case 'wekelijks':
      // Maandag, tenzij er al één dag gekozen was. Het weekend van een oude
      // `weekendOnly` mag hier níét in: dat maakte er stilletjes zondag van.
      return { kind: 'wekelijks', days: [oud.kind === 'wekelijks' ? klem(oud.days?.[0], 0, 6, 1) : 1] }
    case 'maandelijks':
    case 'kwartaal':
      return { kind, dayOfMonth: klem(oud.dayOfMonth, 1, 31, 1) }
    case 'jaarlijks':
      return { kind: 'jaarlijks', month: klem(oud.month, 0, 11, 0), dayOfMonth: klem(oud.dayOfMonth, 1, 31, 1) }
    case 'dagelijks':
    default:
      return { kind: 'dagelijks' }
  }
}

/**
 * Wanneer dit punt de eerstvolgende keer moet.
 *
 * Staat naast de keuze in de editor, want "elk kwartaal, de 1e" zegt pas iets
 * als je erbij ziet dat dat 1 oktober is. Het is ook de enige manier om te
 * merken dat een keuze nergens op uitkomt: een punt op geen enkele dag van de
 * week geeft hier `null`, en dan is er iets mis met wat je koos.
 *
 * Dag voor dag vooruit in plaats van slim rekenen: twee jaar aflopen is een
 * paar honderd vergelijkingen en gebruikt exact dezelfde `dueOn` als de
 * werkvloer. Een eigen berekening ernaast zou op termijn iets anders zeggen
 * dan wat er 's ochtends op het scherm staat.
 */
export function volgendeKeer(repeat, vanaf = new Date()) {
  const dag = startOfDay(vanaf)
  for (let i = 0; i < 366 * 2; i += 1) {
    const kandidaat = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate() + i)
    if (dueOn({ repeat }, kandidaat)) return kandidaat
  }
  return null
}

/**
 * Wat er mis is met deze keuze, in gewone taal — of niets.
 *
 * Een punt zonder aangevinkte dag verdwijnt voorgoed uit de lijst zonder dat
 * iemand het merkt. Dat mag geen stille fout blijven bij een lijst die moet
 * bewijzen dat er gepoetst is.
 */
export function herhalingProbleem(repeat) {
  if (repeat?.kind === 'weekdag' && (repeat.days ?? []).length === 0) {
    return tekst('lijstlib.probleem.geen_dag')
  }
  return volgendeKeer(repeat) ? null : tekst('lijstlib.probleem.nooit')
}

/** "elke maandag · eerstvolgend maandag 5 oktober", zoals het onder de keuze staat. */
export function herhalingUitleg(repeat, vanaf = new Date()) {
  const volgende = volgendeKeer(repeat, vanaf)
  const label = repeatLabel({ repeat })
  if (!volgende) return label
  if (repeat?.kind === 'dagelijks' || !repeat?.kind) return label
  return tekst('lijstlib.uitleg.eerstvolgend', { label, datum: formatDate(volgende) })
}
