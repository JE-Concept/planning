/**
 * De tool in twee talen.
 *
 * JE Plan is in het Nederlands geschreven, want zo praat het team. Maar er werkt
 * ook personeel dat geen Nederlands leest, en dan is een afvinklijst die je niet
 * begrijpt geen afvinklijst — dan raad je wat er staat, en dat is precies wat er
 * bij een FAVV-controle niet mag gebeuren.
 *
 * Er zit met opzet geen bibliotheek achter. Dit is een handvol regels, en wat een
 * pakket eraan zou toevoegen (tientallen talen, verbuigingen, ladingen op maat)
 * gebruikt deze app niet. Wat het wél moet kunnen staat hieronder: een tekst
 * opzoeken, er iets in invullen, en enkelvoud van meervoud onderscheiden.
 *
 * Nederlands is de bron. Ontbreekt een Engelse tekst, dan verschijnt de
 * Nederlandse — niet de sleutel. Een half vertaald scherm met hier en daar een
 * Nederlands woord is bruikbaar; een scherm vol kale sleutels is dat niet.
 *
 * De teksten staan per stuk van de app in `taal/`. Dat is niet uit netheid:
 * zonder die opsplitsing schrijven twee mensen die tegelijk aan twee schermen
 * werken in hetzelfde bestand, en dan is het samenvoegen het werk.
 *
 * ── Wat er in de eerste download zit ──────────────────────────────────────
 * Vroeger alles: honderddertig kilobyte tekst over elk scherm van de tool,
 * opgehaald door iedereen die de app opent en door elke klant die op een
 * offertelink klikt. Daar zat het hele eventscherm in voor wie zijn uren komt
 * boeken, en de hele instellingenmodule voor wie alleen een afvinklijst doet.
 *
 * Nu staat hieronder alleen wat op élk scherm nodig is: de schil, en de
 * woordenlijsten die de kern van de app zelf gebruikt (`activiteit.js`,
 * `offline.js`, `formules.js`, `social.js`, de afvinksjablonen). De rest komt
 * mee met het scherm waar hij bij hoort — zie `laadCatalogus` onderaan en de
 * tabel in `AppPrive.jsx`. `tests/taalbundels.test.js` rekent na dat geen
 * scherm een woordenlijst mist; die vergeten is een scherm vol sleutels.
 */

/*
  `import.meta.glob` is een truc van Vite: bij het bouwen wordt de aanroep
  vervangen door de bestanden zelf. Kale Node kent hem niet, en `scripts/seed.mjs`
  leest via `checklist-templates.js` wél met kale Node mee. Die heeft geen
  teksten nodig — hij schrijft gegevens weg — dus een lege catalogus is daar het
  juiste antwoord, en geen reden om de seed te laten vallen.
*/
let BESTANDEN = {}
let LADERS = {}
try {
  /*
    De kern: wat op elk scherm staat, en wat de kern van de app zelf opzoekt.

    `schil.js` is de zijbalk, de zoekbalk, de timer, de assistent en de
    meldingen. De vier `*-gedeeld.js` horen bij modules die altijd meedraaien
    (`activiteit.js`, `checklist-templates.js`, `formules.js`, `social.js`) en
    niet bij één scherm. `pijplijn.js` hoort bij `pipeline.js`, dat op elke
    kaart en in elke lade de naam van een status zet. `ploeg.js` is het
    aanmeldscherm met de code, en dat is het eerste wat de helft van de
    gebruikers ziet.

    Alles wat hier níét staat, komt met zijn eigen scherm mee. Wie een
    woordenlijst hierbij zet, zet hem in de eerste download van iedereen.
  */
  BESTANDEN = import.meta.glob(
    [
      './taal/schil.js',
      './taal/taken-gedeeld.js',
      './taal/lijsten-gedeeld.js',
      './taal/formules-gedeeld.js',
      './taal/socials-gedeeld.js',
      './taal/pijplijn.js',
      './taal/ploeg.js',
    ],
    { eager: true }
  )

  /*
    En de rest, als losse brokken. Geen `eager`, dus Vite maakt er aparte
    bestanden van die pas opgehaald worden wanneer `laadCatalogus` erom vraagt.
  */
  LADERS = import.meta.glob([
    './taal/*.js',
    '!./taal/schil.js',
    '!./taal/taken-gedeeld.js',
    '!./taal/lijsten-gedeeld.js',
    '!./taal/formules-gedeeld.js',
    '!./taal/socials-gedeeld.js',
    '!./taal/pijplijn.js',
    '!./taal/ploeg.js',
  ])
} catch {
  BESTANDEN = {}
  LADERS = {}
  // In een browser hoort dit niet te kunnen — daar staat de lijst al in de
  // build. Gebeurt het toch, dan zou elk scherm stilletjes vol sleutels komen
  // te staan, en dan wil je weten waarom.
  if (typeof window !== 'undefined') console.error('JE Plan: de teksten zijn niet ingeladen.')
}

