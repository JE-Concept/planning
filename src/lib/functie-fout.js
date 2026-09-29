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
const ONTBREEKT =
  'Dit onderdeel is nog niet uitgerold. Het wacht op de Claude-sleutel: een beheerder zet ' +
  'ANTHROPIC_API_KEY bij het Firebase-project en rolt opnieuw uit — zie docs/assistent-aanzetten.md.'

export function leesFunctieFout(err, wat = 'Dit onderdeel') {
  const code = err?.code ?? ''

  // "not-found" is de functie die er niet is; "internal" krijgen we wanneer de
  // aanroep wel ergens landt maar er niets achter zit.
  if (code === 'functions/not-found' || code === 'functions/internal') {
    return `${wat} is nog niet uitgerold. ${ONTBREEKT.slice(ONTBREEKT.indexOf('Het wacht'))}`
  }
  if (code === 'functions/unauthenticated') return 'Je bent afgemeld. Herlaad de pagina.'
  if (code === 'functions/permission-denied') return err?.message || 'Je hebt hier geen toegang toe.'
  if (code === 'functions/deadline-exceeded') {
    return 'Het duurde te lang. Probeer het met een korter transcript, of probeer het zo opnieuw.'
  }
  if (code === 'functions/unavailable' || code === 'functions/resource-exhausted') {
    return 'De dienst is even niet bereikbaar. Probeer het zo opnieuw.'
  }

  return err?.message || 'Er ging iets mis.'
}
