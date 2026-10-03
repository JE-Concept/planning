/**
 * Het rekenwerk achter de vaste formules.
 *
 * Een formule is een vast aanbod met een vaste prijs per persoon (winter bbq
 * aan 29,90) en een handvol vragen: hapjes vooraf, welke drankenformule, een
 * dessert of niet. Elk antwoord verandert twee dingen tegelijk — de prijs, en
 * wat er besteld moet worden.
 *
 * Dat tweede is de reden dat dit een apart bestand met tests is. Een
 * bestellijst gaat stil fout: 0,4 fles wijn per persoon maal 37 personen is
 * 14,8, en wie dat overneemt bestelt veertien flessen en komt er één te kort op
 * de avond zelf. Er wordt hier dus altijd naar boven afgerond, en altijd per
 * verpakking, want een leverancier levert geen halve bak.
 *
 * Er komt geen Firestore in dit bestand: het rekent op gewone objecten, zodat
 * de tests precies dit kunnen narekenen.
 */

import { tekst } from './i18n'

/**
 * Drempel waaronder een verschil rekenruis is en geen tekort.
 *
 * 0,07 × 100 is in drijvende komma 7.000000000000001, en botweg naar boven
 * afronden maakt daar 8 van: een hele verpakking te veel omdat de computer
 * niet exact kan rekenen. Zes cijfers na de komma is ruim genoeg voor
 * hoeveelheden in grammen en flessen, en veel te grof om een echt tekort
 * (0,1 gram te weinig bestaat niet) weg te poetsen.
 */
const CIJFERS = 6

function netjes(waarde, cijfers = CIJFERS) {
  const factor = 10 ** cijfers
  return Math.round(waarde * factor) / factor
}

/** Naar boven, maar niet omwille van rekenruis. */
export function naarBoven(waarde) {
  if (!Number.isFinite(waarde)) return 0
  return Math.ceil(netjes(waarde))
}

/** Bedragen blijven op de cent staan; anders sleept de fout mee in het totaal. */
export function centen(bedrag) {
  if (!Number.isFinite(bedrag)) return 0
  return Math.round(netjes(bedrag * 100, 4)) / 100
}

const getal = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 })

// ─── Opties en keuzes ──────────────────────────────────────────────────────

/**
 * De antwoorden waarmee een nieuw event begint: per vraag de eerste keuze.
 *
 * De eerste keuze is met opzet de goedkoopste ("geen hapjes", "geen dranken"):
 * wie doorklikt zonder te lezen krijgt de kale formule, geen stille meerprijs.
 */
export function standaardKeuzes(formule) {
  const uit = {}
  for (const optie of formule?.opties ?? []) {
    uit[optie.id] = optie.standaardKeuzeId ?? optie.keuzes?.[0]?.id ?? null
  }
  return uit
}

/** De gekozen keuze per vraag, zonder de vragen die nog openstaan. */
export function gekozen(formule, keuzes = {}) {
  const uit = []
  for (const optie of formule?.opties ?? []) {
    const keuze = (optie.keuzes ?? []).find((k) => k.id === keuzes[optie.id])
    if (keuze) uit.push({ optie, keuze })
  }
  return uit
}

// ─── Prijs ─────────────────────────────────────────────────────────────────

/**
 * Wat de formule kost voor dit aantal personen.
 *
 * Alle bedragen in een formule staan **exclusief btw**. Dat is de kant waar het
 * offertebedrag van een event op staat, en het is de enige manier om eten en
 * drank apart te belasten: in België is bereide maaltijd 12% en drank 21%, en
 * één tarief over het geheel plakken maakt elke factuur fout. Een vraag mag
 * daarom zijn eigen tarief hebben; staat er geen, dan geldt dat van de formule.
 */
