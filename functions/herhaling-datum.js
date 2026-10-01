/**
 * Wanneer een herhaling valt — de kant van de server.
 *
 * ── Waarom dit een eigen bestand is zonder één import ─────────────────────
 * Omdat `tests/herhalingen.test.js` het naast `src/lib/herhaling.js` legt om
 * te bewijzen dat de browser en de planner hetzelfde rekenen. Stond deze
 * logica in `herhalingen.js`, dan sleept die test `firebase-functions` mee —
 * en dat pakket staat alleen in `functions/node_modules`, dat CI niet
 * installeert omdat de unittests van de app er niets mee te maken hebben.
 *
 * Precies dat is er gebeurd: lokaal draaide de test, in CI viel hij om op een
 * import die er niets mee te maken had. Een testbestand hoort niet de halve
 * Firebase-SDK nodig te hebben om een datum na te rekenen.
 *
 * Dus: nul afhankelijkheden hier. Wie er een toevoegt, breekt de drift-test
 * in CI en niet in zijn eigen werkmap.
 */

/* Maandag is 1, zondag is 7 — ISO, net als in het rooster en het poetsplan. */
const isoDag = (datum) => ((new Date(datum).getDay() + 6) % 7) + 1

export function isVervaldag(herhaling, datum) {
  if (!herhaling || herhaling.actief === false) return false
  const d = new Date(datum)
  if (Number.isNaN(d.getTime())) return false

  if (herhaling.soort === 'dagelijks') return true
  if (herhaling.soort === 'wekelijks') return (herhaling.dagen ?? []).includes(isoDag(d))
  if (herhaling.soort === 'maandelijks') return d.getDate() === (herhaling.dagVanMaand ?? 1)
  return false
}

export const dagSleutel = (datum) => {
  const d = new Date(datum)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Het vaste adres van de taak die deze herhaling vandaag maakt.
 *
 * Deterministisch, zodat een tweede poging op dezelfde dag — een herstart van
 * de functie, een uitrol die ertussen valt — exact hetzelfde document schrijft
 * in plaats van een tweede taak.
 */
export const sleutelVan = (herhalingId, datum) => `h-${herhalingId}-${dagSleutel(datum)}`

/**
 * De dag zoals Borgloon hem telt.
 *
 * De functie draait in UTC. Om 05:40 Brussel is het in de winter 04:40 UTC en
 * in de zomer 03:40 — dezelfde dag. Maar een maandelijkse herhaling op de 1e
 * zou bij een herstart rond middernacht op de 31e kunnen landen. Daarom wordt
 * de datum hier expliciet in de Belgische tijdzone bepaald en niet uit
 * `new Date()` gelezen.
 */
export function vandaagInBrussel(nu = new Date()) {
  const delen = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(nu)
  const [jaar, maand, dag] = delen.split('-').map(Number)
  // Middag, zodat omzetten naar lokale tijd nergens een dag verschuift.
  return new Date(jaar, maand - 1, dag, 12, 0, 0, 0)
}
