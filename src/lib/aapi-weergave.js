/**
 * De planning uit AAPI, zoals ze op een scherm hoort te staan.
 *
 * Het rekenwerk van de import staat in `functions/aapi/` — dat draait op de
 * server en kan niets uit `src/` gebruiken. Hier staat het andere soort
 * rekenwerk: van een rij uit de databank naar wat er in een blokje past.
 *
 * Apart van de componenten, omdat het de dingen zijn die stilletjes fout
 * kunnen gaan: een urentotaal waar de pauze niet af is, een geannuleerde shift
 * die meetelt, een badge die "gepland" zegt over iemand die er niet meer bij
 * staat.
 */

/** De vier afdelingen, in de volgorde waarin ze op het scherm staan. */
export const AFDELINGEN = ['bar', 'zaal', 'keuken', 'evenementen']

/**
 * Een kleur per afdeling.
 *
 * Uit het palet van de huisstijl en niet verzonnen: dit zijn dezelfde tinten
 * die de merken en de statussen gebruiken, zodat de planning naast de rest van
 * de tool staat en er niet overheen.
 */
export const AFDELINGSKLEUR = {
  bar: '#946115',
  zaal: '#1b5a73',
  keuken: '#3f6b3a',
  evenementen: '#4a3a86',
}

export const kleurVan = (afdeling) => AFDELINGSKLEUR[afdeling] ?? '#55637a'

/**
 * De naam van een afdeling op het scherm.
 *
 * Komt er in AAPI een afdeling bij, dan heeft die hier geen vertaling. `t()`
 * geeft dan de sleutel terug — en "aapi.afdeling.terras" op een kalender is
 * erger dan gewoon "terras". Vandaar deze omweg.
 */
/**
 * De naam die bij een shift hoort.
 *
 * Eerst het medewerkerskaartje, dan wat er op de shift zelf staat, en pas als
 * allerlei misgaat de GUID. Die volgorde is er met reden: de shifts die vóór
 * het bestaan van het veld `naam` geïmporteerd zijn dragen er geen, en een
 * herimport schrijft een ongewijzigde rij niet opnieuw — dus zouden die voor
 * altijd een GUID tonen. Het kaartje is er wél, want dat wordt elke import
 * aangeraakt.
 */
export function naamVan(shift, medewerkerOpId = {}) {
  const kaartje = medewerkerOpId[shift?.aapiEmployeeId]?.displayName
  return kaartje || shift?.naam || shift?.aapiEmployeeId || '—'
}

/** De naam op een kaartje, of de mededeling dat er nog niemand op staat. */
export function naamOfOpen(t, shift, medewerkerOpId = {}) {
  return shift?.open ? t('aapi.open.niemand') : naamVan(shift, medewerkerOpId)
}

export function afdelingLabel(t, afdeling) {
  if (!afdeling) return '—'
  return AFDELINGEN.includes(afdeling) ? t(`aapi.afdeling.${afdeling}`) : afdeling
}

/** De statuten, met de sleutel van hun label. */
export const STATUUT_TEKST = {
  vast: 'aapi.statuut.vast',
  student: 'aapi.statuut.student',
  flexi: 'aapi.statuut.flexi',
  zelfstandig: 'aapi.statuut.zelfstandig',
  extern: 'aapi.statuut.extern',
  onbekend: 'aapi.statuut.onbekend',
}

/** De koppelingen, met de sleutel van hun label. */
export const KOPPELING_TEKST = {
  auto: 'aapi.koppeling.auto',
  manual: 'aapi.koppeling.manual',
  ambiguous: 'aapi.koppeling.ambiguous',
  unlinked: 'aapi.koppeling.unlinked',
  none: 'aapi.koppeling.none',
  notApplicable: 'aapi.koppeling.nvt',
}

/** Vanaf welke score een automatische koppeling zonder voorbehoud staat. */
export const ZEKER_VANAF = 0.8

