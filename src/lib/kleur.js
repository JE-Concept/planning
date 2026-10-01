/**
 * Kleur, nagerekend in plaats van ingeschat.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * Het team kiest zelf kleuren: voor de kolommen van een bord, voor een merk,
 * voor een label. Die kleuren komen daarna terug als badge, en een badge is
 * tekst. Tot nu werd de tekstkleur geraden — wit op de kleur, of de kleur op
 * een doorzichtige versie van zichzelf — en bij de helft van het oude palet
 * leverde dat iets op wat je niet kon lezen. `#f59e0b` met wit erop haalde
 * 2,15 waar 4,5 nodig is.
 *
 * Raden is hier ook niet nodig: contrast is een formule. Dit bestand rekent
 * ze uit en kiest de inkt die wél leest. Daardoor hoeft er geen enkele kleur
 * die al in de database staat aangepast te worden — ze wordt gewoon leesbaar
 * getoond.
 *
 * ── Waarom WCAG 2.1 en niet APCA ─────────────────────────────────────────
 * Omdat 4,5:1 de norm is waar iemand ons op kan aanspreken, en omdat de
 * formule hieronder in vier regels past en in een test te controleren is.
 * APCA leest beter maar is nog geen norm; wie overstapt, verandert alleen
 * `contrast()` en de drempels.
 */

/** De drempels uit WCAG 2.1, voor wie ze wil opzoeken zonder te zoeken. */
export const DREMPEL = {
  /** Lopende tekst, en alles onder 18,66px halfvet / 24px gewoon. */
  tekst: 4.5,
  /** Grote tekst, randen van bedieningen, pictogrammen. */
  groot: 3,
}

