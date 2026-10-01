import { centen } from './formules'
import { RUBRIEKEN, btwVoor, regelBedrag } from './offerte'

/**
 * Het conceptvoorstel: de offerte zoals de klant ze te lezen krijgt.
 *
 * ── Waarom een offerte niet genoeg is ─────────────────────────────────────
 * Een offertetabel beantwoordt één vraag: wat kost het. De vraag die de klant
 * eerst stelt is een andere — wat krijg ik dan. Daar gaat JE Concept op winnen
 * of verliezen, want prijzen liggen bij elke cateraar in dezelfde buurt en het
 * verhaal eromheen niet. Tot nu werd dat verhaal in Canva getypt, per event
 * opnieuw, naast een tabel die in de tool stond. Twee documenten die uit
 * elkaar lopen zodra er één prijs verandert.
 *
 * Dit bestand maakt er één van. Het voorstel is geen tweede document naast de
 * offerte maar een andere lezing van dezelfde regels: elk onderdeel verwijst
 * naar de offerteregels waaruit het zijn prijs haalt. Verander je een regel,
 * dan verandert de prijs op de voorstelpagina mee.
 *
 * ── De opbouw ligt vast ───────────────────────────────────────────────────
 * Cover, wie zijn wij met het overzicht, de onderdelen twee per pagina, en
 * achteraan de tabel met de btw. Die volgorde is niet onderhandelbaar: ze komt
 * uit het bestaande Canva-sjabloon en elke klant die al eens een voorstel van
 * JE Concept zag, herkent ze. Wat per event verschilt zijn de onderdelen, niet
 * het ritme.
 *
 * ── Wat hier niet staat ───────────────────────────────────────────────────
 * Geen inkoopprijzen, geen foodcost, geen marges. Dat is intern en staat in
 * `offerte.js`. Wat hier staat, mag de klant lezen.
 */

/**
 * De soorten onderdelen, in de volgorde waarin ze in een voorstel horen.
 *
 * `rubriek` zegt onder welke rubriek van de offertetabel dit onderdeel zijn
 * geld haalt; `nummer` of een onderdeel meetelt in de genummerde reeks die de
 * klant op de overzichtspagina ziet. De locatiepagina telt niet mee — die
 * situeert, ze verkoopt geen formule.
 */
export const SOORTEN = [
  { key: 'locatie', rubriek: 'basis', nummer: false },
  { key: 'ontvangst', rubriek: 'catering', nummer: true },
  { key: 'hoofd', rubriek: 'catering', nummer: true },
  { key: 'dranken', rubriek: 'dranken', nummer: true },
  { key: 'dessert', rubriek: 'catering', nummer: true },
  { key: 'extra', rubriek: 'catering', nummer: true },
  { key: 'optie', rubriek: 'optioneel', nummer: false },
]

export const SOORT_KEYS = SOORTEN.map((s) => s.key)

export const soortVan = (key) => SOORTEN.find((s) => s.key === key) ?? SOORTEN[5]

/** De plek van een soort in de vaste volgorde; onbekend gaat achteraan. */
const rang = (key) => {
  const i = SOORT_KEYS.indexOf(key)
  return i === -1 ? SOORT_KEYS.length : i
}

let teller = 0
const nieuwId = () => `o${Date.now().toString(36)}${(teller++).toString(36)}`

/**
 * Eén onderdeel van het voorstel.
 *
 * `titel` en `accent` staan apart omdat de huisstijl het laatste woord van een
 * titel in het schrift zet: "Ontvangst &" in kapitalen, "hapjes" in de krul.
 * Dat met een regex uit één tekst halen gaat de eerste keer mis dat iemand een
 * titel van één woord typt, dus het zijn twee velden.
 *
 * `perPersoon` is wat er op de pagina staat. Staat het er niet, dan haalt het
 * blad de prijs uit de offerteregels van dezelfde rubriek — zie `prijsVan`.
 */
export function maakOnderdeel({
  id = null,
  soort = 'extra',
  titel = '',
  accent = '',
  tekst = '',
  punten = [],
  perPersoon = null,
  prijsNoot = '',
} = {}) {
  return {
    id: id ?? nieuwId(),
    soort: SOORT_KEYS.includes(soort) ? soort : 'extra',
    titel: String(titel ?? ''),
    accent: String(accent ?? ''),
    tekst: String(tekst ?? ''),
    punten: (Array.isArray(punten) ? punten : String(punten ?? '').split('\n'))
      .map((p) => String(p ?? '').trim())
      .filter(Boolean),
    perPersoon: perPersoon == null || perPersoon === '' ? null : centen(Number(perPersoon) || 0),
    prijsNoot: String(prijsNoot ?? ''),
  }
}