const alsDatum = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : v.toDate ? v.toDate() : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * De stand van een shift, als één woord.
 *
 * ── Waarom "voorgesteld" en niet de score ─────────────────────────────────
 * De briefing liet de keuze: de score tonen, of alleen bij twijfel iets zeggen.
 * Een getal als 0,62 naast iemands naam vraagt om uitleg die er niet is — wie
 * weet wat 0,62 betekent? Dus: een koppeling die de machine zelf niet zeker
 * genoeg vond heet "voorgesteld", en de score staat in het detail van de shift,
 * waar iemand ernaar op zoek is. De rest heet gewoon "gepland".
 *
 * De volgorde telt: wie niet meer in AAPI staat, is geen geplande kracht meer,
 * ook al zegt zijn koppeling van wel.
 */
export function standVan(shift) {
  if (!shift) return null
  if (shift.removedFromSourceAt) return 'verdwenen'
  if (shift.canceled) return 'geannuleerd'
  // Een dienst die ingepland staat zonder dat er iemand op staat. Dat is het
  // gat in de planning, en het hoort vóór de koppelingsvraag te komen: of zo'n
  // dienst aan het juiste event hangt is pas interessant als ze ingevuld is.
  if (shift.open) return 'open'
  if (shift.linkStatus === 'auto' && (shift.linkScore ?? 1) < ZEKER_VANAF) return 'voorgesteld'
  if (shift.linkStatus === 'auto' || shift.linkStatus === 'manual') return 'gepland'
  if (shift.linkStatus === 'ambiguous') return 'twijfel'
  return 'ongekoppeld'
}

export const STAND_TEKST = {
  open: 'aapi.stand.open',
  gepland: 'aapi.stand.gepland',
  voorgesteld: 'aapi.stand.voorgesteld',
  twijfel: 'aapi.stand.twijfel',
  ongekoppeld: 'aapi.stand.ongekoppeld',
  geannuleerd: 'aapi.stand.geannuleerd',
  verdwenen: 'aapi.stand.verdwenen',
}

export const STAND_TOON = {
  open: 'danger',
  gepland: 'success',
  voorgesteld: 'accent',
  twijfel: 'warning',
  ongekoppeld: 'warning',
  geannuleerd: 'neutral',
  verdwenen: 'neutral',
}

/**
 * Telt deze shift mee als ingeplande kracht?
 *
 * Een openstaande dienst niet: er staat niemand op. Ze meetellen zou van een
 * gat in de planning een gevulde plaats maken, en dat is precies de vergissing
 * die je op de dag zelf ontdekt.
 */
export function teltMee(shift) {
  return Boolean(shift) && !shift.canceled && !shift.removedFromSourceAt && !shift.open
}

/** Staat deze dienst er nog: niet afgezegd en niet uit AAPI verdwenen. */
export function leeftNog(shift) {
  return Boolean(shift) && !shift.canceled && !shift.removedFromSourceAt
}

/** Een dienst die ingepland staat zonder iemand erop. */
export function isOpen(shift) {
  return leeftNog(shift) && Boolean(shift.open)
}

/**
 * De gewerkte minuten van een shift: de duur min de pauze.
 *
 * Een geannuleerde shift levert nul op en geen negatieve tijd — die staat er
 * nog wel, maar er komt niemand.
 */
export function minutenVan(shift) {
  if (!teltMee(shift)) return 0
  const start = alsDatum(shift.start)
  const eind = alsDatum(shift.end)
  if (!start || !eind || eind <= start) return 0
  const bruto = Math.round((eind - start) / 60000)
  return Math.max(0, bruto - (shift.pauseMinutes ?? 0))
}

/** `450` → `7u30`. Zelfde vorm als de urenregistratie elders in de tool. */
export function urenTekst(minuten) {
  const u = Math.floor(minuten / 60)
  const m = minuten % 60
  return m ? `${u}u${String(m).padStart(2, '0')}` : `${u}u`
}

/**
 * De samenvatting boven het personeelsblok van een event.
 *
 * Geannuleerde shifts en shifts die uit AAPI verdwenen zijn tellen niet mee in
 * de uren — ze staan wel in de lijst, want "er stond iemand en die is
 * afgezegd" is informatie.
 */