export function prijsVan(formule, keuzes = {}, personen = 0) {
  const aantal = Math.max(0, Math.round(Number(personen) || 0))
  const basisBtw = Number(formule?.btwPercent ?? 21)

  const posten = [
    {
      label: formule?.name ?? 'Formule',
      perPersoon: Number(formule?.prijsPerPersoon) || 0,
      vast: Number(formule?.prijsVast) || 0,
      btwPercent: basisBtw,
    },
    ...gekozen(formule, keuzes)
      .filter(({ keuze }) => (Number(keuze.prijsPerPersoon) || 0) !== 0 || (Number(keuze.prijsVast) || 0) !== 0)
      .map(({ optie, keuze }) => ({
        label: `${optie.label}: ${keuze.label}`,
        perPersoon: Number(keuze.prijsPerPersoon) || 0,
        vast: Number(keuze.prijsVast) || 0,
        btwPercent: Number(optie.btwPercent ?? basisBtw),
      })),
  ]

  const regels = posten.map((post) => ({
    ...post,
    bedrag: centen(post.perPersoon * aantal + post.vast),
  }))

  // Per tarief optellen en pas dán de btw rekenen: per regel afronden laat een
  // paar cent verschil na met wat de boekhouding op de factuur zet.
  const perTarief = new Map()
  for (const regel of regels) {
    perTarief.set(regel.btwPercent, centen((perTarief.get(regel.btwPercent) ?? 0) + regel.bedrag))
  }
  const btwRegels = [...perTarief.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([percent, basis]) => ({ percent, basis, btw: centen((basis * percent) / 100) }))

  const exclBtw = centen(regels.reduce((a, r) => a + r.bedrag, 0))
  const btw = centen(btwRegels.reduce((a, r) => a + r.btw, 0))

  return {
    personen: aantal,
    perPersoon: centen(posten.reduce((a, p) => a + p.perPersoon, 0)),
    vast: centen(posten.reduce((a, p) => a + p.vast, 0)),
    regels,
    btwRegels,
    exclBtw,
    btw,
    inclBtw: centen(exclBtw + btw),
  }
}

// ─── Bestellijst ───────────────────────────────────────────────────────────

/**
 * Wat er besteld moet worden voor dit aantal personen.
 *
 * Twee dingen gebeuren hier bewust in deze volgorde:
 *
 * 1. Regels die hetzelfde artikel in dezelfde eenheid betreffen worden eerst
 *    opgeteld en pas daarna afgerond. De formule rekent 0,2 fles wijn per
 *    persoon en de drankenformule legt er 0,2 bij; apart afgerond zijn dat
 *    tweemaal acht flessen, samen vijftien. Het tweede is wat er in de kelder
 *    moet staan, het eerste is een bak te veel.
 * 2. Dan pas naar boven, en naar boven per verpakking: `inhoud` zegt hoeveel
 *    eenheden er in één bestelverpakking zitten (zes flessen in een bak, duizend
 *    gram in een kilo). Wat er geleverd wordt is dus verpakkingen × inhoud, en
 *    dat ligt altijd op of boven wat je nodig hebt.
 */
export function bestellijstVan(formule, keuzes = {}, personen = 0) {
  const aantal = Math.max(0, Math.round(Number(personen) || 0))
  const keuzeById = Object.fromEntries(gekozen(formule, keuzes).map(({ optie, keuze }) => [keuze.id, { optie, keuze }]))

  const meetellen = (regel) => {
    // Een regel zonder keuze hoort bij de kale formule en telt altijd mee.
    if (!regel.keuzeId) return true
    return Boolean(keuzeById[regel.keuzeId])
  }

  const samen = new Map()
  for (const regel of (formule?.bestelregels ?? []).filter(meetellen)) {
    const eenheid = regel.eenheid || 'stuks'
    const inhoud = Math.max(1, Number(regel.inhoud) || 1)
    const sleutel = `${(regel.item ?? '').trim().toLowerCase()}|${eenheid}|${inhoud}`
    const lopend = samen.get(sleutel)
    const bron = regel.keuzeId ? keuzeById[regel.keuzeId]?.optie.label : null

    if (lopend) {
      lopend.perPersoon += Number(regel.perPersoon) || 0
      lopend.vast += Number(regel.vast) || 0
      if (bron && !lopend.bron.includes(bron)) lopend.bron.push(bron)
      continue
    }
    samen.set(sleutel, {
      id: regel.id,
      item: (regel.item ?? '').trim(),
      categorie: regel.categorie || 'Overige',
      eenheid,
      inhoud,
      verpakking: regel.verpakking || '',
      perPersoon: Number(regel.perPersoon) || 0,
      vast: Number(regel.vast) || 0,
      bron: bron ? [bron] : [],
    })
  }

  return [...samen.values()]
    .map((regel) => {
      const nodig = netjes(regel.perPersoon * aantal + regel.vast)
      const verpakkingen = naarBoven(nodig / regel.inhoud)
      return { ...regel, personen: aantal, nodig, verpakkingen, bestellen: netjes(verpakkingen * regel.inhoud) }
    })
    .filter((regel) => regel.item && regel.bestellen > 0)
}

