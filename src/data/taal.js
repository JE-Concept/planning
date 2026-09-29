import { serverTimestamp, setDoc } from 'firebase/firestore'
import { COL, ref } from '@lib/collections'

/**
 * De taalkeuze op je eigen profiel.
 *
 * Onder `prefs`, net als de meldingsvoorkeuren: dat is het veld dat de
 * beveiligingsregels je van jezelf laten bewerken. Met `merge` en een heel
 * object in plaats van een puntpad, want een puntpad wordt in de demostub een
 * letterlijke sleutel — en dan staat er een veld dat "prefs.taal" heet.
 */
export function zetTaal(uid, taal) {
  return setDoc(ref(COL.profiles, uid), { prefs: { taal }, updatedAt: serverTimestamp() }, { merge: true })
}
