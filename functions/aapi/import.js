/**
 * De import als rekensom.
 *
 * ── Waarom dit een pure functie is ────────────────────────────────────────
 * Hier staat geen Firestore, geen bestand, geen klok. Erin gaan de rijen uit de
 * bron, de shifts en medewerkers die er al zijn, en de events; eruit komt wat
 * er zou moeten veranderen, plus het rapport. De laag eromheen leest het
 * bestand en schrijft de mutaties weg.
 *
 * Dat is niet om het netjes te hebben. Het is wat toelaat om een hele import
 * na te spelen in een test — met het echte exportbestand, twee keer achter
 * elkaar — en wat ervoor zorgt dat de API-aanvoer later dezelfde som voedt in
 * plaats van een tweede, bijna-gelijke.
 *
 * ── Wat idempotent betekent ───────────────────────────────────────────────
 * Hetzelfde bestand twee keer importeren mag niets veranderen. Niet "bijna
 * niets": nul schrijfbeurten. Daarom wordt er pas een mutatie gemaakt wanneer
 * er écht een veld verschilt, en wordt een koppeling alleen herbekeken als de
 * shift of de events van die dag gewijzigd zijn.
 *
 * ── Wat een mens besliste, blijft staan ───────────────────────────────────
 * `manual` en `none` worden nooit door een import overschreven. Dat is de hele
 * reden dat de GUID's uit AAPI als sleutel dienen: zonder stabiele sleutel zou
 * elke herimport de correcties van gisteren weggooien.
 */
import { parseBlad, vensterVan } from './parser.js'
import { matchShift, VASTGEZET } from './matcher.js'
import { brusselseDag, dagenTussen } from './tijd.js'

/** De velden die uit de bron komen; verschilt er één, dan is de shift gewijzigd. */
const BRONVELDEN = [
  'aapiEmployeeId', 'naam', 'establishmentName', 'locationName', 'rawLocationName',
  'statuut', 'dimonaType', 'planningType',
  'start', 'end', 'pauseMinutes',
  'defaultStart', 'defaultEnd', 'defaultPauseMinutes',
  'canceled', 'aapiCreatedOn', 'aapiLastModifiedOn',
]

const tijd = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : v.toDate ? v.toDate() : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

const gelijk = (a, b) => {
  const da = tijd(a)
  const db = tijd(b)
  if (da || db) return (da?.getTime() ?? null) === (db?.getTime() ?? null)
  return (a ?? null) === (b ?? null)
}

/** De shift zoals hij in de databank hoort te staan, uit een geparste rij. */
export function shiftUitBron(rij) {
  return {
    aapiPlanningId: rij.aapiPlanningId,
    aapiEmployeeId: rij.aapiEmployeeId,
    /*
      De naam staat ook op de shift en niet alleen op het medewerkerskaartje.
      Firestore kan niet joinen, en een kalender van veertig blokjes wil geen
      veertig losse opzoekingen — dezelfde reden waarom een taak de naam van
      haar lijst meedraagt.

      Het scherm leest hem toch via het kaartje wanneer die er is: shifts die
      vóór deze regel geïmporteerd zijn dragen hem niet, en een ongewijzigde
      rij wordt bij een herimport niet opnieuw geschreven. Zonder die omweg
      zouden die voor altijd een GUID blijven tonen.
    */
    naam: rij.naam,
    establishmentName: rij.establishmentName,
    locationName: rij.afdeling,
    rawLocationName: rij.ruweAfdeling,
    statuut: rij.statuut,
    dimonaType: rij.dimonaType,
    planningType: rij.planningType,
    start: rij.start,
    end: rij.eind,
    /*
      De Brusselse kalenderdag, meegeschreven en niet in de browser berekend.
      Een shift van 05:00 op 25 oktober hoort bij die dag, en wie dat in de
      browser uitrekent krijgt het antwoord van de tijdzone van die browser.
      Dat gaat negen van de tien keer goed en precies daarom valt het niet op.
    */
    dag: brusselseDag(rij.start),
    pauseMinutes: rij.pauzeMinuten,
    defaultStart: rij.standaardStart,
    defaultEnd: rij.standaardEind,
    defaultPauseMinutes: rij.standaardPauzeMinuten,
    canceled: rij.geannuleerd,
    aapiCreatedOn: rij.aapiAangemaaktOp,
    aapiLastModifiedOn: rij.aapiGewijzigdOp,
  }
}

