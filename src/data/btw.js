import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@lib/firebase'

/**
 * Naam en adres bij een btw-nummer, uit VIES.
 *
 * Via de server (`btwOpzoeken` in `functions/btw-opzoeken.js`): VIES zet geen
 * CORS-koppen, dus een browser mag het antwoord niet lezen. Het antwoord is
 * `{ geldig, naam, adres, reden }`; `geldig: null` betekent dat VIES het nu
 * niet weet, en dat is iets anders dan "ongeldig".
 *
 * Een fout bij het aanroepen zelf (geen netwerk, de functie ligt plat) wordt
 * hetzelfde antwoord als een VIES dat niet antwoordt: voor wie de fiche
 * invult, is het verschil er niet.
 */
const functions = getFunctions(app, 'europe-west1')

const NIET_BEREIKT = { geldig: null, naam: '', adres: null, reden: 'onbereikbaar' }

export async function zoekBtwOp(btw) {
  try {
    const { data } = await httpsCallable(functions, 'btwOpzoeken')({ btw })
    return data ?? NIET_BEREIKT
  } catch {
    return NIET_BEREIKT
  }
}
