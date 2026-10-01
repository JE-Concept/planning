/**
 * De rijen uit het AAPI-blad tot shifts die ergens op slaan.
 *
 * ── Op kolomnaam en niet op plaats ────────────────────────────────────────
 * AAPI mag morgen een kolom bijzetten of verplaatsen. Wie op index leest,
 * leest dan stilletjes het verkeerde veld: een pauze van 30 minuten die ineens
 * een GUID is valt op, maar een starttijd die een eindtijd blijkt niet.
 * Daarom: de kopregel bepaalt welke kolom waar staat, en een ontbrekende
 * verplichte kolom stopt de import met naam en toenaam.
 *
 * ── Eén rij stuk is geen import stuk ──────────────────────────────────────
 * Een rij met een onleesbare datum wordt overgeslagen met een reden erbij, en
 * de rest gaat door. Een ontbrekende kolom is wél structureel: dan klopt het
 * hele bestand niet en is doorgaan erger dan stoppen.
 */
import { brusselNaarInstant } from './tijd.js'
import { afdelingVan, booleanVan, inEenAdem, minutenVan, naamNetjes, statuutVan } from './normaliseer.js'

/** Zonder deze kolommen heeft het bestand geen betekenis. */
export const VERPLICHT = [
  'Location Name',
  'Employee Id',
  'Employee Name',
  'Planning Id',
  'Start Datetime',
  'End Datetime',
  'Canceled',
]

/** Wat er verder in mag, zodat een onbekende kolom opvalt in plaats van weg te vallen. */
export const GEKEND = [
  'EmployerId', 'Employer Name',
  'Establishment Id', 'Establishment Name',
  'Location Id', 'Location Name',
  'Employee Id', 'Employee Name', 'Employee Reverse Name',
  'Planning Type', 'Dimona Type', 'Planning Id',
  'Default Start Datetime', 'Default End Datetime', 'Default Pause',
  'Start Datetime', 'End Datetime', 'Pause',
  'Canceled', 'Created On', 'Last Modified On',
]

export class ImportFout extends Error {}

/**
 * De kopregel: kolomnaam → kolomletter.
 *
 * Namen worden ontdaan van spaties aan de randen en vergeleken zonder
 * hoofdletters, want dat is precies het soort verschil dat een export tussen
 * twee versies oplevert.
 */
export function koppenVan(rij) {
  const koppen = {}
  for (const [letter, waarde] of Object.entries(rij ?? {})) {
    const naam = inEenAdem(waarde)
    if (naam) koppen[naam.toLowerCase()] = letter
  }
  return koppen
}

const lees = (rij, koppen, naam) => inEenAdem(rij[koppen[naam.toLowerCase()]])

/*
  De cel zoals ze er staat, zonder de spaties op te ruimen.

  `rawName` bestaat om te kunnen nakijken wat AAPI écht schreef — "Herman  Van
  Ormelingen" met twee spaties, "ANNELEEN COENEN" in hoofdletters. Wie dat veld
  langs `inEenAdem` haalt, bewaart een half opgeruimde waarde die geen van beide
  is, en dan is de vraag "stond dat er altijd al zo" niet meer te beantwoorden.
*/
const leesRuw = (rij, koppen, naam) => String(rij[koppen[naam.toLowerCase()]] ?? '')

/**
 * Het blad tot shifts.
 *
 * Geeft `{ shifts, fouten, onbekendeKolommen }` terug. `fouten` zijn rijen die
 * overgeslagen zijn, met rijnummer en reden — die horen in het rapport, niet in
 * een console.
 */