/** Het medewerkerskaartje uit een geparste rij. */
export function medewerkerUitBron(rij) {
  return {
    aapiEmployeeId: rij.aapiEmployeeId,
    displayName: rij.naam,
    rawName: rij.ruweNaam,
    dimonaType: rij.dimonaType,
    planningType: rij.planningType,
  }
}

/**
 * Moet de koppeling van deze shift herbekeken worden?
 *
 * Nooit als een mens hem vastgezet heeft. Verder: als de shift zelf veranderd
 * is, als er nog nooit naar gekeken is, of als er die dag iets aan de events
 * gewijzigd is sinds de vorige keer. Dat laatste is wat een shift die gisteren
 * nergens bij hoorde alsnog laat koppelen zodra het event aangemaakt wordt.
 */
export function moetHerbekeken({ bestaand, gewijzigd, laatsteEventWijziging }) {
  if (bestaand && VASTGEZET.includes(bestaand.linkStatus)) return false
  if (!bestaand || gewijzigd) return true
  if (!bestaand.linkedAt) return true
  const sinds = tijd(bestaand.linkedAt)
  return Boolean(laatsteEventWijziging && sinds && laatsteEventWijziging > sinds)
}

/**
 * De hele som.
 *
 * `bestaandeShifts` en `bestaandeMedewerkers` zijn lijsten zoals ze uit de
 * databank komen; `events` zijn de events met een `dag` erbij (de Brusselse
 * kalenderdag) en hun `updatedAt`. `nu` komt van buiten, zodat een test de klok
 * in handen heeft.
 */
