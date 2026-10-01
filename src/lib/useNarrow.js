import { useEffect, useState } from 'react'
import { onder } from './schermmaat'

/**
 * Onder 1000px wordt de schil een app: balk bovenaan, navigatie onderaan.
 *
 * Het getal staat hier niet meer: het komt uit `schermmaat.js`, samen met de
 * drie andere breekpunten en met wat de stylesheets gebruiken. Dat 999 hier en
 * 1080 in de CSS stond, was precies hoe de zijkolom op een andere breedte
 * wegsprong dan het rooster.
 */
export const NARROW_QUERY = onder('schil')

export function useNarrow() {
  const get = () => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches
  const [narrow, setNarrow] = useState(get)

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return narrow
}
