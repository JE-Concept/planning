import { useEffect, useState } from 'react'
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { COL, col, fromQuery, ref } from '@lib/collections'
import { oordeel } from '@lib/systeem'

/**
 * Of de tool nog doet wat ze hoort te doen.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * De ophaler van de post schreef elke vijf minuten bij waar ze gebleven was,
 * en niemand las dat. Mislukte mails belandden in `mailQueue` met de reden
 * erbij, en geen enkel scherm toonde het. Loopt een app-wachtwoord af, dan
 * stopt de post in stilte en is het eerste signaal een klant die vraagt
 * waarom niemand antwoordt.
 *
 * Een tool die zwijgt als ze stuk is, is erger dan een tool die niets doet:
 * bij de eerste vertrouw je haar nog.
 *
 * Het oordeel zelf staat in `@lib/systeem`, zodat het na te rekenen is zonder
 * browser en zonder database. Hier staat alleen waar de gegevens vandaan komen.
 */

export function useSysteem() {
  const [postvak, setPostvak] = useState(null)
  const [mislukt, setMislukt] = useState([])
  const [laadt, setLaadt] = useState(true)

  useEffect(() => {
    return onSnapshot(
      ref(COL.instellingen, 'postvak'),
      (snap) => {
        setPostvak(snap.exists() ? snap.data() : null)
        setLaadt(false)
      },
      // Geen recht of geen document is hetzelfde antwoord voor het scherm:
      // we weten het niet. Dat is iets anders dan "het is stil".
      () => setLaadt(false)
    )
  }, [])

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.mailQueue), where('status', '==', 'mislukt'), orderBy('createdAt', 'desc'), limit(20)),
        (snap) => setMislukt(fromQuery(snap)),
        () => setMislukt([])
      ),
    []
  )

  return { postvak, mislukt, laadt, ...oordeel({ postvak, mislukt }) }
}
