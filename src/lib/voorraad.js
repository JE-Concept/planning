import { dayKey } from './dates'

/**
 * Wat er vrij is, en wanneer.
 *
 * ── Waarom verhuurmateriaal niet als voorraad te tellen is ────────────────
 * Een tent gaat niet op. Ze is bezet van vrijdag tot maandag en daarna weer
 * vrij. "Hoeveel heb ik er nog" is dus geen getal maar een getal per dag, en
 * de vraag die iemand werkelijk stelt — "kan ik er drie van 12 tot 14 maart"
 * — is of er élke dag van die periode drie vrij zijn.
 *
 * Dat laatste is de reden dat dit bestand bestaat. De vanzelfsprekende fout
 * is kijken naar de eerste dag, of naar het gemiddelde. Vier vrij op de
 * twaalfde en nul op de dertiende is niet "gemiddeld twee vrij": het is niet
 * beschikbaar. Beschikbaar over een periode is het **minimum** over de dagen.
 *
 * ── Waarom er een uitlooptijd in zit ──────────────────────────────────────
 * Materiaal komt vuil en op een camion terug. Een bar die zondag terugkomt,
 * staat maandag niet opnieuw op een feest. Elk artikel draagt daarom
 * `uitloopDagen`, en die dagen tellen mee als bezet. Zonder dat belooft de
 * site dingen die het magazijn niet waarmaakt.
 *
 * ── Geen imports uit de Firebase-SDK ──────────────────────────────────────
 * Alles hier is rekenwerk op gewone objecten, zodat het ook server-side kan
 * draaien (`functions/voorraad-stand.js` gebruikt dezelfde regels) en zonder
 * browser te testen is.
 */

/**
 * De standen die een reservatie doorloopt.
 *
 * Dezelfde reeks als in het design system, waar ze ook voor tafels geldt:
 * nog niet zeker, vastgelegd, gebeurt nu, afgerond, valt weg. Voor materiaal
 * heet dat optie, vast, uit, terug, geannuleerd.
 */
export const STANDEN = ['optie', 'vast', 'uit', 'terug', 'geannuleerd']

/** Een reservatie die niet meetelt: afgezegd, of een optie die verlopen is. */
export function teltMee(reservatie, nu = new Date()) {
  if (!reservatie || reservatie.status === 'geannuleerd') return false
  if (reservatie.status !== 'optie') return true
  // Een optie zonder vervaldag blijft staan; met een verlopen vervaldag niet.
  const vervalt = reservatie.optieVervalt ? new Date(reservatie.optieVervalt) : null
  if (!vervalt || Number.isNaN(vervalt.getTime())) return true
  return vervalt.getTime() > nu.getTime()
}

/** Staat dit stuk fysiek buiten? Geboekt en buiten zijn twee verschillende dingen. */
export const isUit = (reservatie) => reservatie?.status === 'uit'

/** Hoogstens drie jaar aan dagen: een tikfout in een datum hoort niet het geheugen op te eten. */
const MAX_DAGEN = 1100

/**
 * De dagen die één reservatie bezet houdt, uitlooptijd inbegrepen.
 *
 * `van` en `tot` zijn allebei inbegrepen: huren van de twaalfde tot de
 * veertiende is drie dagen, niet twee. Zo staat het ook op de offerte en zo
 * rekent de klant.
 */
export function dagenVanReservatie(reservatie, uitloopDagen = 0) {
  const van = sleutel(reservatie?.van)
  /*
    Vroeger terug is eerder vrij.

    Komt een tent op zaterdag binnen terwijl ze tot maandag geboekt stond,
    dan is ze zondag beschikbaar — en dat hoort de kalender te weten, want
    anders staat ze er twee dagen voor niets. De uitlooptijd telt wél nog
    vanaf de dag dat ze echt terugkwam: ze moet nog altijd schoongemaakt.
  */
  const geboekt = sleutel(reservatie?.tot) || van
  const terug = sleutel(reservatie?.teruggebrachtOp)
  const tot = terug && terug < geboekt ? terug : geboekt
  if (!van) return []

  const dagen = []
  const loper = new Date(`${van}T12:00:00`)
  if (Number.isNaN(loper.getTime())) return []

  const laatste = nDagenLater(tot, Math.max(0, Math.round(uitloopDagen) || 0))
  while (dagen.length < MAX_DAGEN) {
    const dag = dayKey(loper)
    if (dag > laatste) break
    dagen.push(dag)
    loper.setDate(loper.getDate() + 1)
  }
  return dagen
}

const sleutel = (waarde) => {
  if (!waarde) return ''
  if (typeof waarde === 'string') return waarde.slice(0, 10)
  return dayKey(waarde)
}

