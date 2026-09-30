import { centen } from './formules'
import { tekst } from './i18n'

/**
 * De offerte: wat een event kost, en hoe dat belast wordt.
 *
 * ── Waarom dit rekenwerk hier staat en niet op het scherm ─────────────────
 * Eén fout in een btw-tarief is geen schoonheidsfoutje maar een factuur die
 * niet klopt, en die fout is in de oude Canva-offertes echt gemaakt: daar stond
 * 6% op catering waar 12% hoort. Wat hier staat, staat er één keer, met tests
 * erop, en het scherm rekent niets zelf uit.
 *
 * ── De regel waar het altijd op misloopt ──────────────────────────────────
 * Een prijs per persoon die zowel eten als drank dekt, mag niet als één lijn op
 * de offerte. Dan wordt het geheel aan 21% belast. Ze moet gesplitst worden:
 * het spijzendeel aan 12%, het drankendeel aan 21%. JE Concept hanteert
 * daarvoor 70/30 — bij 49,50 per persoon is dat 34,65 spijzen en 14,85 dranken.
 *
 * ── Levering of dienst ────────────────────────────────────────────────────
 * Zet je het eten af en vertrek je weer, dan is het een levering: 6% op
 * voeding. Is er bediening, materiaal, opstelling of personeel ter plaatse, dan
 * is het een dienst: 12% op spijzen. De drempel ligt laag — een foodtruck met
 * twee statafels is al consumptie ter plaatse. Alles wat JE Concept met Ofyr,
 * walking dinners en buffetten doet, is een dienst.
 *
 * Bedragen staan overal exclusief btw en op de cent, net als in `formules.js`.
 */

// ─── Btw ───────────────────────────────────────────────────────────────────

/** De tarieven, per soort post. Stand september 2026. */
export const BTW = {
  spijzen_dienst: 12,
  spijzen_levering: 6,
  dranken: 21,
  materiaal: 21,
  personeel: 21,
  animatie: 21,
  overig: 21,
}

/**
 * Het tarief dat bij een rubriek hoort.
 *
 * `levering` maakt alleen voor de spijzen verschil: dranken, materiaal en
 * personeel staan hoe dan ook op 21%.
 */
export function btwVoor(rubriek, { levering = false } = {}) {
  if (rubriek === 'catering') return levering ? BTW.spijzen_levering : BTW.spijzen_dienst
  return BTW[rubriek] ?? BTW.overig
}

/** Hoe een all-inprijs verdeeld wordt over spijzen en dranken. */
export const SPLITSING = { spijzen: 0.7, dranken: 0.3 }

/**
 * Eén prijs per persoon uit elkaar halen in een spijzen- en een drankenlijn.
 *
 * De verdeling moet redelijk en onderbouwbaar zijn; 70/30 is wat JE Concept
 * hanteert en wat met hun kostprijsverhouding overeenkomt. Wie het anders weet
 * voor deze opdracht, geeft een andere `verdeling` mee.
 */
export function splitsAllIn({ perPersoon, personen, omschrijving = '', verdeling = SPLITSING, levering = false }) {
  const prijs = centen(Number(perPersoon) || 0)
  const aantal = Math.max(0, Math.round(Number(personen) || 0))
  if (!prijs || !aantal) return []

  const spijzen = centen(prijs * verdeling.spijzen)
  // De rest en niet nog eens een percentage: anders valt er bij een oneven
  // bedrag een cent tussen de twee lijnen door.
  const dranken = centen(prijs - spijzen)

  return [
    maakRegel({
      rubriek: 'catering',
      omschrijving: omschrijving ? `${omschrijving} — spijzen` : tekst('offerte.spijzen'),
      eenheidExcl: spijzen,
      aantal,
      eenheid: 'pp',
      btwPercent: btwVoor('catering', { levering }),
    }),
    maakRegel({
      rubriek: 'dranken',
      omschrijving: omschrijving ? `${omschrijving} — dranken` : tekst('offerte.dranken'),
      eenheidExcl: dranken,
      aantal,
      eenheid: 'pp',
      btwPercent: BTW.dranken,
    }),
  ]
}

