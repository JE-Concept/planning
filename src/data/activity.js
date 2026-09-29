import { useEffect, useState } from 'react'
import { limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { COL, col, fromQuery, newRef } from '@lib/collections'
import { db } from '@lib/firebase'
import { wijzigingen } from '@lib/activiteit'

/**
 * Het activiteitslog van een taak.
 *
 * ── Waarom een eigen collectie met `taskId`, en geen subcollectie ──────────
 *
 * Een subcollectie `tasks/{id}/activity` leest mooier en wordt vanzelf mee
 * opgeruimd als de taak verdwijnt. Toch staat het hier los, om drie redenen die
 * in deze codebase zwaarder wegen:
 *
 * 1. De regels. `firestore.rules` laat subcollecties niet toe: alles wat niet
 *    bij naam genoemd staat valt in de slotregel `match /{document=**}` en gaat
 *    dicht. Een subcollectie vraagt dus een nieuwe regel én een `collectionGroup`
 *    -index, en tot beide uitgerold zijn faalt de query — en een mislukte query
 *    in het takenpaneel neemt het hele scherm mee.
 * 2. Er ligt al een index klaar voor precies deze vraag: `activity` op `taskId`
 *    plus `createdAt` aflopend. De collectie stond al in `COL`, alleen werd ze
 *    nog nergens geschreven.
 * 3. Dezelfde vorm als `comments` en `postReviews`, die ook plat naast de taak
 *    staan met een `taskId`. Eén model in de kop scheelt fouten.
 *
 * De prijs is dat het log níét mee verdwijnt met de taak. Dat is hier eerder
 * winst dan verlies: wie wil weten wie een taak weggooide, heeft daar juist een
 * log voor. `deleteTask` laat het dan ook staan.
 */

/** De regels van één taak, nieuwste eerst — zoals de index ze teruggeeft. */
export function useActivity(taskId, { max = 100 } = {}) {
  const [regels, setRegels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!taskId) {
      setRegels([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    return onSnapshot(
      query(col(COL.activity), where('taskId', '==', taskId), orderBy('createdAt', 'desc'), limit(max)),
      (snap) => {
        setRegels(fromQuery(snap))
        setLoading(false)
      },
      (err) => {
        // Een log dat niet laadt is vervelend; een taakfiche die daardoor niet
        // opengaat, is erger. Dus leeg tonen en verder.
        console.error('JE Plan: het activiteitslog is niet op te halen', err)
        setRegels([])
        setLoading(false)
      }
    )
  }, [taskId, max])

  return { regels, loading }
}

/**
 * Schrijft wat er aan een taak veranderde.
 *
 * Eén batch voor alle regels van één handeling: wie een kaart versleept en
 * daarmee tegelijk de status en de afvinkstand wijzigt, hoort dat als één
 * moment terug te lezen, niet als twee schrijfbeurten die net naast elkaar
 * landen.
 *
 * Geeft nooit een fout terug. Het log is een bijproduct van de wijziging — als
 * het schrijven mislukt, is de wijziging zelf al gelukt en die mag er niet
 * alsnog op stuklopen.
 */
export async function logWijzigingen({ taskId, voor, na, door }) {
  const regels = wijzigingen(voor, na)
  if (regels.length === 0) return 0

  try {
    const batch = writeBatch(db)
    for (const regel of regels) {
      batch.set(newRef(COL.activity), {
        taskId,
        veld: regel.veld,
        van: regel.van ?? null,
        naar: regel.naar ?? null,
        createdBy: door ?? null,
        createdAt: serverTimestamp(),
      })
    }
    await batch.commit()
    return regels.length
  } catch (err) {
    console.error('JE Plan: het activiteitslog is niet weggeschreven', err)
    return 0
  }
}
