import { useEffect, useState } from 'react'

/** Onder 1000px wordt de schil een app: balk bovenaan, navigatie onderaan. */
export const NARROW_QUERY = '(max-width: 999px)'

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
