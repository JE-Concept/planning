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
  if (shift.linkStatus === 'auto' && (shift.linkScore ?? 1) < ZEKER_VANAF) return 'voorgesteld'
  if (shift.linkStatus === 'auto' || shift.linkStatus === 'manual') return 'gepland'
  if (shift.linkStatus === 'ambiguous') return 'twijfel'
  return 'ongekoppeld'
}

export const STAND_TEKST = {
  gepland: 'aapi.stand.gepland',
  voorgesteld: 'aapi.stand.voorgesteld',
  twijfel: 'aapi.stand.twijfel',
  ongekoppeld: 'aapi.stand.ongekoppeld',
  geannuleerd: 'aapi.stand.geannuleerd',
  verdwenen: 'aapi.stand.verdwenen',
}

export const STAND_TOON = {
  gepland: 'success',
  voorgesteld: 'accent',
  twijfel: 'warning',
  ongekoppeld: 'warning',
  geannuleerd: 'neutral',
  verdwenen: 'neutral',
}

/** Telt deze shift mee als ingeplande kracht? */
export function teltMee(shift) {
  return Boolean(shift) && !shift.canceled && !shift.removedFromSourceAt
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
  return {
    gepland: meetellend.length,
    afgezegd: shifts.length - meetellend.length,
    minuten: meetellend.reduce((op, s) => op + minutenVan(s), 0),
    perStatuut,
  }
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
    if (!teltMee(s)) return false
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

/** Wat er aandacht vraagt: twijfel en ongekoppeld, alleen bij Evenementen. */
export function vraagtAandacht(shift) {
  return (
    shift?.locationName === 'evenementen'
    && teltMee(shift)
    && ['ambiguous', 'unlinked'].includes(shift.linkStatus)
  )
}