/** De onderdelen in de vaste volgorde, met de rommel eruit. */
export const sorteer = (onderdelen = []) =>
  (Array.isArray(onderdelen) ? onderdelen : [])
    .filter(Boolean)
    .map(maakOnderdeel)
    .sort((a, b) => rang(a.soort) - rang(b.soort))

/**
 * Wat dit onderdeel per persoon kost.
 *
 * Staat er een prijs op het onderdeel zelf, dan geldt die — iemand heeft hem
 * daar met opzet gezet. Anders wordt hij uit de offerteregels gehaald: alle
 * regels van dezelfde rubriek die per persoon lopen, opgeteld. Zo blijft het
 * voorstel kloppen met de tabel zonder dat iemand twee plekken moet bijhouden.
 */
export function prijsVan(onderdeel, regels = []) {
  if (onderdeel?.perPersoon != null) return onderdeel.perPersoon

  const rubriek = soortVan(onderdeel?.soort).rubriek
  const eigen = (regels ?? []).filter((r) => r?.rubriek === rubriek && r?.eenheid === 'pp')
  if (!eigen.length) return null
  return centen(eigen.reduce((a, r) => a + (Number(r.eenheidExcl) || 0), 0))
}

/**
 * De genummerde reeks voor de overzichtspagina: "01 Ontvangst & hapjes".
 *
 * Alleen wat een formule is krijgt een nummer. De locatiepagina en de opties
 * staan er niet in: de eerste is een inleiding, de tweede een keuze. Zou alles
 * meetellen, dan leest de klant op pagina twee een lijstje van negen waar hij
 * er vijf moet onthouden.
 */
export function overzicht(onderdelen = [], regels = []) {
  let n = 0
  return sorteer(onderdelen)
    .filter((o) => soortVan(o.soort).nummer)
    .map((o) => {
      n += 1
      return {
        id: o.id,
        nummer: String(n).padStart(2, '0'),
        titel: [o.titel, o.accent].filter(Boolean).join(' ').trim(),
        perPersoon: prijsVan(o, regels),
      }
    })
}

/**
 * De onderdelen verdeeld over pagina's, twee per pagina.
 *
 * Twee is wat er op A4 past met de witruimte die de huisstijl vraagt, en het
 * is ook wat het Canva-sjabloon doet. Eén onderdeel met meer dan vier bullets
 * krijgt de pagina alleen: anders loopt de tweede eraf bij het afdrukken, en
 * dat merk je pas als de klant het al heeft.
 */
export function paginas(onderdelen = []) {
  const uit = []
  let huidig = []

  for (const onderdeel of sorteer(onderdelen)) {
    const groot = onderdeel.punten.length > 4 || onderdeel.tekst.length > 420
    if (groot) {
      if (huidig.length) uit.push(huidig)
      uit.push([onderdeel])
      huidig = []
      continue
    }
    huidig.push(onderdeel)
    if (huidig.length === 2) {
      uit.push(huidig)
      huidig = []
    }
  }

  if (huidig.length) uit.push(huidig)
  return uit
}

/**
 * Een eerste voorstel uit wat de offerte al weet.
 *
 * Dit is een vertrekpunt, geen eindpunt: de teksten hieronder zijn de
 * standaardzinnen van het huis en horen per event aangescherpt te worden. Ze
 * staan er omdat een leeg voorstel niemand helpt — met een voorstel dat al
 * klopt op de prijzen is het werk herschrijven, zonder is het werk beginnen.
 *
 * Deze zinnen staan hier in het Nederlands en gaan niet door `i18n`: het is
 * geen schermtekst maar een eerste versie van wat iemand gaat herschrijven.
 * Zodra ze bewaard is, is het de tekst van dit event en van geen enkel ander.
 */
const STANDAARD = {
  ontvangst: {
    titel: 'Ontvangst &',
    accent: 'hapjes',
    tekst:
      'We verwelkomen uw gasten met een keuze uit cocktail, mocktail, cava of frisdrank, ' +
      'met daarbij een selectie warme en koude hapjes.',
  },
  hoofd: {
    titel: 'De',
    accent: 'formule',
    tekst:
      'Het hoofdgedeelte van de avond, met een gevarieerd aanbod en bijgerechten. ' +
      'Laat ons gerust weten of er allergieën zijn; vegetarische opties zijn mogelijk.',
  },
  dranken: {
    titel: 'Dranken',
    accent: 'formule',
    tekst:
      'Tijdens het event geniet uw gezelschap van een uitgebreide drankenformule, ' +
      'samengesteld voor een gezellige en ongedwongen sfeer.',
    punten: [
      'Frisdranken, plat en bruisend water',
      'Bier van het vat, cava',
      'Een selectie witte, rosé en rode wijn',
    ],
  },
  dessert: {
    titel: 'Dessert',
    accent: 'buffet',
    tekst:
      'Een assortiment mini desserts, aangevuld met koffie en thee. ' +
      'Laat ons gerust weten of er dieetwensen zijn.',
  },
  locatie: {
    titel: 'De',
    accent: 'locatie',
    tekst: '',
  },
}