export function samenvatting(shifts = []) {
  const meetellend = shifts.filter(teltMee)
  const perStatuut = {}
  for (const s of meetellend) {
    const statuut = s.statuut ?? 'onbekend'
    perStatuut[statuut] = (perStatuut[statuut] ?? 0) + 1
  }
  const open = shifts.filter(isOpen)
  return {
    gepland: meetellend.length,
    open: open.length,
    // Wat er niet meetelt én niet openstaat: afgezegd of uit AAPI verdwenen.
    afgezegd: shifts.length - meetellend.length - open.length,
    minuten: meetellend.reduce((op, s) => op + minutenVan(s), 0),
    perStatuut,
  }
}

/**
 * Het bolletje op de personeelstab: groen, oranje of rood.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * Om te weten of de planning rond is, moest je het tabblad openen. Dat doe je
 * niet voor elk event, dus doe je het voor geen enkel, en dan ontdek je een
 * gat op de dag zelf. Eén kleur op de tab zelf beantwoordt de vraag zonder
 * klik.
 *
 * ── Waarom drie kleuren en niet vijf ──────────────────────────────────────
 * Omdat er drie antwoorden zijn: het is rond, er is iets te doen, er is iets
 * mis. Wie er vijf maakt, maakt er vijf die niemand uit elkaar houdt — zie
 * dezelfde afweging in `eventstand.js`.
 *
 * - **rood** — er staat niemand, of er staat een dienst open die niemand
 *   ingevuld heeft. Dat is een gat, en een gat is geen detail.
 * - **oranje** — er staat volk, maar er is een vraag open: een koppeling waar
 *   de machine over twijfelde, een shift van die dag die nergens bij hoort,
 *   of iemand die afgezegd heeft zonder vervanging.
 * - **groen** — er staat volk en er is niets te beslissen.
 *
 * Geen kleur (null) wanneer er helemaal niets uit AAPI bij dit event in de
 * buurt komt: dan is er niets om over te oordelen en liegt elke kleur. Een
 * trouw van twintig man waar het bureau zelf achter de bar staat, hoort geen
 * rood bolletje te krijgen.
 */
export function tabStand({ shifts = [], kandidaten = [] } = {}) {
  if (!shifts.length && !kandidaten.length) return null
  const telling = samenvatting(shifts)

  if (telling.open > 0) return 'rood'
  if (telling.gepland === 0) return 'rood'

  const twijfel = shifts.some((s) => standVan(s) === 'twijfel' || standVan(s) === 'voorgesteld')
  if (twijfel || kandidaten.length > 0 || telling.afgezegd > 0) return 'oranje'
  return 'groen'
}

/**
 * Het bolletje voor een hele lijst events in één keer.
 *
 * ── Waarom niet per kaart ─────────────────────────────────────────────────
 * Een bord met veertig kaarten zou veertig abonnementen openen, elk voor de
 * shifts van één event. Dat is veertig keer dezelfde vraag aan dezelfde
 * collectie. Hier gaat één lijst shifts in en komt er een kaart per event uit.
 *
 * ── Waarom er geen bolletje staat buiten het venster ──────────────────────
 * De lijst shifts dekt een periode rond vandaag. Een event van volgend jaar
 * valt daarbuiten, en dan weten we niets — en niets weten hoort geen kleur te
 * krijgen, want een rood bolletje op een event waarvan de planning nog niet
 * gemaakt is, is een vals alarm dat iedereen leert wegkijken.
 */
