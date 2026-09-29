import { useEffect, useState } from 'react'

/**
 * Staat er een nieuwe versie van JE Plan op de server?
 *
 * Dit bestaat om een wit scherm te vermijden dat echt gebeurd is. De pagina's
 * worden per stuk geladen, met een naam waar de inhoud in verwerkt zit. Rolt er
 * een nieuwe versie uit, dan verdwijnen de oude namen — en een tabblad dat al
 * dagen openstaat vraagt precies die op zodra iemand op een ander menu-item
 * klikt. Er is dan niets aan de hand met de app: het tabblad is alleen oud.
 *
 * Zeggen is beter dan opvangen. De vangnetten blijven staan voor wat er
 * doorheen glipt, maar wie het zelf te horen krijgt, herlaadt op zijn eigen
 * moment in plaats van halverwege een lijst afvinken.
 *
 * Er wordt gekeken wanneer het tabblad weer op de voorgrond komt en verder elk
 * kwartier — vaker heeft geen zin, want we rollen niet vaker uit dan dat.
 */
const INTERVAL_MS = 15 * 60 * 1000

export function useNieuweVersie() {
  const [nieuw, setNieuw] = useState(false)

  useEffect(() => {
    if (nieuw) return undefined

    let gestopt = false

    const kijk = async () => {
      if (gestopt || document.visibilityState === 'hidden') return
      try {
        const antwoord = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
        if (!antwoord.ok) return
        const { build } = await antwoord.json()
        // Geen nummer op de server betekent niets nieuws, geen alarm.
        if (build && build !== __BUILD_ID__) setNieuw(true)
      } catch {
        // Offline is geen nieuwe versie. Stil laten.
      }
    }

    const klok = setInterval(kijk, INTERVAL_MS)
    document.addEventListener('visibilitychange', kijk)

    return () => {
      gestopt = true
      clearInterval(klok)
      document.removeEventListener('visibilitychange', kijk)
    }
  }, [nieuw])

  return nieuw
}
