/**
 * De personeelslijst uit AAPI.
 *
 * ── Waarom er een witte lijst is, en geen zwarte ──────────────────────────
 * Dit bestand is iets heel anders dan de planningsexport. Daar stond wie
 * wanneer werkt; hier staat van elke medewerker het rijksregisternummer, het
 * rekeningnummer, het thuisadres, de geboortedatum, de nationaliteit, de
 * burgerlijke staat en het aantal kinderen ten laste.
 *
 * Daarvan gaat niets mee. Niet omdat het niet mag — het is zijn eigen
 * personeelsadministratie — maar omdat het hier niets komt doen. JE Plan is een
 * planningstool waarin het hele kantoor meeleest; een rijksregisternummer heeft
 * daar geen enkele functie en elke kopie ervan is een kopie die ooit ergens
 * terechtkomt waar niemand hem gezocht heeft. Wat die administratie nodig heeft,
 * staat in AAPI, en dat blijft de plek.
 *
 * Wat wél meegaat is wat je nodig hebt om iemand in te plannen en te bereiken:
 * naam, e-mail, gsm, statuut, afdeling, en sinds wanneer hij meedraait.
 *
 * Een witte lijst en geen zwarte, om dezelfde reden als in
 * `functions/social-projectie.js`: vergeet je bij een zwarte lijst één nieuwe
 * kolom, dan lekt ze. Vergeet je er hier één, dan mist er iets op een scherm en
 * zegt iemand dat.
 *
 * ── Waarom het matchen hier wél op naam gaat ──────────────────────────────
 * Bij de shifts is dat verboden: daar geeft AAPI een `Employee Id` mee, en
 * matchen op naam zou twee mensen samenvoegen die toevallig hetzelfde heten.
 * In dit bestand zit die id níét — AAPI exporteert hem hier niet. Er is dus
 * geen keuze, en de schade is ook anders: een verkeerde match voegt twee
 * kaartjes samen, geen gewerkte uren.
 *
 * Eerst op e-mail (uniek en stabiel), dan op de genormaliseerde naam. Wie
 * nergens op uitkomt, krijgt een eigen kaartje. Komt er ooit een export mét
 * `Employee Id`, dan wordt dit exact — zie `sleutelVan`.
 */
import { afdelingVan, inEenAdem, naamNetjes, statuutVan } from './normaliseer.js'
import { brusselNaarInstant } from './tijd.js'
import { ImportFout } from './parser.js'

/** Zonder deze kolommen is dit geen personeelslijst. */
export const VERPLICHT = ['Naam', 'Dimona type']

/**
 * Wat er meegaat naar JE Plan.
 *
 * Alles wat hier niet staat, wordt gelezen en weggegooid. Dat is geen
 * nalatigheid maar de bedoeling; zie de kop van dit bestand.
 */
export const OVERGENOMEN = [
  'Naam',
  'Email',
  'Mobiel',
  'Dimona type',
  'Vestiging',
  'Afdeling',
  'Anciënniteit',
]

/**
 * Wat er met opzet achterblijft.
 *
 * Staat hier bij naam opgesomd en niet alleen als "de rest", zodat bij een
 * volgende export te zien is dat er over nagedacht is — en zodat wie er ooit
 * iets uit nodig heeft, ziet dat het een beslissing was.
 */
export const BEWUST_NIET = [
  'INSZ', // rijksregisternummer
  'Rekeningnummer',
  'Betalingswijze',
  'Straat', 'N°', 'Bus', 'Postcode', 'Gemeente', 'Land',
  'Geboortedatum', 'Leeftijd', 'Geboorteplaats', 'Geboorteland',
  'Geslacht', 'Nationaliteit',
  'Burgerlijke stand', 'Kinderen ten laste',
  'Verplaatsing/dag', 'Verplaatsingsmiddel',
  'Soc.sec. N°',
  'Telefoonnummer', 'Professioneel mobiel', 'Professioneel telefoonnummer',
  'Professioneel email', 'E-post',
  // Tijdstempels van AAPI zelf; die zeggen iets over hun databank, niet over ons.
  'Gecreërd op', 'Laatst gewijzigd op',
]

/** De kopregel: kolomnaam zonder spaties en hoofdletters → kolomletter. */
function koppenVan(rij) {
  const koppen = {}
  for (const [letter, waarde] of Object.entries(rij ?? {})) {
    const naam = inEenAdem(waarde)
    if (naam) koppen[naam.toLowerCase()] = letter
  }
  return koppen
}

const lees = (rij, koppen, naam) => inEenAdem(rij[koppen[naam.toLowerCase()]])

/** De cel zoals ze er staat; zie `leesRuw` in `parser.js` voor waarom. */
const leesRuw = (rij, koppen, naam) => String(rij[koppen[naam.toLowerCase()]] ?? '')

