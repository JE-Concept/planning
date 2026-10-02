/**
 * Iemand vermelden in een notitie.
 *
 * ── Waarom er markering in de tekst staat ─────────────────────────────────
 * Een vermelding moet twee dingen tegelijk zijn: leesbaar voor wie het bericht
 * leest ("@Elke, kun jij dit bekijken?") en aanwijsbaar voor de server, die
 * er een melding op moet sturen. Alleen "@Elke" in de tekst is het eerste maar
 * niet het tweede: er kunnen twee Elkes zijn, en een naam die verandert maakt
 * oude berichten stil.
 *
 * Daarom staat het er als `@[Elke Vandeput](u-elke)`: de naam zoals ze op het
 * moment van schrijven heette, en het account waar het over gaat. Het scherm
 * toont alleen de naam, de server leest alleen de id.
 *
 * De lijst met vermelde accounts staat daarnaast nog eens apart op de reactie
 * (`mentions`). Dat is met opzet dubbel: de trigger die de melding stuurt hoeft
 * dan geen tekst te ontleden, en een reactie waarvan de tekst ooit anders
 * geschreven wordt, blijft dezelfde mensen bereiken.
 */

// De naam mag alles bevatten behalve een blokhaak; de id is wat Firestore als
// document-id toelaat.
const MARKERING = /@\[([^\]\n]{1,80})\]\(([A-Za-z0-9_-]{1,64})\)/g

/** Alle vermelde accounts, in volgorde en zonder dubbels. */
export function vermeldingenIn(tekst) {
  const uit = []
  for (const [, , uid] of (tekst ?? '').matchAll(MARKERING)) {
    if (!uit.includes(uid)) uit.push(uid)
  }
  return uit
}

/**
 * De tekst zoals een mens hem leest: `@[Elke](u-elke)` wordt `@Elke`.
 *
 * Hiermee gaat een notitie naar een pushbericht of een e-mail zonder dat de
 * markering meereist — daar is geen scherm dat haar kan tekenen.
 */
export function leesbaar(tekst) {
  return (tekst ?? '').replace(MARKERING, (_, naam) => `@${naam}`)
}

/**
 * De tekst opgeknipt in stukken, zodat het scherm de namen anders kan tekenen.
 *
 * Geeft altijd minstens één stuk terug, ook voor een lege tekst: een lijst die
 * soms leeg is en soms niet, moet elke aanroeper apart afhandelen.
 */
export function stukken(tekst) {
  const bron = tekst ?? ''
  const uit = []
  let vorige = 0

  for (const match of bron.matchAll(MARKERING)) {
    if (match.index > vorige) uit.push({ soort: 'tekst', tekst: bron.slice(vorige, match.index) })
    uit.push({ soort: 'naam', tekst: `@${match[1]}`, uid: match[2] })
    vorige = match.index + match[0].length
  }
  if (vorige < bron.length) uit.push({ soort: 'tekst', tekst: bron.slice(vorige) })
  return uit.length ? uit : [{ soort: 'tekst', tekst: '' }]
}

/**
 * Waar in de tekst de cursor staat te typen achter een `@`, en wat er al staat.
 *
 * Geeft `null` zodra het geen vermelding meer kan zijn: geen `@` voor de
 * cursor, een spatie te veel erachter, of een `@` midden in een woord (een
 * e-mailadres is geen vermelding).
 */
export function zoekopdrachtVan(tekst, cursor) {
  const bron = (tekst ?? '').slice(0, cursor ?? 0)
  const at = bron.lastIndexOf('@')
  if (at < 0) return null
  if (at > 0 && !/\s/.test(bron[at - 1])) return null

  const staart = bron.slice(at + 1)
  // Eén spatie mag: voor- en achternaam. Een tweede betekent dat het gewoon
  // een zin geworden is.
  if (/\n/.test(staart) || (staart.match(/ /g) ?? []).length > 1) return null
  return { begin: at, vraag: staart }
}

/**
 * De gekozen naam in de tekst zetten, op de plek waar iemand `@` typte.
 *
 * ── Waarom er gewone tekst in het veld komt ───────────────────────────────
 * Hier stond vroeger de markering zelf: wie Maxine aansprak, zag
 * `@[Maxine Vanbrabant](spdwOygRumebHfPZAQ2pxXCFlVN2)` in zijn tekstvak staan.
 * Technisch klopte dat — het is wat bewaard wordt — maar het is onleesbaar, het
 * neemt drie regels in, en wie het per ongeluk half wegveegt houdt een kapotte
 * vermelding over zonder te zien wat er mis is.
 *
 * Nu komt er `@Maxine Vanbrabant ` in het veld, en wordt de markering er pas
 * bij het bewaren omheen gezet (`metMarkering`). Wat je typt is wat je leest.
 *
 * Geeft de nieuwe tekst terug, waar de cursor daarna hoort te staan — achter
 * de naam en de spatie, zodat doortypen gewoon doorgaat — en het kaartje van
 * wie er aangesproken is, zodat de oproeper dat kan bijhouden.
 */
