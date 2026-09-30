/**
 * Welke mail bij welk event hoort.
 *
 * ── Waarom dit apart staat en getest is ───────────────────────────────────
 * Een mail bij het verkeerde event zetten is erger dan hem nergens zetten. Wie
 * de draad van "Trouw Niels en Inez" opent en daar de prijsonderhandeling van
 * een ander dossier ziet staan, kan dat niet ongedaan maken en vertrouwt de
 * rest ook niet meer. Daarom koppelt dit alleen wanneer het zeker is, en gaat
 * de rest naar het postvak waar iemand ernaar kijkt.
 *
 * ── De volgorde, van zeker naar waarschijnlijk ────────────────────────────
 * 1. **Het antwoordadres.** Post die JE Plan over een event stuurt, draagt
 *    `Reply-To: info+e<eventId>@jeconcept.be`. Antwoordt de klant, dan staat
 *    het event letterlijk in het adres. Dat is geen gok.
 * 2. **De draad.** `In-Reply-To` en `References` wijzen naar berichten die we
 *    al kennen. Hangt daar een event aan, dan hangt dit bericht er ook aan.
 *    Ook exact: die kop komt van het mailprogramma, niet van ons.
 * 3. **De afzender.** Het adres hoort bij een klant, en die klant heeft precies
 *    één lopend dossier. Dan is het dat. Heeft hij er meer, dan koppelen we
 *    niet: kiezen tussen twee dossiers van dezelfde klant is precies waar het
 *    misgaat, en de mens die het postvak opent, weet het wel.
 *
 * Wat overblijft is een aanvraag: een nieuwe klant die schrijft. Die hoort ook
 * nergens aan gekoppeld te worden — er is nog geen event.
 */

/** "Kristien Maris <k@example.be>" → "k@example.be". Leeg blijft leeg. */
export function adresVan(waarde) {
  const tekst = String(waarde ?? '').trim()
  const haakjes = tekst.match(/<([^>]+)>/)
  const adres = (haakjes ? haakjes[1] : tekst).trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+$/.test(adres) ? adres : ''
}

/** Alle adressen uit een kopregel die er meer dan één kan dragen. */
export const adressenVan = (waarde) =>
  String(waarde ?? '')
    .split(',')
    .map(adresVan)
    .filter(Boolean)

/**
 * Het antwoordadres voor een event.
 *
 * Plusadressering: alles achter de `+` negeert de mailserver bij het bezorgen,
 * dus `info+e<id>@jeconcept.be` komt gewoon in `info@` terecht. Google Workspace
 * doet dat standaard. Zo draagt elk antwoord zijn eigen event bij zich zonder
 * dat er iets in het onderwerp hoeft — en een onderwerp knipt een klant af, een
 * adres niet.
 */
export function antwoordAdres(postbus, eventId) {
  const adres = adresVan(postbus)
  if (!adres || !eventId) return adres
  const [lokaal, domein] = adres.split('@')
  return `${lokaal}+e${eventId}@${domein}`
}

/** Het event uit een plusadres, of niets wanneer er geen in staat. */
export function eventUitAdres(waarde) {
  const adres = adresVan(waarde)
  const merk = adres.split('@')[0]?.split('+')[1]
  return merk && merk.startsWith('e') && merk.length > 1 ? merk.slice(1) : null
}

/** Alle Message-ID's waar dit bericht naar terugwijst, nieuwste eerst. */
export function draadVan(bericht) {
  const uit = []
  const bij = (waarde) => {
    for (const stuk of String(waarde ?? '').split(/\s+/)) {
      const id = stuk.trim().replace(/^<|>$/g, '')
      if (id && !uit.includes(id)) uit.push(id)
    }
  }
  bij(bericht?.inReplyTo)
  // `References` loopt van oud naar nieuw; het laatste bericht is het meest
  // waarschijnlijke aanknopingspunt, dus omgekeerd erin.
  bij([...String(bericht?.references ?? '').split(/\s+/)].reverse().join(' '))
  return uit
}

/**
 * De klant bij een afzender.
 *
 * Kijkt naar het adres van de klant zelf én naar dat van zijn contactpersonen:
 * de zaakvoerder staat op de fiche, maar het is de eventverantwoordelijke die
 * mailt.
 */
export function klantVanAdres(adres, klanten = []) {
  const zoek = adresVan(adres)
  if (!zoek) return null
  return (
    (klanten ?? []).find((klant) => {
      if (adresVan(klant?.email) === zoek) return true
      return (klant?.contacts ?? []).some((c) => adresVan(c?.email) === zoek)
    }) ?? null
  )
}

/**
 * Het event waar dit bericht bij hoort, en waarom.
 *
 * `reden` gaat mee naar het scherm: wie ziet dat een mail "via het
 * antwoordadres" gekoppeld is, hoeft niet te twijfelen; bij "de enige lopende
 * aanvraag van deze klant" kijkt hij beter nog even.
 */
export function kiesEvent({ bericht, bekend = [], events = [], klanten = [] }) {
  const ontvangers = [
    ...adressenVan(bericht?.aan),
    ...adressenVan(bericht?.cc),
    ...adressenVan(bericht?.deliveredTo),
  ]

  // 1. Het antwoordadres draagt het event met zich mee.
  for (const adres of ontvangers) {
    const id = eventUitAdres(adres)
    if (id && events.some((e) => e.id === id)) {
      return { eventId: id, customerId: events.find((e) => e.id === id)?.customerId ?? null, reden: 'adres' }
    }
  }

  // 2. De draad: een bericht dat we al kennen en dat aan een event hangt.
  const perMessageId = new Map((bekend ?? []).filter((m) => m?.messageId).map((m) => [m.messageId, m]))
  for (const id of draadVan(bericht)) {
    const eerder = perMessageId.get(id)
    if (eerder?.eventId) {
      return { eventId: eerder.eventId, customerId: eerder.customerId ?? null, reden: 'draad' }
    }
  }

  // 3. De afzender is een klant met precies één lopend dossier.
  const klant = klantVanAdres(bericht?.van, klanten)
  if (klant) {
    const lopend = (events ?? []).filter((e) => e.customerId === klant.id && !e.archived)
    if (lopend.length === 1) return { eventId: lopend[0].id, customerId: klant.id, reden: 'klant' }
    // Meer dan één: niet kiezen. Wel al weten van wie het is — dat scheelt de
    // mens die het postvak opent de helft van het werk.
    return { eventId: null, customerId: klant.id, reden: klant ? 'klant_meerdere' : null }
  }

  return { eventId: null, customerId: null, reden: null }
}

/**
 * Een Message-ID tot iets wat een documentnaam kan zijn.
 *
 * De id is de sleutel van het bericht: schrijft de ophaler er twee keer
 * dezelfde weg — na een herstart, of omdat een server een bericht opnieuw
 * aanbiedt — dan is het hetzelfde document en staat het één keer in de draad.
 */
export function berichtSleutel(messageId, terugval = '') {
  const bron = String(messageId ?? '').replace(/^<|>$/g, '').trim() || String(terugval ?? '').trim()
  if (!bron) return ''
  return bron.replace(/[^A-Za-z0-9._@-]/g, '_').slice(0, 180)
}
