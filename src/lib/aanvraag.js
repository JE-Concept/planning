/**
 * Een aanvraag van een klant lezen.
 *
 * ── Waarom dit geen model is ──────────────────────────────────────────────
 * Een offerte die op een verkeerd gelezen datum staat, is erger dan geen
 * offerte: ze gaat de deur uit, de klant rekent erop, en niemand kijkt nog
 * eens na waar dat "28 november" vandaan kwam. Wat hier staat is daarom
 * deterministisch en getest: dezelfde mail geeft altijd hetzelfde antwoord, en
 * elk antwoord draagt bij hoe zeker het is.
 *
 * Een taalmodel mag hier bovenop komen — het leest nuance die een regel nooit
 * vangt ("liefst het weekend erna", "het budget mag niet boven de 3.000") —
 * maar dan als aanvulling op iets dat ook zonder sleutel werkt. De tool moet
 * blijven draaien op een dag dat een API eruit ligt.
 *
 * ── Wat eruit komt ────────────────────────────────────────────────────────
 * Velden die je meteen op een event kan zetten, plus `onzeker`: de lijst van
 * wat geraden is. Het scherm toont die geraden velden anders, zodat er iemand
 * naar kijkt voor de offerte de deur uit gaat. Niets invullen is beter dan
 * verkeerd invullen: wat niet met zekerheid te lezen is, komt er niet in.
 */

const MAANDEN = {
  januari: 0, jan: 0, january: 0,
  februari: 1, feb: 1, february: 1,
  maart: 2, mrt: 2, march: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, jun: 5, june: 5,
  juli: 6, jul: 6, july: 6,
  augustus: 7, aug: 7, august: 7,
  september: 8, sep: 8, sept: 8,
  oktober: 9, okt: 9, october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
}