export function parseBlad(rijen) {
  if (!Array.isArray(rijen) || rijen.length === 0) {
    throw new ImportFout('Het blad "Data" is leeg.')
  }

  const koppen = koppenVan(rijen[0])
  const ontbreekt = VERPLICHT.filter((naam) => !koppen[naam.toLowerCase()])
  if (ontbreekt.length) {
    throw new ImportFout(
      `Dit bestand mist ${ontbreekt.length === 1 ? 'de kolom' : 'de kolommen'} ${ontbreekt.join(', ')}. `
      + 'Exporteer opnieuw als "Planning Overview" en kies alle kolommen.'
    )
  }

  const gekend = new Set(GEKEND.map((n) => n.toLowerCase()))
  const onbekendeKolommen = Object.keys(koppen).filter((n) => !gekend.has(n))

  const shifts = []
  const fouten = []

  for (let i = 1; i < rijen.length; i += 1) {
    const rij = rijen[i]
    const rijnummer = i + 1 // zoals Excel ze nummert: rij 1 is de kop
    if (Object.keys(rij).length === 0) continue // een lege rij onderaan is geen fout

    const planningId = lees(rij, koppen, 'Planning Id')
    const employeeId = lees(rij, koppen, 'Employee Id')
    const start = brusselNaarInstant(lees(rij, koppen, 'Start Datetime'))
    const eind = brusselNaarInstant(lees(rij, koppen, 'End Datetime'))
    const geannuleerd = booleanVan(lees(rij, koppen, 'Canceled'))
    const pauze = minutenVan(lees(rij, koppen, 'Pause'))

    const klacht =
      !planningId ? 'geen Planning Id'
      : !employeeId ? 'geen Employee Id'
      : !start ? `onleesbare starttijd "${lees(rij, koppen, 'Start Datetime')}"`
      : !eind ? `onleesbare eindtijd "${lees(rij, koppen, 'End Datetime')}"`
      : eind <= start ? 'de eindtijd ligt niet na de starttijd'
      : geannuleerd === null ? `onleesbare waarde voor Canceled "${lees(rij, koppen, 'Canceled')}"`
      : pauze === null ? `onleesbare pauze "${lees(rij, koppen, 'Pause')}"`
      : null

    if (klacht) {
      fouten.push({ rij: rijnummer, planningId: planningId || null, reden: klacht })
      continue
    }

    const ruweNaam = leesRuw(rij, koppen, 'Employee Name')
    const ruweAfdeling = lees(rij, koppen, 'Location Name')
    const planningType = lees(rij, koppen, 'Planning Type')
    const dimonaType = lees(rij, koppen, 'Dimona Type')

    shifts.push({
      aapiPlanningId: planningId,
      aapiEmployeeId: employeeId,
      naam: naamNetjes(ruweNaam),
      ruweNaam,
      afdeling: afdelingVan(ruweAfdeling),
      ruweAfdeling,
      statuut: statuutVan(dimonaType, planningType),
      dimonaType: dimonaType || null,
      planningType: planningType || null,
      establishmentName: lees(rij, koppen, 'Establishment Name') || null,
      start,
      eind,
      pauzeMinuten: pauze,
      // De oorspronkelijk geplande tijden: bewaren, nergens voor rekenen. Ze
      // zijn het antwoord op "stond dat er altijd al zo in".
      standaardStart: brusselNaarInstant(lees(rij, koppen, 'Default Start Datetime')),
      standaardEind: brusselNaarInstant(lees(rij, koppen, 'Default End Datetime')),
      standaardPauzeMinuten: minutenVan(lees(rij, koppen, 'Default Pause')) ?? 0,
      geannuleerd,
      aapiAangemaaktOp: brusselNaarInstant(lees(rij, koppen, 'Created On')),
      aapiGewijzigdOp: brusselNaarInstant(lees(rij, koppen, 'Last Modified On')),
      bronRij: rijnummer,
    })
  }

  return { shifts, fouten, onbekendeKolommen }
}

/**
 * Het venster waarbinnen dit bestand iets te zeggen heeft.
 *
 * Van het begin van de vroegste dag tot het einde van de laatste. Alleen
 * daarbinnen mag een shift die niet in het bestand staat als verdwenen gelden —
 * anders zou een export van één maand de planning van de volgende maand wissen.
 */
export function vensterVan(shifts) {
  if (!shifts.length) return null
  let van = shifts[0].start
  let tot = shifts[0].eind
  for (const s of shifts) {
    if (s.start < van) van = s.start
    if (s.eind > tot) tot = s.eind
  }
  return { van, tot }
}