const kanaal = (c) => {
  const x = c / 255
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

/** Een `#rgb` of `#rrggbb` naar drie getallen. Alles anders geeft null. */
export function ontleed(kleur) {
  const tekst = String(kleur ?? '').trim()
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(tekst)
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

export const naarHex = ([r, g, b]) =>
  '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')

/** De relatieve helderheid, zoals WCAG ze definieert. */
export function helderheid(kleur) {
  const rgb = ontleed(kleur)
  if (!rgb) return null
  const [r, g, b] = rgb.map(kanaal)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Het contrast tussen twee kleuren: 1 (gelijk) tot 21 (zwart op wit).
 *
 * Geeft null terug zodra een van de twee niet te lezen is. Niet 1, en niet 21:
 * een onbekende kleur is geen slecht contrast maar geen antwoord, en wie dat
 * verschil wegmoffelt, krijgt een test die groen staat op een fout.
 */
export function contrast(a, b) {
  const la = helderheid(a)
  const lb = helderheid(b)
  if (la == null || lb == null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Een kleur met dekking `alpha` over een ondergrond, samengesteld tot één kleur. */
export function meng(voor, alpha, achter) {
  const v = ontleed(voor)
  const a = ontleed(achter)
  if (!v || !a) return null
  const d = Math.max(0, Math.min(1, Number(alpha) || 0))
  return naarHex(v.map((c, i) => c * d + a[i] * (1 - d)))
}

/**
 * Welke inkt leest op dit vlak: de lichte of de donkere.
 *
 * Niet "wit tenzij de kleur licht is", maar: reken allebei uit en neem de
 * beste. Bij een middentint — en dat is precies waar het altijd misging —
 * scheelt dat het verschil tussen leesbaar en niet.
 */
export function inktOp(vlak, { licht = '#ffffff', donker = '#00172e' } = {}) {
  const l = contrast(licht, vlak)
  const d = contrast(donker, vlak)
  if (l == null || d == null) return licht
  return d > l ? donker : licht
}

/**
 * Dezelfde kleur, zo ver verdiept tot ze op dit vlak leesbaar wordt.
 *
 * De tint blijft: alleen de helderheid zakt, in stapjes, tot de drempel
 * gehaald is. Zo blijft een oranje kolom een oranje kolom — ze wordt alleen
 * donker genoeg om de naam erop te lezen.
 *
 * Haalt ze het na vijftig stappen nog niet, dan is het vlak zelf donker en
 * valt de functie terug op de inkt die er wél op leest. Een kleur die tot
 * zwart verdiept is, is geen kleur meer.
 */
export function verdiep(kleur, vlak, doel = DREMPEL.tekst) {
  const rgb = ontleed(kleur)
  if (!rgb || helderheid(vlak) == null) return kleur
  if ((contrast(kleur, vlak) ?? 0) >= doel) return naarHex(rgb)

  let huidig = rgb
  for (let i = 0; i < 50; i += 1) {
    huidig = huidig.map((c) => c * 0.94)
    const hex = naarHex(huidig)
    if ((contrast(hex, vlak) ?? 0) >= doel) return hex
  }
  return inktOp(vlak)
}

/**
 * Hoe een zelfgekozen kleur als badge getoond wordt.
 *
 * `vol` is de kleur als vulling, met de inkt die erop leest. `stil` is de
 * kleur als tekst op een lichte waas van zichzelf — de variant die in lijsten
 * en tabellen staat, en die zonder deze berekening het vaakst onleesbaar was.
 *
 * `grond` is het vlak waarop de badge ligt. Standaard wit, want dat is waar
 * elke badge met een eigen kleur in deze tool staat: in een paneel of een
 * tabelrij. In de nachtschil (zijbalk, aanmeldscherm) staan er geen.
 */
export function badgeKleuren(kleur, { grond = '#ffffff', waas = 0.12 } = {}) {
  const basis = ontleed(kleur) ? naarHex(ontleed(kleur)) : null
  if (!basis) return null

  /*
    Bij sommige kleuren haalt géén van beide inkten de drempel. Het blauw uit
    het oude palet, `#3377ff`, ligt er precies tussenin: wit erop geeft 4,02 en
    de donkere inkt 4,49 — allebei net te weinig. De beste van twee te slechte
    kiezen is dan geen antwoord.

    Dan verdiept de vulling zelf, tot wit erop wél leest. De tint blijft; het
    blauw wordt alleen een slag donkerder dan het team gekozen heeft. Dat is de
    enige plek in deze berekening waar de gekozen kleur verschuift, en ze
    verschuift alleen wanneer de naam anders onleesbaar is.
  */
  const inkt = inktOp(basis)
  const vulDekt = (contrast(inkt, basis) ?? 0) >= DREMPEL.tekst
  const vulling_vol = vulDekt ? basis : verdiep(basis, '#ffffff', DREMPEL.tekst)
  const inkt_vol = vulDekt ? inkt : inktOp(vulling_vol)

  const vulling = meng(basis, waas, grond) ?? grond
  return {
    vol: { background: vulling_vol, color: inkt_vol, borderColor: vulling_vol },
    stil: { background: vulling, color: verdiep(basis, vulling), borderColor: 'transparent' },
  }
}

/**
 * Het palet dat het team te kiezen krijgt voor kolommen, merken en labels.
 *
 * Negen kleuren, allemaal uit dezelfde familie als het design system en
 * allemaal nagerekend: elk haalt 4,5:1 als tekst op wit, als tekst op zijn
 * eigen waas, én met witte tekst erop als vulling. Daar is een test op.
 *
 * Het oude palet kwam uit ClickUp en had daar geen enkele van. `#f59e0b`
 * haalde 2,15 met wit erop, `#3db88b` 2,49 — die stonden als kolomnaam op het
 * bord en waren niet te lezen. Wat al in de database staat blijft staan; de
 * weergave hierboven maakt die alsnog leesbaar.
 */
export const PALET = [
  '#55637a', // grijsblauw — neutraal, het begin van een pijplijn
  '#1b3a6b', // navy — het accent van het huis
  '#1b5a73', // staalblauw
  '#4a3a86', // indigo
  '#6b3a79', // pruim
  '#1b6e4b', // groen — klaar
  '#3f6b3a', // mosgroen
  '#946115', // oker — let op
  '#b3352f', // rood — fout of te laat
]
