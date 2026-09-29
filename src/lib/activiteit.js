import { asDate, formatDate } from './dates'
import { tekst } from './i18n'
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
// Heette `tekst`; die naam is nu van de vertaalfunctie hierboven.
const alsTekst = (waarde) => (waarde ?? '').toString().trim()

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

  if (alsTekst(voor.title) !== alsTekst(na.title)) {
    regels.push({ veld: 'title', van: alsTekst(voor.title), naar: alsTekst(na.title) })
  }

  // Status en "afgerond" zijn één gebeurtenis, geen twee. Een taak die naar de
  // laatste kolom gaat is afgevinkt; dat als aparte regel eronder zetten maakt
  // het log dubbel zo lang zonder dat er iets bij staat.
  const statusAnders = alsTekst(voor.statusName) !== alsTekst(na.statusName)
  const openAnders = voor.open !== na.open && typeof na.open === 'boolean'
  if (statusAnders || openAnders) {
    const veld = openAnders ? (na.open ? 'heropend' : 'afgerond') : 'status'
    regels.push({ veld, van: alsTekst(voor.statusName), naar: alsTekst(na.statusName) })
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

const naam = (uid, naamVan) => naamVan?.(uid) || tekst('taaklib.log.iemand')
const datum = (waarde) => formatDate(waarde) || tekst('taaklib.log.geen_datum')

/** "Elke en Jasper" — hetzelfde voegwoord als in de verwijdervraag. */
const enLijst = (delen) => delen.join(` ${tekst('taaklib.en')} `)

/**
 * Eén regel als zin, zonder de naam van wie het deed.
 *
 * Die naam staat in het paneel ervoor ("Elke Motmans verzette de deadline…"),
 * zodat hij niet in elke zin herhaald wordt. De statusnamen blijven in de
 * database wat ze in ClickUp heetten; hier komt het label dat het team ziet.
 *
 * De zin volgt de taal waarin iemand werkt, maar wat erin gevuld wordt niet:
 * statuslabels, taaktitels en de namen van collega's staan in de database en
 * blijven overal hetzelfde.
 */
export function beschrijf(regel, { naamVan, statuses = [] } = {}) {
  if (!regel) return ''
  const label = (naam) => labelOf(naam, statuses) || naam

  switch (regel.veld) {
    case 'title':
      return regel.van
        ? tekst('taaklib.log.hernoemd', { van: regel.van, naar: regel.naar })
        : tekst('taaklib.log.titel_gezet', { naar: regel.naar })

    case 'status':
      return regel.van
        ? tekst('taaklib.log.status_verzet', { van: label(regel.van), naar: label(regel.naar) })
        : tekst('taaklib.log.status_gezet', { naar: label(regel.naar) })

    // Het streepje met het statuslabel erachter is leesteken, geen taal: het
    // staat er in beide talen hetzelfde bij.
    case 'afgerond':
      return `${tekst('taaklib.log.afgerond')}${regel.naar ? ` — ${label(regel.naar)}` : ''}`

    case 'heropend':
      return `${tekst('taaklib.log.heropend')}${regel.naar ? ` — ${label(regel.naar)}` : ''}`

    case 'dueDate':
      if (!regel.naar) return tekst('taaklib.log.deadline_weg', { van: datum(regel.van) })
      if (!regel.van) return tekst('taaklib.log.deadline_gezet', { naar: datum(regel.naar) })
      return tekst('taaklib.log.deadline_verzet', {
        van: datum(regel.van),
        naar: datum(regel.naar),
      })

    case 'assignees': {
      const van = lijst(regel.van)
      const naarLijst = lijst(regel.naar)
      const erbij = naarLijst.filter((uid) => !van.includes(uid))
      const eraf = van.filter((uid) => !naarLijst.includes(uid))
      const delen = []
      if (erbij.length) {
        delen.push(tekst('taaklib.log.toegewezen', { wie: enLijst(erbij.map((uid) => naam(uid, naamVan))) }))
      }
      if (eraf.length) {
        delen.push(tekst('taaklib.log.afgehaald', { wie: enLijst(eraf.map((uid) => naam(uid, naamVan))) }))
      }
      return delen.join(`, ${tekst('taaklib.en')} `)
    }

    case 'priority': {
      const naarLabel = priorityOf(regel.naar)?.label
      if (!naarLabel) return tekst('taaklib.log.prioriteit_weg')
      return tekst('taaklib.log.prioriteit_gezet', { prio: naarLabel })
    }

    case 'archived':
      return regel.naar ? tekst('taaklib.log.gearchiveerd') : tekst('taaklib.log.uit_archief')

    default:
      return tekst('taaklib.log.gewijzigd')
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
