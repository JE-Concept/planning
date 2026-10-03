/**
 * Wat een event opbracht, en wat het kostte.
 *
 * ── Waarom dit er is ──────────────────────────────────────────────────────
 * Van elk dossier staat vast wat het opbracht, en van geen enkel wat het
 * kostte. Daardoor is "verdient een Winter BBQ van veertig personen eigenlijk
 * iets" een gesprek over gevoel. Hier wordt het een getal, uit gegevens die
 * allemaal al in de tool staan: het offertebedrag, de shifts uit AAPI, de
 * bestellijst en de geboekte uren.
 *
 * ── Drie regels die het verschil maken tussen nuttig en misleidend ────────
 *
 * **Een ontbrekend gegeven is geen nul.** Een bestellijstregel zonder
 * inkoopprijs kost niet niets; we weten alleen niet wat ze kost. Zou ze als
 * nul meetellen, dan ziet een half ingevuld dossier er winstgevender uit dan
 * een volledig ingevuld — precies de verkeerde kant op. Dus telt ze niet mee
 * en staat ze in `ontbreekt`, en heet de marge onvolledig tot dat opgelost is.
 *
 * **Loon is een raming, geen loonstaat.** De uren komen uit AAPI en worden
 * hier vermenigvuldigd met een tarief per statuut dat het team zelf instelt.
 * Dat is een planningscijfer om een formule mee te beoordelen, geen bedrag dat
 * iemand uitbetaald krijgt. Daarom staat het altijd samengeteld en nooit per
 * persoon: wie wat verdient hoort in AAPI en niet hier. Zie `CLAUDE.md`.
 *
 * **Alles exclusief btw.** De offerte rekent in bedragen exclusief btw en de
 * bestellijst ook. Eén bedrag inclusief ertussen maakt van de marge een getal
 * dat niemand kan narekenen.
 */

/** De statuten waarvoor een uurkost ingesteld kan worden; de volgorde van het scherm. */
export const STATUTEN = ['vast', 'flexi', 'student', 'zelfstandig', 'extern', 'onbekend']

/*
  Er staan met opzet geen standaardtarieven in dit bestand.

  Een verzonnen uurkost geeft een marge die eruitziet als een meting, en
  daar worden beslissingen op genomen. Zolang er niets ingesteld is, telt
  loon niet mee en zegt het scherm dat erbij.
*/

/**
 * Een bedrag, of niets.
 *
 * `Number(null)` is nul en `Number('')` ook, en dat is hier precies het
 * verkeerde antwoord: een leeg prijsveld zou dan een regel van nul euro
 * worden en de marge stilletjes te mooi maken. Daarom eerst kijken of er
 * überhaupt iets ingevuld is.
 */
const getal = (waarde) => {
  if (waarde === null || waarde === undefined || waarde === '') return null
  const n = Number(waarde)
  return Number.isFinite(n) ? n : null
}

/** Twee cijfers na de komma, zonder de drijvende-kommastaart. */
const cent = (n) => Math.round(n * 100) / 100

/**
 * De gewerkte minuten van een shift: de duur min de pauze.
 *
 * Staat ook in `aapi-weergave.js` en wordt daar gebruikt om uren te tonen.
 * Hier staat hij opnieuw omdat dit bestand geen schermcode mag binnenhalen —
 * het draait ook in de tests zonder DOM. `tests/marge.test.js` legt de twee
 * naast elkaar.
 */
export function minutenVanShift(shift) {
  const start = shift?.start ? new Date(shift.start) : null
  const eind = shift?.end ? new Date(shift.end) : null
  if (!start || !eind || Number.isNaN(start.getTime()) || Number.isNaN(eind.getTime())) return 0
  const bruto = Math.round((eind.getTime() - start.getTime()) / 60000)
  return Math.max(0, bruto - (shift?.pauseMinutes ?? 0))
}

/** Een shift die afgezegd is of uit AAPI verdween, kost niets. */
const telMee = (shift) => !shift?.canceled && !shift?.removedFromSourceAt

/**
 * De loonkost van de ploeg die op dit event staat.
 *
 * Per statuut opgeteld en niet per persoon: zie de kop van dit bestand.
 * Een statuut waarvoor geen tarief ingesteld is, levert uren op zonder kost —
 * die uren staan apart, zodat het scherm kan zeggen wat er mist in plaats van
 * een te lage kost te tonen.
 */
