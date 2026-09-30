import { useCallback, useEffect, useMemo, useState } from 'react'
import { STANDAARDTAAL, geldigeTaal, localeVan, vertaal, zetHuidigeTaal } from '@lib/i18n'
import { TaalContext, useTaal } from './taal-context'
import { zetLocale } from '@lib/dates'
import { useAuth } from '@context/AuthProvider'
import { zetTaal as bewaarTaal } from '@data/taal'

/**
 * Welke taal iemand ziet.
 *
 * De keuze staat op het profiel, niet in deze browser. Wie op de tablet in de
 * keuken in het Engels werkt, wil dat ook op zijn telefoon — en een keuze die
 * per toestel opnieuw gemaakt moet worden, wordt niet gemaakt.
 *
 * Wie nooit koos, krijgt Nederlands — de taal van de zaak. De taal van de
 * browser wordt niet overgenomen; waarom niet staat in `@lib/i18n`.
 *
 * Er staat een kopie in `localStorage` omdat het aanmeldscherm nog geen profiel
 * heeft. Zonder dat zou de app eerst in de ene taal openen en na het aanmelden
 * in de andere — en dat ziet er kapot uit, ook al is het dat niet.
 */

const BEWAARD = 'je-plan:taal'

function uitOpslag() {
  try {
    return localStorage.getItem(BEWAARD)
  } catch {
    return null
  }
}

export function TaalProvider({ children }) {
  const { profile, uid } = useAuth()
  const [gekozen, setGekozen] = useState(() => geldigeTaal(uitOpslag() ?? STANDAARDTAAL))

  // Het profiel wint zodra het er is: dat is de keuze die de persoon ergens
  // gemaakt heeft, en deze browser weet daar niets van.
  const taal = geldigeTaal(profile?.prefs?.taal ?? gekozen ?? STANDAARDTAAL)

  useEffect(() => {
    try {
      localStorage.setItem(BEWAARD, taal)
    } catch {
      /* Zonder opslag werkt alles, het opent alleen één keer in de verkeerde taal. */
    }
    // De datums, getallen en bedragen moeten meegaan; anders leest een Engelse
    // pagina "1 oktober" en dat is geen halve vertaling maar een fout.
    zetLocale(localeVan(taal))
    // En dezelfde afspraak voor de gewone functies die geen hook kunnen
    // gebruiken — zie `zetHuidigeTaal` in `@lib/i18n`.
    zetHuidigeTaal(taal)
    if (typeof document !== 'undefined') document.documentElement.lang = taal
  }, [taal])

  const kies = useCallback(
    async (nieuw) => {
      const veilig = geldigeTaal(nieuw)
      setGekozen(veilig)
      if (uid) await bewaarTaal(uid, veilig).catch(() => {})
    },
    [uid]
  )

  const waarde = useMemo(
    () => ({
      taal,
      locale: localeVan(taal),
      kies,
      t: (sleutel, waarden) => vertaal(taal, sleutel, waarden),
    }),
    [taal, kies]
  )

  return <TaalContext.Provider value={waarde}>{children}</TaalContext.Provider>
}

/*
  `useTaal` staat in `taal-context.js` en wordt hier doorgegeven, zodat de
  tientallen componenten die hem al importeren niets hoeven te veranderen.
  Waarom die splitsing er is, staat daar.
*/
export { useTaal }
