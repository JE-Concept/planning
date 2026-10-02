import { useEffect, useState } from 'react'
import { signInWithCustomToken } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth } from '@lib/firebase'

/**
 * Aanmelden met een cijfercode.
 *
 * Alles wat telt gebeurt op de server (`functions/ploeg.js`); hier staat
 * alleen het heen en weer. Wat terugkomt is een `custom token`, en daarmee
 * meldt Firebase Auth de persoon aan als een gewone gebruiker — de rest van de
 * tool merkt geen verschil tussen een code-aanmelding en Google.
 */
const functions = getFunctions(app, 'europe-west1')

/** De namen om uit te kiezen. Zonder aanmelding, want dat is het punt. */
export function usePloegLijst(actief = true) {
  const [mensen, setMensen] = useState([])
  const [laadt, setLaadt] = useState(actief)
  const [fout, setFout] = useState(null)

  useEffect(() => {
    if (!actief) return undefined
    let levend = true
    setLaadt(true)
    httpsCallable(functions, 'ploegLijst')()
      .then(({ data }) => {
        if (!levend) return
        setMensen(data?.mensen ?? [])
        setFout(null)
      })
      .catch((err) => levend && setFout(err))
      .finally(() => levend && setLaadt(false))
    return () => {
      levend = false
    }
  }, [actief])

  return { mensen, laadt, fout }
}

/**
 * Aanmelden, en bij de eerste keer meteen de code zetten.
 *
 * Of dit de eerste keer is, beslist de server. Zou het scherm dat doen, dan
 * kon iemand "eerste keer" spelen op andermans naam en zo zijn code
 * overschrijven.
 */
export async function meldAanMetCode({ medewerkerId, code }) {
  const { data } = await httpsCallable(functions, 'ploegAanmelden')({ medewerkerId, code })
  await signInWithCustomToken(auth, data.token)
  return { nieuw: Boolean(data.nieuw) }
}

/** Je eigen code wijzigen. */
export async function wijzigEigenCode(code) {
  await httpsCallable(functions, 'ploegCodeWijzigen')({ code })
}

/** De code van iemand opzoeken. Wie kijkt, laat een spoor na — zie de functie. */
export async function leesPloegcode(medewerkerId) {
  const { data } = await httpsCallable(functions, 'ploegCodeLezen')({ medewerkerId })
  return data?.code ?? null
}