/**
 * Welke onderdelen bij deze offerte horen.
 *
 * Afgeleid uit de regels: is er een drankenlijn, dan is er een drankenpagina.
 * Niet omgekeerd — een voorstel met een drankenpagina en geen drankenlijn in
 * de tabel is een belofte zonder prijs, en dat valt op bij het factureren.
 */
export function voorstelVanOfferte(offerte, { locatie = '' } = {}) {
  const regels = offerte?.regels ?? []
  const heeft = (rubriek) => regels.some((r) => r?.rubriek === rubriek)

  const uit = []

  if (locatie || offerte?.locatie) {
    uit.push(
      maakOnderdeel({
        soort: 'locatie',
        ...STANDAARD.locatie,
        tekst: `Uw event vindt plaats in ${locatie || offerte.locatie}.`,
      })
    )
  }

  if (heeft('catering')) {
    uit.push(maakOnderdeel({ soort: 'hoofd', ...STANDAARD.hoofd, titel: offerte?.eventNaam ? 'De' : 'De' }))
  }
  if (heeft('dranken')) uit.push(maakOnderdeel({ soort: 'dranken', ...STANDAARD.dranken }))

  for (const regel of regels.filter((r) => r?.optioneel)) {
    uit.push(
      maakOnderdeel({
        soort: 'optie',
        titel: regel.omschrijving || 'Optie',
        accent: '',
        perPersoon: regel.eenheid === 'pp' ? regel.eenheidExcl : null,
        prijsNoot: regel.eenheid === 'pp' ? '' : `${regel.aantal} × ${regel.eenheidExcl}`,
      })
    )
  }

  return sorteer(uit)
}

/**
 * Of dit voorstel klaar is om te versturen.
 *
 * Drie dingen, niet tien: een onderdeel zonder tekst is een lege pagina, een
 * onderdeel zonder prijs laat de klant raden, en een voorstel zonder
 * onderdelen is alleen een tabel. De rest is smaak en daar gaat een
 * waarschuwing niet over.
 */
export function ontbreektInVoorstel(onderdelen = [], regels = []) {
  const lijst = sorteer(onderdelen)
  const uit = []
  if (!lijst.length) return ['voorstel.mist_onderdelen']
  if (lijst.some((o) => !o.tekst.trim() && !o.punten.length)) uit.push('voorstel.mist_tekst')
  if (lijst.filter((o) => soortVan(o.soort).nummer).some((o) => prijsVan(o, regels) == null)) {
    uit.push('voorstel.mist_prijs')
  }
  return uit
}

/**
 * Het totaal per persoon zoals het op de overzichtspagina optelt.
 *
 * Handig voor het team om te zien of het voorstel en de tabel hetzelfde
 * zeggen. Dit bedrag staat níét op het document: een klant die 79,50 per
 * persoon leest terwijl er verderop vijf bedragen staan, telt zelf wel op —
 * en wat hij moet betalen staat in de tabel, inclusief btw.
 */
export const perPersoonTotaal = (onderdelen = [], regels = []) =>
  centen(overzicht(onderdelen, regels).reduce((a, r) => a + (r.perPersoon ?? 0), 0))

/**
 * Wat de tabel per persoon zegt, om het bovenstaande tegen af te zetten.
 *
 * Alleen de lijnen die per persoon lopen: een vaste kost zoals een tent deelt
 * niet door het aantal gasten op een manier die hier iets betekent.
 */
export function tabelPerPersoon(regels = []) {
  const pp = (regels ?? []).filter((r) => r?.eenheid === 'pp' && !r?.optioneel && RUBRIEKEN.includes(r.rubriek))
  return centen(pp.reduce((a, r) => a + (Number(r.eenheidExcl) || 0), 0))
}

/** Het btw-tarief dat bij een onderdeel hoort, voor wie het wil nakijken. */
export const btwVanOnderdeel = (onderdeel) => btwVoor(soortVan(onderdeel?.soort).rubriek)

/** Wat de offerteregels van dit onderdeel samen kosten, exclusief btw. */
export function bedragVanOnderdeel(onderdeel, regels = [], personen = 0) {
  const prijs = prijsVan(onderdeel, regels)
  if (prijs == null) return null
  const aantal = Math.max(0, Math.round(Number(personen) || 0))
  return aantal ? centen(prijs * aantal) : prijs
}

/** Het totaal van een stel regels, zonder de optionele. Voor de voetregel. */
export const bedragVanRegels = (regels = []) =>
  centen((regels ?? []).filter((r) => r && !r.optioneel).reduce((a, r) => a + regelBedrag(r), 0))