/**
 * Alles bij elkaar, met een waarschuwing wanneer twee bestanden dezelfde sleutel
 * claimen. Zonder die controle wint stilletjes wie alfabetisch later staat, en
 * dan verandert een tekst op een scherm waar je niet aan gewerkt hebt.
 */
function bouwTeksten() {
  const alles = {}
  const dubbel = []
  for (const [pad, module] of Object.entries(BESTANDEN).sort(([a], [b]) => a.localeCompare(b))) {
    for (const [sleutel, teksten] of Object.entries(module.default ?? {})) {
      if (sleutel in alles) dubbel.push(`${sleutel} (${alles[sleutel].__bestand} en ${pad})`)
      alles[sleutel] = { ...teksten, __bestand: pad }
    }
  }
  return { alles, dubbel }
}

const { alles: TEKSTEN, dubbel: DUBBELE } = bouwTeksten()

export const TALEN = [
  { code: 'nl', label: 'Nederlands', locale: 'nl-BE' },
  { code: 'en', label: 'English', locale: 'en-GB' },
]

export const STANDAARDTAAL = 'nl'

/** De opmaaktaal die bij een taal hoort. */
export const localeVan = (taal) => TALEN.find((t) => t.code === taal)?.locale ?? TALEN[0].locale

/*
  Wat hier met opzet niet staat: de taal van de browser overnemen.

  Dat leek het vriendelijke antwoord, tot je bedenkt wie deze tool gebruikt. Het
  is één zaak met één team, en Nederlands is de taal waarin ze met elkaar praten
  over dezelfde schermen. Een deel van hen heeft Windows of Chrome in het Engels
  staan — dat zegt niets over welke taal ze willen werken. Die zouden op een
  ochtend een andere tool openen dan gisteren, zonder dat ze iets veranderd
  hebben, en dan is "Openen & sluiten" ineens "Opening & closing" in een gesprek
  waarin iedereen het over de eerste blijft hebben.

  Dus: iedereen begint in het Nederlands, en wie Engels wil, kiest het. Die keuze
  staat op het profiel en volgt mee naar elk toestel. De knop staat daar bij je
  voorkeuren en heet "English" — in het Engels, zodat wie geen Nederlands leest
  hem toch herkent.
*/

/** Bestaat deze taal? Anders de standaard, zodat een oude voorkeur nooit blokkeert. */
export const geldigeTaal = (taal) => (TALEN.some((t) => t.code === taal) ? taal : STANDAARDTAAL)

/**
 * Een tekst opzoeken.
 *
 * `waarden` vult `{naam}`-plekken in. Staat er een `aantal` bij, dan kiest hij
 * tussen de sleutel met `_een` en die met `_meer` — Nederlands en Engels hebben
 * allebei precies die twee vormen, dus meer is hier niet nodig.
 *
 * Een ontbrekende sleutel geeft de Nederlandse tekst, en anders de sleutel zelf.
 * Dat laatste is lelijk en dat is de bedoeling: zo valt op dat er iets vergeten
 * is, in plaats van dat er stilletjes niets staat.
 */
export function vertaal(taal, sleutel, waarden = null) {
  const code = geldigeTaal(taal)

  let echteSleutel = sleutel
  if (waarden && typeof waarden.aantal === 'number') {
    const vorm = `${sleutel}${waarden.aantal === 1 ? '_een' : '_meer'}`
    if (TEKSTEN[vorm]) echteSleutel = vorm
  }

  const regel = TEKSTEN[echteSleutel]
  const tekst = regel?.[code] ?? regel?.[STANDAARDTAAL] ?? echteSleutel
  if (!waarden) return tekst

  return tekst.replace(/\{(\w+)\}/g, (heel, naam) =>
    waarden[naam] === undefined || waarden[naam] === null ? heel : String(waarden[naam])
  )
}

