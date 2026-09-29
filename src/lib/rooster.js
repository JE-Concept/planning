import { addDays, dayKey, formatWeekday, startOfWeek } from './dates'

/**
 * Het weekrooster: wie wanneer werkt.
 *
 * Een shift is een dag met een begin- en einduur, als tekst ("17:30"), en niet
 * als tijdstip. Dat is met opzet. Een rooster gaat over klokuren zoals ze op de
 * deur hangen; wie ze als moment bewaart, krijgt ze bij een zomeruurwissel of op
 * een ander toestel een uur verschoven te zien. De dag staat er als sleutel naast
 * ("2026-09-29"), en daarmee is het altijd duidelijk welke dag bedoeld is.
 *
 * Het rekenwerk staat hier los van het scherm omdat het stil fout kan gaan: een
 * nachtdienst die over middernacht loopt, twee diensten die elkaar overlappen,
 * een pauze die wel of niet meetelt. Dat zijn geen dingen die je aan een scherm
 * ziet — die zie je in een tabel met verwachte uitkomsten.
 */

/** "17:30" → 1050 minuten na middernacht. Onleesbaar → null. */
export function naarMinuten(klok) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(klok ?? '').trim())
  if (!m) return null
  const uren = Number(m[1])
  const minuten = Number(m[2])
  if (uren > 23 || minuten > 59) return null
  return uren * 60 + minuten
}

/** 1050 → "17:30". */
export function naarKlok(minuten) {
  if (minuten == null || Number.isNaN(minuten)) return ''
  const heel = ((Math.round(minuten) % 1440) + 1440) % 1440
  return `${String(Math.floor(heel / 60)).padStart(2, '0')}:${String(heel % 60).padStart(2, '0')}`
}

/**
 * Hoelang een dienst duurt, in minuten.
 *
 * Eindigt hij vóór hij begint, dan loopt hij over middernacht — de avondbar tot
 * drie uur is hier geen uitzondering maar de regel. Zo'n dienst als "min veertien
 * uur" rekenen levert een weektotaal op waar niemand iets aan heeft.
 */
export function duurVan(shift) {
  const begin = naarMinuten(shift?.start)
  const eind = naarMinuten(shift?.end)
  if (begin == null || eind == null) return 0
  const bruto = eind > begin ? eind - begin : eind + 1440 - begin
  const pauze = Number(shift?.breakMinutes) || 0
  return Math.max(0, bruto - pauze)
}

export const urenVan = (shift) => duurVan(shift) / 60

/**
 * De zeven dagen van de week waarin deze datum valt, maandag eerst.
 *
 * De naam komt uit de opmaaktaal en niet uit een vaste lijst: wie de tool in
 * het Engels leest, hoort boven de kolom "Mon" te zien staan. De sleutel en het
 * nummer veranderen niet mee — daar wordt op gerekend en gegroepeerd.
 */
export function weekDagen(datum = new Date()) {
  const maandag = startOfWeek(datum)
  return Array.from({ length: 7 }, (_, i) => {
    const dag = addDays(maandag, i)
    return { sleutel: dayKey(dag), datum: dag, naam: formatWeekday(dag), nummer: dag.getDate() }
  })
}

/**
 * Overlappen twee diensten van dezelfde persoon?
 *
 * Iemand twee keer tegelijk inplannen is een fout die je pas op de dag zelf
 * merkt, en dan staat er één plek leeg. Een dienst die over middernacht loopt
 * wordt in twee stukken gerekend, anders zou hij met bijna alles overlappen.
 */
export function overlapt(a, b) {
  if (!a || !b || a.date !== b.date || a.profileId !== b.profileId) return false

  const stukken = (shift) => {
    const begin = naarMinuten(shift.start)
    const eind = naarMinuten(shift.end)
    if (begin == null || eind == null) return []
    return eind > begin ? [[begin, eind]] : [[begin, 1440], [0, eind]]
  }

  return stukken(a).some(([a1, a2]) => stukken(b).some(([b1, b2]) => a1 < b2 && b1 < a2))
}

/** Welke diensten in deze week elkaar in de weg zitten. */
export function botsingen(shifts) {
  const uit = []
  for (let i = 0; i < shifts.length; i += 1) {
    for (let j = i + 1; j < shifts.length; j += 1) {
      if (overlapt(shifts[i], shifts[j])) uit.push([shifts[i], shifts[j]])
    }
  }
  return uit
}

/**
 * Het rooster als raster: per persoon per dag zijn diensten.
 *
 * Mensen zonder enige dienst blijven in de lijst staan. Een rooster waar alleen
 * de ingeplande mensen op staan, laat niet zien wie er nog vrij is — en dat is
 * de helft van waarvoor je ernaar kijkt.
 */
export function roosterVan({ shifts, profiles, datum = new Date() }) {
  const dagen = weekDagen(datum)
  const inWeek = shifts.filter((s) => dagen.some((d) => d.sleutel === s.date))

  const rijen = profiles.map((persoon) => {
    const eigen = inWeek.filter((s) => s.profileId === persoon.id)
    return {
      persoon,
      perDag: Object.fromEntries(
        dagen.map((d) => [d.sleutel, eigen.filter((s) => s.date === d.sleutel).sort(opTijd)])
      ),
      minuten: eigen.reduce((som, s) => som + duurVan(s), 0),
      diensten: eigen.length,
    }
  })

  return {
    dagen,
    rijen,
    perDag: Object.fromEntries(
      dagen.map((d) => [
        d.sleutel,
        {
          diensten: inWeek.filter((s) => s.date === d.sleutel).length,
          minuten: inWeek
            .filter((s) => s.date === d.sleutel)
            .reduce((som, s) => som + duurVan(s), 0),
        },
      ])
    ),
    minuten: inWeek.reduce((som, s) => som + duurVan(s), 0),
    botsingen: botsingen(inWeek),
  }
}

const opTijd = (a, b) => (naarMinuten(a.start) ?? 0) - (naarMinuten(b.start) ?? 0)

/**
 * Wat er gepland stond tegenover wat er geboekt is.
 *
 * Twee getallen die iets anders meten: het rooster zegt wat de bedoeling was, de
 * urenregistratie wat er echt gebeurd is. Het verschil is waar een gesprek over
 * gaat — structureel meer werken dan gepland is een planningsprobleem, en
 * structureel minder is er ook een.
 */
export function geplandTegenoverGeboekt({ rooster, entries }) {
  return rooster.rijen.map((rij) => {
    const geboekt = entries
      .filter((e) => e.profileId === rij.persoon.id)
      .reduce((som, e) => som + (e.durationSeconds ?? 0), 0)
    return {
      persoon: rij.persoon,
      geplandeMinuten: rij.minuten,
      geboekteMinuten: Math.round(geboekt / 60),
      verschilMinuten: Math.round(geboekt / 60) - rij.minuten,
    }
  })
}

/** "8u30" — hetzelfde formaat als de urenregistratie gebruikt. */
export function urenTekst(minuten) {
  const heel = Math.max(0, Math.round(minuten))
  const u = Math.floor(heel / 60)
  const m = heel % 60
  if (!u) return `${m}m`
  return m ? `${u}u${String(m).padStart(2, '0')}` : `${u}u`
}
