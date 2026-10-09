import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { leesBtwNummer, leesViesAntwoord, viesUrl } from './vies.js'

/**
 * Naam en adres van een klant ophalen met zijn btw-nummer.
 *
 * ── Waarom dit op de server gebeurt ───────────────────────────────────────
 * VIES zet geen CORS-koppen: een browser mag het antwoord niet lezen. Dus
 * vraagt de server het, en geeft hij de drie velden terug die de klantfiche
 * nodig heeft. Er is geen sleutel of contract voor nodig — vandaar dat dit in
 * de standaardcodebase mag staan en niet achter een eigen geheim.
 *
 * ── Waarom alleen het nummer de deur uit gaat ─────────────────────────────
 * Het adres ligt vast (`viesUrl`) en de vraag is een land en een nummer, na
 * `leesBtwNummer` alleen letters en cijfers. Er is dus geen manier om de
 * server via deze functie iets anders te laten opvragen, en geen reden voor
 * de bewaking die `linkVoorbeeld` nodig heeft.
 *
 * ── Waarom niets bewaard wordt ────────────────────────────────────────────
 * Het antwoord gaat terug naar wie het vroeg, en die beslist wat er op de
 * fiche komt (zie `viesVoorstel` in `src/lib/klanten.js`). Een cache zou een
 * tweede plek zijn waar een adres staat, en een verhuisde klant zou er nog
 * wekenlang op het oude adres wonen.
 */

const TIJDSLIMIET_MS = 8000

export function maakBtwOpzoeken({ region }) {
  const btwOpzoeken = onCall({ region, cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')

    const nummer = leesBtwNummer(request.data?.btw)
    if (!nummer) return { geldig: null, naam: '', adres: null, reden: 'vorm' }

    try {
      const antwoord = await fetch(viesUrl(nummer), {
        signal: AbortSignal.timeout(TIJDSLIMIET_MS),
        headers: { accept: 'application/json' },
      })
      // VIES antwoordt op een fout in de vraag met 400 en een uitleg in JSON;
      // die lezen we gewoon, `leesViesAntwoord` weet wat ze betekent.
      const json = await antwoord.json().catch(() => null)
      if (!json) return { geldig: null, naam: '', adres: null, reden: 'onbereikbaar' }
      return { ...leesViesAntwoord(json, nummer.land), land: nummer.land, nummer: nummer.nummer }
    } catch (err) {
      logger.warn('btwOpzoeken: VIES niet bereikbaar', { land: nummer.land, fout: String(err?.message ?? err) })
      return { geldig: null, naam: '', adres: null, reden: 'onbereikbaar' }
    }
  })

  return { btwOpzoeken }
}
