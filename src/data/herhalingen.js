import { useEffect, useState } from 'react'
import { deleteDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { maakHerhaling } from '@lib/herhaling'

/**
 * De herhalingen: werk dat vanzelf terugkomt.
 *
 * De taken zelf worden 's nachts door een geplande functie neergezet — zie
 * `functions/herhalingen.js`. Wat hier staat is het beheer van het recept, en
 * dat is bewust alles wat de browser ermee mag: een scherm dat zelf taken
 * aanmaakt, maakt ze alleen aan op de dagen dat iemand de tool opent.
 */
export function useHerhalingen() {
  const [rijen, setRijen] = useState([])

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.herhalingen), orderBy('titel')),
        (snap) => setRijen(fromQuery(snap)),
        // Een geweigerde vraag is een fout en geen lege lijst; zonder deze tak
        // ziet iemand zonder rechten "er zijn er geen" in plaats van niets.
        () => setRijen([])
      ),
    []
  )

  return rijen
}

export async function nieuweHerhaling(velden, uid = null) {
  const doc = newRef(COL.herhalingen)
  await setDoc(doc, {
    ...maakHerhaling(velden),
    createdAt: serverTimestamp(),
    createdBy: uid ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: uid ?? null,
  })
  return doc.id
}

/*
  Het hele recept wordt opnieuw geschreven en niet alleen het veld dat
  veranderde. Dat is met opzet: `maakHerhaling` zet de dagen in volgorde,
  haalt dubbels eruit en begrenst de dag van de maand. Een deelupdate zou die
  opruiming overslaan, en dan staat er in de database iets wat het scherm nooit
  getoond heeft.

  De id gaat er niet in mee: die is het adres van het document, niet een veld
  erop.
*/
export const bewerkHerhaling = (id, velden, uid = null) =>
  updateDoc(ref(COL.herhalingen, id), {
    ...maakHerhaling(velden),
    updatedAt: serverTimestamp(),
    updatedBy: uid ?? null,
  })

export const wisHerhaling = (id) => deleteDoc(ref(COL.herhalingen, id))
