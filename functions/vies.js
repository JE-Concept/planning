/**
 * Een btw-nummer opzoeken in VIES, de Europese btw-databank — het lees- en
 * rekenwerk, zonder het ophalen zelf.
 *
 * ── Waarom VIES en niet de KBO ────────────────────────────────────────────
 * De KBO kent alleen Belgische ondernemingen en heeft geen open
 * programmeerbare toegang zonder contract. VIES is gratis, kent elk EU-land,
 * en geeft voor een Belgisch nummer dezelfde naam en hetzelfde
 * maatschappelijk adres als de KBO. Een Nederlandse klant (en daar zijn er
 * genoeg, in Limburg) vind je er ook in.
 *
 * ── Waarom dit apart staat ────────────────────────────────────────────────
 * Wat VIES teruggeeft is per land anders opgemaakt: een Belgisch adres is
 * "Straat 1\n3000 Leuven", een Nederlands "DORPSSTRAAT 00001\n1234AB
 * AMSTERDAM", een Duits nummer geeft helemaal geen naam of adres prijs ("---").
 * Dat uit elkaar halen is precies het soort code dat stilletjes stukgaat, dus
 * staat het hier zonder één import, zodat `tests/vies.test.js` het in CI kan
 * draaien — daar bestaat `functions/node_modules` niet.
 */

/** De landcodes die VIES kent. Griekenland heet er EL, niet GR. */
const LANDEN = {
  AT: 'Oostenrijk',
  BE: 'België',
  BG: 'Bulgarije',
  CY: 'Cyprus',
  CZ: 'Tsjechië',
  DE: 'Duitsland',
  DK: 'Denemarken',
  EE: 'Estland',
  EL: 'Griekenland',
  ES: 'Spanje',
  FI: 'Finland',
  FR: 'Frankrijk',
  HR: 'Kroatië',
  HU: 'Hongarije',
  IE: 'Ierland',
  IT: 'Italië',
  LT: 'Litouwen',
  LU: 'Luxemburg',
  LV: 'Letland',
  MT: 'Malta',
  NL: 'Nederland',
  PL: 'Polen',
  PT: 'Portugal',
  RO: 'Roemenië',
  SE: 'Zweden',
  SI: 'Slovenië',
  SK: 'Slowakije',
  XI: 'Noord-Ierland',
}

/**
 * Wat er getypt is, als land en nummer zoals VIES ze wil.
 *
 * Even soepel als `formatVat` in de app: "BE 0123.456.789", "be0123456789"
 * en "123456789" zijn hetzelfde nummer. Zonder landcode is het Belgisch —
 * dat is bijna altijd zo, en wie een buitenlands nummer heeft, typt het land
 * er vanzelf voor. Null wanneer er niets op te zoeken valt; dan gaat er ook
 * geen vraag naar Brussel.
 */
export function leesBtwNummer(ruw) {
  const tekst = String(ruw ?? '')
    .toUpperCase()
    .replace(/[\s.\-/]/g, '')
  if (!tekst) return null

  let land = 'BE'
  let nummer = tekst
  const m = /^([A-Z]{2})(.*)$/.exec(tekst)
  if (m) {
    land = m[1] === 'GR' ? 'EL' : m[1]
    nummer = m[2]
  }
  if (!LANDEN[land]) return null
  if (!/^[0-9A-Z+*]{2,14}$/.test(nummer)) return null

  if (land === 'BE') {
    // Negen cijfers is het oude ondernemingsnummer; de nul hoort er nog voor.
    if (/^\d{9}$/.test(nummer)) nummer = `0${nummer}`
    if (!/^\d{10}$/.test(nummer)) return null
  }
  return { land, nummer }
}

/** "---" is VIES' manier om te zeggen dat het land het niet vrijgeeft. */
const leeg = (v) => {
  const s = String(v ?? '').trim()
  return !s || /^-+$/.test(s) ? '' : s
}

/**
 * Rechtsvormen blijven in hoofdletters: "Blum België BV", niet "Bv".
 * Alleen de korte afkortingen; een lange vorm ("Commanditaire…") is een woord.
 */
const VORMEN = new Set([
  'NV', 'BV', 'CV', 'VOF', 'COMMV', 'VZW', 'BVBA', 'CVBA', 'SA', 'SRL', 'SPRL', 'SC', 'SCRL', 'ASBL', 'SNC',
  'SCS', 'GCV', 'GMBH', 'AG', 'KG', 'UG', 'SAS', 'SARL', 'EURL', 'LTD', 'PLC', 'IVZW', 'AISBL',
])

/**
 * Een tekst die volledig in hoofdletters binnenkomt, gewoon zetten.
 *
 * Sommige landen geven alles in kapitalen. In een klantenlijst leest
 * "BROUWERIJ HET ANKER NV" als geroep tussen de rest, en een adres in
 * hoofdletters op een offerte ziet eruit als een etiket. Wat al gemengd
 * binnenkomt, laten we zoals het is: daar heeft iemand over nagedacht
 * ("deBuren", "McDonald's").
 */
