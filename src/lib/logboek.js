import { asDate, dayKey, formatDay } from './dates'
import { tekst } from './i18n'

/**
 * Het logboek voorlezen.
 *
 * De regels komen van de server (`functions/audit.js`) en staan er in de taal
 * van de database: `statusName`, `quoteAmount`, `assignees`. Hier worden dat
 * zinnen. Dat rekenwerk staat apart van het scherm zodat het te testen is
 * zonder database, en zodat er één plek is waar staat hoe een wijziging
 * voorgelezen wordt.
 */

/** De soorten die het logboek kent, in de volgorde van het filter. */
export const SOORTEN = [
  'taak',
  'klant',
  'offerte',
  'formule',
  'regel',
  'lijst',
  'afvinklijst',
  'dienst',
  'template',
  'profiel',
  'instelling',
]

/** De naam van een veld, zoals het op het scherm heet. */
export const VELDNAAM = {
  title: 'logboek.veld.titel',
  name: 'logboek.veld.naam',
  statusName: 'logboek.veld.status',
  dueDate: 'logboek.veld.deadline',
  assignees: 'logboek.veld.uitvoerders',
  priority: 'logboek.veld.prioriteit',
  archived: 'logboek.veld.archief',
  budget: 'logboek.veld.budget',
  quoteAmount: 'logboek.veld.offertebedrag',
  customerId: 'logboek.veld.klant',
  location: 'logboek.veld.locatie',
  planning: 'logboek.veld.planning',
  pax: 'logboek.veld.gasten',
  socialStage: 'logboek.veld.socialstand',
  listId: 'logboek.veld.lijst',
  role: 'logboek.veld.rol',
  active: 'logboek.veld.actief',
  email: 'logboek.veld.email',
  department: 'logboek.veld.afdeling',
  vatNumber: 'logboek.veld.btwnummer',
  phone: 'logboek.veld.telefoon',
  address: 'logboek.veld.adres',
  statuses: 'logboek.veld.kolommen',
  sections: 'logboek.veld.onderdelen',
  prijsPerPersoon: 'logboek.veld.prijs_pp',
  prijsVast: 'logboek.veld.vaste_prijs',
  btwPercent: 'logboek.veld.btw',
  opties: 'logboek.veld.opties',
  enabled: 'logboek.veld.aan',
  conditions: 'logboek.veld.voorwaarden',
  actions: 'logboek.veld.handelingen',
  table: 'logboek.veld.tabel',
  status: 'logboek.veld.stand',
  regels: 'logboek.veld.regels',
  bedragExcl: 'logboek.veld.bedrag',
  verstuurdOp: 'logboek.veld.verstuurd',
  kind: 'logboek.veld.soort',
  date: 'logboek.veld.datum',
  start: 'logboek.veld.start',
  end: 'logboek.veld.einde',
  breakMinutes: 'logboek.veld.pauze',
  note: 'logboek.veld.notitie',
  profileId: 'logboek.veld.persoon',
  allowedDomains: 'logboek.veld.domeinen',
  taken: 'logboek.veld.taken',
  entity: 'logboek.veld.entiteit',
  trigger: 'logboek.veld.aanleiding',
  workspaceName: 'logboek.veld.werkruimte',
  kostenplaatsen: 'logboek.veld.kostenplaatsen',
}

export const veldNaam = (veld) => (VELDNAAM[veld] ? tekst(VELDNAAM[veld]) : veld)

/** Een waarde zoals ze op het scherm leest. Leeg wordt "leeg", geen sleutel. */
export function waardeTekst(waarde) {
  if (waarde === null || waarde === undefined || waarde === '') return tekst('logboek.leeg')
  if (waarde === true) return tekst('logboek.ja')
  if (waarde === false) return tekst('logboek.nee')
  if (Array.isArray(waarde)) return waarde.length ? waarde.join(', ') : tekst('logboek.leeg')
  return String(waarde)
}

/**
 * Eén regel als zin.
 *
 * "Elke Motmans wijzigde het offertebedrag van 16.399 naar 17.200" — niet
 * "update op tasks/t-trouw". Een logboek dat je moet ontcijferen wordt niet
 * gelezen, en dan had het er net zo goed niet kunnen staan.
 */
