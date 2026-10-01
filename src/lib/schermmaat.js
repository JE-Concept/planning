/**
 * De breekpunten, op één plek.
 *
 * Ze stonden met acht verschillende waarden in de stylesheets — 560, 640, 720,
 * 860, 900, 1080, 1100 — terwijl `useNarrow` op 999 stond. Dat waren geen
 * zeven beslissingen maar vier, een paar keer net anders opgeschreven, en
 * daardoor sprong de zijkolom op een andere breedte weg dan het rooster.
 *
 * Deze vier zijn de echte. Ze staan ook in `je-ds.css` als `--bp-*`, want een
 * media query kan geen CSS-variabele lezen; hier staan ze voor JavaScript. Wie
 * er een verandert, verandert ze op allebei de plekken — daar staat een test op.
 */
export const BREEKPUNTEN = {
  /** Eén kolom, alles onder elkaar. */
  telefoon: 560,
  /** Twee kolommen; de zijkolom valt weg. */
  tablet: 860,
  /** Onder deze maat wordt de schil een app: balk bovenaan, navigatie onderaan. */
  schil: 1000,
  /** De brede kolom past volledig. */
  breed: 1240,
}

/** De media query die bij een breekpunt hoort: alles eronder. */
export const onder = (naam) => `(max-width: ${BREEKPUNTEN[naam] - 1}px)`