export function netjes(tekst) {
  const s = String(tekst ?? '')
  if (!s || s !== s.toUpperCase() || !/[A-ZÀ-Ý]/.test(s)) return s
  return s
    .toLowerCase()
    .replace(/[\p{L}\p{N}]+/gu, (woord, plek, geheel) => {
      const groot = woord.toUpperCase()
      if (VORMEN.has(groot)) return groot
      // Een huisnummer met een letter ("12B") blijft zoals het is.
      if (/\d/.test(woord)) return groot
      // Na een apostrof alleen een hoofdletter voor een echt woord:
      // "D'Ieteren", maar "Wouter's", niet "Wouter'S".
      if (plek > 0 && geheel[plek - 1] === "'" && woord.length === 1) return woord
      return woord[0].toUpperCase() + woord.slice(1)
    })
}

/**
 * Het adres uit VIES als straat, postcode en gemeente.
 *
 * VIES geeft één tekst met regeleinden. De regel met de postcode vooraan is
 * de gemeente; wat ervoor staat is de straat. Vindt het geen postcode, dan
 * gaat alles naar de straat: een adres dat in één veld staat, is beter dan
 * een adres dat half weg is.
 */
export function viesAdres(tekst, land = 'BE') {
  const regels = String(tekst ?? '')
    .split(/\r?\n/)
    .map((r) => r.replace(/\s+/g, ' ').trim())
    .filter((r) => r && !/^-+$/.test(r))
  if (!regels.length) return { street: '', postalCode: '', city: '' }

  // Nederland: "1234AB" of "1234 AB". Elders: cijfers, met een landletter
  // ervoor ("L-1234") of een streepje erin (Portugal: "1000-001").
  const postcode =
    land === 'NL'
      ? /^(\d{4}\s?[A-Z]{2})\s+(.+)$/i
      : /^((?:[A-Z]{1,2}-)?\d{3,5}(?:-\d{3})?)\s+(.+)$/i

  // Eén regel: dan staan straat en gemeente vaak achter elkaar met een komma.
  if (regels.length === 1 && regels[0].includes(',')) {
    const i = regels[0].lastIndexOf(',')
    const achter = regels[0].slice(i + 1).trim()
    if (postcode.test(achter)) regels.splice(0, 1, regels[0].slice(0, i).trim(), achter)
  }

  for (let i = regels.length - 1; i >= 0; i -= 1) {
    const m = postcode.exec(regels[i])
    if (!m) continue
    const pc = land === 'NL' ? m[1].replace(/\s/g, '').replace(/^(\d{4})/, '$1 ').toUpperCase() : m[1].toUpperCase()
    return {
      street: netjes(regels.slice(0, i).join(', ')),
      postalCode: pc,
      city: netjes(m[2]),
    }
  }
  return { street: netjes(regels.join(', ')), postalCode: '', city: '' }
}

/**
 * Wat VIES fout kan zeggen, en wat dat voor ons betekent.
 *
 * Alleen INVALID betekent "dit nummer bestaat niet". De rest zegt dat het
 * land of VIES zelf even niet antwoordt — en dan is het eerlijke antwoord
 * "weet ik niet", niet "ongeldig". Wie dat leest als ongeldig, belt de klant
 * voor niets.
 */
const ONBEREIKBAAR = new Set([
  'MS_UNAVAILABLE',
  'MS_MAX_CONCURRENT_REQ',
  'SERVICE_UNAVAILABLE',
  'TIMEOUT',
  'GLOBAL_MAX_CONCURRENT_REQ',
  'IP_BLOCKED',
  'VAT_BLOCKED',
])

/**
 * Het antwoord van VIES in de vorm die het scherm gebruikt.
 *
 *   { geldig: true | false | null, naam, adres: { street, postalCode, city, country }, reden }
 *
 * `geldig: null` is "VIES weet het nu niet". `reden` is een sleutel voor het
 * scherm, geen tekst: de woorden staan in de taalbundels.
 */
export function leesViesAntwoord(json, land = 'BE') {
  const fout =
    json?.errorWrappers?.[0]?.error ?? (json?.userError && json.userError !== 'VALID' ? json.userError : null)
  if (fout && fout !== 'INVALID') {
    return {
      geldig: null,
      naam: '',
      adres: null,
      reden: fout === 'INVALID_INPUT' ? 'vorm' : ONBEREIKBAAR.has(fout) ? 'onbereikbaar' : 'onbekend',
    }
  }
  if (json?.isValid !== true) return { geldig: false, naam: '', adres: null, reden: 'ongeldig' }

  const naam = netjes(leeg(json.name))
  const adresTekst = leeg(json.address)
  const adres = adresTekst ? { ...viesAdres(adresTekst, land), country: LANDEN[land] ?? land } : null
  return {
    geldig: true,
    naam,
    adres,
    // Duitsland en Spanje bevestigen alleen dat het nummer bestaat.
    reden: naam || adres ? null : 'geheim',
  }
}

/** Het adres van de VIES-dienst voor één nummer. */
export const viesUrl = ({ land, nummer }) =>
  `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${land}/vat/${encodeURIComponent(nummer)}`
