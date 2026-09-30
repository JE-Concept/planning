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
 */
export function leesDatum(tekst, { nu = new Date() } = {}) {
  const bron = norm(tekst)
  const patroon = /(?:(zondag|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+)?(\d{1,2})\s*(?:\/|\s)\s*([a-zé]+|\d{1,2})(?:\s+(\d{4}))?/gi

  for (const m of bron.matchAll(patroon)) {
    const [, weekdag, dagTekst, maandTekst, jaarTekst] = m
    const dag = Number(dagTekst)
    const maand = /^\d+$/.test(maandTekst) ? Number(maandTekst) - 1 : MAANDEN[maandTekst]
    if (maand == null || dag < 1 || dag > 31) continue

    const gewenst = weekdag ? WEEKDAGEN[weekdag] : null
    let eerste = null

    for (let stap = 0; stap < 3; stap += 1) {
      const jaar = jaarTekst ? Number(jaarTekst) + stap : nu.getFullYear() + stap
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

    if (eerste) return { datum: eerste, weekdagKlopt: gewenst == null }
  }

  return null
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
 * opmerkt tot de tafels besteld zijn.
 */
export function leesPersonen(tekst) {
  const bron = norm(tekst)
  const eenheid = '(?:personen|person|pers\\.?|gasten|guests|man|koppels|pax|volwassenen)'
  const patroon = new RegExp(
    `(?:(?:ongeveer|circa|ca\\.?|±|~|een|zo'n|about|around)\\s*)?` +
      `(\\d{1,4})\\s*(?:-?tal)?\\s*(?:(?:à|a|tot|-|–|of|or)\\s*(\\d{1,4})\\s*)?${eenheid}`,
    'gi'
  )

  for (const m of bron.matchAll(patroon)) {
    const laag = Number(m[1])
    const hoog = m[2] ? Number(m[2]) : null
    if (!Number.isFinite(laag) || laag < 1 || laag > 5000) continue
    return { personen: laag, tot: hoog && hoog > laag ? hoog : null, vork: Boolean(hoog && hoog > laag) }
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

/**
 * De locatie, wanneer de klant er zelf een noemt die van jullie is.
 *
 * Alleen de eigen zalen: een willekeurige plaatsnaam uit een mail als locatie
 * op een event zetten geeft een adres waar niemand ooit geweest is. Wat de
 * klant verder schrijft, blijft in de tekst van de aanvraag staan.
 */
export function leesLocatie(tekst, plekken = []) {
  const bron = norm(tekst)
  for (const plek of plekken) {
    // "Meer — Het Vinne": het merk staat vóór het streepje, de zaal erachter.
    // Een klant schrijft de zaal ("in het zaaltje van Het Vinne"), dus beide
    // helften tellen.
    const delen = norm(plek?.name).split(/\s*[—–-]\s*/).filter((d) => d.length > 2)
    if (delen.some((deel) => bron.includes(deel))) return plek
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

/**
 * De naam van wie schrijft.
 *
 * Uit de ondertekening en niet uit de aanhef: "Beste," zegt niets, en de laatste
 * regel met een naam erin is in bijna elke mail de afzender. Een titel ervoor
 * ("Architect", "Dr.") hoort niet bij de naam van een klant.
 */
export function leesAfzender(tekst) {
  const regels = (tekst ?? '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)

  const groet = /^(met vriendelijke groet|vriendelijke groeten|mvg|groeten|hartelijke groet|kind regards|best regards|regards|bedankt|alvast bedankt|dank)/i
  const start = regels.findLastIndex((r) => groet.test(r))
  const kandidaten = start >= 0 ? regels.slice(start + 1) : []

  for (const regel of kandidaten) {
    const schoon = regel
      .replace(/^(architect|arch\.|dr\.|ir\.|mr\.|mevr\.|dhr\.|prof\.)\s+/i, '')
      .replace(/[,;].*$/, '')
      .trim()
    // Een naam, geen adres, geen telefoonnummer, geen functietitel van tien woorden.
    if (/^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,3}$/u.test(schoon) && !/@|\d/.test(schoon)) {
      return schoon
    }
  }

  return null
}

/**
 * De hele aanvraag in één keer.
 *
 * `onzeker` draagt wat geraden is. Het scherm zet die velden apart, want een
 * gok die niemand ziet, is een fout die niemand tegenhoudt.
 */
export function leesAanvraag(tekst, { nu = new Date(), formules = [], plekken = [] } = {}) {
  const datum = leesDatum(tekst, { nu })
  const personen = leesPersonen(tekst)
  const formule = leesFormule(tekst, formules)
  const plek = leesLocatie(tekst, plekken)
  const onzeker = []

  // Zonder jaartal in de mail is het jaar onze aanname, niet die van de klant.
  if (datum && !/\b(19|20)\d{2}\b/.test(tekst ?? '')) onzeker.push('datum')
  if (personen?.vork) onzeker.push('personen')
  if (formule) onzeker.push('formule')

  return {
    datum: datum?.datum ?? null,
    personen: personen?.personen ?? null,
    personenTot: personen?.tot ?? null,
    soort: leesSoort(tekst),
    formule,
    plek,
    afzender: leesAfzender(tekst),
    vragen: leesVragen(tekst),
    onzeker,
    tekst: (tekst ?? '').trim(),
  }
}
