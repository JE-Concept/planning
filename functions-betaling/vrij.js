/**
 * Is er genoeg vrij? — de strenge versie, voor de kassa.
 *
 * ── Waarom dit niet `src/lib/voorraad.js` is ──────────────────────────────
 * Omdat het een andere vraag beantwoordt. In de backoffice mág je
 * overboeken: wie het nodig heeft huurt bij of belt de andere klant, en een
 * slot dat niet opengaat levert een reservatie op een papiertje op. Daar is
 * "te weinig" een waarschuwing.
 *
 * Hier is het een weigering. Een vreemde die op zijn telefoon afrekent, kan
 * niemand bellen en kan niet bijhuren. Verkoopt de site twee keer dezelfde
 * tent, dan staat er zaterdag iemand voor een gesloten magazijn met een
 * betaalbewijs in de hand. Dat is geen waarschuwing waard maar een "nee".
 *
 * Dus twee modules met opzet, en niet één met een vlaggetje: het verschil
 * zit niet in een instelling maar in wat het antwoord betekent.
 *
 * ── En hoe blijft dit gelijklopen met de backoffice? ───────────────────────
 * Wat hier wél hetzelfde moet zijn, is het tellen: welke standen bezet
 * houden, hoe de uitlooptijd meetelt, en wat er gebeurt als iets vroeger
 * terugkomt. Dat is één regel die op twee plekken staat, en dus loopt er een
 * test (`tests/voorraad-server.test.js`) die beide implementaties dezelfde
 * gevallen voorlegt en eist dat ze hetzelfde antwoord geven. Loopt er iets
 * uiteen, dan valt die test om vóór er een tent dubbel verhuurd is.
 */

/**
 * Hoogstens drie jaar aan dagen per reservatie — net als in de tool. Een
 * tikfout in een jaartal hoort niet het geheugen van de functie op te eten.
 */
const MAX_DAGEN = 1100

const dagsleutel = (d) => {
  const datum = d instanceof Date ? d : new Date(`${d}T12:00:00`)
  if (Number.isNaN(datum.getTime())) return null
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`
}

const volgende = (sleutel) => {
  const d = new Date(`${sleutel}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return dagsleutel(d)
}

/** Alle dagsleutels van `van` tot en met `tot`. */
export function dagenTussen(van, tot) {
  const start = dagsleutel(van)
  const eind = dagsleutel(tot ?? van)
  if (!start || !eind || eind < start) return []
  const uit = []
  // Ruime bovengrens: een huur van meer dan een jaar bestaat hier niet, en
  // zonder grens maakt een verkeerde datum uit een formulier een oneindige lus.
  for (let dag = start; dag <= eind && uit.length < MAX_DAGEN; dag = volgende(dag)) uit.push(dag)
  return uit
}

/**
 * Telt deze reservatie mee? Alles behalve afgezegd en een verlopen optie.
 *
 * ── Waarom een lijst van wat níét meetelt ─────────────────────────────────
 * Hier stond eerst een lijst van standen die wél bezet houden, en daar zat
 * `terug` niet bij. Dat klinkt juist — het stuk is binnen — maar het is fout:
 * een tent die terug is, moet nog gewassen worden, en die uitloopdag hangt
 * aan de reservatie. Met de lijst andersom was die dag vrij en verkocht de
 * site een natte tent. Een onbekende stand telt daarom óók mee: bij twijfel
 * bezet, want dat kost hoogstens een telefoontje en het omgekeerde kost een
 * dubbele boeking.
 *
 * Dezelfde regel als `teltMee` in `src/lib/voorraad.js`, en
 * `tests/betaalmotor.test.js` houdt beide naast elkaar.
 */
function teltMee(reservatie, nu) {
  if (!reservatie || reservatie.status === 'geannuleerd') return false
  if (reservatie.status !== 'optie') return true
  // Een optie zonder vervaldag blijft staan; met een verlopen vervaldag niet.
  const vervalt = reservatie.optieVervalt
  if (!vervalt) return true
  const moment = vervalt?.toDate?.() ?? new Date(vervalt)
  return Number.isNaN(moment.getTime()) ? true : moment > nu
}

/**
 * Welke dagen houdt deze reservatie bezet, uitlooptijd inbegrepen?
 *
 * Kwam het stuk vroeger terug dan geboekt, dan tellen de dagen daarna niet
 * meer mee: het ligt in het magazijn en mag opnieuw de deur uit.
 */
export function dagenVanReservatie(reservatie, uitloopDagen = 0) {
  const van = dagsleutel(reservatie?.van)
  if (!van) return []

  const geboekt = dagsleutel(reservatie?.tot) || van
  const terug = dagsleutel(reservatie?.teruggebrachtOp)
  const tot = terug && terug < geboekt ? terug : geboekt

  const dagen = dagenTussen(van, tot)
  // De uitloop hangt aan de laatste dag dat het stuk buiten was, niet aan de
  // geboekte einddatum: een tent die maandag terugkomt in plaats van woensdag,
  // is dinsdag al gewassen.
  for (let i = 0; i < Math.max(0, Math.round(uitloopDagen)); i += 1) {
    dagen.push(volgende(dagen[dagen.length - 1] ?? tot))
  }
  return dagen
}

/** Hoeveel stuks er per dag bezet zijn. */
export function bezetPerDag(reservaties = [], { uitloopDagen = 0, nu = new Date() } = {}) {
  const perDag = new Map()
  for (const r of reservaties) {
    if (!teltMee(r, nu)) continue
    const aantal = Math.max(0, Math.round(Number(r.aantal) || 0))
    for (const dag of dagenVanReservatie(r, uitloopDagen)) {
      perDag.set(dag, (perDag.get(dag) ?? 0) + aantal)
    }
  }
  return perDag
}

/**
 * Past deze vraag erbij? Bij twijfel: nee.
 *
 * `vrij` is het minimum over alle dagen van de periode — niet het gemiddelde
 * en niet dat van de eerste dag. Een tent die vier van de vijf dagen vrij is,
 * is niet vrij.
 */
export function past({ materiaal, van, tot, aantal, reservaties = [], nu = new Date() }) {
  const gevraagd = Math.max(0, Math.round(Number(aantal) || 0))
  const voorraad = Math.max(0, Math.round(Number(materiaal?.aantal) || 0))
  const dagen = dagenTussen(van, tot)

  if (gevraagd <= 0 || dagen.length === 0) return { kan: false, vrij: 0, gevraagd, reden: 'onvolledig' }

  const perDag = bezetPerDag(reservaties, { uitloopDagen: materiaal?.uitloopDagen ?? 0, nu })
  let vrij = voorraad
  for (const dag of dagen) vrij = Math.min(vrij, voorraad - (perDag.get(dag) ?? 0))
  vrij = Math.max(0, vrij)

  return { kan: vrij >= gevraagd, vrij, gevraagd, reden: vrij >= gevraagd ? null : 'te_weinig' }
}
