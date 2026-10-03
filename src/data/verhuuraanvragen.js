import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { COL, col, fromQuery, ref } from '@lib/collections'

/**
 * Offerteaanvragen die van de verhuursite binnenkomen.
 *
 * ── Waarom ze niet meteen een event worden ───────────────────────────────
 * Omdat de meeste aanvragen een telefoontje worden en een deel niets. Zou elke
 * aanvraag meteen op het bord staan, dan staat dat bord binnen een maand vol
 * met dingen die nooit doorgaan — en een bord dat je moet wegfilteren om te
 * zien wat er echt speelt, gebruikt niemand meer. Ze staan dus in het postvak,
 * naast de losse mail, waar hetzelfde werk gebeurt: bellen, en er een dossier
 * van maken als het doorgaat.
 *
 * Aanmaken gebeurt door `functions/verhuur.js`; de browser mag hier alleen
 * lezen en de stand bijwerken — zie `firestore.rules`.
 */

/** De open aanvragen, nieuwste eerst. */
export function useVerhuuraanvragen() {
  const [aanvragen, setAanvragen] = useState([])
  const [laadt, setLaadt] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.verhuuraanvragen), where('status', '==', 'nieuw'), orderBy('createdAt', 'desc')),
        (snap) => {
          setAanvragen(fromQuery(snap))
          setLaadt(false)
        },
        () => setLaadt(false)
      ),
    []
  )

  return { aanvragen, laadt }
}

/**
 * Afgehandeld, en waarom.
 *
 * `afgehandeld` en niet verwijderen: wie zich afvraagt of er die week iets
 * binnenkwam, hoort dat te kunnen nakijken. En wat er met een aanvraag
 * gebeurde — gebeld, offerte verstuurd, niet doorgegaan — is precies het
 * soort ding dat je een half jaar later nog eens wil opzoeken.
 */
export const handelAf = (id, { eventId = null } = {}) =>
  updateDoc(ref(COL.verhuuraanvragen, id), {
    status: 'afgehandeld',
    eventId,
    updatedAt: serverTimestamp(),
  })
