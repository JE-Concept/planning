/**
 * Wat een huur kost.
 *
 * ── Waarom dit een eigen bestand is ───────────────────────────────────────
 * Omdat dezelfde som op drie plekken gemaakt wordt: op de publieke
 * verhuursite, op de offerte in de backoffice, en in de betaling bij Stripe.
 * Lopen die uit elkaar, dan ziet een klant een bedrag en betaalt hij een
 * ander — en dat is het soort fout waar je een boze mail over krijgt in
 * plaats van een foutmelding. Eén bestand, en de server rekent altijd zelf
 * na: wat er uit de browser komt is een wens, geen bedrag.
 *
 * ── De staffel, en de regel die niemand verwacht ──────────────────────────
 * Verhuur heeft drie tarieven: per dag, per weekend en per week. De
 * vanzelfsprekende aanpak is "aantal dagen maal dagprijs", en die is fout:
 * zes dagen zou dan duurder zijn dan een week. Dat is niet alleen onvriendelijk
 * maar ook ongeloofwaardig — een klant die het narekent, belt.
 *
 * Dus geldt hier: **je betaalt nooit meer dan de eerstvolgende grotere
 * staffel.** Zes dagen kost hoogstens een week. Een periode van drie dagen die
 * in een weekend valt, kost hoogstens het weekendtarief. De klant krijgt de
 * goedkoopste geldige combinatie, en dat is ook hoe een verhuurder het
 * uitlegt aan de telefoon.
 *
 * ── Btw ───────────────────────────────────────────────────────────────────
 * Verhuur van materiaal is 21%. Dat staat hier als constante en niet als
 * veld: een tent verhuren valt niet onder het verlaagde tarief voor bereide
 * maaltijden, en een invulveld nodigt uit tot een vergissing die op de
 * factuur terechtkomt. Catering rekent in `offerte.js` met zijn eigen tarieven.
 */

export const BTW_VERHUUR = 21

/** Vrijdag tot en met maandag: daar hoort het weekendtarief bij. */
const WEEKENDDAGEN = new Set([5, 6, 0, 1])

const cent = (n) => Math.round(n * 100) / 100

const getal = (waarde) => {
  if (waarde === null || waarde === undefined || waarde === '') return null
  const n = Number(waarde)
  return Number.isFinite(n) ? n : null
}

/**
 * Valt deze periode binnen één weekend?
 *
 * Het weekendtarief is geen duur maar een plek op de kalender: vrijdag
 * ophalen en maandag terugbrengen. Drie dagen midden in de week zijn geen
 * weekend, hoe lang ze ook duren.
 */
export function isWeekend(dagen = []) {
  if (dagen.length === 0 || dagen.length > 4) return false
  return dagen.every((dag) => {
    const d = new Date(`${dag}T12:00:00`)
    return !Number.isNaN(d.getTime()) && WEEKENDDAGEN.has(d.getDay())
  })
}

/**
 * De huurprijs van één artikel voor een reeks dagen, vóór korting en btw.
 *
 * `dagen` zijn de dagsleutels waarop het stuk gehuurd is — zonder de
 * uitlooptijd, want die is van ons en niet van de klant.
 */