/**
 * Zijn deze twee waarden hetzelfde?
 *
 * Met de datums erbij, en dat is de reden dat dit een functie is: een
 * Firestore-tijdstempel, een `Date` en een string zijn drie vormen van
 * hetzelfde moment. Wie ze met `===` vergelijkt, ziet elke import een
 * wijziging die er niet is — en dan schrijft een dagelijkse import elke dag de
 * hele ploeg opnieuw.
 */
function zelfde(a, b) {
  const tijd = (v) => {
    if (v == null) return null
    if (v instanceof Date) return v.getTime()
    if (typeof v.toDate === 'function') return v.toDate().getTime()
    return null
  }
  const ta = tijd(a)
  const tb = tijd(b)
  if (ta !== null || tb !== null) return ta === tb
  return (a ?? null) === (b ?? null)
}

/**
 * Welk soort blad is dit?
 *
 * Eén uploadvak en één mailadres voor beide bestanden: de tool kijkt zelf wat
 * ze gekregen heeft. Dat scheelt een keuzelijst waarin iemand zich vergist, en
 * het maakt de mailweg vanzelf geschikt voor allebei.
 */
export function herkenBlad(rijen) {
  const koppen = koppenVan(rijen?.[0])
  if (koppen['planning id'] && koppen['start datetime']) return 'planning'
  if (koppen['naam'] && koppen['dimona type']) return 'personeel'
  return null
}

/** De lijst tot medewerkers. Eén rij die niet deugt stopt de rest niet. */
export function parsePersoneel(rijen) {
  if (!Array.isArray(rijen) || rijen.length === 0) throw new ImportFout('Het blad "Data" is leeg.')

  const koppen = koppenVan(rijen[0])
  const ontbreekt = VERPLICHT.filter((naam) => !koppen[naam.toLowerCase()])
  if (ontbreekt.length) {
    throw new ImportFout(
      `Dit bestand mist ${ontbreekt.length === 1 ? 'de kolom' : 'de kolommen'} ${ontbreekt.join(', ')}. `
      + 'Exporteer opnieuw als personeelslijst.'
    )
  }

  const mensen = []
  const fouten = []

  for (let i = 1; i < rijen.length; i += 1) {
    const rij = rijen[i]
    const rijnummer = i + 1
    if (Object.keys(rij).length === 0) continue

    const ruweNaam = leesRuw(rij, koppen, 'Naam')
    if (!inEenAdem(ruweNaam)) {
      fouten.push({ rij: rijnummer, reden: 'geen naam' })
      continue
    }

    const dimona = lees(rij, koppen, 'Dimona type')
    const email = lees(rij, koppen, 'Email').toLowerCase()
    const anciënniteit = lees(rij, koppen, 'Anciënniteit')

    mensen.push({
      naam: naamNetjes(ruweNaam),
      ruweNaam,
      email: email || null,
      gsm: telefoonNetjes(lees(rij, koppen, 'Mobiel')),
      // `Dimona type` staat hier voluit ("Flex Dag", "Student COT") en in de
      // planningsexport als code ("FLX_DAY", "STU_COT"). Eén woord voor
      // allebei, anders staat dezelfde persoon op twee schermen anders.
      statuut: statuutUitWoorden(dimona),
      dimonaType: dimona || null,
      vestiging: lees(rij, koppen, 'Vestiging') || null,
      afdeling: afdelingVan(lees(rij, koppen, 'Afdeling')),
      inDienstSinds: anciënniteit ? brusselNaarInstant(`${anciënniteit} 00:00:00`) : null,
      bronRij: rijnummer,
    })
  }

  const gekend = new Set([...OVERGENOMEN, ...BEWUST_NIET].map((n) => n.toLowerCase()))
  const onbekendeKolommen = Object.keys(koppen).filter((n) => !gekend.has(n))

  return { mensen, fouten, onbekendeKolommen }
}

/**
 * `0032477201707` → `+32 477 20 17 07`.
 *
 * Leesbaar, want dit nummer is er om gebeld te worden door iemand die om
 * elf uur 's avonds vaststelt dat er iemand niet is komen opdagen.
 */
