import { createContext, useContext } from 'react'
import { STANDAARDTAAL, localeVan, vertaal } from '@lib/i18n'

/**
 * De taalcontext, los van de provider die hem vult.
 *
 * ── Waarom dit apart staat ────────────────────────────────────────────────
 * `TaalProvider` bewaart de keuze op het profiel en sleept dus Firestore mee.
 * Dat is prima in de app, maar niet op de klantenpagina's: die worden geopend
 * door mensen die de tool nooit zullen gebruiken, vaak op een telefoon, vaak
 * één keer — en een halve megabyte database-SDK inladen om een offerte te
 * lezen, is dat niet waard.
 *
 * Componenten die alleen willen weten in welke taal ze moeten tekenen,
 * importeren daarom hier. Wie de keuze ook wil kúnnen wijzigen, heeft de
 * provider nodig.
 */
export const TaalContext = createContext(null)

/**
 * `const { t } = useTaal()` en dan `t('nav.tasks')`.
 *
 * Buiten de provider valt hij terug op het Nederlands in plaats van te
 * crashen: dit wordt in tientallen componenten gebruikt, en een scherm dat
 * omvalt omdat het toevallig buiten de boom staat, is erger dan een scherm in
 * de brontaal. Op de klantenpagina's is dat geen noodgeval maar de bedoeling.
 */
export function useTaal() {
  return (
    useContext(TaalContext) ?? {
      taal: STANDAARDTAAL,
      locale: localeVan(STANDAARDTAAL),
      kies: async () => {},
      t: (sleutel, waarden) => vertaal(STANDAARDTAAL, sleutel, waarden),
    }
  )
}