// ─── De regels van een offerte ─────────────────────────────────────────────

/**
 * De rubrieken van de offertetabel, in de volgorde waarin ze op papier staan.
 *
 * Vaste volgorde en geen vrije tekst: een offerte waarin "Dranken" de ene keer
 * boven en de andere keer onder het personeel staat, leest als twee bedrijven.
 */
export const RUBRIEKEN = ['basis', 'catering', 'dranken', 'personeel', 'optioneel']

let teller = 0
const nieuwId = () => `r${Date.now().toString(36)}${(teller++).toString(36)}`

/** Eén lijn, met alles ingevuld wat de tabel nodig heeft. */
export function maakRegel({
  id = null,
  rubriek = 'catering',
  omschrijving = '',
  eenheidExcl = 0,
  aantal = 1,
  eenheid = 'st',
  btwPercent = null,
  optioneel = false,
}) {
  const echteRubriek = RUBRIEKEN.includes(rubriek) ? rubriek : 'catering'
  return {
    id: id ?? nieuwId(),
    rubriek: echteRubriek,
    omschrijving,
    eenheidExcl: centen(Number(eenheidExcl) || 0),
    aantal: Number(aantal) || 0,
    eenheid,
    btwPercent: Number(btwPercent ?? btwVoor(echteRubriek)),
    // Wat optioneel is telt niet mee in het totaal: het staat er om te kiezen,
    // niet om te betalen. Zou het meetellen, dan schrikt het bedrag de klant af
    // voor hij de keuze gelezen heeft.
    optioneel: Boolean(optioneel) || echteRubriek === 'optioneel',
  }
}

/** Wat één lijn kost, exclusief btw. */
export const regelBedrag = (regel) => centen((Number(regel?.eenheidExcl) || 0) * (Number(regel?.aantal) || 0))

/**
 * De totalen.
 *
 * Per tarief optellen en pas dán de btw rekenen — per regel afronden laat een
 * paar cent verschil na met wat de boekhouding op de factuur zet. Dezelfde
 * volgorde als in `formules.js`, met opzet.
 */
export function totalenVan(regels = []) {
  const meetellend = (regels ?? []).filter((r) => r && !r.optioneel)

  const perTarief = new Map()
  for (const regel of meetellend) {
    const tarief = Number(regel.btwPercent) || 0
    perTarief.set(tarief, centen((perTarief.get(tarief) ?? 0) + regelBedrag(regel)))
  }

  const btwRegels = [...perTarief.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([percent, basis]) => ({ percent, basis, btw: centen((basis * percent) / 100) }))

  const excl = centen(meetellend.reduce((a, r) => a + regelBedrag(r), 0))
  const btw = centen(btwRegels.reduce((a, r) => a + r.btw, 0))

  return {
    btwRegels,
    excl,
    btw,
    incl: centen(excl + btw),
    optioneelExcl: centen((regels ?? []).filter((r) => r?.optioneel).reduce((a, r) => a + regelBedrag(r), 0)),
  }
}

/** De lijnen per rubriek, in de volgorde van de tabel en zonder lege rubrieken. */
export function perRubriek(regels = []) {
  return RUBRIEKEN.map((rubriek) => ({
    rubriek,
    regels: (regels ?? []).filter((r) => r?.rubriek === rubriek),
  })).filter((groep) => groep.regels.length)
}

// ─── De vaste prijsregels van het huis ─────────────────────────────────────

/** Toog en bediening: altijd apart, nooit in de persoonsprijs verstopt. */
export const UURPRIJS_PERSONEEL = 28

/** De drankenformule: twee uur inbegrepen, daarna per uur. */
export const DRANKEN_BASIS = 15
export const DRANKEN_PER_EXTRA_UUR = 5

