import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { offlineBericht, syncboek } from '@lib/offline'
import { useTaal } from '@context/TaalProvider'

/**
 * Of er verbinding is, en hoeveel werk er nog op dit toestel staat.
 *
 * Twee bronnen, want ze zeggen iets anders. `navigator.onLine` weet of het
 * toestel een netwerk ziet — niet meer dan dat; een wifi zonder internet telt
 * als online. Het syncboek weet wat Firestore nog niet kwijt is, en dat is het
 * enige dat écht telt voor wie staat af te vinken.
 *
 * Vandaar dat allebei getoond wordt: "geen verbinding" is de verwachting die je
 * moet bijstellen, "er staat nog wat open" is het feit.
 */
const OfflineContext = createContext(null)

export function OfflineProvider({ children }) {
  // De balk zegt het in de taal van wie kijkt; wie in de koelcel afvinkt leest
  // hem misschien in het Engels, en juist daar moet de boodschap aankomen.
  const { t } = useTaal()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  const [{ wachtend, uitCache }, setStand] = useState(() => syncboek.stand())

  useEffect(() => {
    const aan = () => setOnline(true)
    const uit = () => setOnline(false)
    window.addEventListener('online', aan)
    window.addEventListener('offline', uit)
    // De gebeurtenissen kunnen gemist zijn terwijl dit component nog niet
    // stond; bij het aanhaken één keer de werkelijke stand overnemen.
    setOnline(navigator.onLine !== false)
    return () => {
      window.removeEventListener('online', aan)
      window.removeEventListener('offline', uit)
    }
  }, [])

  useEffect(() => {
    setStand(syncboek.stand())
    return syncboek.abonneer(setStand)
  }, [])

  const waarde = useMemo(
    () => ({ online, wachtend, uitCache, bericht: offlineBericht({ online, wachtend, t }) }),
    [online, wachtend, uitCache, t]
  )

  return <OfflineContext.Provider value={waarde}>{children}</OfflineContext.Provider>
}

/**
 * Buiten de provider valt dit terug op "alles in orde".
 *
 * Een scherm dat los getest wordt of buiten de schil hangt, mag niet crashen op
 * een mededeling; zwijgen is daar het juiste gedrag.
 */
export function useOffline() {
  return useContext(OfflineContext) ?? { online: true, wachtend: 0, uitCache: false, bericht: null }
}
