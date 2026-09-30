/**
 * Start van de demobuild: vult de in-memory database.
 */
import './seed.js'
import { doc, updateDoc } from './firestore.js'

/**
 * `?rol=…` zet de demo op een andere rol.
 *
 * In de echte tool komt de rol uit het profiel; hier is het een schakelaar,
 * zodat elke kant te bekijken is zonder even zoveel accounts. Elke rol uit
 * `firestore.rules` staat erin, ook `guest` — juist die, want een rol die
 * niemand ooit bekeken heeft is een rol waarvan niemand weet wat ze doet.
 *
 * Sinds `demo/regels.js` weigert de demo ook wat de regels weigeren, dus deze
 * schakelaar doet niet langer alleen alsof: hij laat zien wat een rol werkelijk
 * te zien krijgt, en waar het scherm meer vraagt dan ze mag.
 */
const ROLLEN = {
  personeel: { role: 'staff', fullName: 'Lotte Vrijsen' },
  staff: { role: 'staff', fullName: 'Lotte Vrijsen' },
  social: { role: 'social', fullName: 'Charish Nolmans' },
  member: { role: 'member', fullName: 'Sam Beckers' },
  team: { role: 'member', fullName: 'Sam Beckers' },
  admin: { role: 'admin', fullName: 'Elke Motmans' },
  guest: { role: 'guest', fullName: 'Gast Gebruiker' },
  gast: { role: 'guest', fullName: 'Gast Gebruiker' },
}

const rol = new URLSearchParams(location.search).get('rol')
if (rol && ROLLEN[rol]) {
  // Geen await: de in-memory schrijver heeft geen asynchrone body, dus dit is
  // rond voor main.jsx verder gaat — en top-level await mag hier niet.
  updateDoc(doc(null, 'profiles', 'u-jasper'), ROLLEN[rol])
}

console.info('JE Plan — demomodus: gegevens staan in het geheugen, niets wordt bewaard.')

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