/**
 * Wat de drankenformule per persoon kost voor dit aantal uren.
 *
 * Onder de twee uur blijft het de basisprijs: de kost zit in het opzetten van
 * de toog, niet in de klok.
 */
export function drankenPrijs(uren) {
  const u = Math.max(0, Number(uren) || 0)
  if (!u) return 0
  return centen(DRANKEN_BASIS + Math.max(0, Math.ceil(u - 2)) * DRANKEN_PER_EXTRA_UUR)
}

/** Wat bediening kost: uren maal mensen maal het uurtarief. */
export const personeelsPrijs = (uren, mensen = 1) =>
  centen(Math.max(0, Number(uren) || 0) * Math.max(0, Number(mensen) || 0) * UURPRIJS_PERSONEEL)

/**
 * De kinderprijs: 1,50 euro per levensjaar, tot en met twaalf.
 *
 * Met één rem erop: nooit meer dan de volwassenprijs van dezelfde formule. Bij
 * een goedkopere formule zoals het ontbijtbuffet loopt de regel daar anders
 * overheen, en dan betaalt een kind van twaalf meer dan zijn vader.
 */
export function kinderprijs(leeftijd, volwassenprijs, { vast = null } = {}) {
  const jaar = Math.max(0, Number(leeftijd) || 0)
  if (jaar > 12) return centen(volwassenprijs)
  if (vast != null) return centen(Math.min(vast, volwassenprijs))
  return centen(Math.min(jaar * 1.5, volwassenprijs))
}

/**
 * Of de foodcost klopt.
 *
 * Vuistregel van het huis: rond 30% van de persoonsprijs gaat naar inkoop.
 * Ligt de raming er ver onder, dan is de prijs te hoog ingeschat of vergeet je
 * iets; ligt ze erboven, dan verdien je er niets aan. Dit oordeel is intern en
 * hoort nooit in het document dat de klant ziet.
 */
export function foodcostOordeel(perPersoon, inkoopPerPersoon) {
  const prijs = centen(perPersoon)
  const inkoop = centen(inkoopPerPersoon)
  if (!prijs || !inkoop) return null

  const deel = inkoop / prijs
  const percent = Math.round(deel * 100)
  if (deel > 0.36) return { percent, oordeel: 'hoog', sleutel: 'offerte.foodcost_hoog' }
  if (deel < 0.24) return { percent, oordeel: 'laag', sleutel: 'offerte.foodcost_laag' }
  return { percent, oordeel: 'goed', sleutel: 'offerte.foodcost_goed' }
}

// ─── Voorwaarden: voorschot, geldigheid, annulatie ─────────────────────────

/** Het voorschot waarmee de datum vastligt. */
export const VOORSCHOT_DEEL = 0.3
export const voorschotVan = (excl) => centen((Number(excl) || 0) * VOORSCHOT_DEEL)

/** Een offerte blijft dertig dagen geldig. */
export const GELDIG_DAGEN = 30

export function geldigTot(datum = new Date()) {
  const d = new Date(datum)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + GELDIG_DAGEN)
  return d
}

export const isVerlopen = (offerte, nu = new Date()) => {
  const tot = offerte?.geldigTot ? new Date(offerte.geldigTot) : null
  return Boolean(tot) && !Number.isNaN(tot.getTime()) && tot.getTime() < new Date(nu).getTime()
}

/**
 * Wat een annulatie kost, naar hoeveel dagen op voorhand.
 *
 * Van boven naar beneden gelezen, zoals de tabel in de voorwaarden: de eerste
 * regel die past, geldt.
 */
export const ANNULATIE = [
  { vanaf: 60, deel: 0.1 },
  { vanaf: 30, deel: 0.3 },
  { vanaf: 14, deel: 0.5 },
  { vanaf: 7, deel: 0.75 },
  { vanaf: 0, deel: 1 },
]

export function annulatieDeel(dagenVoor) {
  const dagen = Number(dagenVoor)
  if (!Number.isFinite(dagen)) return 1
  return ANNULATIE.find((rij) => dagen > rij.vanaf)?.deel ?? 1
}

