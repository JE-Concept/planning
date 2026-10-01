/**
 * Tijd uit AAPI: Brusselse klokslagen omzetten naar echte tijdstippen.
 *
 * ── Waarom dit een eigen bestand is ───────────────────────────────────────
 * AAPI schrijft `2026-10-25 05:00:00.000` zonder tijdzone. Dat is geen
 * tijdstip maar een klokstand: wat er op de klok in Rummen stond. Om er een
 * tijdstip van te maken moet je weten welke offset er op dát moment gold, en
 * die verandert twee keer per jaar.
 *
 * Dat is hier geen theorie. Het voorbeeldbestand draagt zijn drukste dag op
 * **25 oktober 2026**, en dat is precies de nacht waarin de klok teruggaat.
 * Een shift van 05:00 die dag staat op +01:00 en niet op +02:00; wie dat mist,
 * zet elke shift van die dag een uur verkeerd — en dan matcht hij met het
 * verkeerde event of met geen.
 *
 * `@lib/dates` lost dit niet op: `dayKey()` en `startOfDay()` daar rekenen in
 * de lokale tijd van de machine. In de browser van het team is dat Brussel, in
 * een Cloud Function is dat UTC. Deze functies noemen de zone dus met naam.
 *
 * Geen imports: dit bestand moet te testen zijn zonder firebase-functions, net
 * als `functions/herhaling-datum.js`. Zie daar waarom dat uitmaakt.
 */

export const ZONE = 'Europe/Brussels'

const DELEN = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** De klokstand in Brussel op dit tijdstip, als losse getallen. */
function brusselseDelen(instant) {
  const uit = {}
  for (const deel of DELEN.formatToParts(instant)) {
    if (deel.type !== 'literal') uit[deel.type] = Number(deel.value)
  }
  // Middernacht komt er bij sommige runtimes als uur 24 uit.
  if (uit.hour === 24) uit.hour = 0
  return uit
}

/** Hoeveel minuten Brussel op dit tijdstip vóór UTC loopt (+60 of +120). */
export function offsetMinuten(instant) {
  const d = brusselseDelen(instant)
  const alsofUtc = Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute, d.second)
  return (alsofUtc - instant.getTime()) / 60000
}

/**
 * `2026-10-25 05:00:00.000` → het echte tijdstip.
 *
 * Twee passen: de offset hangt af van het tijdstip dat je nog aan het uitrekenen
 * bent. Eerst schatten met de offset die geldt alsof de klokstand UTC was, dan
 * met de offset die op die schatting geldt. Na twee passen klopt het, ook op de
 * dag van de omschakeling.
 *
 * Het uur dat 's nachts twee keer voorkomt (02:00–03:00 bij het terugzetten)
 * kan deze functie niet uit elkaar houden — niemand kan dat, want de bron zegt
 * het niet. Ze kiest er één en blijft daar consequent in. Voor een shift maakt
 * dat één uur verschil in een nacht waarin niemand van ons werkt.
 */
export function brusselNaarInstant(tekst) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(tekst ?? '').trim())
  if (!m) return null

  const klok = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  let instant = new Date(klok - offsetMinuten(new Date(klok)) * 60000)
  instant = new Date(klok - offsetMinuten(instant) * 60000)
  return instant
}

/** De kalenderdag in Brussel waarop dit tijdstip valt: `2026-10-25`. */
export function brusselseDag(instant) {
  const d = brusselseDelen(instant instanceof Date ? instant : new Date(instant))
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

/** Het begin van die Brusselse dag, als tijdstip. */
export function beginVanDag(dag) {
  return brusselNaarInstant(`${dag} 00:00:00`)
}

/** Het einde van die Brusselse dag — de laatste milliseconde. */
export function eindeVanDag(dag) {
  const volgende = new Date(beginVanDag(dag).getTime() + 36 * 3600 * 1000)
  return new Date(beginVanDag(brusselseDag(volgende)).getTime() - 1)
}

/** Elke Brusselse dag die dit bereik raakt, van vroeg naar laat. */
export function dagenTussen(van, tot) {
  const dagen = []
  let dag = brusselseDag(van)
  const laatste = brusselseDag(tot)
  // Een ruime stap vooruit en dan terugrekenen naar de dag: 24 uur optellen
  // gaat mis op de dag dat die 23 of 25 uur duurt.
  for (let i = 0; i < 400 && dag <= laatste; i++) {
    dagen.push(dag)
    dag = brusselseDag(new Date(beginVanDag(dag).getTime() + 36 * 3600 * 1000))
  }
  return dagen
}
