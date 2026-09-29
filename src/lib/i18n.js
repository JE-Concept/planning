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
 * Nederlands woord is bruikbaar; een scherm vol `tasks.leeg.titel` is dat niet.
 *
 * De teksten staan per stuk van de app in `taal/`, en elk bestand wordt hier
 * vanzelf opgepikt. Dat is niet uit netheid: zonder die opsplitsing schrijven
 * twee mensen die tegelijk aan twee schermen werken in hetzelfde bestand, en
 * dan is het samenvoegen het werk.
 */

const BESTANDEN = import.meta.glob('./taal/*.js', { eager: true })

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
  staat op het profiel en volgt mee naar elk toestel. De knop staat in het
  accountmenu en heet "English" — in het Engels, zodat wie geen Nederlands leest
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

/** Welke sleutels in deze taal nog ontbreken — voor de test die daarop let. */
export function ontbrekendeVertalingen(taal = 'en') {
  return Object.keys(TEKSTEN).filter((sleutel) => !TEKSTEN[sleutel][taal])
}

/** Sleutels die in twee bestanden staan; één van de twee wint en dat wil je weten. */
export const dubbeleSleutels = () => DUBBELE

/** Alle sleutels met hun teksten — voor de tests en voor niets anders. */
export const alleTeksten = () =>
  Object.fromEntries(Object.entries(TEKSTEN).map(([sleutel, { __bestand, ...talen }]) => [sleutel, talen]))
