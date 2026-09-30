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
 * Geeft de nieuwe tekst terug én waar de cursor daarna hoort te staan: achter
 * de naam en de spatie, zodat doortypen gewoon doorgaat.
 */
export function zetVermelding(tekst, cursor, profiel) {
  const plek = zoekopdrachtVan(tekst, cursor)
  const naam = (profiel?.fullName || profiel?.email || '').replace(/[[\]]/g, '').trim()
  if (!plek || !profiel?.id || !naam) return { tekst: tekst ?? '', cursor: cursor ?? 0 }

  const stuk = `@[${naam}](${profiel.id}) `
  const nieuw = (tekst ?? '').slice(0, plek.begin) + stuk + (tekst ?? '').slice(cursor ?? 0)
  return { tekst: nieuw, cursor: plek.begin + stuk.length }
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