const WEEKDAGEN = {
  zondag: 0, maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

const SOORTEN = [
  { type: 'Huwelijk', woorden: ['trouw', 'huwelijk', 'bruiloft', 'wedding', 'trouwfeest'] },
  { type: 'Verjaardag', woorden: ['verjaardag', 'jarig', 'jaar wordt', 'wordt.*jaar', 'birthday'] },
  { type: 'Bedrijfsevent', woorden: ['bedrijf', 'personeelsfeest', 'teambuilding', 'klantenevent', 'corporate', 'receptie voor'] },
  { type: 'Communie', woorden: ['communie', 'lentefeest', 'doopsel', 'doop'] },
  { type: 'Babyborrel', woorden: ['babyborrel', 'geboorte'] },
  { type: 'Jubileum', woorden: ['jubileum', 'jubilé', 'anniversary', 'bestaan'] },
]

const norm = (tekst) => (tekst ?? '').toLowerCase().replace(/\s+/g, ' ')

const DAGNAMEN = Object.keys(WEEKDAGEN).join('|')

/*
  Wat er tussen twee dagen van dezelfde reeks staat: "23, 24 en 25", "23 tot
  25", "23-25", "23 t.e.m. 25". "Tot en met" staat vóór "tot", anders blijft er
  "en met" over en is de reeks gebroken.
*/
const TUSSEN = String.raw`(?:\s*(?:,|&|\+|-|–)\s*|\s+(?:tot en met|tot|t\/m|t\.e\.m\.?|tem|tm|en|and|to|till|until)\s+)`
// Een woord dat zegt dat het om een aaneengesloten reeks gaat en niet om losse dagen.
const REEKS = /tot|t\/m|t\.e\.m|tem|tm|-|–|to|till|until/
// Twee volledige datums na elkaar: "23 februari tot 25 februari", "23/2 - 25/2".
const TOT_TUSSEN = /^(?:\s*(?:-|–)\s*|\s+(?:tot en met|tot|t\/m|t\.e\.m\.?|tem|tm|to|till|until)\s+)$/

/** Het langste dat een reeks uit een mail kan duren voor we hem niet meer geloven. */
const LANGSTE_REEKS_DAGEN = 31

/**
 * Elke plek in de tekst waar een datum zou kunnen staan, in volgorde.
 *
 * Twee vormen. Met de maand voluit mag er een reeks dagen vóór staan ("23, 24
 * en 25 februari"); in cijfers moet er een schuine streep of een streepje
 * tussen ("28/11", "14-11-2026") en een punt alleen met een jaartal erbij
 * ("14.11.2026"). Een spatie tussen twee getallen telt níét: dan is
 * "0470 04 12 34" ineens 4 december, en een telefoonnummer staat in bijna elke
 * ondertekening.
 */
function datumKandidaten(bron) {
  const woord = new RegExp(
    String.raw`(?<![\d.,/])(?:(${DAGNAMEN})\s+)?(\d{1,2})((?:${TUSSEN}(?:(?:${DAGNAMEN})\s+)?\d{1,2})*)\s*([a-zé]+)\.?(?:,?\s+(\d{4}))?`,
    'g'
  )
  const cijfers = new RegExp(
    String.raw`(?<![\d.,/])(?:(${DAGNAMEN})\s+)?(\d{1,2})\s*(?:([/-])\s*(\d{1,2})(?:\3(\d{4}|\d{2}))?|\.(\d{1,2})\.(\d{4}))(?![\d/])`,
    'g'
  )

  const uit = []
  for (const m of bron.matchAll(woord)) {
    const maand = MAANDEN[m[4]]
    if (maand == null) continue
    const rest = [...m[3].matchAll(/\d{1,2}/g)].map((x) => Number(x[0]))
    uit.push({
      begin: m.index,
      eind: m.index + m[0].length,
      weekdag: m[1] ?? null,
      dagen: [Number(m[2]), ...rest],
      reeks: Boolean(rest.length) && REEKS.test(m[3]),
      maand,
      jaar: m[5] ? Number(m[5]) : null,
    })
  }
  for (const m of bron.matchAll(cijfers)) {
    // Een vorm in cijfers binnen een datum met de maand voluit ("3-5 mei") is
    // een reeks en geen derde mei.
    if (uit.some((k) => m.index < k.eind && m.index + m[0].length > k.begin)) continue
    const maandTekst = m[4] ?? m[6]
    const jaarTekst = m[5] ?? m[7]
    uit.push({
      begin: m.index,
      eind: m.index + m[0].length,
      weekdag: m[1] ?? null,
      dagen: [Number(m[2])],
      reeks: false,
      maand: Number(maandTekst) - 1,
      jaar: jaarTekst ? (jaarTekst.length === 2 ? 2000 + Number(jaarTekst) : Number(jaarTekst)) : null,
    })
  }
  return uit.filter((k) => k.maand >= 0 && k.maand <= 11).sort((a, b) => a.begin - b.begin)
}

/**
 * De datum uit de tekst.
 *
 * Alleen een dag-en-maand die er echt staat telt. "Ergens in het voorjaar" is
 * geen datum, en die gok mag niet op een offerte belanden.
 *
 * Het jaar staat er meestal niet bij; dan is het de eerstvolgende keer dat die
 * dag valt. Een klant die in oktober over 28 november schrijft, bedoelt over
 * zes weken en niet over veertien maanden — en schrijft hij in december over
 * 15 januari, dan bedoelt hij volgend jaar.
 *
 * Staat de weekdag erbij, dan mag die het jaar één keer opschuiven: "zaterdag
 * 28 november" is een sterkere aanwijzing dan onze aanname over het jaar.
 * Verder dan volgend jaar zoeken we niet — dan is het eerder een vergissing
 * van de klant dan een feest over vijf jaar. In dat geval geven we de datum
 * gewoon terug met `weekdagKlopt: false`, zodat het scherm kan zeggen dat 28
 * november op een zaterdag valt en niet op een vrijdag. Zwijgen zou hier het
 * ergste zijn: dan gaat de offerte de deur uit met een dag die niemand
 * nagekeken heeft.
 *
 * Een reeks ("23, 24 en 25 februari", "3 tot 5 mei", "23/2 - 25/2") geeft ook
 * `tot`: dan is het een meerdaags event, en dat hoort het event ook te zijn —
 * anders plant de keuken één dag voor drie wandeldagen. Losse dagen ("3 en 10
 * mei") zijn géén reeks; dan blijft het bij de eerste en staat `losseDagen`
 * aan, zodat het scherm zegt dat er meer dan één dag gevraagd is.
 *
 * `jaarGegeven` zegt of het jaartal bij déze datum stond. Een jaartal elders
 * in de mail ("sinds 2019 klant") zegt niets over wanneer het feest is.
 */
export function leesDatum(tekst, { nu = new Date() } = {}) {
  const bron = norm(tekst)
  const kandidaten = datumKandidaten(bron)

  for (const [i, k] of kandidaten.entries()) {
    const dag = k.dagen[0]
    if (dag < 1 || dag > 31) continue

    const gevonden = kiesJaar(k, dag, nu)
    if (!gevonden) continue

    const volgende = kandidaten[i + 1]
    const totKandidaat =
      volgende && TOT_TUSSEN.test(bron.slice(k.eind, volgende.begin)) && k.dagen.length === 1 ? volgende : null
    const laatste = totKandidaat ? totKandidaat.dagen.at(-1) : k.dagen.at(-1)
    const aaneen = k.dagen.every((d, j) => j === 0 || d === k.dagen[j - 1] + 1)

    let tot = null
    if (totKandidaat || (k.dagen.length > 1 && (k.reeks || aaneen))) {
      const maand = totKandidaat ? totKandidaat.maand : k.maand
      let eind = new Date(gevonden.datum.getFullYear(), maand, laatste, 12)
      // "28 december tot 2 januari" loopt over de jaarwisseling.
      if (eind < gevonden.datum) eind = new Date(gevonden.datum.getFullYear() + 1, maand, laatste, 12)
      const dagen = Math.round((eind - gevonden.datum) / 86400000)
      if (eind.getDate() === laatste && dagen > 0 && dagen <= LANGSTE_REEKS_DAGEN) tot = eind
    }

    return {
      ...gevonden,
      tot,
      losseDagen: k.dagen.length > 1 && !tot,
      jaarGegeven: k.jaar != null || Boolean(totKandidaat?.jaar),
    }
  }

  return null
}

/** Het jaar bij een dag en een maand; zie `leesDatum` voor de redenering. */
function kiesJaar({ weekdag, maand, jaar: jaarTekst }, dag, nu) {
  const gewenst = weekdag ? WEEKDAGEN[weekdag] : null
  let eerste = null

  for (let stap = 0; stap < 3; stap += 1) {
    const jaar = jaarTekst ? jaarTekst + stap : nu.getFullYear() + stap
    const kandidaat = new Date(jaar, maand, dag, 12)
    if (kandidaat.getMonth() !== maand || kandidaat.getDate() !== dag) break
    // Een datum die al voorbij is, bedoelt niemand — behalve wanneer het
    // jaar er met zoveel woorden bij staat.
    if (!jaarTekst && kandidaat < startVanDag(nu)) continue
    eerste ??= kandidaat
    if (gewenst == null || kandidaat.getDay() === gewenst) {
      return { datum: kandidaat, weekdagKlopt: true }
    }
    // Met een jaartal erbij valt er niets op te schuiven: de klant heeft de
    // weekdag er dan gewoon naast.
    if (jaarTekst) break
  }

  return eerste ? { datum: eerste, weekdagKlopt: gewenst == null } : null
}

const startVanDag = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * Het aantal personen.
 *
 * "een 40-tal", "ongeveer 40", "±40", "40 à 50", "40 tot 50 personen": allemaal
 * hetzelfde getal met een andere slag om de arm. Bij een vork nemen we het
 * laagste en zeggen we erbij dat het er een is — wie op 50 rekent en er 40
 * krijgt, heeft te veel ingekocht; andersom bel je de klant.
 *
 * Het getal moet bij "personen", "gasten", "man" of "pax" horen. Anders is
 * "65 jaar" ineens vijfenzestig gasten, en dat is precies de fout die niemand
 * opmerkt tot de tafels besteld zijn. "Bezoekers" en "deelnemers" horen er
 * wel bij: een vereniging schrijft niet over gasten maar over wie er komt
 * ("200 à 250 bezoekers"), en een titel als "8 Pers" of "(24p)" is dezelfde
 * vraag in vier tekens.
 *
 * Na het woord mag geen letter meer volgen: "3 manieren" is geen drie man.
 * `bron` is het stuk tekst zelf, zodat een titel het eruit kan knippen.
 */
export function leesPersonen(tekst) {
  const bron = norm(tekst)
  const eenheid =
    '(?:personen|persoon|persons|person|people|pers\\.?|p(?!\\.p)|gasten|guests|bezoekers|deelnemers|aanwezigen|genodigden|mensen|man|koppels|pax|volwassenen|adults)'
  const patroon = new RegExp(
    `(?:(?:ongeveer|circa|ca\\.?|±|~|een|zo'n|about|around|tussen(?: de)?)\\s*)?` +
      `(?<![\\d/.,:])(\\d{1,4})\\s*(?:-?tal)?\\s*(?:(?:à|a|tot|-|–|of|or|en)\\s*(\\d{1,4})\\s*)?${eenheid}(?![a-zà-ÿ])`,
    'gi'
  )

  for (const m of bron.matchAll(patroon)) {
    const laag = Number(m[1])
    const hoog = m[2] ? Number(m[2]) : null
    if (!Number.isFinite(laag) || laag < 1 || laag > 5000) continue
    const vork = Boolean(hoog && hoog > laag)
    return { personen: laag, tot: vork ? hoog : null, vork, bron: m[0] }
  }

  return null
}

/** Het soort feest, aan de woorden waarmee erover geschreven wordt. */
export function leesSoort(tekst) {
  const bron = norm(tekst)
  for (const { type, woorden } of SOORTEN) {
    if (woorden.some((w) => new RegExp(w).test(bron))) return type
  }
  return null
}

/**
 * De formule waar de klant naar vraagt, uit jullie eigen lijst.
 *
 * Zoekt op de woorden van de naam en niet op de naam in haar geheel: "we dachten
 * aan een winterbarbecue" hoort bij "Winter BBQ", en "walking dinner met
 * dessertbuffet" bij "Walking dinner". Barbecue en bbq zijn hetzelfde woord
 * voor een klant, dus voor ons ook.
 */
export function leesFormule(tekst, formules = []) {
  const bron = norm(tekst).replace(/barbecue|barbeque/g, 'bbq')
  let beste = null

  for (const formule of formules) {
    const woorden = norm(formule?.name)
      .replace(/barbecue|barbeque/g, 'bbq')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
    if (!woorden.length) continue

    const raak = woorden.filter((w) => bron.includes(w)).length
    if (raak === 0) continue
    // Alle woorden van de naam terugvinden telt zwaarder dan er één.
    const score = raak / woorden.length + raak / 100
    if (!beste || score > beste.score) beste = { formule, score, raak }
  }

  return beste && beste.score >= 0.5 ? beste.formule : null
}

/*
  De zalen die we zelf uitbaten, met het adres zoals het op een event hoort te
  staan. Hetzelfde adres als `BRONNEN.meer.locatie` in
  `functions/messaging-kaart.js`: een aanvraag via de site en een geplakte mail
  over dezelfde zaal horen op dezelfde plek uit te komen. Dat bestand kan hier
  niet geïmporteerd worden (zie CLAUDE.md), vandaar de herhaling.

  `merk` is het deel van de merknaam vóór het streepje. Heet het merk live
  gewoon "Meer", dan vindt een mail over Het Vinne het toch.
*/
const ZALEN = [{ naam: 'Het Vinne', woorden: ['het vinne', "'t vinne", 'vinne'], adres: 'Het Vinne, Zoutleeuw', merk: 'meer' }]

/** "Meer — Het Vinne" → ["Meer", "Het Vinne"]: het merk vóór het streepje, de zaal erachter. */
const delenVan = (naam) =>
  String(naam ?? '')
    .split(/\s*[—–-]\s*/)
    .map((d) => d.trim())
    .filter((d) => d.length > 2)

const zonderLidwoord = (deel) => deel.replace(/^(?:het|de|'t)\s+/i, '')
const ontsnap = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Staat deze naam in de tekst?
 *
 * Een naam van meer dan één woord mag in elke schrijfwijze ("het vinne"). Een
 * naam van één woord moet als eigennaam staan, met een hoofdletter: "Meer"
 * is een merk, maar "wat meer informatie" staat in de helft van alle
 * aanvragen, en dan krijgt elk event het verkeerde concept.
 */
function noemt(tekst, naam) {
  const deel = String(naam ?? '').trim()
  if (deel.length < 3) return false
  const voor = '(?<![\\p{L}\\d])'
  const na = '(?![\\p{L}\\d])'
  if (/\s/.test(deel)) {
    return new RegExp(voor + ontsnap(deel).replace(/\s+/g, '\\s+') + na, 'iu').test(tekst ?? '')
  }
  const [eerste, ...rest] = [...deel]
  const patroon =
    ontsnap(eerste.toUpperCase()) +
    rest
      .map((c) => (c.toLowerCase() === c.toUpperCase() ? ontsnap(c) : `[${c.toLowerCase()}${c.toUpperCase()}]`))
      .join('')
  return new RegExp(voor + patroon + na, 'u').test(tekst ?? '')
}

/**
 * De zaal, wanneer de klant er een noemt die van ons is.
 *
 * Geeft de zaal terug met het adres voor op het event én het merk dat erbij
 * hoort: "in Het Vinne" is de locatie Het Vinne en het concept Meer. Alleen
 * de eigen zalen — een willekeurige plaatsnaam uit een mail als locatie op een
 * event zetten geeft een adres waar niemand ooit geweest is.
 */
export function leesZaal(tekst, plekken = []) {
  for (const zaal of ZALEN) {
    if (!zaal.woorden.some((w) => noemt(tekst, w))) continue
    const plek =
      plekken.find((p) => delenVan(p?.name).some((d) => norm(d) === norm(zaal.naam))) ??
      plekken.find((p) => norm(delenVan(p?.name)[0]) === zaal.merk) ??
      null
    return { naam: zaal.naam, adres: zaal.adres, plek }
  }
  for (const plek of plekken) {
    const [, ...zalen] = delenVan(plek?.name)
    const zaal = zalen.find((d) => noemt(tekst, d) || noemt(tekst, zonderLidwoord(d)))
    if (zaal) return { naam: zaal, adres: zaal, plek }
  }
  return null
}

/**
 * Het concept, wanneer de klant een zaal of een merk noemt dat van ons is.
 *
 * Een klant schrijft de zaal ("in het zaaltje van Het Vinne") vaker dan het
 * merk, dus beide helften van de naam tellen. Wat de klant verder schrijft,
 * blijft in de tekst van de aanvraag staan.
 */
export function leesLocatie(tekst, plekken = []) {
  const zaal = leesZaal(tekst, plekken)
  if (zaal?.plek) return zaal.plek
  for (const plek of plekken) {
    if (delenVan(plek?.name).some((d) => noemt(tekst, d) || noemt(tekst, zonderLidwoord(d)))) return plek
  }
  return null
}

/**
 * Wat de klant vraagt, zodat het antwoord het niet vergeet.
 *
 * Dit is geen veld op een event maar een lijstje voor wie de offerte schrijft:
 * "ze vroegen naar richtprijzen én naar een alternatieve locatie" is precies
 * wat er in een half beantwoorde mail sneuvelt.
 */
export function leesVragen(tekst) {
  const bron = norm(tekst)
  const uit = []
  if (/(richtprij|prijsindicatie|wat kost|budget|prijzen|tarieven)/.test(bron)) uit.push('aanvraag.vraag.prijzen')
  if (/(formule|arrangement|pakket|all-?in)/.test(bron)) uit.push('aanvraag.vraag.formules')
  if (/(andere (geschikte )?locatie|alternatieve locatie|locatie kunnen aanraden|zaal aanraden)/.test(bron)) {
    uit.push('aanvraag.vraag.locatie')
  }
  if (/(beschikbaar|vrij op|mogelijk op|nog vrij)/.test(bron)) uit.push('aanvraag.vraag.beschikbaar')
  if (/(menu|hapjes|dessert|vegetarisch|allergie)/.test(bron)) uit.push('aanvraag.vraag.menu')
  return uit
}


/*
  De koppen die een formulier of een nette mail gebruikt: "Naam: Sofie
  Peeters", "Klant: Jolien en Bernd", "GSM: 0470 12 34 56". Wat zo staat, is
  geen gok — de klant heeft het zelf in een vakje gezet.
*/
const LABELS = {
  naam: ['naam', 'name', 'contactpersoon', 'contact', 'volledige naam', 'naam en voornaam', 'voornaam en naam', 'full name'],
  klant: ['klant', 'customer', 'organisatie', 'vereniging', 'bedrijf', 'firma', 'organisator', 'company'],
  email: ['e-mail', 'email', 'mail', 'e-mailadres', 'emailadres', 'mailadres'],
  telefoon: ['telefoon', 'tel', 'gsm', 'telefoonnummer', 'gsm-nummer', 'gsmnummer', 'phone', 'mobiel', 'mobile', 'gsm nr', 'tel nr'],
  van: ['van', 'from'],
}

/** De velden die met een kop in de tekst staan, op hun vaste naam. */
export function leesLabels(tekst) {
  const uit = {}
  for (const regel of String(tekst ?? '').split('\n')) {
    const m = regel.match(/^\s*[-*•]?\s*(\p{L}[\p{L} .-]{0,24}?)\s*[:：]\s*(.+?)\s*$/u)
    if (!m) continue
    const label = m[1].toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '')
    for (const [veld, namen] of Object.entries(LABELS)) {
      if (namen.includes(label) && !uit[veld]) uit[veld] = m[2].slice(0, 120)
    }
  }
  return uit
}

// Ons eigen adres staat in elke doorgestuurde mail; dat is nooit de klant.
const EIGEN_ADRES = /@(?:[a-z0-9-]+\.)*(?:jeconcept\.be|kenjeklanten\.be)$/i
const ADRES = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

/** Het e-mailadres van de klant: onder een kop als die er is, anders het eerste dat niet van ons is. */
export function leesEmail(tekst) {
  for (const bron of [leesLabels(tekst).email, tekst]) {
    const adres = [...String(bron ?? '').matchAll(ADRES)].map((m) => m[0].toLowerCase()).find((a) => !EIGEN_ADRES.test(a))
    if (adres) return adres
  }
  return null
}

/**
 * Het telefoonnummer van de klant.
 *
 * Een Belgisch nummer heeft negen of tien cijfers en begint met een 0
 * ("0470 12 34 56", "011/78.12.34"); een internationaal begint met + of 00.
 * Een ondernemingsnummer (0123.456.789) ziet er net zo uit, dus wat na "btw",
 * "BE" of "ondernemingsnummer" staat, telt niet. Per regel gezocht: een datum
 * en een nummer op dezelfde regel zouden anders één lang getal worden.
 */
export function leesTelefoon(tekst) {
  const regels = [leesLabels(tekst).telefoon, ...String(tekst ?? '').split('\n')].filter(Boolean)
  for (const regel of regels) {
    for (const m of regel.matchAll(/(?<![\w+])(?:\+|00)?\d[\d ./-]{6,16}\d(?!\d)/g)) {
      const ruw = m[0].trim()
      const cijfers = ruw.replace(/\D/g, '')
      const ervoor = regel.slice(0, m.index)
      if (/(?:btw|vat|ondernemingsn\w*|kbo|iban|rekening\w*)\W*$/i.test(ervoor) || /BE\s?$/.test(ervoor)) continue
      if ((ruw.match(/\//g) ?? []).length > 1) continue
      const internationaal = /^(?:\+|00)/.test(ruw)
      const lengte = internationaal ? cijfers.replace(/^00/, '').length : cijfers.length
      if (internationaal ? lengte >= 10 && lengte <= 13 : cijfers.startsWith('0') && (lengte === 9 || lengte === 10)) {
        return ruw
      }
    }
  }
  return null
}

/*
  Hoe een Vlaamse mail eindigt. "Groetjes" stond er niet bij, en dat is
  precies hoe de helft van de aanvragen ondertekend wordt.
*/
const GROET =
  /^(?:met (?:vriendelijke|hartelijke|warme|beste|sportieve) groet(?:en)?|vriendelijke groet(?:en|jes)?|hartelijke groet(?:en)?|warme groet(?:en)?|beste groet(?:en)?|m\.?v\.?g\.?|groet(?:en|jes|je)?|kind regards|best regards|regards|bedankt|alvast bedankt|alvast dank|met dank|dank(?: je| u)?(?: wel)?|tot (?:dan|snel|binnenkort))(?![\p{L}])[\s,.!]*/iu

// Tussenvoegsels in een naam schrijft niemand met een hoofdletter.
const TUSSENVOEGSEL = /^(?:van|de|der|den|het|ter|ten|vande|vander|von|du|da|di|le|la|en|&)$/i

/** Een regel die een naam is, of `null`. Een titel ervoor hoort niet bij de naam. */
function alsNaam(regel) {
  const schoon = String(regel ?? '')
    .replace(/^(architect|arch\.|dr\.|ir\.|mr\.|mevr\.|dhr\.|prof\.)\s+/i, '')
    .replace(/[,;|].*$/, '')
    .replace(/[.!]+$/, '')
    .trim()
  // Een naam, geen adres, geen telefoonnummer, geen functietitel van tien woorden.
  if (!/^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}&][\p{L}'’.-]*){0,4}$/u.test(schoon) || /@|\d/.test(schoon)) return null
  if (GROET.test(schoon)) return null
  const woorden = schoon.split(/\s+/)
  // Met een hoofdletter, behalve "van" en "de": "dank u voor uw snelle
  // reactie" is geen naam, "Jan van den Broeck" wel.
  if (!/^\p{Lu}/u.test(woorden[0])) return null
  if (!woorden.every((w) => /^\p{Lu}/u.test(w) || TUSSENVOEGSEL.test(w))) return null
  if (woorden.filter((w) => !TUSSENVOEGSEL.test(w)).length > 4) return null
  return schoon
}

/**
 * De naam van wie schrijft.
 *
 * Uit de ondertekening en niet uit de aanhef: "Beste," zegt niets, en de laatste
 * regel met een naam erin is in bijna elke mail de afzender. Een titel ervoor
 * ("Architect", "Dr.") hoort niet bij de naam van een klant.
 *
 * Vier vormen, van zeker naar minder zeker: de naam onder een groet
 * ("Groetjes,\nSofie Peeters", of op dezelfde regel: "Mvg, Sofie"), een kop
 * ("Naam: Sofie Peeters"), een naam die vlak boven of naast een e-mailadres of
 * telefoonnummer staat — de ondertekening zonder groet — en de kop van een
 * doorgestuurde mail ("Van: Sofie Peeters <…>").
 */
export function leesAfzender(tekst) {
  const regels = (tekst ?? '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)

  const start = regels.findLastIndex((r) => GROET.test(r))
  if (start >= 0) {
    const opDeRegel = regels[start].replace(GROET, '').trim()
    for (const regel of [opDeRegel, ...regels.slice(start + 1, start + 4)]) {
      const naam = alsNaam(regel)
      if (naam) return naam
    }
  }

  const labels = leesLabels(tekst)
  if (alsNaam(labels.naam)) return alsNaam(labels.naam)

  // Een ondertekening zonder groet: de naam staat boven het adres of het nummer.
  const contact = (r) => /@/.test(r ?? '') || /\d{2}[\s./-]?\d{2}[\s./-]?\d{2}/.test(r ?? '')
  for (let i = regels.length - 1; i >= Math.max(0, regels.length - 10); i -= 1) {
    if (!contact(regels[i])) continue
    const naam = alsNaam(regels[i]) ?? alsNaam(regels[i - 1]) ?? (contact(regels[i - 1]) ? alsNaam(regels[i - 2]) : null)
    if (naam) return naam
  }

  const van = labels.van?.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]
  return van ? alsNaam(van) : null
}

/**
 * Wat er in een titel staat dat eigenlijk een veld is.
 *
 * "Verjaardag 13 personen", "BBQ 8 Pers", "Trouw — Klant: Jolien en Bernd":
 * zo schrijft iemand een event op wanneer er geen vakje voor is, en dan staan
 * de gasten en de klant in de naam terwijl de fiche ze leeg laat. Hier gaan
 * ze eruit en naar hun eigen veld; wat overblijft is de naam.
 *
 * Een titel die alleen uit een aantal bestaat ("13 personen") houdt geen
 * naam over; dan is `naam` leeg en kiest de aanroeper zelf.
 */
export function ontleedTitel(titel) {
  let naam = String(titel ?? '')
  let klant = null

  const klantKop = naam.match(/(?:^|[\s,;(|—–-])(?:klant|customer)\s*:\s*([^,;|()—–]+?)\s*(?=$|[,;|()—–]|\s-\s)/i)
  if (klantKop) {
    klant = klantKop[1].trim()
    naam = naam.replace(klantKop[0], ' ')
  }

  const personen = leesPersonen(naam)
  if (personen) {
    // Het stuk zelf, met de haakjes errond als die er stonden: "(24p)".
    const stuk = new RegExp(`\\(?\\s*${ontsnap(personen.bron.trim()).replace(/\s+/g, '\\s+')}\\s*\\)?`, 'i')
    naam = naam.replace(stuk, ' ')
  }

  naam = naam
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:|—–-]+|[\s,;:|—–-]+$/g, '')
    .trim()

  return {
    naam,
    personen: personen?.personen ?? null,
    personenTot: personen?.tot ?? null,
    klant: klant || null,
  }
}

/** "Re: Fwd: ORKA wandeldagen" → "ORKA wandeldagen". */
const zonderVoorvoegsel = (onderwerp) =>
  String(onderwerp ?? '')
    .replace(/^(?:\s*(?:re|fw|fwd|tr|antw|doorst|wg|aw)\s*:\s*)+/i, '')
    .trim()

/**
 * De naam voor een nieuw event uit een aanvraag.
 *
 * Het onderwerp van de mail eerst: dat heeft de klant zelf gekozen en zo
 * verwijst hij er later naar ("ORKA wandeldagen"). Zonder onderwerp het soort
 * feest of de formule met de klant erachter, zoals de kaarten van de sites:
 * "Verjaardag — Kristien Maris". `standaard` is het woord voor een aanvraag
 * in de taal van het scherm, voor wanneer er geen soort te lezen is.
 */
export function naamVoorEvent(gelezen, { onderwerp = '', standaard = null } = {}) {
  const titel = ontleedTitel(zonderVoorvoegsel(onderwerp)).naam
  if (titel) return titel
  const soort = gelezen?.soort ?? gelezen?.formule?.name ?? null
  if (gelezen?.klant) return [soort ?? standaard, gelezen.klant].filter(Boolean).join(' — ')
  return soort ?? ''
}

const cijfersVan = (nummer) => String(nummer ?? '').replace(/\D/g, '').slice(-9)

/**
 * De klant uit de lijst die bij deze aanvraag hoort, of `null`.
 *
 * Op het e-mailadres en het telefoonnummer eerst — van de klant zelf én van
 * zijn contactpersonen, want het is de eventverantwoordelijke die mailt — en
 * pas dan op de naam, en dan alleen een naam die precies één keer zo in de
 * lijst staat. Twee "Peeters" verwarren is erger dan er geen voorstellen:
 * dan staat de offerte bij het verkeerde dossier.
 */
export function zoekKlant(gelezen, klanten = []) {
  const actief = (klanten ?? []).filter((k) => k && !k.archived)
  const email = gelezen?.email?.toLowerCase()
  if (email) {
    const raak = actief.find((k) =>
      [k.email, k.billingEmail, ...(k.contacts ?? []).map((c) => c?.email)]
        .filter(Boolean)
        .some((a) => String(a).trim().toLowerCase() === email)
    )
    if (raak) return raak
  }
  const tel = cijfersVan(gelezen?.telefoon)
  if (tel.length === 9) {
    const raak = actief.find((k) =>
      [k.phone, ...(k.contacts ?? []).map((c) => c?.phone)].some((n) => n && cijfersVan(n) === tel)
    )
    if (raak) return raak
  }
  const naam = norm(gelezen?.klant).trim()
  if (naam) {
    const raak = actief.filter(
      (k) => norm(k.name).trim() === naam || (k.contacts ?? []).some((c) => norm(c?.name).trim() === naam)
    )
    if (raak.length === 1) return raak[0]
  }
  return null
}

/**
 * "Sofie Peeters <sofie@example.be>" → naam en adres, zoals de kop `Van:` van
 * een opgehaalde mail ze draagt. Ons eigen adres is nooit de klant.
 */
export function afzenderUitKop(van) {
  const tekst = String(van ?? '').trim()
  const m = tekst.match(/^"?([^"<]*?)"?\s*<([^>]+)>/)
  const naam = m ? alsNaam(m[1]) : null
  const adres = (m ? m[2] : tekst).trim().toLowerCase()
  const email = /^[^\s@]+@[^\s@]+$/.test(adres) && !EIGEN_ADRES.test(adres) ? adres : null
  return { naam, email }
}

const plat = (tekst) => norm(tekst).replace(/[^\p{L}\d@]+/gu, ' ').trim()

/**
 * De mail uit het postvak die iemand net plakte, of `null`.
 *
 * Wie een aanvraag uit zijn eigen mailbox plakt, plakt vaak een mail die via
 * info@ al in Aanvragen staat. Dan hoort díé aan het event te hangen, en niet
 * een tweede kopie ernaast terwijl het origineel in het postvak blijft wachten
 * tot iemand het nog eens behandelt. Het begin van de mail moet in de geplakte
 * tekst staan — leestekens en witruimte tellen niet mee, want een mailprogramma
 * breekt regels anders af dan een ander.
 */
export function zelfdeMail(tekst, mails = []) {
  const geplakt = plat(tekst)
  if (geplakt.length < 40) return null
  return (
    (mails ?? []).find((mail) => {
      const begin = plat(mail?.tekst).slice(0, 160)
      return begin.length >= 40 && geplakt.includes(begin)
    }) ?? null
  )
}

/**
 * "Aantal personen: 45" — een formulier zet het woord ervóór, niet erachter.
 * Alleen onder een kop die over gasten gaat; een los getal is geen aantal.
 */
function personenUitKop(tekst) {
  const kop = String(tekst ?? '')
    .split('\n')
    .map((r) =>
      r.match(/^\s*(?:aantal(?: personen| gasten| deelnemers| bezoekers)?|personen|gasten|pax|deelnemers|bezoekers)\s*[:：]\s*(.+)$/i)
    )
    .find(Boolean)
  if (!kop) return null
  const getallen = [...kop[1].matchAll(/\d{1,4}/g)].map((m) => Number(m[0])).filter((n) => n > 0 && n <= 5000)
  if (!getallen.length) return null
  const [laag, hoog] = getallen
  const vork = Boolean(hoog && hoog > laag)
  return { personen: laag, tot: vork ? hoog : null, vork, bron: kop[0] }
}

/**
 * De hele aanvraag in één keer.
 *
 * `onzeker` draagt wat geraden is. Het scherm zet die velden apart, want een
 * gok die niemand ziet, is een fout die niemand tegenhoudt.
 *
 * `klant` is wie het event aanvraagt: een kop "Klant:" of "Naam:" wint van
 * de ondertekening, want een secretaris die voor een vereniging schrijft, is
 * niet altijd de klant. `afzender` blijft de naam onder de mail.
 */
export function leesAanvraag(tekst, { nu = new Date(), formules = [], plekken = [] } = {}) {
  const datum = leesDatum(tekst, { nu })
  const labels = leesLabels(tekst)
  const personen = leesPersonen(tekst) ?? personenUitKop(tekst)
  const formule = leesFormule(tekst, formules)
  const zaal = leesZaal(tekst, plekken)
  const afzender = leesAfzender(tekst)
  const onzeker = []

  // Zonder jaartal bij de datum is het jaar onze aanname, niet die van de
  // klant; een jaartal elders in de mail ("klant sinds 2019") verandert daar
  // niets aan. Een weekdag die niet klopt of losse dagen zijn evengoed iets
  // om na te vragen.
  if (datum && (!datum.jaarGegeven || !datum.weekdagKlopt || datum.losseDagen)) onzeker.push('datum')
  if (personen?.vork) onzeker.push('personen')
  if (formule) onzeker.push('formule')

  return {
    datum: datum?.datum ?? null,
    tot: datum?.tot ?? null,
    jaarGegeven: datum?.jaarGegeven ?? false,
    weekdagKlopt: datum?.weekdagKlopt ?? true,
    losseDagen: datum?.losseDagen ?? false,
    personen: personen?.personen ?? null,
    personenTot: personen?.tot ?? null,
    soort: leesSoort(tekst),
    formule,
    plek: zaal?.plek ?? leesLocatie(tekst, plekken),
    zaal: zaal ? { naam: zaal.naam, adres: zaal.adres } : null,
    afzender,
    klant: labels.klant?.trim() || alsNaam(labels.naam) || labels.naam?.trim() || afzender,
    email: leesEmail(tekst),
    telefoon: leesTelefoon(tekst),
    vragen: leesVragen(tekst),
    onzeker,
    tekst: (tekst ?? '').trim(),
  }
}