/**
 * Wat er op de bestelbon komt te staan.
 *
 * Bij een verpakking van meer dan één staat het aantal verpakkingen vooraan,
 * want dat is wat je bij de leverancier ingeeft — "drie bakken", niet "achttien
 * flessen". De eenheid wordt geschreven zoals ze ingevuld is ("flessen", "g"),
 * zodat er hier geen meervouden gefabriceerd hoeven te worden; "doosken" en
 * "kgs" wil niemand op een bestelbon zien.
 */
export function bestelTekst(regel) {
  const inhoud = Math.max(1, Number(regel.inhoud) || 1)
  const eenheid = regel.eenheid || 'stuks'
  if (inhoud === 1) return `${getal.format(regel.bestellen)} ${eenheid}`
  return tekst('formulelib.bestel.verpakt', {
    aantal: getal.format(regel.verpakkingen),
    verpakking: regel.verpakking || tekst('formulelib.bestel.verpakking'),
    inhoud: getal.format(inhoud),
    eenheid,
  })
}

/** Het totaal in eenheden, los van de verpakking. */
export function totaalTekst(regel) {
  return `${getal.format(regel.bestellen)} ${regel.eenheid || 'stuks'}`
}

/** Hoeveel er echt nodig was — alleen als er door het afronden iets overblijft. */
export function nodigTekst(regel) {
  if (netjes(regel.bestellen - regel.nodig) <= 0) return null
  return tekst('formulelib.bestel.nodig', {
    aantal: getal.format(regel.nodig),
    eenheid: regel.eenheid || 'stuks',
  })
}

/**
 * De bestellijst zoals ze op het event bewaard wordt.
 *
 * Bewust een platte kopie en geen verwijzing naar de formule: verandert de
 * formule volgend seizoen van prijs of leverancier, dan hoort een event dat al
 * besteld is daar niets van te merken. De formule is een startpunt, geen
 * keurslijf — alles hieronder is op de fiche nog te wijzigen.
 */
export function bestellijstVoorEvent(formule, keuzes, personen) {
  return bestellijstVan(formule, keuzes, personen).map((regel) => ({
    id: regel.id,
    item: regel.item,
    categorie: regel.categorie,
    eenheid: regel.eenheid,
    inhoud: regel.inhoud,
    verpakking: regel.verpakking,
    perPersoon: regel.perPersoon,
    vast: regel.vast,
    // Mee op het event, zodat de marge van dit dossier met de prijs van
    // vandaag rekent en niet met die van volgend seizoen.
    inkoopprijs: regel.inkoopprijs ?? null,
    leverancier: regel.leverancier ?? '',
    personen: regel.personen,
    nodig: regel.nodig,
    verpakkingen: regel.verpakkingen,
    bestellen: regel.bestellen,
    bron: regel.bron,
    besteld: false,
  }))
}

/** Een samenvatting van de gekozen antwoorden, voor op de fiche. */
export function keuzeSamenvatting(formule, keuzes) {
  return gekozen(formule, keuzes)
    .map(({ optie, keuze }) => `${optie.label}: ${keuze.label}`)
    .join(' · ')
}

/** Eén regel per categorie, in de volgorde waarin ze op de lijst staan. */
export function perCategorie(regels = []) {
  const uit = new Map()
  for (const regel of regels) {
    const naam = regel.categorie || 'Overige'
    if (!uit.has(naam)) uit.set(naam, [])
    uit.get(naam).push(regel)
  }
  return [...uit.entries()].map(([categorie, items]) => ({ categorie, items }))
}
