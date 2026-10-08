import { useEffect, useMemo, useState } from 'react'
import { deleteDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { koppelsleutel, raakt, voegSamen, zetKoppelingen } from '@lib/koppelingen'

/**
 * Notities: los van waar ze over gaan, en gekoppeld aan alles wat ze raken.
 *
 * Twee soorten staan in dezelfde collectie:
 *  - `notitie` — wat iemand van het team schrijft. Open voor het hele team.
 *  - `overleg` — het verslag van een teamoverleg, geschreven door
 *    `functions-meetings/`. Privé: alleen wie in `viewerIds` staat leest het.
 *    Vroeger stond dat in een eigen collectie `meetings`; `scripts/seed.mjs`
 *    verhuist wat daar staat, en laat het origineel staan.
 *
 * ── Waarom twee vragen en niet één ────────────────────────────────────────
 * Firestore weigert een vraag die documenten zou kunnen opleveren die de
 * regels afwijzen — en dan faalt het hele overzicht in plaats van korter te
 * worden. De regel heeft twee takken (open voor het team, of jij staat in
 * `viewerIds`), en elke vraag moet er één van aantoonbaar volgen. Vandaar:
 * één vraag op `prive == false`, één op `viewerIds array-contains uid`.
 *
 * Bij een object (de notities van één klant) kan de privévraag niet ook nog op
 * `koppelsleutels` filteren — Firestore staat maar één `array-contains` per
 * vraag toe. Die filter gebeurt dan in de browser, en dat kan: privénotities
 * zijn de verslagen van een overleg, een handvol per maand.
 *
 * Geen `orderBy` in de vragen: gelijkheid plus `array-contains` bedient
 * Firestore uit zijn eigen veldindexen, met een sortering erbij zou elke vraag
 * een samengestelde index vragen. Sorteren doet `voegSamen`.
 */
export function useNotities({ uid, koppeling = null, aan = true } = {}) {
  const [open, setOpen] = useState([])
  const [prive, setPrive] = useState([])
  const [laadt, setLaadt] = useState(true)
  const sleutel = koppeling ? koppelsleutel(koppeling) : null

  useEffect(() => {
    if (!aan || (koppeling && !sleutel)) {
      setOpen([])
      setLaadt(false)
      return undefined
    }
    setLaadt(true)
    const clauses = [where('prive', '==', false)]
    if (sleutel) clauses.push(where('koppelsleutels', 'array-contains', sleutel))
    return onSnapshot(
      query(col(COL.notities), ...clauses),
      (snap) => {
        setOpen(fromQuery(snap))
        setLaadt(false)
      },
      () => {
        setOpen([])
        setLaadt(false)
      }
    )
    // `koppeling` zelf is elke render een nieuw object; de sleutel is wat telt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel, aan])

  useEffect(() => {
    if (!aan || !uid) {
      setPrive([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.notities), where('viewerIds', 'array-contains', uid)),
      (snap) => setPrive(fromQuery(snap)),
      () => setPrive([])
    )
  }, [uid, aan])

  const notities = useMemo(
    () => voegSamen(open, sleutel ? prive.filter((n) => raakt(n, koppeling)) : prive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, prive, sleutel]
  )

  return { notities, laadt }
}

/**
 * Een nieuwe notitie. Altijd open: een privénotitie maakt alleen de functie
 * die een overleg samenvat, want "wie mag dit lezen" is daar beleid
 * (`config/access.meetingViewers`) en geen keuze per notitie.
 */
export async function maakNotitie({ titel, tekst, datum, koppelingen = [], auteur }) {
  const notitieRef = newRef(COL.notities)
  await setDoc(notitieRef, {
    soort: 'notitie',
    titel: (titel ?? '').trim(),
    tekst: (tekst ?? '').trim(),
    datum,
    ...zetKoppelingen(koppelingen),
    prive: false,
    viewerIds: [],
    auteurId: auteur?.id ?? null,
    auteurNaam: auteur?.fullName || auteur?.email || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return notitieRef.id
}

/** Titel, tekst of datum van een notitie wijzigen. */
export function wijzigNotitie(id, { titel, tekst, datum }, uid = null) {
  return updateDoc(ref(COL.notities, id), {
    titel: (titel ?? '').trim(),
    tekst: (tekst ?? '').trim(),
    datum,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

/**
 * Alleen de koppelingen. Apart, omdat dit ook op een verslag van een overleg
 * mag — wie het verslag lezen mag, mag zeggen over welk event het ging — en de
 * regels daar niets anders toelaten dan deze velden.
 */
export function zetNotitieKoppelingen(id, koppelingen, uid = null) {
  return updateDoc(ref(COL.notities, id), {
    ...zetKoppelingen(koppelingen),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export const verwijderNotitie = (id) => deleteDoc(ref(COL.notities, id))