export const annulatieKosten = (excl, dagenVoor) => centen((Number(excl) || 0) * annulatieDeel(dagenVoor))

// ─── Een offerte uit een event ─────────────────────────────────────────────

/** Het nummer op het document: het jaar en een volgnummer, zoals een factuur. */
export const offerteNummer = (datum = new Date(), volgnummer = 1) =>
  `${new Date(datum).getFullYear()}-${String(Math.max(1, Math.round(volgnummer))).padStart(3, '0')}`

/**
 * De eerste versie van een offerte, uit wat er van het event al bekend is.
 *
 * Dit is een vertrekpunt en geen eindpunt: het team past er altijd nog iets
 * aan. Daarom staat er liever een lijn te weinig dan een lijn die iemand moet
 * gaan zoeken om ze weg te halen.
 *
 * De formule levert al posten met hun eigen tarief (eten 12%, drank 21%) —
 * die worden lijn per lijn overgenomen. Is er geen formule maar wel een
 * offertebedrag, dan is dat één prijs die eten én drank dekt, en die wordt
 * gesplitst. Precies de regel waar het anders misloopt.
 */
export function offerteVanEvent({ event, prijs = null, nu = new Date(), volgnummer = 1 } = {}) {
  const personen = Math.max(0, Math.round(Number(event?.pax ?? event?.guests) || 0))

  const regels = []

  if (prijs?.regels?.length) {
    for (const post of prijs.regels) {
      const dranken = Number(post.btwPercent) === BTW.dranken
      regels.push(
        maakRegel({
          rubriek: dranken ? 'dranken' : 'catering',
          omschrijving: post.label,
          // Een post kan per persoon én een vast deel hebben; per persoon is
          // wat op de tabel hoort, het vaste deel wordt een eigen lijn.
          eenheidExcl: post.perPersoon || post.vast,
          aantal: post.perPersoon ? personen : 1,
          eenheid: post.perPersoon ? 'pp' : 'st',
          btwPercent: post.btwPercent,
        })
      )
    }
  } else if (event?.quoteAmount && personen) {
    regels.push(
      ...splitsAllIn({
        perPersoon: centen(Number(event.quoteAmount) / personen),
        personen,
        omschrijving: event?.formuleNaam || event?.name || '',
      })
    )
  }

  return {
    eventId: event?.id ?? null,
    nummer: offerteNummer(nu, volgnummer),
    datum: new Date(nu),
    geldigTot: geldigTot(nu),
    klantId: event?.customerId ?? null,
    klantNaam: event?.customerName ?? '',
    eventNaam: event?.name ?? '',
    eventDatum: event?.date ?? null,
    locatie: event?.location ?? '',
    personen,
    regels,
    status: 'concept',
  }
}

/**
 * Wat er nog gevraagd moet worden voor deze offerte de deur uit kan.
 *
 * Kort houden: drie of vier punten die er echt toe doen. Een lijst van tien
 * leest niemand, en dan valt ook het ene punt weg dat wél belangrijk was.
 */
export function ontbrekend(offerte, event = null) {
  const uit = []
  if (!offerte?.personen) uit.push('offerte.mist_personen')
  if (!offerte?.klantNaam) uit.push('offerte.mist_klant')
  if (!offerte?.regels?.length) uit.push('offerte.mist_regels')
  if (!(event?.date ?? offerte?.eventDatum)) uit.push('offerte.mist_datum')
  if (offerte?.regels?.length && !offerte.regels.some((r) => r.rubriek === 'dranken')) {
    uit.push('offerte.mist_dranken')
  }
  return uit
}

/** De vier standen waarin een offerte kan staan. */
export const STANDEN = ['concept', 'verstuurd', 'goedgekeurd', 'feedback']

export const isBeantwoord = (offerte) => offerte?.status === 'goedgekeurd' || offerte?.status === 'feedback'