export function loonkost(shifts = [], tarieven = {}) {
  const perStatuut = new Map()

  for (const shift of shifts) {
    if (!telMee(shift)) continue
    const statuut = shift?.statuut ?? 'onbekend'
    const minuten = minutenVanShift(shift)
    if (minuten === 0) continue

    const rij = perStatuut.get(statuut) ?? { statuut, minuten: 0, tarief: getal(tarieven[statuut]) }
    rij.minuten += minuten
    perStatuut.set(statuut, rij)
  }

  const rijen = [...perStatuut.values()]
    .map((rij) => ({
      ...rij,
      uren: cent(rij.minuten / 60),
      kost: rij.tarief == null ? null : cent((rij.minuten / 60) * rij.tarief),
    }))
    .sort((a, b) => STATUTEN.indexOf(a.statuut) - STATUTEN.indexOf(b.statuut))

  return {
    kost: cent(rijen.reduce((som, r) => som + (r.kost ?? 0), 0)),
    uren: cent(rijen.reduce((som, r) => som + r.uren, 0)),
    rijen,
    zonderTarief: rijen.filter((r) => r.tarief == null).map((r) => r.statuut),
  }
}

/**
 * Wat er ingekocht moet worden voor dit event.
 *
 * `bestellen` is wat de bestellijst al uitrekent: het aantal eenheden dat je
 * bij de leverancier ingeeft, met de verpakking erin verwerkt. De inkoopprijs
 * hoort bij diezelfde eenheid — een prijs per fles bij een bestelling in
 * flessen, per kilo bij een bestelling in kilo's.
 */
export function inkoopkost(bestellijst = []) {
  let kost = 0
  const zonderPrijs = []

  for (const regel of bestellijst) {
    const aantal = getal(regel?.bestellen) ?? 0
    if (aantal <= 0) continue
    const prijs = getal(regel?.inkoopprijs)
    if (prijs == null) {
      zonderPrijs.push(regel?.item ?? '—')
      continue
    }
    kost += aantal * prijs
  }

  return { kost: cent(kost), regels: bestellijst.length, zonderPrijs }
}

/**
 * De eigen uren van het team op dit event.
 *
 * Dit is wat er in JE Plan geboekt is — voorbereiding, offertewerk, opvolging
 * — en niet wat de ploeg op de dag zelf deed; dat laatste staat in AAPI en
 * loopt via `loonkost`. Het uurtarief staat op het profiel.
 *
 * Een profiel zonder uurtarief telt niet mee en wordt gemeld, om dezelfde
 * reden als een bestellijstregel zonder prijs.
 */
export function eigenUrenkost(entries = [], profielen = {}) {
  let kost = 0
  let seconden = 0
  const zonderTarief = new Set()

  for (const entry of entries) {
    const duur = getal(entry?.seconds ?? entry?.durationSeconds) ?? 0
    if (duur <= 0) continue
    seconden += duur

    const profiel = profielen[entry?.profileId]
    const tarief = getal(profiel?.hourlyRate)
    if (tarief == null || tarief === 0) {
      zonderTarief.add(profiel?.fullName ?? entry?.profileId ?? '—')
      continue
    }
    kost += (duur / 3600) * tarief
  }

  return { kost: cent(kost), uren: cent(seconden / 3600), zonderTarief: [...zonderTarief] }
}

/**
 * De hele rekensom voor één event.
 *
 * `volledig` zegt of elk onderdeel een bedrag heeft. Is dat niet zo, dan is de
 * marge een ondergrens van de kosten en dus een bovengrens van de winst, en
 * hoort het scherm dat te zeggen in plaats van een percentage neer te zetten
 * dat te mooi is.
 */
export function margeVan({ event, shifts = [], bestellijst = [], uren = [], profielen = {}, tarieven = {} } = {}) {
  const opbrengst = getal(event?.quoteAmount ?? event?.budget)

  const loon = loonkost(shifts, tarieven)
  const inkoop = inkoopkost(bestellijst ?? event?.bestellijst ?? [])
  const eigen = eigenUrenkost(uren, profielen)

  const kost = cent(loon.kost + inkoop.kost + eigen.kost)
  const marge = opbrengst == null ? null : cent(opbrengst - kost)
  const percent = opbrengst == null || opbrengst === 0 ? null : Math.round((marge / opbrengst) * 100)

  const ontbreekt = []
  if (opbrengst == null) ontbreekt.push({ soort: 'opbrengst' })
  if (loon.zonderTarief.length) ontbreekt.push({ soort: 'tarief', statuten: loon.zonderTarief })
  if (inkoop.zonderPrijs.length) ontbreekt.push({ soort: 'inkoopprijs', aantal: inkoop.zonderPrijs.length })
  if (eigen.zonderTarief.length) ontbreekt.push({ soort: 'uurtarief', mensen: eigen.zonderTarief })
  if (!shifts.length) ontbreekt.push({ soort: 'geen_ploeg' })

  return {
    opbrengst,
    loon,
    inkoop,
    eigen,
    kost,
    marge,
    percent,
    volledig: ontbreekt.length === 0,
    ontbreekt,
  }
}