export function telefoonNetjes(ruw) {
  const cijfers = String(ruw ?? '').replace(/[^\d+]/g, '')
  if (!cijfers) return null
  const met32 = cijfers.replace(/^\+?0032/, '+32').replace(/^0(?=\d)/, '+32')
  const m = /^\+32(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(met32)
  return m ? `+32 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : met32
}

/**
 * Het statuut uit de woorden die de personeelslijst gebruikt.
 *
 * De planningsexport schrijft codes, deze lijst schrijft het voluit. Komt het
 * op hetzelfde neer, dan hoort het hetzelfde woord op te leveren — anders
 * staat dezelfde persoon in de kalender als "flexi" en in de lijst als
 * "flex dag".
 */
const WOORDEN = {
  'flex dag': 'flexi',
  'flex uur': 'flexi',
  'student cot': 'student',
  'student': 'student',
  'arbeider/bediende': 'vast',
  'arbeider': 'vast',
  'bediende': 'vast',
  'zelfstandige': 'zelfstandig',
}

export function statuutUitWoorden(ruw) {
  const tekst = inEenAdem(ruw).toLowerCase()
  if (WOORDEN[tekst]) return WOORDEN[tekst]
  // Misschien staat er tóch een code in; dan weet de andere vertaler raad.
  const viaCode = statuutVan(ruw, null)
  return viaCode === 'onbekend' ? (tekst || 'onbekend') : viaCode
}

/**
 * De sleutel van een kaartje.
 *
 * De planningsexport geeft een `Employee Id` en die wint altijd: dat is de
 * enige echt stabiele sleutel die AAPI ons geeft. De personeelslijst heeft hem
 * niet, dus komt daar een sleutel uit het e-mailadres — ook stabiel, en
 * herkenbaar in de databank.
 */
export function sleutelVan({ aapiEmployeeId, email }) {
  if (aapiEmployeeId) return aapiEmployeeId
  const adres = String(email ?? '').trim().toLowerCase()
  if (!adres) return null
  return `mail-${adres.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 180)
}

/**
 * Wat er met de personeelslijst moet gebeuren.
 *
 * Pure functie, net als `planImport`: erin gaat de lijst en wat er al staat,
 * eruit komen mutaties en een rapport. Hetzelfde bestand twee keer geeft de
 * tweede keer nul schrijfbeurten.
 */
export function planPersoneel({ rijen, bestaandeMedewerkers = [], nu = new Date(), importRunId = null, bron = 'xlsx-upload', bestandsnaam = null }) {
  const { mensen, fouten, onbekendeKolommen } = parsePersoneel(rijen)

  const opEmail = new Map()
  const opNaam = new Map()
  for (const m of bestaandeMedewerkers) {
    if (m.email) opEmail.set(String(m.email).toLowerCase(), m)
    if (m.displayName) opNaam.set(m.displayName, m)
  }

  const mutaties = []
  let aangemaakt = 0
  let bijgewerkt = 0
  let ongewijzigd = 0
  let gekoppeld = 0

  for (const mens of mensen) {
    // Eerst op e-mail, dan op naam. Zie de kop: de id ontbreekt in dit bestand.
    const bestaand = (mens.email && opEmail.get(mens.email)) || opNaam.get(mens.naam) || null
    if (bestaand && !bestaand.email) gekoppeld += 1

    const kaart = {
      displayName: mens.naam,
      rawName: mens.ruweNaam,
      email: mens.email,
      gsm: mens.gsm,
      statuut: mens.statuut,
      dimonaType: mens.dimonaType,
      vestiging: mens.vestiging,
      afdeling: mens.afdeling,
      inDienstSinds: mens.inDienstSinds,
    }

    const id = bestaand?.aapiEmployeeId ?? bestaand?.id ?? sleutelVan(mens)
    if (!id) {
      fouten.push({ rij: mens.bronRij, reden: `${mens.naam} heeft geen e-mailadres en is nergens aan te hangen` })
      continue
    }

    if (!bestaand) {
      mutaties.push({
        id,
        nieuw: true,
        patch: { ...kaart, aapiEmployeeId: bestaand?.aapiEmployeeId ?? null, active: true, firstSeenAt: nu, uitPersoneelslijst: nu, importRunId },
      })
      aangemaakt += 1
      continue
    }

    const patch = {}
    for (const [veld, waarde] of Object.entries(kaart)) {
      if (!zelfde(bestaand[veld], waarde)) patch[veld] = waarde ?? null
    }

    if (Object.keys(patch).length === 0) {
      ongewijzigd += 1
      continue
    }

    mutaties.push({ id, nieuw: false, patch: { ...patch, uitPersoneelslijst: nu, importRunId } })
    bijgewerkt += 1
  }

  return {
    mutaties,
    fouten,
    rapport: {
      soort: 'personeel',
      source: bron,
      fileName: bestandsnaam,
      rowsRead: mensen.length + fouten.length,
      employeesCreated: aangemaakt,
      employeesUpdated: bijgewerkt,
      employeesUnchanged: ongewijzigd,
      employeesMatched: gekoppeld,
      unknownColumns: onbekendeKolommen,
      // Wat er in het bestand stond en met opzet niet overgenomen is. Dit hoort
      // in het rapport: wie het uploadt mag weten wat ermee gebeurd is.
      weggelaten: BEWUST_NIET.filter((k) => Object.values(rijen[0] ?? {}).some((v) => inEenAdem(v).toLowerCase() === k.toLowerCase())),
      errors: fouten,
      status: fouten.length ? 'met-fouten' : 'ok',
    },
  }
}