export function zinVan(regel) {
  const wie = regel?.actorNaam || tekst('logboek.onbekend')
  const wat = regel?.naam || regel?.documentId || ''
  const soort = tekst(`logboek.soort.${regel?.soort}`)

  if (regel?.actie === 'aangemaakt') return tekst('logboek.zin.aangemaakt', { wie, soort, wat })
  if (regel?.actie === 'verwijderd') return tekst('logboek.zin.verwijderd', { wie, soort, wat })

  const wijzigingen = regel?.wijzigingen ?? []
  if (wijzigingen.length === 1) {
    const w = wijzigingen[0]
    return tekst('logboek.zin.veld', {
      wie,
      veld: veldNaam(w.veld),
      wat,
      van: waardeTekst(w.van),
      naar: waardeTekst(w.naar),
    })
  }

  return tekst('logboek.zin.meerdere', {
    wie,
    soort,
    wat,
    velden: wijzigingen.map((w) => veldNaam(w.veld)).join(', '),
  })
}

/**
 * Filteren.
 *
 * Het zoeken kijkt naar de naam van wat er veranderde, naar wie het deed en
 * naar de velden — dat is waar iemand op zoekt wanneer hij iets terug wil
 * vinden ("Blum", "Charish", "prijs").
 */
export function filter(regels, { wie = '', soort = '', zoek = '', vanaf = null, tot = null } = {}) {
  const naald = zoek.trim().toLowerCase()

  return (regels ?? []).filter((regel) => {
    if (wie && regel.actorId !== wie) return false
    if (soort && regel.soort !== soort) return false

    const at = asDate(regel.at)
    if (vanaf && at && at < asDate(vanaf)) return false
    if (tot && at && at > asDate(tot)) return false

    if (!naald) return true
    const hooi = [
      regel.naam,
      regel.actorNaam,
      regel.soort,
      regel.documentId,
      ...(regel.wijzigingen ?? []).flatMap((w) => [veldNaam(w.veld), w.van, w.naar]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hooi.includes(naald)
  })
}

/** Per dag, nieuwste dag eerst — zo leest een logboek. */
export function perDag(regels) {
  const dagen = new Map()
  for (const regel of regels ?? []) {
    const at = asDate(regel.at)
    const sleutel = at ? dayKey(at) : 'onbekend'
    if (!dagen.has(sleutel)) dagen.set(sleutel, { sleutel, label: at ? formatDay(at) : tekst('logboek.onbekend'), regels: [] })
    dagen.get(sleutel).regels.push(regel)
  }
  return [...dagen.values()].sort((a, b) => b.sleutel.localeCompare(a.sleutel))
}

/** Wie er in dit logboek voorkomt — voor het filter, zonder de dubbels. */
export function mensenIn(regels) {
  const perId = new Map()
  for (const regel of regels ?? []) {
    if (regel.actorId && !perId.has(regel.actorId)) perId.set(regel.actorId, regel.actorNaam || regel.actorId)
  }
  return [...perId.entries()].map(([id, naam]) => ({ id, naam })).sort((a, b) => a.naam.localeCompare(b.naam))
}

/**
 * Het logboek als CSV.
 *
 * Puntkomma's en een BOM, net als de FAVV-export: Excel op een Belgische
 * computer leest een komma-CSV als één kolom.
 */
export function naarCsv(regels) {
  const veilig = (waarde) => `"${String(waarde ?? '').replace(/"/g, '""')}"`
  const kop = ['Tijdstip', 'Wie', 'Soort', 'Wat', 'Actie', 'Wijziging']

  const rijen = (regels ?? []).map((regel) => {
    const at = asDate(regel.at)
    return [
      at ? at.toISOString() : '',
      regel.actorNaam ?? '',
      regel.soort ?? '',
      regel.naam ?? regel.documentId ?? '',
      regel.actie ?? '',
      (regel.wijzigingen ?? [])
        .map((w) => `${veldNaam(w.veld)}: ${waardeTekst(w.van)} → ${waardeTekst(w.naar)}`)
        .join(' | '),
    ].map(veilig)
  })

  return `\uFEFF${[kop.map(veilig), ...rijen].map((r) => r.join(';')).join('\r\n')}\r\n`
}
