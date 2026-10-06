/**
 * De envelop van een bericht, en wat ervan klopt.
 *
 * Elke bron van buiten — Wintermoods, Bar Vue, Feestbeest, de verhuursite —
 * stuurt hetzelfde omhulsel: wie het stuurt (`bron`), wat het is (`soort`),
 * het eigen kenmerk van de bron (`sleutel`), en de inhoud die bij die soort
 * hoort. Het omhulsel is wat JE Plan leest om te weten wát er met een bericht
 * moet gebeuren; de inhoud leest pas de verwerker van die soort.
 *
 * Zonder één import, zodat `tests/messaging.test.js` dit kan nalopen zonder de
 * functies-SDK — dezelfde lijn als `order.js` in functions-betaling.
 */

/** Een bron is een korte naam in kleine letters: zo heet ze ook in het geheim. */
const BRON = /^[a-z][a-z0-9-]{1,30}$/
/** Een soort is `domein.gebeurtenis`, in het Nederlands, in de voltooide tijd. */
const SOORT = /^[a-z]+(\.[a-z]+)+$/
const SLEUTEL = /^[A-Za-z0-9_.:-]{1,80}$/
const TALEN = ['nl', 'fr', 'en']

export const tekst = (waarde, max) => String(waarde ?? '').trim().slice(0, max)

/**
 * Het document-id in de log: `<bron>-<sleutel>`. Dezelfde inzending die twee
 * keer vertrekt (een dubbele klik, een herhaling na een time-out die wél
 * aankwam) krijgt hetzelfde id en dus één rij — `create` weigert de tweede.
 */
export const berichtId = ({ bron, sleutel }) => `${bron}-${sleutel}`

/** Velden van de envelop zelf; al de rest van een plat formulier is inhoud. */
const ENVELOP_VELDEN = new Set(['bron', 'soort', 'sleutel', 'tijdstip', 'taal', 'inhoud'])
/** Bovengrens voor de inhoud: een aanvraag is een formulier, geen bijlage. */
const MAX_INHOUD = 20000
/** Zonder soort is een bericht van een formulier een vraag om een offerte. */
export const STANDAARD_SOORT = 'offerte.aangevraagd'

/**
 * Een kenmerk uit de inhoud zelf, voor een formulier dat er geen meestuurt
 * (een webhook van een WordPress- of Wix-formulier). Dezelfde inzending twee
 * keer geeft hetzelfde kenmerk en dus één rij. FNV-1a over de JSON met
 * gesorteerde sleutels: geen cryptografie nodig, alleen een vaste vingerafdruk.
 */
export function kenmerkVan(inhoud) {
  const vast = (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, vast(v[k])]))
      : v
  const tekst = JSON.stringify(vast(inhoud))
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < tekst.length; i += 1) {
    const c = tekst.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0
  }
  return `h${h1.toString(36)}${h2.toString(36)}`
}

/**
 * De envelop nakijken. Geeft `{ fout }` met een korte code, of `{ envelop }`
 * met precies de velden die in de log komen — nooit het ruwe verzoek, want wat
 * er niet in de envelop hoort, hoort ook niet in de database.
 *
 * Twee vormen worden aanvaard. De volledige envelop (`soort`, `sleutel`,
 * `inhoud`) is wat een eigen site stuurt. Een **plat formulier** — gewoon de
 * velden, zoals een formulier-webhook ze verstuurt — wordt in de envelop
 * gestoken: zonder `inhoud` wordt al wat geen envelopveld is de inhoud,
 * zonder `soort` geldt `offerte.aangevraagd`, en zonder `sleutel` is het
 * kenmerk een vingerafdruk van de inhoud. Zo kan een site waar we geen code op
 * draaien (Bar Vue, Meer, Ken je klanten) aansluiten met enkel een webhook.
 */