export function zetVermelding(tekst, cursor, profiel) {
  const plek = zoekopdrachtVan(tekst, cursor)
  const naam = naamVoor(profiel)
  if (!plek || !profiel?.id || !naam) return { tekst: tekst ?? '', cursor: cursor ?? 0, vermelding: null }

  const stuk = `@${naam} `
  const nieuw = (tekst ?? '').slice(0, plek.begin) + stuk + (tekst ?? '').slice(cursor ?? 0)
  return {
    tekst: nieuw,
    cursor: plek.begin + stuk.length,
    vermelding: { uid: profiel.id, naam },
  }
}

/**
 * De naam zoals ze in een vermelding komt te staan.
 *
 * Blokhaken eruit, want die zijn de markering zelf: een naam met een `]` erin
 * zou de markering halverwege afbreken en de rest van de zin in de id duwen.
 */
export function naamVoor(profiel) {
  return (profiel?.fullName || profiel?.email || '').replace(/[[\]]/g, '').trim()
}

/**
 * De getypte tekst opgeknipt langs de vermeldingen die erin staan.
 *
 * Eén doorloop die zowel het bewaren als het tekenen voedt — twee keer
 * dezelfde regel schrijven is twee plekken waar de pil en de markering uit
 * elkaar kunnen lopen.
 *
 * Langste naam eerst, want "Maxine" is een begin van "Maxine Vanbrabant": wie
 * de kortste eerst probeert, knipt de langste doormidden. Dragen twee mensen
 * dezelfde naam, dan valt er aan de tekst niet te zien wie bedoeld is en wint
 * degene die het eerst aangeklikt werd — daarom staat de id ook apart op de
 * reactie.
 */
export function ruweStukken(tekst, vermeldingen = []) {
  const bron = tekst ?? ''
  const lijst = (vermeldingen ?? [])
    .filter((v) => v?.uid && v?.naam)
    .sort((a, b) => b.naam.length - a.naam.length)
  if (!lijst.length) return bron ? [{ soort: 'tekst', tekst: bron }] : []

  const uit = []
  let gewoon = ''
  let i = 0

  while (i < bron.length) {
    const treffer =
      bron[i] === '@'
        ? lijst.find((v) => bron.startsWith(v.naam, i + 1) && !grensInWoord(bron, i + 1 + v.naam.length))
        : null

    if (!treffer) {
      gewoon += bron[i]
      i += 1
      continue
    }

    if (gewoon) uit.push({ soort: 'tekst', tekst: gewoon })
    gewoon = ''
    uit.push({ soort: 'naam', naam: treffer.naam, uid: treffer.uid })
    i += 1 + treffer.naam.length
  }

  if (gewoon) uit.push({ soort: 'tekst', tekst: gewoon })
  return uit
}

// Een naam die doorloopt in een woord is de naam niet: "@Elke" in "@Elkeen".
const grensInWoord = (bron, eind) => eind < bron.length && /[\p{L}\p{N}]/u.test(bron[eind])

/**
 * De tekst zoals ze bewaard wordt: `@Maxine Vanbrabant` wordt
 * `@[Maxine Vanbrabant](uid)`.
 *
 * Wat niet meer in de tekst staat, komt er niet in: wie de naam weer weggeveegd
 * heeft, heeft de vermelding weggehaald, en die hoort dan ook geen melding te
 * sturen.
 */
export function metMarkering(tekst, vermeldingen = []) {
  return ruweStukken(tekst, vermeldingen)
    .map((stuk) => (stuk.soort === 'naam' ? `@[${stuk.naam}](${stuk.uid})` : stuk.tekst))
    .join('')
}

/**
 * Wie er bij een half getypte naam voorgesteld wordt.
 *
 * Zoekt op elk woord apart, zodat "van" zowel Vandeput als Van Loon vindt, en
 * houdt de volgorde van de teamlijst aan: die is voorspelbaar, een score niet.
 */
export function kandidaten(profielen, vraag, { max = 6 } = {}) {
  const woorden = (vraag ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  return (profielen ?? [])
    .filter((p) => {
      if (!p?.id) return false
      if (!woorden.length) return true
      const hooi = `${p.fullName ?? ''} ${p.email ?? ''}`.toLowerCase()
      return woorden.every((w) => hooi.includes(w))
    })
    .slice(0, max)
}