export function standenVoorEvents(events = [], shifts = [], { van = null, tot = null } = {}) {
  const opEvent = new Map()
  const opDag = new Map()
  for (const s of shifts) {
    if (s.eventRef) {
      if (!opEvent.has(s.eventRef)) opEvent.set(s.eventRef, [])
      opEvent.get(s.eventRef).push(s)
    }
    if (s.dag) {
      if (!opDag.has(s.dag)) opDag.set(s.dag, [])
      opDag.get(s.dag).push(s)
    }
  }

  const uit = new Map()
  for (const event of events) {
    const dagen = event?.dagen ?? []
    // Buiten het venster: geen oordeel. Een event zonder dagen evenmin.
    const binnen = dagen.length && (!van || dagen[dagen.length - 1] >= van) && (!tot || dagen[0] <= tot)
    if (!binnen) continue

    const eigen = opEvent.get(event.id) ?? []
    const vanDieDagen = dagen.flatMap((d) => opDag.get(d) ?? [])
    const kandidaten = mogelijkVoor(event.id, dagen, vanDieDagen)
    const stand = tabStand({ shifts: eigen, kandidaten })
    if (stand) uit.set(event.id, stand)
  }
  return uit
}

export const TAB_STAND_TEKST = {
  groen: 'aapi.tab.rond',
  oranje: 'aapi.tab.aandacht',
  rood: 'aapi.tab.gat',
}

/**
 * Shifts die bij dit event zouden kunnen horen maar het nog niet zijn.
 *
 * Twee gevallen, en allebei horen ze onder het event thuis en niet alleen in
 * de kalender: een shift waar de machine tussen events twijfelde en dit event
 * een van de kandidaten is, en een shift op dezelfde dag die nergens bij hoort.
 */
export function mogelijkVoor(eventId, dagen, shifts = []) {
  const dagenSet = new Set(dagen)
  return shifts.filter((s) => {
    if (s.eventRef) return false
    if (s.locationName !== 'evenementen') return false
    // `leeftNog` en niet `teltMee`: een openstaande dienst hoort hier juist
    // wél bij. Dat ze nog niemand heeft, is de reden om ze aan het juiste
    // event te hangen — anders staat het gat op geen enkel event.
    if (!leeftNog(s)) return false
    if (!dagenSet.has(s.dag)) return false
    if (s.linkStatus === 'ambiguous') {
      return (s.linkCandidates ?? []).some((k) => k.eventId === eventId)
    }
    return s.linkStatus === 'unlinked'
  })
}

/** Shifts gebundeld per Brusselse kalenderdag, in de volgorde van de dag. */
export function perDag(shifts = []) {
  const uit = {}
  for (const s of shifts) {
    if (!s.dag) continue
    ;(uit[s.dag] ??= []).push(s)
  }
  for (const lijst of Object.values(uit)) {
    lijst.sort((a, b) => new Date(a.start) - new Date(b.start) || String(a.naam ?? '').localeCompare(String(b.naam ?? '')))
  }
  return uit
}

/**
 * Shifts gebundeld per dag, met per dag een eigen telling.
 *
 * Voor een meerdaags event: een festival van drie dagen heeft drie ploegen, en
 * "elf mensen, 84 uur" over de hele reeks beantwoordt geen enkele vraag die
 * iemand stelt. De vraag is "staat er zaterdag genoeg volk", en dat is een
 * vraag per dag.
 *
 * De dagen van het event geven de volgorde én de volledigheid: een dag zonder
 * één shift hoort er juist te staan, want dat is de dag waarop niemand werkt.
 * Shifts op een dag die het event niet beslaat — de opbouw daags ervoor —
 * komen erachteraan, zodat er niets wegvalt.
 */
export function groepenPerDag(shifts = [], dagen = []) {
  const op = perDag(shifts)
  const volgorde = [...dagen, ...Object.keys(op).filter((d) => !dagen.includes(d)).sort()]
  const uit = []
  for (const dag of volgorde) {
    if (uit.some((g) => g.dag === dag)) continue
    const eigen = op[dag] ?? []
    uit.push({ dag, shifts: eigen, telling: samenvatting(eigen) })
  }
  return uit
}

/** Wat er aandacht vraagt: twijfel en ongekoppeld, alleen bij Evenementen. */
export function vraagtAandacht(shift) {
  if (shift?.locationName !== 'evenementen' || !leeftNog(shift)) return false
  // Een openstaande dienst vraagt altijd aandacht: er staat niemand op, en dat
  // is een gat of de koppeling nu klopt of niet.
  if (shift.open) return true
  return ['ambiguous', 'unlinked'].includes(shift.linkStatus)
}
