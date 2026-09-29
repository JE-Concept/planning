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
 */

import { nl } from './taal/nl'
import { en } from './taal/en'

export const TALEN = [
  { code: 'nl', label: 'Nederlands', locale: 'nl-BE' },
  { code: 'en', label: 'English', locale: 'en-GB' },
]

export const STANDAARDTAAL = 'nl'

const CATALOGI = { nl, en }

/** De opmaaktaal die bij een taal hoort. */
export const localeVan = (taal) =>
  TALEN.find((t) => t.code === taal)?.locale ?? TALEN[0].locale

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
export const geldigeTaal = (taal) => (CATALOGI[taal] ? taal : STANDAARDTAAL)

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
  const nu = CATALOGI[geldigeTaal(taal)]
  const bron = CATALOGI[STANDAARDTAAL]

  let echteSleutel = sleutel
  if (waarden && typeof waarden.aantal === 'number') {
    const vorm = `${sleutel}${waarden.aantal === 1 ? '_een' : '_meer'}`
    if (nu[vorm] ?? bron[vorm]) echteSleutel = vorm
  }

  const tekst = nu[echteSleutel] ?? bron[echteSleutel] ?? echteSleutel
  if (!waarden) return tekst

  return tekst.replace(/\{(\w+)\}/g, (heel, naam) =>
    waarden[naam] === undefined || waarden[naam] === null ? heel : String(waarden[naam])
  )
}

/** Welke sleutels in het Engels nog ontbreken — voor de test die daarop let. */
export function ontbrekendeVertalingen(taal = 'en') {
  const nu = CATALOGI[geldigeTaal(taal)]
  return Object.keys(CATALOGI[STANDAARDTAAL]).filter((sleutel) => !nu[sleutel])
}
