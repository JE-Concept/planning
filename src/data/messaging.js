import { useEffect, useState } from 'react'
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { COL, col, fromQuery } from '@lib/collections'
import { app } from '@lib/firebase'

/**
 * De log van messaging, voor het tabblad Instellingen → Messaging.
 *
 * Alleen lezen: de rijen komen van de functie `messaging` en de stand per
 * verwerker van de triggers; de browser mag er niets aan veranderen
 * (`firestore.rules`). Herspelen gaat daarom via een callable, die zelf
 * nakijkt of je beheerder bent en dan de verwerker opnieuw laat lopen.
 */

/** De verwerkers die er zijn, in de volgorde van het scherm. Zelfde lijst als `functions/messaging-stand.js`. */
export const VERWERKERS = ['event']

export function useMessaging({ hoeveel = 100 } = {}) {
  const [berichten, setBerichten] = useState([])
  const [laadt, setLaadt] = useState(true)
  const [fout, setFout] = useState(null)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.messaging), orderBy('ontvangen', 'desc'), limit(hoeveel)),
        (snap) => {
          setBerichten(fromQuery(snap))
          setLaadt(false)
        },
        (err) => {
          setFout(err)
          setLaadt(false)
        }
      ),
    [hoeveel]
  )

  return { berichten, laadt, fout }
}

/** Eén verwerker opnieuw laten lopen op één bericht. Alleen voor beheerders; de functie weigert de rest. */
export async function herspelen(id, verwerker = 'event') {
  const aanroep = httpsCallable(getFunctions(app, 'europe-west1'), 'messagingHerspelen')
  const { data } = await aanroep({ id, verwerker })
  return data
}

/** De stand van een bericht voor één verwerker, met een vaste vorm voor het scherm. */
export function standVan(bericht, verwerker) {
  const s = bericht?.verwerking?.[verwerker]
  if (!s) return { stand: 'wacht' }
  return s
}