export function prijsVoorPeriode(materiaal, dagen = []) {
  const aantalDagen = dagen.length
  if (aantalDagen === 0) return { bedrag: 0, opbouw: [] }

  const perDag = getal(materiaal?.prijsPerDag)
  if (perDag == null) return { bedrag: 0, opbouw: [], geenTarief: true }

  const perWeek = getal(materiaal?.prijsWeek)
  const perWeekend = getal(materiaal?.prijsWeekend)

  /*
    Eerst hele weken, dan de rest. De rest wordt per dag gerekend, of tegen
    het weekendtarief wanneer ze in een weekend valt.
  */
  const weken = perWeek != null ? Math.floor(aantalDagen / 7) : 0
  const restDagen = aantalDagen - weken * 7
  const restSleutels = dagen.slice(weken * 7)

  const opbouw = []
  if (weken > 0) opbouw.push({ wat: 'week', aantal: weken, stuk: perWeek, bedrag: cent(weken * perWeek) })

  if (restDagen > 0) {
    const losseDagen = cent(restDagen * perDag)
    const weekendtarief = perWeekend != null && isWeekend(restSleutels) ? perWeekend : null
    if (weekendtarief != null && weekendtarief < losseDagen) {
      opbouw.push({ wat: 'weekend', aantal: 1, stuk: weekendtarief, bedrag: weekendtarief })
    } else {
      opbouw.push({ wat: 'dag', aantal: restDagen, stuk: perDag, bedrag: losseDagen })
    }
  }

  let bedrag = cent(opbouw.reduce((som, r) => som + r.bedrag, 0))

  /*
    En dan de regel die het geheel geloofwaardig houdt: nooit meer dan de
    eerstvolgende grotere staffel. Zes dagen kost hoogstens een week; twee
    dagen in een weekend hoogstens een weekend.
  */
  const plafonds = []
  if (perWeek != null && aantalDagen <= 7) plafonds.push({ wat: 'week', bedrag: perWeek })
  if (perWeekend != null && isWeekend(dagen)) plafonds.push({ wat: 'weekend', bedrag: perWeekend })
  if (perWeek != null && aantalDagen > 7) {
    plafonds.push({ wat: 'week', bedrag: cent(Math.ceil(aantalDagen / 7) * perWeek) })
  }

  const goedkoper = plafonds.filter((p) => p.bedrag < bedrag).sort((a, b) => a.bedrag - b.bedrag)[0]
  if (goedkoper) {
    bedrag = goedkoper.bedrag
    return {
      bedrag,
      opbouw: [{ wat: goedkoper.wat, aantal: 1, stuk: goedkoper.bedrag, bedrag: goedkoper.bedrag, plafond: true }],
    }
  }

  return { bedrag, opbouw }
}

/**
 * Eén regel van een huur: een artikel, een aantal, een periode.
 *
 * De korting staat op de klant en geldt alleen voor materiaal — catering
 * valt er met opzet buiten, want daar zit de marge al dun.
 */
export function regelPrijs({ materiaal, aantal = 1, dagen = [], kortingPercent = 0 }) {
  const stuks = Math.max(0, Math.round(Number(aantal) || 0))
  const { bedrag: perStuk, opbouw, geenTarief } = prijsVoorPeriode(materiaal, dagen)

  const bruto = cent(perStuk * stuks)
  const korting = cent(bruto * (Math.max(0, Math.min(100, Number(kortingPercent) || 0)) / 100))
  const netto = cent(bruto - korting)

  return {
    materiaalId: materiaal?.id ?? null,
    naam: materiaal?.naam ?? '',
    aantal: stuks,
    dagen: dagen.length,
    perStuk,
    opbouw,
    bruto,
    korting,
    netto,
    // Een artikel zonder dagprijs kost niet niets; we weten niet wat het kost.
    geenTarief: Boolean(geenTarief),
    waarborg: cent((getal(materiaal?.waarborg) ?? 0) * stuks),
  }
}

/**
 * De hele huur: regels, korting, btw en waarborg.
 *
 * De waarborg staat **buiten** het btw-totaal en buiten de omzet: het is geld
 * dat je vasthoudt en teruggeeft, geen opbrengst. Het bij het factuurbedrag
 * optellen is een boekhoudkundige fout die pas opvalt bij de afsluiting.
 */
export function huurTotaal(regels = []) {
  const netto = cent(regels.reduce((som, r) => som + r.netto, 0))
  const korting = cent(regels.reduce((som, r) => som + r.korting, 0))
  const btw = cent(netto * (BTW_VERHUUR / 100))
  const waarborg = cent(regels.reduce((som, r) => som + r.waarborg, 0))

  return {
    regels,
    korting,
    exclBtw: netto,
    btw,
    inclBtw: cent(netto + btw),
    waarborg,
    // Wat er werkelijk afgerekend wordt bij een directe huur: de huur met btw,
    // plus de waarborg die later teruggaat.
    teBetalen: cent(netto + btw + waarborg),
    onvolledig: regels.some((r) => r.geenTarief),
  }
}

/**
 * Mag dit artikel zonder offerte gehuurd worden?
 *
 * Alleen wat de klant zelf kan komen halen. Een tent moet geplaatst worden en
 * een mobiele bar moet op een camion: daar hoort een gesprek bij, en dus een
 * aanvraag en een offerte. Dit onderscheid staat per artikel en niet per
 * bedrag, want niet alles wat goedkoop is, is eenvoudig.
 */
export const isLosTeHuren = (materiaal) =>
  materiaal?.directTeHuren === true && getal(materiaal?.prijsPerDag) != null
