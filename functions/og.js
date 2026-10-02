/**
 * Het voorbeeldkaartje van een link: de titel, de omschrijving en het plaatje.
 *
 * Geen imports, zodat de tests dit kunnen nakijken zonder firebase-admin — dat
 * staat in CI voor deze codebase niet geïnstalleerd. Zie `herhaling-datum.js`
 * voor hetzelfde patroon en dezelfde reden.
 *
 * ── Waarom geen HTML-ontleder ─────────────────────────────────────────────
 * We hebben vier velden nodig uit de kop van de pagina. Een volledige ontleder
 * is honderden kilobytes en moet elke onvolkomen pagina ter wereld aankunnen;
 * dit zijn vijftig regels en het ergste wat er misgaat is een leeg kaartje.
 * Dezelfde afweging als bij de xlsx-lezer.
 */

/** Alleen de kop: daar staat de metadata, en de rest is soms een megabyte. */
function kop(html) {
  const eind = html.search(/<\/head>/i)
  return eind > 0 ? html.slice(0, eind) : html.slice(0, 200_000)
}

/*
  De entiteiten die in een paginatitel voorkomen.

  Niet de hele lijst van tweeduizend: dit zijn de leestekens en de letters die
  een Nederlandse of Franse titel draagt. Wat er niet in staat, blijft staan
  zoals het stond — een titel met een vreemde entiteit erin is lelijk, een
  ontbrekende titel is erger.
*/
const ENTITEITEN = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', auml: 'ä', aacute: 'á',
  iuml: 'ï', icirc: 'î', ouml: 'ö', ocirc: 'ô', oacute: 'ó',
  uuml: 'ü', ucirc: 'û', ugrave: 'ù', ccedil: 'ç', ntilde: 'ñ',
  hellip: '…', mdash: '—', ndash: '–',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  laquo: '«', raquo: '»', euro: '€', deg: '°', middot: '·',
}

/** `&amp;` terug naar `&`. Alleen wat er in een titel voorkomt. */
export function ontsnapTerug(tekst) {
  return (tekst ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (heel, naam) => {
    const sleutel = naam.toLowerCase()
    if (ENTITEITEN[sleutel] !== undefined) return ENTITEITEN[sleutel]
    const cijfers = /^#x/i.test(naam) ? parseInt(naam.slice(2), 16) : /^#/.test(naam) ? Number(naam.slice(1)) : NaN
    return Number.isFinite(cijfers) ? String.fromCodePoint(cijfers) : heel
  })
}

const schoon = (tekst, max = 300) =>
  ontsnapTerug(tekst).replace(/\s+/g, ' ').trim().slice(0, max) || null

/**
 * De waarde van één meta-tag.
 *
 * Attributen staan in willekeurige volgorde — `<meta content="…"
 * property="og:title">` komt evenveel voor als andersom — dus eerst elke
 * meta-tag apart pakken en dan pas in die tag zoeken.
 */
function metaVan(html, sleutels) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const naam = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    if (!naam || !sleutels.includes(naam)) continue
    const waarde = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (waarde?.trim()) return waarde
  }
  return null
}

/**
 * Wat er op het kaartje komt te staan.
 *
 * Open Graph eerst, want dat is wat een site bewust meegeeft om gedeeld te
 * worden. Daarna Twitter, dan de gewone `<title>` en `description` — die staan
 * er altijd, maar zijn vaker de naam van de hele site dan van deze pagina.
 */
export function leesVoorbeeld(html) {
  const h = kop(String(html ?? ''))
  const titelTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1]

  return {
    titel: schoon(metaVan(h, ['og:title', 'twitter:title']) ?? titelTag ?? '', 200),
    omschrijving: schoon(metaVan(h, ['og:description', 'twitter:description', 'description']) ?? '', 300),
    afbeelding: schoon(metaVan(h, ['og:image', 'og:image:url', 'twitter:image']) ?? '', 2000),
    site: schoon(metaVan(h, ['og:site_name']) ?? '', 80),
  }
}

/** Een relatief plaatje (`/og.png`) wordt een adres waar een browser bij kan. */
export function absoluut(basis, adres) {
  if (!adres) return null
  try {
    return new URL(adres, basis).toString()
  } catch {
    return null
  }
}

/*
  Hosts waar een server nooit namens een gebruiker heen hoort te gaan.

  Dit is het punt waarop een voorbeeldkaartje gevaarlijk wordt: de functie
  haalt een adres op dat iemand zelf getypt heeft, en ze draait binnen Google
  Cloud. `http://169.254.169.254/` geeft daar de inloggegevens van de machine
  terug, en `http://localhost:8080` praat met wat er naast draait. Dat heet
  SSRF, en het is de reden dat deze lijst er is en niet alleen een vriendelijke
  foutmelding bij een kapot adres.

  Een lijst met namen is niet genoeg — een domein kan naar 127.0.0.1 wijzen —
  en daarom lost de functie de naam ook op en kijkt ze naar het echte adres.
  Zie `linkvoorbeeld.js`.
*/
const VERBODEN_NAMEN = [/^localhost$/i, /\.local$/i, /\.internal$/i, /^metadata/i]

/** Is dit IP-adres van het internet, of van het netwerk binnenin? */
export function isPrivaatIp(adres) {
  const ip = String(adres ?? '').trim()

  // IPv6: alles buiten het gewone unicast-bereik houden we tegen, plus het
  // lokale adres zelf en de ingepakte IPv4-adressen.
  if (ip.includes(':')) {
    const laag = ip.toLowerCase().replace(/^\[|\]$/g, '')
    if (laag === '::1' || laag === '::') return true
    if (/^(fc|fd|fe8|fe9|fea|feb)/.test(laag)) return true
    const ingepakt = /(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/.exec(laag)?.[1]
    return ingepakt ? isPrivaatIp(ingepakt) : false
  }

  const delen = ip.split('.').map(Number)
  if (delen.length !== 4 || delen.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = delen

  return (
    a === 0 // dit netwerk
    || a === 10 // privé
    || a === 127 // deze machine
    || (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
    || (a === 169 && b === 254) // link-local, en de metadata-server van de cloud
    || (a === 172 && b >= 16 && b <= 31) // privé
    || (a === 192 && b === 168) // privé
    || (a === 192 && b === 0) // gereserveerd
    || (a === 198 && b >= 18 && b <= 19) // testnet
    || a >= 224 // multicast en gereserveerd
  )
}

/**
 * Mag deze link opgehaald worden?
 *
 * Geeft het opgeschoonde adres terug, of de reden waarom niet. De reden is
 * voor het logboek en niet voor het scherm: wie een link plakt die niet
 * opgehaald kan worden, krijgt gewoon geen kaartje.
 */
export function mag(ruw) {
  let url
  try {
    url = new URL(String(ruw ?? '').trim())
  } catch {
    return { ok: false, reden: 'geen geldig adres' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reden: `protocol ${url.protocol} wordt niet opgehaald` }
  }
  if (url.username || url.password) return { ok: false, reden: 'inloggegevens in het adres' }
  if (VERBODEN_NAMEN.some((p) => p.test(url.hostname))) return { ok: false, reden: 'interne naam' }
  if (isPrivaatIp(url.hostname)) return { ok: false, reden: 'intern adres' }
  if (ruw.length > 2000) return { ok: false, reden: 'adres te lang' }

  // Het fragment hoort bij de browser en niet bij de server; eraf, zodat
  // dezelfde pagina met twee ankers niet twee keer opgehaald wordt.
  url.hash = ''
  return { ok: true, url: url.toString() }
}
