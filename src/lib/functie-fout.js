/**
 * Wat een mislukte aanroep van een Cloud Function betekent voor wie het leest.
 *
 * De assistent en het samenvatten van een overleg staan in een eigen codebase,
 * omdat ze aan de Claude-sleutel hangen en een functions-uitrol in zijn geheel
 * faalt op een ontbrekend geheim — met alles bij elkaar zou dat ook het
 * aanmelden meeslepen. Die splitsing is goed, maar ze heeft een keerzijde:
 * zolang de sleutel niet gezet is, worden die functies overgeslagen bij de
 * uitrol, en dan bestaat er niets om aan te roepen.
 *
 * De browser meldt dat als "internal" of "not-found". Dat leest als een fout in
 * de applicatie, terwijl er alleen iets niet ingesteld is — en dan gaat iemand
 * zoeken naar een probleem dat er niet is. Deze vertaling zegt wat er aan de hand
 * is en wie het kan oplossen.
 */
import { tekst } from './i18n'

export function leesFunctieFout(err, wat = null) {
  const code = err?.code ?? ''

  // "not-found" is de functie die er niet is; "internal" krijgen we wanneer de
  // aanroep wel ergens landt maar er niets achter zit.
  if (code === 'functions/not-found' || code === 'functions/internal') {
    return tekst('fout.niet_uitgerold', { wat: wat ?? tekst('fout.dit_onderdeel') })
  }
  if (code === 'functions/unauthenticated') return tekst('fout.afgemeld')
  if (code === 'functions/permission-denied') return err?.message || tekst('fout.geen_toegang')
  if (code === 'functions/deadline-exceeded') return tekst('fout.te_lang')
  if (code === 'functions/unavailable' || code === 'functions/resource-exhausted') {
    return tekst('fout.niet_bereikbaar')
  }

  return err?.message || tekst('fout.iets_mis')
}
