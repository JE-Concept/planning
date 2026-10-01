import { Badge, Bar, Hex, initialsOf } from '@components/ds'
import { asDate, huidigeLocaleVan } from '@lib/dates'
import { labelOf, toneOf } from '@lib/pipeline'
import { planningVan } from '@lib/planning'
import { isDone } from '@lib/taak'

/**
 * Kleine stukken die op meer dan één scherm terugkomen: de statusbadge, het
 * team als zeshoekjes, de voortgang van een event.
 */

/*
  De datums volgen de gekozen taal.

  Hier stonden tabellen met "jan, feb, mrt" en "maandag, dinsdag" in. Die
  blijven Nederlands zodra iemand in het Engels werkt, en dan staat er een
  woord op het scherm dat de lezer niet kent. De opmaaktaal komt uit
  `@lib/dates`, waar ze bij een taalwissel gezet wordt — één bron voor elke
  datum in de tool.

  De formatters worden per taal één keer gebouwd: `Intl.DateTimeFormat` is
  duurder dan het lijkt, en deze helpers draaien per rij van een lijst met
  honderden events.
*/
const TZ = 'Europe/Brussels'
const VORMEN = {
  dagmaand: { day: 'numeric', month: 'short' },
  tijd: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  dagkort: { weekday: 'short', day: 'numeric', month: 'short' },
  daglang: { weekday: 'long', day: 'numeric', month: 'long' },
  maand: { month: 'long' },
  maandkort: { month: 'short' },
  weekdag: { weekday: 'short' },
}
const formatters = new Map()

function formatter(vorm) {
  const sleutel = `${huidigeLocaleVan()}|${vorm}`
  let f = formatters.get(sleutel)
  if (!f) {
    f = new Intl.DateTimeFormat(huidigeLocaleVan(), { ...VORMEN[vorm], timeZone: TZ })
    formatters.set(sleutel, f)
  }
  return f
}

// Via `asDate`, want een ongeldige waarde laat `Intl` met een RangeError
// omvallen en die neemt tijdens het tekenen de hele pagina mee.
const opmaak = (vorm) => (d) => {
  const datum = asDate(d)
  return datum ? formatter(vorm).format(datum) : null
}

export const shortDate = opmaak('dagmaand')
export const dayLabel = opmaak('dagkort')
export const longDate = opmaak('daglang')
export const monthShort = (d) => opmaak('maandkort')(d) ?? ''
export const maandNaam = (d) => opmaak('maand')(d) ?? ''
export const weekdagKort = (d) => opmaak('weekdag')(d) ?? ''

/*
  ── De tijd van een event, als die iets zegt ───────────────────────────────

  Een event dat in de tool aangemaakt wordt, krijgt zijn datum op twaalf uur
  's middags. Dat is geen aanvangsuur maar een plaatshouder: de dag telt, het
  uur is nooit ingevuld. Hetzelfde geldt voor middernacht, dat uit een
  datumveld zonder tijd komt — "het feest begint om 00:00" is wat een kaart
  dan zou zeggen, en dat klopt zelden.

  Dus: een tijd verschijnt alleen wanneer iemand er echt een gezet heeft. Dat
  is wat "eventueel" betekent — niet "we tonen hem als het veld bestaat", maar
  "we tonen hem als hij iets toevoegt".
*/
const PLAATSHOUDERS = ['12:00', '00:00']

export function eventTijd(event) {
  // `startDate` gaat voor: dat is het veld waar een aanvangsuur in hoort. Pas
  // als dat leeg is, kan de datum zelf er nog een dragen — zo kwamen de
  // gemigreerde ClickUp-events binnen.
  for (const waarde of [event?.startDate, event?.eventDate]) {
    const datum = asDate(waarde)
    if (!datum) continue
    const tijd = opmaak('tijd')(datum)
    if (tijd && !PLAATSHOUDERS.includes(tijd)) return tijd
  }
  return null
}

/**
 * De ondertitel van een eventkaart: wanneer het is.
 *
 * Dit stond vroeger bóven de naam, met het concept ervoor en "Los event"
 * wanneer er geen concept was. Dat laatste is wat een kaart níét hoort te
 * zeggen: het is de afwezigheid van een merk, geen eigenschap van het feest,
 * en het stond op de helft van alle kaarten de naam in de weg.
 *
 * Nu komt de naam eerst en staat hieronder wanneer het is — en het merk
 * alleen wanneer er een is.
 */
export function eventOndertitel(event, { kort = false } = {}) {
  const datum = kort ? shortDate(event?.eventDate) : dayLabel(event?.eventDate)
  return [datum, eventTijd(event), event?.concept?.split(' — ')[0]].filter(Boolean).join(' · ')
}

export const euro = (n) => (n == null || n === '' ? null : `€ ${Number(n).toLocaleString('nl-BE')}`)

/** Uren als "21u30", zoals in het design. */
export const hours = (seconds) => {
  const m = Math.round((seconds ?? 0) / 60)
  return `${Math.floor(m / 60)}u${String(m % 60).padStart(2, '0')}`
}

export function StatusBadge({ statusName, statuses }) {
  return (
    <Badge tone={toneOf(statusName)} dot>
      {labelOf(statusName, statuses)}
    </Badge>
  )
}

/**
 * De stand van de planning, als badge.
 *
 * Geeft niets terug zolang niemand iets koos: een badge die op elk event staat
 * omdat er een standaardwaarde is, zegt niets meer. Zo is het overzicht stil
 * tot er iets te zeggen valt.
 */
export function PlanningBadge({ event, compact = false }) {
  const stand = planningVan(event)
  if (!stand) return null
  return (
    <Badge tone={stand.tone} dot={!compact}>
      {stand.label}
    </Badge>
  )
}

export function TeamHexes({ ids = [], profileById, size = 26 }) {
  return (
    <span style={{ display: 'flex', gap: 2 }}>
      {ids.slice(0, 4).map((id) => {
        const p = profileById[id]
        return (
          <Hex key={id} size={size} title={p?.fullName ?? p?.email}>
            {initialsOf(p)}
          </Hex>
        )
      })}
    </span>
  )
}

// De tekst erbij ("3/8 taken") wordt gemaakt waar ze getekend wordt: hier is
// geen `t` en een tekst die van de taal afhangt hoort niet in een rekensom.
export function progressOf(tasks = []) {
  const done = tasks.filter(isDone).length
  return {
    done,
    total: tasks.length,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  }
}

export function ProgressLine({ tasks }) {
  const p = progressOf(tasks)
  return <Bar pct={p.pct} />
}

export function paxLabel(e) {
  return e.pax ? `${e.pax} pax` : '— pax'
}
