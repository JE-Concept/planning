import { BTW_VERHUUR } from '@lib/huurprijs'

/**
 * Hoe bedragen en namen op het scherm komen.
 *
 * ── Waarom de site prijzen met btw toont ──────────────────────────────────
 * Beslissing van Jasper (conceptvoorstel verhuursite, 7 okt): de site is voor
 * particulieren én bedrijven, en een particulier rekent met wat hij betaalt.
 * De prijzen in de catalogus staan zonder btw, want zo rekent de motor en zo
 * rekent de server. Hier komt er alleen voor het scherm 21% bij; wat er
 * afgerekend wordt, rekent de server zelf opnieuw uit (`huurTotaal`).
 */
export const euro = (n) => `€ ${Number(n ?? 0).toFixed(2).replace('.', ',')}`

/** Een bedrag zonder btw, zoals een klant het betaalt. Op de cent afgerond. */
export const metBtw = (n) => Math.round(Number(n ?? 0) * (100 + BTW_VERHUUR)) / 100

/** "Koeling & bar" → "koeling-bar": een categorie als stuk van een adres. */
export const slug = (tekst) =>
  String(tekst ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** "2027-03-16" → "di 16 mrt". Zonder jaar: wie huurt, weet welk jaar het is. */
export function korteDag(sleutel) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sleutel ?? '')) return ''
  return new Date(`${sleutel}T12:00:00`).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
}
