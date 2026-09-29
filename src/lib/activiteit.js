import { asDate, formatDate } from './dates'
import { labelOf } from './pipeline'
import { priorityOf } from './format'

/**
 * Wat er aan een taak veranderde, en hoe je dat voorleest.
 *
 * De aanleiding: sinds er met meerdere mensen tegelijk in de planning gewerkt
 * wordt, is "wie heeft dit verzet?" een dagelijkse vraag geworden. De taak zelf
 * bewaart alleen de eindstand — `updatedBy` zegt wie als laatste iets deed, niet
 * wat. Daar komt dit voor.
 *
 * Het rekenwerk staat hier en niet in de schrijffuncties, om twee redenen. Het
 * is te testen zonder database, en het is één plek waar staat wat "een
 * wijziging die ertoe doet" betekent — een log dat alles registreert leest
 * niemand meer.
 */

/**
 * De velden die gelogd worden.
 *
 * Bewust kort. Een omschrijving die tien keer bijgeschaafd wordt, een budget
 * dat tijdens het offreren op en neer gaat, een label dat aan en uit gaat: dat
 * wil je later niet teruglezen. Wat je wél wil weten is waarom een taak ineens
 * ergens anders staat, later klaar moet zijn, of bij iemand anders ligt.
 */
export const GELOGDE_VELDEN = ['title', 'statusName', 'dueDate', 'assignees', 'priority', 'archived']

/**
 * Vanaf wanneer er gelogd wordt.
 *
 * Een taak van vorige maand heeft geen regels, en dat is geen fout maar een
 * begindatum. Het paneel zegt dat liever met zoveel woorden dan dat het een
 * lege doos toont waar iemand uit afleidt dat er niets gebeurd is.
 */
export const LOGGEN_SINDS = new Date('2026-09-29T00:00:00')

/** Raakt deze wijziging iets dat gelogd wordt? Zo niet, geen extra leesbeurt. */
export function raaktLog(patch) {
  if (!patch) return false
  return GELOGDE_VELDEN.some((veld) => veld in patch)
}

const tijd = (waarde) => asDate(waarde)?.getTime() ?? null
const lijst = (waarde) => (Array.isArray(waarde) ? waarde.filter(Boolean) : [])
const tekst = (waarde) => (waarde ?? '').toString().trim()

/**
 * De regels die deze wijziging oplevert.
 *
 * Geeft een lege lijst terug wanneer er niets veranderde. Dat is het halve
 * punt: een statuskolom waar je een kaart per ongeluk in en weer uit sleept,
 * een deadline die je opent en ongewijzigd sluit, of twee mensen die dezelfde
 * knop indrukken — dat hoort geen drie regels op te leveren.
 */
export function wijzigingen(voor, na) {
  if (!voor || !na) return []
  const regels = []

  if (tekst(voor.title) !== tekst(na.title)) {
    regels.push({ veld: 'title', van: tekst(voor.title), naar: tekst(na.title) })
  }

  // Status en "afgerond" zijn één gebeurtenis, geen twee. Een taak die naar de
  // laatste kolom gaat is afgevinkt; dat als aparte regel eronder zetten maakt
  // het log dubbel zo lang zonder dat er iets bij staat.
  const statusAnders = tekst(voor.statusName) !== tekst(na.statusName)
  const openAnders = voor.open !== na.open && typeof na.open === 'boolean'
  if (statusAnders || openAnders) {
    const veld = openAnders ? (na.open ? 'heropend' : 'afgerond') : 'status'
    regels.push({ veld, van: tekst(voor.statusName), naar: tekst(na.statusName) })
  }

  if (tijd(voor.dueDate) !== tijd(na.dueDate)) {
    regels.push({
      veld: 'dueDate',
      van: asDate(voor.dueDate)?.toISOString() ?? null,
      naar: asDate(na.dueDate)?.toISOString() ?? null,
    })
  }

  const vanWie = lijst(voor.assignees)
  const naarWie = lijst(na.assignees)
  if (vanWie.length !== naarWie.length || vanWie.some((uid) => !naarWie.includes(uid))) {
    regels.push({ veld: 'assignees', van: vanWie, naar: naarWie })
  }

  if ((voor.priority ?? null) !== (na.priority ?? null)) {
    regels.push({ veld: 'priority', van: voor.priority ?? null, naar: na.priority ?? null })
  }

  if (Boolean(voor.archived) !== Boolean(na.archived)) {
    regels.push({ veld: 'archived', van: Boolean(voor.archived), naar: Boolean(na.archived) })
  }

  return regels
}

