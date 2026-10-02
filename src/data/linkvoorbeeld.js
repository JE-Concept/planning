import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@lib/firebase'

/**
 * Het voorbeeldkaartje bij een link.
 *
 * ── Waarom er hier nog eens een cache zit ─────────────────────────────────
 * De functie bewaart haar antwoord al in Firestore, maar dat scheelt alleen
 * het ophalen van de vreemde site — elke notitie zou nog altijd zijn eigen
 * aanroep doen. Een draad met tien keer dezelfde link is dan tien aanroepen
 * naar onze eigen server, en die rekent per keer.
 *
 * De cache leeft zolang het tabblad openstaat. Langer hoeft niet: een
 * voorbeeldkaartje is geen gegeven dat iemand mist wanneer het na een herlaadt
 * opnieuw opgehaald wordt.
 *
 * De belofte zelf wordt bewaard en niet pas het antwoord. Anders vragen drie
 * notities die tegelijk verschijnen alle drie hetzelfde op, want geen van
 * drieën is dan al klaar.
 */
const functions = getFunctions(app, 'europe-west1')
const cache = new Map()

export function haalLinkVoorbeeld(url) {
  if (!url) return Promise.resolve(null)
  if (!cache.has(url)) {
    const aanroep = httpsCallable(functions, 'linkVoorbeeld')
    cache.set(
      url,
      aanroep({ url })
        .then(({ data }) => data ?? null)
        // Een kaartje dat niet komt, is geen storing: dan staat er gewoon een
        // link. Daarom geen `toast` en geen opnieuw proberen.
        .catch(() => null)
    )
  }
  return cache.get(url)
}

export function useLinkVoorbeeld(url) {
  const [kaartje, setKaartje] = useState(null)

  useEffect(() => {
    let levend = true
    setKaartje(null)
    if (!url) return undefined
    haalLinkVoorbeeld(url).then((uit) => {
      if (levend) setKaartje(uit)
    })
    return () => {
      levend = false
    }
  }, [url])

  return kaartje
}