export function leesEnvelop(body, { bron } = {}) {
  const b = tekst(bron ?? body?.bron, 31)
  if (!BRON.test(b)) return { fout: 'geen_bron' }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fout: 'geen_inhoud' }

  const plat = body.inhoud === undefined
  const inhoud = plat
    ? Object.fromEntries(Object.entries(body).filter(([k]) => !ENVELOP_VELDEN.has(k)))
    : body.inhoud
  if (inhoud === null || typeof inhoud !== 'object' || Array.isArray(inhoud)) return { fout: 'geen_inhoud' }
  if (Object.keys(inhoud).length === 0) return { fout: 'geen_inhoud' }
  if (JSON.stringify(inhoud).length > MAX_INHOUD) return { fout: 'te_groot' }

  const soort = tekst(body.soort, 60) || STANDAARD_SOORT
  if (!SOORT.test(soort)) return { fout: 'geen_soort' }
  const sleutel = tekst(body.sleutel, 80) || kenmerkVan(inhoud)
  if (!SLEUTEL.test(sleutel)) return { fout: 'geen_sleutel' }

  // Een tijdstip van de bron is welkom maar niet nodig; de log kent haar eigen ontvangsttijd.
  const tijdstip = tekst(body.tijdstip, 40)
  const tijd = tijdstip && !Number.isNaN(Date.parse(tijdstip)) ? new Date(tijdstip).toISOString() : null

  return {
    envelop: {
      bron: b,
      soort,
      sleutel,
      tijdstip: tijd,
      taal: TALEN.includes(body.taal) ? body.taal : 'nl',
      inhoud,
    },
  }
}

/**
 * Het oude Wintermoods-contract (een plat formulier op /api/wintermoods) in de
 * envelop gestoken. De site stuurt het nog zo; dit adres blijft als alias
 * bestaan tot ze zelf de envelop stuurt.
 */
export function wintermoodsNaarEnvelop(body) {
  const sleutel = tekst(body?.aanvraagId, 80)
  if (!sleutel) return { fout: 'geen_sleutel' }
  const { aanvraagId: _weg, bron: _bron, taal, ...inhoud } = body ?? {}
  return leesEnvelop({ soort: 'reservatie.aangevraagd', sleutel, taal, inhoud }, { bron: 'wintermoods' })
}

/**
 * De tokens per bron, uit één geheim: een JSON-object `{ "wintermoods": "…" }`.
 * Eén geheim en niet één per bron, want elke nieuwe bron zou anders een nieuw
 * `defineSecret` en een nieuwe uitrolwacht vragen — en een bron erbij hoort een
 * regel in een geheim te zijn, geen uitrolwijziging.
 */
export function leesTokens(geheim) {
  try {
    const obj = JSON.parse(String(geheim ?? ''))
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    return Object.fromEntries(
      Object.entries(obj).filter(([k, v]) => BRON.test(k) && typeof v === 'string' && v.length >= 16)
    )
  } catch {
    return {}
  }
}

/** De bron die bij een token hoort, of null. Vergelijkt in constante tijd per kandidaat. */
export function bronVanToken(tokens, header, gelijk) {
  const meegegeven = String(header ?? '').replace(/^Bearer\s+/i, '')
  if (!meegegeven) return null
  for (const [bron, token] of Object.entries(tokens)) {
    if (gelijk(token, meegegeven)) return bron
  }
  return null
}

/**
 * Platformen die voor meer dan één site spreken.
 *
 * De boekingsapp (Base44) host mini-sites met een reservatieformulier, en Cue
 * (het platform achter jeconcept.be) is er een met tenants. Eén token per
 * platform, en het platform zegt in `bron` voor welke site het bericht is.
 * Alleen de bronnen in deze lijst: een gelekt platform-token kan zo nooit
 * spreken voor een bron die niet bij dat platform hoort, en de lijst staat in
 * de code, niet in een geheim, zodat ze in een review te zien is.
 */
export const SPREEKT_VOOR = {
  jebookings: ['barvue', 'meer', 'kenjeklanten', 'feestbeest', 'jeconcept'],
  jeconcept: ['barvue', 'meer', 'kenjeklanten'],
}

/**
 * De bron waaronder het bericht in de log komt: die van de token, tenzij het
 * platform achter de token voor de gevraagde bron mag spreken. `via` zegt dan
 * welk platform het afleverde.
 */
export function effectieveBron(tokenBron, gevraagd) {
  const g = tekst(gevraagd, 31)
  if (g && g !== tokenBron && (SPREEKT_VOOR[tokenBron] ?? []).includes(g)) return { bron: g, via: tokenBron }
  return { bron: tokenBron, via: null }
}
