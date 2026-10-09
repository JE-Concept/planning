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
 * 1. **De draad.** `In-Reply-To` en `References` wijzen naar berichten die we
 *    al kennen — post die we zelf naar de klant stuurden. Hangt daar een event
 *    aan, dan hangt dit bericht er ook aan. Exact: die koppen komen van het
 *    mailprogramma van de klant, niet van ons, en ze overleven de tocht door
 *    een Google Groep.
 * 2. **Het antwoordadres.** Een adres van de vorm `naam+e<eventId>@domein`
 *    draagt het event met zich mee. Let op: `info@jeconcept.be` is een groep,
 *    en een groep kent geen plusadressering — mail naar `info+e123@` bouncet.
 *    Deze regel geldt dus alleen wanneer iemand rechtstreeks naar de postbus
 *    van de tool schrijft. Hij staat er omdat hij gratis is en omdat het adres
 *    ooit wél een postbus kan worden, niet omdat we erop rekenen.
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
 * Een adres dat het event met zich meedraagt.
 *
 * Plusadressering: alles achter de `+` negeert de mailserver bij het bezorgen,
 * dus `plan+e<id>@jeconcept.be` komt gewoon in `plan@` terecht. Dat werkt voor
 * een postbus, maar níét voor een Google Groep: `info+e<id>@jeconcept.be`
 * wordt door Groups niet herkend en bouncet. Daarom wordt dit niet gebruikt
 * als antwoordadres op post aan een klant — dat is de groep, waar het team het
 * ook wil zien — en leunt het koppelen op de draad.
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

  // 1. De draad: een bericht dat we al kennen en dat aan een event hangt.
  const perMessageId = new Map((bekend ?? []).filter((m) => m?.messageId).map((m) => [m.messageId, m]))
  for (const id of draadVan(bericht)) {
    const eerder = perMessageId.get(id)
    if (eerder?.eventId) {
      return { eventId: eerder.eventId, customerId: eerder.customerId ?? null, reden: 'draad' }
    }
  }

  // 2. Een plusadres dat het event draagt. Zeldzaam sinds info@ een groep is;
  //    zie de uitleg bovenaan.
  for (const adres of ontvangers) {
    const id = eventUitAdres(adres)
    if (id && events.some((e) => e.id === id)) {
      return { eventId: id, customerId: events.find((e) => e.id === id)?.customerId ?? null, reden: 'adres' }
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

/** Even lang als wat de ophaler bewaart; zie `bewaar` in `functions-mail/postvak.js`. */
export const MAX_TEKST = 20000

/**
 * Een korte, vaste vingerafdruk van een tekst (FNV-1a, 32 bits).
 *
 * Geen beveiliging, alleen een naam: wie twee keer op "aanmaken" drukt, of
 * wiens verbinding de vraag herhaalt, komt op hetzelfde document uit in plaats
 * van op twee keer dezelfde mail in de draad. Zonder `node:crypto`, zodat dit
 * bestand zonder imports blijft.
 */
export function vingerafdruk(tekst) {
  let h = 0x811c9dc5
  for (const teken of String(tekst ?? '')) {
    h ^= teken.codePointAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Een aanvraag die iemand in "Nieuw event › Uit een mail" plakte, als bericht
 * in de draad van dat event.
 *
 * ── Waarom in `mails` en niet in de omschrijving ──────────────────────────
 * Zo stond het eerst: de geplakte mail werd de omschrijving van het event. Dan
 * staat de vraag van de klant tussen de notities van het team, telt de tegel
 * Post nul en is het tabblad Mail leeg — net dat tabblad waar iedereen de
 * wisseling met de klant zoekt. Een aanvraag die via info@ binnenkwam en een
 * die iemand uit zijn eigen mailbox plakte, horen op dezelfde plek te staan.
 *
 * ── Waarom het te zien blijft dat hij geplakt is ──────────────────────────
 * De draad is bewijs van wat er gezegd is; daarom schrijft geen browser in
 * `mails`. Deze rij schrijft de server, met `bron: 'geplakt'` en wie het deed.
 * Wat de ophaler binnenhaalde, heeft koppen van de mailserver; dit heeft
 * alleen wat iemand in een vak zette, en dat hoort men te kunnen zien.
 *
 * Geeft `null` terug als er niets te bewaren valt.
 */
export function geplakteMail({ tekst, onderwerp = '', van = '', eventId, customerId = null, door, nu = new Date() }) {
  const inhoud = String(tekst ?? '').trim().slice(0, MAX_TEKST)
  if (!inhoud || !eventId || !door) return null
  return {
    id: `geplakt-${String(eventId).replace(/[^A-Za-z0-9_-]/g, '_')}-${vingerafdruk(inhoud)}`,
    data: {
      richting: 'in',
      bron: 'geplakt',
      uid: null,
      messageId: null,
      inReplyTo: null,
      references: null,
      van: String(van ?? '').trim().slice(0, 200),
      aan: '',
      cc: '',
      onderwerp: String(onderwerp ?? '').trim().slice(0, 300),
      tekst: inhoud,
      bijlagen: [],
      datum: nu,
      eventId: String(eventId),
      customerId: customerId || null,
      // Met de hand aan dit event gehangen, door wie hem plakte: daar valt
      // niets aan te raden, dus geen knop "hoort hier niet".
      koppeling: 'geplakt',
      geplaktDoor: door,
      opgehaaldOp: nu,
    },
  }
}
