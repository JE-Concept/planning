import { eindeVan } from './eventdagen'
import { indexOf } from './pipeline'
import { isVerlopen, totalenVan } from './offerte'
import { planningVan } from './planning'
import { isDone } from './taak'

/**
 * De stand van één event, in één oordeel.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * Een event leeft in zeven schermen tegelijk: de pijplijn zegt waar het staat
 * tegenover de klant, de taken zeggen wat er nog moet, de offerte zegt of er
 * geld tegenover staat, het rooster zegt of er volk is. Wie wilde weten of
 * een dossier in orde was, moest die zeven plekken afgaan en zelf onthouden
 * wat er niet klopte. Dat is precies het werk dat een computer hoort te doen.
 *
 * ── Waarom het hier staat en niet in het scherm ───────────────────────────
 * Omdat het een oordeel is, en een oordeel hoort getest. "Dit event vraagt
 * aandacht" is een uitspraak die fout kan zijn, en dan is het erger dan geen
 * uitspraak: een waarschuwing die te vaak komt, leert iedereen wegklikken.
 *
 * ── Wat een aandachtspunt is, en wat niet ─────────────────────────────────
 * Alleen wat iemand vandaag kan oplossen én wat mis gaat als niemand het doet.
 * Een event zonder locatie drie maanden op voorhand is normaal; hetzelfde
 * event een week voor de datum is een probleem. De drempels staan hieronder
 * met naam, zodat ze te verleggen zijn zonder de code te lezen.
 */

/** Vanaf wanneer een gat in het dossier een probleem wordt, in dagen. */
export const DREMPELS = {
  // Binnen drie weken hoort de planning rond te zijn: personeel vastleggen
  // vraagt bij JE Concept ongeveer zo veel voorbereiding.
  planning: 21,
  // Twee weken voor de datum horen de gegevens te kloppen; daarna gaan er
  // bestellingen de deur uit die erop gebaseerd zijn.
  gegevens: 14,
  // Een week erna is een event dat niet gefactureerd is, vergeten geld.
  facturatie: 7,
}

const dagenTot = (datum, nu) => {
  const d = datum?.toDate?.() ?? (datum ? new Date(datum) : null)
  if (!d || Number.isNaN(d.getTime())) return null
  const dag = (x) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  return Math.round((dag(d) - dag(new Date(nu))) / 86400000)
}

/**
 * Hoe het met dit event staat.
 *
 * Alles wat binnenkomt mag ontbreken: het overzicht is het eerste wat een
 * scherm tekent en de rest van de gegevens komt per abonnement binnen. Een
 * dashboard dat pas iets toont als alles er is, toont een halve seconde lang
 * niets — en dat is precies de halve seconde waarin iemand beslist of de tool
 * traag is.
 */
export function standVan({
  event = null,
  tasks = [],
  offerte = null,
  mails = [],
  documenten = [],
  secondenGeboekt = 0,
  nu = new Date(),
} = {}) {
  /*
    Twee tellingen, want een meerdaags event heeft twee kantelpunten. `dagen`
    telt af naar de eerste dag: daar hangen de voorbereidingsdrempels aan, en
    die zijn op de begindag gericht — bestellingen moeten er zijn als het
    begint, niet als het eindigt. `dagenNa` telt vanaf de laatste dag, want
    factureren en taken afwerken kan pas als het achter de rug is. Bij een
    event van één dag zijn beide hetzelfde getal.
  */
  const dagen = dagenTot(event?.eventDate, nu)
  const dagenNa = dagenTot(eindeVan(event), nu)
  const stap = indexOf(event?.statusName)
  const planning = planningVan(event)

  const af = tasks.filter(isDone).length
  const taken = {
    totaal: tasks.length,
    af,
    open: tasks.length - af,
    deel: tasks.length ? af / tasks.length : null,
  }

  const totalen = offerte ? totalenVan(offerte.regels) : null
  const offerteStand = {
    stand: offerte?.status ?? 'geen',
    excl: totalen?.excl ?? null,
    incl: totalen?.incl ?? null,
    verlopen: Boolean(offerte && offerte.status === 'verstuurd' && isVerlopen(offerte, nu)),
  }

  const aandacht = []

  // ── Wat er aan het dossier zelf ontbreekt ──────────────────────────────
  const dichtbij = dagen != null && dagen <= DREMPELS.gegevens
  if (!event?.eventDate) aandacht.push('overzicht.let.geen_datum')
  if (!event?.customerId && !event?.customerName) aandacht.push('overzicht.let.geen_klant')
  if (dichtbij && !event?.pax) aandacht.push('overzicht.let.geen_gasten')
  if (dichtbij && !event?.location) aandacht.push('overzicht.let.geen_locatie')

  // ── De offerte ─────────────────────────────────────────────────────────
  // Vanaf "offerte opmaken" hoort er een offerte te zijn die verder staat dan
  // een concept. Daarvoor niet: dan is een concept precies wat het hoort te
  // zijn.
  if (stap >= indexOf('create offer')) {
    if (!offerte) aandacht.push('overzicht.let.geen_offerte')
    else if (offerte.status === 'concept') aandacht.push('overzicht.let.offerte_concept')
  }
  if (offerteStand.verlopen) aandacht.push('overzicht.let.offerte_verlopen')

  // ── De interne planning ────────────────────────────────────────────────
  if (dagen != null && dagen >= 0 && dagen <= DREMPELS.planning && planning?.key !== 'rond' && planning?.key !== 'nvt') {
    aandacht.push('overzicht.let.planning_open')
  }

  // ── Na afloop ──────────────────────────────────────────────────────────
  if (dagenNa != null && dagenNa < 0) {
    if (taken.open) aandacht.push('overzicht.let.taken_na_afloop')
    if (-dagenNa >= DREMPELS.facturatie && stap >= 0 && stap < indexOf('invoiced')) {
      aandacht.push('overzicht.let.niet_gefactureerd')
    }
  }

  return {
    dagen,
    stap,
    planning,
    taken,
    offerte: offerteStand,
    mail: { aantal: mails.length, laatste: mails[mails.length - 1] ?? null },
    tijd: { seconden: Math.max(0, Number(secondenGeboekt) || 0) },
    bijlagen: documenten.length,
    bestellijst: (event?.bestellijst ?? []).length,
    aandacht,
    // Eén woord voor hoe het ervoor staat, voor de badge bovenaan. Niet meer
    // dan drie standen: wie er vijf maakt, maakt er vijf die niemand uit
    // elkaar houdt.
    stand: aandacht.length ? (dagen != null && dagen <= DREMPELS.gegevens ? 'dringend' : 'aandacht') : 'rond',
  }
}