const naam = (uid, naamVan) => naamVan?.(uid) || 'iemand'
const datum = (waarde) => formatDate(waarde) || 'geen datum'

/**
 * Eén regel als Nederlandse zin, zonder de naam van wie het deed.
 *
 * Die naam staat in het paneel ervoor ("Elke Motmans verzette de deadline…"),
 * zodat hij niet in elke zin herhaald wordt. De statusnamen blijven in de
 * database wat ze in ClickUp heetten; hier komt het label dat het team ziet.
 */
export function beschrijf(regel, { naamVan, statuses = [] } = {}) {
  if (!regel) return ''
  const label = (naam) => labelOf(naam, statuses) || naam

  switch (regel.veld) {
    case 'title':
      return regel.van
        ? `hernoemde “${regel.van}” naar “${regel.naar}”`
        : `gaf de taak de titel “${regel.naar}”`

    case 'status':
      return regel.van
        ? `verzette de status van ${label(regel.van)} naar ${label(regel.naar)}`
        : `zette de status op ${label(regel.naar)}`

    case 'afgerond':
      return `rondde de taak af${regel.naar ? ` — ${label(regel.naar)}` : ''}`

    case 'heropend':
      return `heropende de taak${regel.naar ? ` — ${label(regel.naar)}` : ''}`

    case 'dueDate':
      if (!regel.naar) return `haalde de deadline weg (stond op ${datum(regel.van)})`
      if (!regel.van) return `zette de deadline op ${datum(regel.naar)}`
      return `verzette de deadline van ${datum(regel.van)} naar ${datum(regel.naar)}`

    case 'assignees': {
      const van = lijst(regel.van)
      const naarLijst = lijst(regel.naar)
      const erbij = naarLijst.filter((uid) => !van.includes(uid))
      const eraf = van.filter((uid) => !naarLijst.includes(uid))
      const delen = []
      if (erbij.length) delen.push(`zette ${erbij.map((uid) => naam(uid, naamVan)).join(' en ')} op de taak`)
      if (eraf.length) delen.push(`haalde ${eraf.map((uid) => naam(uid, naamVan)).join(' en ')} van de taak`)
      return delen.join(', en ')
    }

    case 'priority': {
      const naarLabel = priorityOf(regel.naar)?.label
      if (!naarLabel) return 'haalde de prioriteit weg'
      return `zette de prioriteit op ${naarLabel}`
    }

    case 'archived':
      return regel.naar ? 'archiveerde de taak' : 'haalde de taak uit het archief'

    default:
      return 'wijzigde de taak'
  }
}

/**
 * Reacties en logregels als één verhaal, oudste eerst.
 *
 * Twee lijstjes onder elkaar dwingen je om zelf te puzzelen welke reactie bij
 * welke verzetting hoorde. Door elkaar gelezen staat er wat er werkelijk
 * gebeurde: "verzet naar volgende week" en daaronder "klant belde, gaat niet
 * door op zaterdag".
 */
export function verloopVan({ reacties = [], activiteit = [] } = {}) {
  const items = [
    ...reacties.map((r) => ({ soort: 'reactie', id: `c-${r.id}`, at: asDate(r.createdAt), data: r })),
    ...activiteit.map((a) => ({ soort: 'activiteit', id: `a-${a.id}`, at: asDate(a.createdAt), data: a })),
  ]

  // Wat nog geen tijdstip van de server terugkreeg, hoort onderaan: het is net
  // geschreven en staat op het punt zijn echte tijd te krijgen.
  return items.sort((a, b) => (a.at?.getTime() ?? Infinity) - (b.at?.getTime() ?? Infinity))
}
