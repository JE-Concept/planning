import { tekst } from './i18n'

const euro = new Intl.NumberFormat('nl-BE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const decimal = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 })

/**
 * Wat niet als getal te lezen is, krijgt een streepje en geen "€ NaN".
 *
 * Een bedrag dat met een komma getypt is ("12,50") wordt door `Number` NaN, en
 * `Intl` schrijft dat uit als "€ NaN". Dat staat dan op een klantenfiche of in
 * een urenrapport alsof het een bedrag is. Een streepje zegt eerlijk dat er
 * niets bekend is, en dat stond er voor een leeg veld al.
 */
function alsGetal(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function formatCurrency(value) {
  const n = alsGetal(value)
  return n === null ? '—' : euro.format(n)
}

export function formatNumber(value) {
  const n = alsGetal(value)
  return n === null ? '—' : decimal.format(n)
}

/** 9045 → "2u 30m". Always the shape a timesheet wants, never "2.51 hours". */
export function formatDuration(seconds, { withSeconds = false } = {}) {
  // Een onleesbaar aantal seconden gaf hier een leeg vakje: geen tijd, geen
  // nul, niets. In een urenlijst leest dat als "niet geboekt" in plaats van
  // "onbekend". Nul is het eerlijke antwoord en het valt wél op.
  const n = Number(seconds ?? 0)
  const total = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (withSeconds) {
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
  }
  // De letter achter het uur volgt de taal: "5u 45m" leest in het Engels als
  // niets, en dit staat op elk scherm waar tijd geboekt wordt.
  const uur = tekst('alg.uur_kort')
  const min = tekst('alg.minuut_kort')
  if (h === 0 && m === 0) return `0${min}`
  return [h > 0 ? `${h}${uur}` : null, m > 0 ? `${m}${min}` : null].filter(Boolean).join(' ')
}

/** Decimal hours for invoicing: 9045 → 2.51 */
export function toDecimalHours(seconds) {
  const n = Number(seconds ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.round((n / 3600) * 100) / 100
}

export function initials(name, email) {
  const source = (name || email || '?').trim()
  const parts = source.split(/[\s.@_-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/*
  De kleur ligt vast, de naam hangt aan de taal.

  Daarom is `label` een getter en geen waarde: de lijst wordt één keer gemaakt
  en op tien plekken uitgelezen, en een vaste tekst zou na een taalwissel de
  oude blijven tonen tot de pagina herladen wordt.
*/
export const PRIORITIES = [1, 2, 3, 4].map((value) => ({
  value,
  color: { 1: '#dc2626', 2: '#f59e0b', 3: '#3377ff', 4: '#8593a9' }[value],
  get label() {
    return tekst(`prio.${value}`)
  },
}))

export function priorityOf(value) {
  return PRIORITIES.find((p) => p.value === value) ?? null
}

/** Readable text colour for an arbitrary background — WCAG relative luminance. */
export function contrastColor(hex) {
  const clean = (hex || '').replace('#', '')
  // Zes tekens is niet hetzelfde als zes hexcijfers: "rommel" haalde de vorige
  // controle en gaf daarna witte letters, want NaN is nooit groter dan 0,45.
  // Wit op een lichte achtergrond is onleesbaar; donker is de veilige gok.
  if (!/^[0-9a-f]{6}$/i.test(clean)) return '#161a22'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255)
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.45 ? '#161a22' : '#ffffff'
}
