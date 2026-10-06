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

/**
 * De envelop nakijken. Geeft `{ fout }` met een korte code, of `{ envelop }`
 * met precies de velden die in de log komen — nooit het ruwe verzoek, want wat
 * er niet in de envelop hoort, hoort ook niet in de database.
 */
export function leesEnvelop(body, { bron } = {}) {
  const b = tekst(bron ?? body?.bron, 31)
  if (!BRON.test(b)) return { fout: 'geen_bron' }
  const soort = tekst(body?.soort, 60)
  if (!SOORT.test(soort)) return { fout: 'geen_soort' }
  const sleutel = tekst(body?.sleutel, 80)
  if (!SLEUTEL.test(sleutel)) return { fout: 'geen_sleutel' }
  if (body?.inhoud === null || typeof body?.inhoud !== 'object' || Array.isArray(body.inhoud)) {
    return { fout: 'geen_inhoud' }
  }
  // Een tijdstip van de bron is welkom maar niet nodig; de log kent haar eigen ontvangsttijd.
  const tijdstip = tekst(body?.tijdstip, 40)
  const tijd = tijdstip && !Number.isNaN(Date.parse(tijdstip)) ? new Date(tijdstip).toISOString() : null

  return {
    envelop: {
      bron: b,
      soort,
      sleutel,
      tijdstip: tijd,
      taal: TALEN.includes(body?.taal) ? body.taal : 'nl',
      inhoud: body.inhoud,
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