/*
  De taal waar de app nu in staat, voor code die geen hook kan gebruiken.

  `formatDuration`, `relativeDay` en de prioriteitsnamen zijn gewone functies
  die overal aangeroepen worden, ook buiten een component. Ze een `t` laten
  meekrijgen zou betekenen dat elke aanroeper op tien schermen aangepast wordt
  om één woord te vertalen.

  Dit is dezelfde afspraak als `zetLocale` in `dates.js`, en ze werkt om
  dezelfde reden: de provider zet de taal, en het wisselen van taal laat React
  alles opnieuw tekenen — dus wordt er ook opnieuw opgezocht.
*/
let huidigeTaal = STANDAARDTAAL

export function zetHuidigeTaal(taal) {
  huidigeTaal = geldigeTaal(taal)
}

export const huidigeTaalVan = () => huidigeTaal

/** `vertaal` in de taal waar de app nu in staat. */
export const tekst = (sleutel, waarden = null) => vertaal(huidigeTaal, sleutel, waarden)

/** Welke sleutels in deze taal nog ontbreken — voor de test die daarop let. */
export function ontbrekendeVertalingen(taal = 'en') {
  return Object.keys(TEKSTEN).filter((sleutel) => !TEKSTEN[sleutel][taal])
}

/** Sleutels die in twee bestanden staan; één van de twee wint en dat wil je weten. */
export const dubbeleSleutels = () => DUBBELE

/**
 * Een woordenboek dat pas bij zijn eigen scherm binnenkomt.
 *
 * Dubbel toevoegen doet niets: `laadCatalogus` houdt bij wat er al binnen is,
 * zodat twee schermen die dezelfde lijst nodig hebben niet elke sleutel als
 * dubbel melden.
 */
function voegCatalogusToe(naam, teksten) {
  for (const [sleutel, waarde] of Object.entries(teksten ?? {})) {
    if (sleutel in TEKSTEN) {
      // Dezelfde sleutel in twee bestanden is hetzelfde probleem als eerder:
      // stilletjes wint er een, en dan verandert een tekst op een scherm waar
      // niemand aan gewerkt heeft.
      DUBBELE.push(`${sleutel} (${TEKSTEN[sleutel].__bestand} en ${naam})`)
      continue
    }
    TEKSTEN[sleutel] = { ...waarde, __bestand: naam }
  }
}

/*
  Wat er binnen is of onderweg, per bestand.

  Twee schermen kunnen dezelfde woordenlijst nodig hebben, en ze kunnen hem
  tegelijk vragen. Zonder deze map zou de tweede vraag het bestand nog eens
  ophalen en elke sleutel als dubbel melden, of — erger — terugkeren vóór de
  teksten er zijn, en dan tekent dat scherm zijn sleutels.
*/
const ONDERWEG = new Map()

/**
 * Een woordenlijst ophalen die niet in de eerste download zat.
 *
 * `naam` is de bestandsnaam zonder `.js`: `laadCatalogus('events')`. Zit hij al
 * in de kern, dan is dit meteen klaar. Bestaat hij niet, dan is dat een fout en
 * geen stille leegte — een typefout in een naam hoort niet op te lossen in een
 * scherm vol sleutels.
 *
 * De schermen roepen dit niet zelf aan; `pagina()` in `paginalader.js` doet het
 * naast het inladen van het scherm, zodat beide tegelijk onderweg zijn en de
 * Suspense die er toch al staat op allebei wacht.
 */
export function laadCatalogus(naam) {
  const pad = `./taal/${naam}.js`
  if (pad in BESTANDEN) return Promise.resolve()
  if (ONDERWEG.has(pad)) return ONDERWEG.get(pad)

  const laad = LADERS[pad]
  if (!laad) return Promise.reject(new Error(`JE Plan: er is geen tekstenbestand "${naam}".`))

  const bezig = laad().then((module) => voegCatalogusToe(pad, module.default))
  ONDERWEG.set(pad, bezig)
  return bezig
}

/** Alles tegelijk — voor de tests, die over de hele catalogus gaan. */
export const laadAlleCatalogi = () =>
  Promise.all(Object.keys(LADERS).map((pad) => laadCatalogus(pad.slice('./taal/'.length, -'.js'.length))))

/** Alle sleutels met hun teksten — voor de tests en voor niets anders. */
export const alleTeksten = () =>
  Object.fromEntries(Object.entries(TEKSTEN).map(([sleutel, { __bestand, ...talen }]) => [sleutel, talen]))
