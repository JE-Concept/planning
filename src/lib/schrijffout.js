import { tekst } from './i18n'

/**
 * Een schrijfactie die niet doorging, en waarom dat erger is dan het lijkt.
 *
 * Firestore past een schrijving eerst lokaal toe en stuurt ze daarna pas door.
 * Dat is precies wat je wil hebben — de app voelt snel aan en werkt offline —
 * maar het heeft een keerzijde: het scherm toont de nieuwe waarde alsof het
 * gelukt is, ook wanneer de server ze even later weigert. Dan rolt Firestore de
 * waarde stilletjes terug en zegt niemand iets.
 *
 * Voor een planningstool is dat de ergste fout die er is. Een taak die niet
 * bewaard wordt zonder dat iemand het merkt, is erger dan een taak die zichtbaar
 * niet bewaard wordt: in het tweede geval doe je het opnieuw.
 *
 * In de schermen staan tientallen van zulke schrijvingen zonder `await` en
 * zonder `catch` — dat is ook redelijk, want er valt bij elk veld weinig
 * zinnigs te doen. Daarom vangt `AppShell` ze centraal op: elke afgewezen
 * belofte die van de database of van een functie komt, wordt hier een zin.
 */

/** Komt deze fout van de database of van een Cloud Function? */
export function isSchrijffout(fout) {
  const code = String(fout?.code ?? '')
  if (!code) return false
  // Firestore geeft kale codes ("permission-denied"), de functions-SDK geeft ze
  // met een voorvoegsel ("functions/internal").
  return (
    code.startsWith('functions/') ||
    [
      'permission-denied',
      'unauthenticated',
      'not-found',
      'already-exists',
      'failed-precondition',
      'resource-exhausted',
      'invalid-argument',
      'aborted',
      'out-of-range',
      'data-loss',
      'internal',
      'unavailable',
      'deadline-exceeded',
    ].includes(code)
  )
}

/**
 * Wat er op het scherm komt.
 *
 * Elke zin zegt eerst dat het niet bewaard is. Dat is wat iemand moet weten; de
 * reden erachter is voor wie er iets mee kan. `unavailable` is de uitzondering:
 * dat is geen weigering maar een wachtrij, en dan zou "niet bewaard" gewoon
 * onwaar zijn.
 */
export function leesSchrijffout(fout) {
  const code = String(fout?.code ?? '').replace(/^functions\//, '')

  if (code === 'permission-denied') return tekst('fout.niet_bewaard_geen_toegang')
  if (code === 'unauthenticated') return tekst('fout.afgemeld')
  if (code === 'unavailable') return tekst('fout.wacht_op_verbinding')
  if (code === 'not-found') return tekst('fout.niet_bewaard_weg')
  if (code === 'failed-precondition') return tekst('fout.niet_bewaard_veranderd')
  if (code === 'resource-exhausted') return tekst('fout.niet_bewaard_te_druk')

  return tekst('fout.niet_bewaard')
}