const nDagenLater = (dag, n) => {
  if (!dag) return ''
  const d = new Date(`${dag}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dag
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/**
 * Hoeveel er per dag bezet is, opgesplitst naar vast en optie.
 *
 * De twee staan apart omdat ze iets anders betekenen. Een vaste reservatie is
 * weg; een optie is iemand die nog moet tekenen. Voor de publieke site telt
 * allebei als bezet — anders verkoop je hetzelfde twee keer — maar in de
 * backoffice wil je het verschil zien, want een optie is te bellen.
 */
export function bezetPerDag(reservaties = [], { uitloopDagen = 0, nu = new Date() } = {}) {
  const perDag = new Map()

  for (const reservatie of reservaties) {
    if (!teltMee(reservatie, nu)) continue
    const aantal = Math.max(0, Math.round(Number(reservatie.aantal) || 0))
    if (aantal === 0) continue

    const soort = reservatie.status === 'optie' ? 'optie' : 'vast'
    for (const dag of dagenVanReservatie(reservatie, uitloopDagen)) {
      const rij = perDag.get(dag) ?? { vast: 0, optie: 0 }
      rij[soort] += aantal
      perDag.set(dag, rij)
    }
  }

  return perDag
}

/** Wat er op één dag vrij is. Nooit negatief — overboeking lees je uit `conflicten`. */
export function vrijOp(materiaal, dag, perDag) {
  const bezet = perDag?.get?.(dag) ?? { vast: 0, optie: 0 }
  return Math.max(0, (Number(materiaal?.aantal) || 0) - bezet.vast - bezet.optie)
}

/**
 * Wat er over een hele periode vrij is.
 *
 * Het minimum over de dagen, en niet het gemiddelde of de eerste dag: wie
 * drie dagen huurt, heeft het stuk alle drie de dagen nodig.
 */
export function vrijInPeriode(materiaal, { van, tot }, perDag) {
  const dagen = dagenVanReservatie({ van, tot }, 0)
  if (!dagen.length) return Number(materiaal?.aantal) || 0
  return dagen.reduce((minste, dag) => Math.min(minste, vrijOp(materiaal, dag, perDag)), Infinity)
}

/**
 * De dagen waarop er meer beloofd is dan er staat.
 *
 * Dat kan echt gebeuren: twee mensen reserveren tegelijk, of iemand verhoogt
 * een aantal op een dossier dat al bevestigd was. Het scherm hoort dat te
 * tonen als een beslissing die iemand moet nemen — bijhuren, verzetten,
 * bellen — en niet als een foutmelding.
 */
export function conflicten(materiaal, perDag) {
  const aantal = Number(materiaal?.aantal) || 0
  const uit = []
  for (const [dag, bezet] of perDag ?? []) {
    const totaal = bezet.vast + bezet.optie
    if (totaal > aantal) uit.push({ dag, bezet: totaal, aantal, tekort: totaal - aantal })
  }
  return uit.sort((a, b) => (a.dag < b.dag ? -1 : 1))
}

/**
 * Een reeks dagen om een balk mee te tekenen.
 *
 * Geeft per dag wat er vrij is en hoe die dag heet, zodat een scherm er een
 * rij blokjes van kan maken zonder zelf te rekenen.
 */
export function reeks(materiaal, { van, dagen = 14 }, perDag) {
  const uit = []
  const loper = new Date(`${sleutel(van)}T12:00:00`)
  if (Number.isNaN(loper.getTime())) return uit

  for (let i = 0; i < Math.min(dagen, MAX_DAGEN); i += 1) {
    const dag = dayKey(loper)
    const bezet = perDag?.get?.(dag) ?? { vast: 0, optie: 0 }
    uit.push({
      dag,
      vast: bezet.vast,
      optie: bezet.optie,
      vrij: vrijOp(materiaal, dag, perDag),
      over: bezet.vast + bezet.optie > (Number(materiaal?.aantal) || 0),
    })
    loper.setDate(loper.getDate() + 1)
  }
  return uit
}

/**
 * Kan deze reservatie erbij?
 *
 * Geeft terug wat er vrij is en wat er gevraagd wordt, zodat de aanroeper een
 * zin kan maken in plaats van alleen ja of nee. Een bestaande reservatie die
 * gewijzigd wordt, telt niet tegen zichzelf: geef haar id mee in `behalve`.
 */
export function kanErbij({ materiaal, van, tot, aantal, reservaties = [], behalve = null, nu = new Date() }) {
  const andere = behalve ? reservaties.filter((r) => r.id !== behalve) : reservaties
  const perDag = bezetPerDag(andere, { uitloopDagen: materiaal?.uitloopDagen ?? 0, nu })
  const vrij = vrijInPeriode(materiaal, { van, tot }, perDag)
  const gevraagd = Math.max(0, Math.round(Number(aantal) || 0))
  return { kan: vrij >= gevraagd, vrij: vrij === Infinity ? (Number(materiaal?.aantal) || 0) : vrij, gevraagd }
}
