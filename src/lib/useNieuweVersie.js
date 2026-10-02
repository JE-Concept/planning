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
 * ── Wanneer er gekeken wordt ─────────────────────────────────────────────
 * Meteen bij het openen, telkens als het tabblad weer op de voorgrond komt,
 * zodra er weer verbinding is, en verder elke vijf minuten. Het stond op een
 * kwartier en begon pas na dat kwartier — een tabblad dat tien minuten open
 * stond tijdens een uitrol wist dus van niets, en dat is precies het tabblad
 * waar het misgaat. Eén klein bestandje per vijf minuten voor een handvol
 * mensen kost niets.
 *
 * ── En de service worker zegt het ook ────────────────────────────────────
 * Die neemt het bij een uitrol meteen over (`skipWaiting` + `clients.claim`,
 * zie public/sw.js). Op dat moment staat er zeker iets nieuws, en weet de
 * browser dat eerder dan onze klok. `controllerchange` is dus het snelste en
 * zekerste signaal dat er is — en het werkt ook wanneer `version.json` om wat
 * voor reden dan ook niet te lezen valt.
 */
const INTERVAL_MS = 5 * 60 * 1000

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

    /*
      Een nieuwe service worker die het overneemt, betekent een nieuwe uitrol.

      Niet bij de állereerste: dan neemt de worker het over omdat hij er nog
      niet was, en niet omdat er iets veranderd is. Die zou iedereen bij zijn
      eerste bezoek een herlaadmelding geven.
    */
    const alEenWorker = Boolean(navigator.serviceWorker?.controller)
    const opWisseling = () => {
      if (alEenWorker) setNieuw(true)
    }

    kijk()
    const klok = setInterval(kijk, INTERVAL_MS)
    document.addEventListener('visibilitychange', kijk)
    window.addEventListener('online', kijk)
    navigator.serviceWorker?.addEventListener('controllerchange', opWisseling)

    return () => {
      gestopt = true
      clearInterval(klok)
      document.removeEventListener('visibilitychange', kijk)
      window.removeEventListener('online', kijk)
      navigator.serviceWorker?.removeEventListener('controllerchange', opWisseling)
    }
  }, [nieuw])

  return nieuw
}
