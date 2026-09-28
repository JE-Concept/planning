/**
 * Start van de demobuild: vult de in-memory database.
 */
import './seed.js'

console.info('JE Planning — demomodus: gegevens staan in het geheugen, niets wordt bewaard.')

// Eerlijk zichtbaar maken dat dit voorbeeldgegevens zijn.
addEventListener('DOMContentLoaded', () => {
  const badge = document.createElement('div')
  badge.textContent = 'Demo — voorbeeldgegevens, niets wordt bewaard'
  badge.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:12px', 'transform:translateX(-50%)',
    'z-index:90', 'background:#C9A84C', 'color:#3A2C08', 'font:700 11px/1 Nunito,sans-serif',
    'letter-spacing:.04em', 'padding:6px 12px', 'border-radius:999px',
    'box-shadow:0 6px 24px rgba(11,22,38,.18)', 'pointer-events:none',
  ].join(';')
  document.body.appendChild(badge)
})