export function planImport({
  rijen,
  bestaandeShifts = [],
  bestaandeMedewerkers = [],
  events = [],
  nu = new Date(),
  importRunId = null,
  bron = 'xlsx-upload',
  bestandsnaam = null,
}) {
  const { shifts: bronShifts, fouten, onbekendeKolommen } = parseBlad(rijen)
  const venster = vensterVan(bronShifts)

  // Wanneer er voor het laatst iets aan de events van een dag veranderde. Dat
  // bepaalt of een koppeling die eerder niets opleverde opnieuw bekeken wordt.
  const eventWijzigingPerDag = {}
  for (const event of events) {
    const gewijzigd = tijd(event.updatedAt)
    if (!event.dag || !gewijzigd) continue
    if (!eventWijzigingPerDag[event.dag] || gewijzigd > eventWijzigingPerDag[event.dag]) {
      eventWijzigingPerDag[event.dag] = gewijzigd
    }
  }

  // ── Medewerkers ────────────────────────────────────────────────────────
  const medewerkerOpId = new Map(bestaandeMedewerkers.map((m) => [m.aapiEmployeeId, m]))
  const medewerkers = []
  const gezien = new Set()

  for (const rij of bronShifts) {
    if (gezien.has(rij.aapiEmployeeId)) continue
    gezien.add(rij.aapiEmployeeId)

    const kaart = medewerkerUitBron(rij)
    const bestaand = medewerkerOpId.get(rij.aapiEmployeeId)

    if (!bestaand) {
      medewerkers.push({
        aapiEmployeeId: rij.aapiEmployeeId,
        nieuw: true,
        // `active` staat standaard aan en wordt nooit automatisch uitgezet:
        // iemand die een maand niet ingepland staat, is daarom niet vertrokken.
        patch: { ...kaart, active: true, firstSeenAt: nu, lastSeenAt: nu },
      })
      continue
    }

    const patch = { lastSeenAt: nu }
    // De naam alleen bijwerken als de genormaliseerde vorm verandert: anders
    // schrijft elke import iedereen opnieuw omdat AAPI een spatie verzette.
    if (bestaand.displayName !== kaart.displayName) {
      patch.displayName = kaart.displayName
      patch.rawName = kaart.rawName
    }
    for (const veld of ['dimonaType', 'planningType']) {
      if (!gelijk(bestaand[veld], kaart[veld])) patch[veld] = kaart[veld]
    }
    medewerkers.push({ aapiEmployeeId: rij.aapiEmployeeId, nieuw: false, patch })
  }

  // ── Shifts ─────────────────────────────────────────────────────────────
  const shiftOpId = new Map(bestaandeShifts.map((s) => [s.aapiPlanningId, s]))
  const shifts = []
  let aangemaakt = 0
  let bijgewerkt = 0
  let ongewijzigd = 0
  let linksAuto = 0
  let linksAmbigu = 0

  for (const rij of bronShifts) {
    const kaart = shiftUitBron(rij)
    const bestaand = shiftOpId.get(rij.aapiPlanningId) ?? null

    const veranderd = BRONVELDEN.filter((veld) => !bestaand || !gelijk(bestaand[veld], kaart[veld]))
    // Een shift die eerder uit de bron verdwenen leek en nu terug is: dat veld
    // moet weer leeg, anders blijft ze voor altijd doorstreept staan.
    const terug = Boolean(bestaand?.removedFromSourceAt)

    const dagen = dagenTussen(rij.start, rij.eind)
    const laatsteEventWijziging = dagen
      .map((d) => eventWijzigingPerDag[d])
      .filter(Boolean)
      .sort((a, b) => b - a)[0] ?? null

    const herbekijken = moetHerbekeken({
      bestaand,
      gewijzigd: veranderd.length > 0,
      laatsteEventWijziging,
    })

    const koppeling = herbekijken ? matchShift(rij, events) : null
    const koppelingVerandert =
      koppeling
      && (!bestaand
        || bestaand.linkStatus !== koppeling.linkStatus
        || (bestaand.eventRef ?? null) !== (koppeling.eventId ?? null)
        || (bestaand.linkScore ?? null) !== (koppeling.linkScore ?? null))

    if (bestaand && !veranderd.length && !terug && !koppelingVerandert) {
      ongewijzigd += 1
      if (bestaand.linkStatus === 'auto') linksAuto += 1
      if (bestaand.linkStatus === 'ambiguous') linksAmbigu += 1
      continue
    }

    const patch = { ...kaart, importedAt: nu, importRunId }
    if (terug) patch.removedFromSourceAt = null
    if (!bestaand) patch.removedFromSourceAt = null

    if (koppeling) {
      patch.linkStatus = koppeling.linkStatus
      patch.eventRef = koppeling.eventId
      patch.linkScore = koppeling.linkScore
      patch.linkCandidates = koppeling.linkCandidates
      patch.linkedAt = nu
      patch.linkedBy = null
    }

    const status = koppeling?.linkStatus ?? bestaand?.linkStatus
    if (status === 'auto') linksAuto += 1
    if (status === 'ambiguous') linksAmbigu += 1

    if (bestaand) bijgewerkt += 1
    else aangemaakt += 1

    shifts.push({
      aapiPlanningId: rij.aapiPlanningId,
      nieuw: !bestaand,
      patch,
      soort: bestaand ? 'bijgewerkt' : 'aangemaakt',
    })
  }

  // ── Wat uit de bron verdwenen is ───────────────────────────────────────
  const inBestand = new Set(bronShifts.map((s) => s.aapiPlanningId))
  const verdwenen = []

  for (const bestaand of bestaandeShifts) {
    if (inBestand.has(bestaand.aapiPlanningId)) continue
    if (bestaand.removedFromSourceAt) continue
    const start = tijd(bestaand.start)
    // Alleen binnen het venster van dít bestand. Een export van oktober mag
    // nooit iets zeggen over november.
    if (!venster || !start || start < venster.van || start > venster.tot) continue
    verdwenen.push({
      aapiPlanningId: bestaand.aapiPlanningId,
      patch: { removedFromSourceAt: nu, importRunId },
    })
  }

  const evenementen = bronShifts.filter((s) => s.afdeling === 'evenementen')

  return {
    venster,
    medewerkers,
    shifts,
    verdwenen,
    fouten,
    rapport: {
      source: bron,
      fileName: bestandsnaam,
      windowStart: venster?.van ?? null,
      windowEnd: venster?.tot ?? null,
      rowsRead: bronShifts.length + fouten.length,
      shiftsCreated: aangemaakt,
      shiftsUpdated: bijgewerkt,
      shiftsUnchanged: ongewijzigd,
      shiftsRemoved: verdwenen.length,
      employeesCreated: medewerkers.filter((m) => m.nieuw).length,
      employeesSeen: medewerkers.length,
      linksAuto,
      linksAmbiguous: linksAmbigu,
      eventShifts: evenementen.length,
      unknownColumns: onbekendeKolommen,
      errors: fouten,
      status: fouten.length ? 'met-fouten' : 'ok',
    },
  }
}
