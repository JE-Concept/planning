/**
 * Start van de demobuild: vult de in-memory database.
 */
import './seed.js'
import { doc, updateDoc } from './firestore.js'

/**
 * `?rol=personeel` laat de demo zien wat zaalpersoneel te zien krijgt: één
 * scherm, geen borden, geen instellingen. In de echte tool komt die rol uit
 * het profiel; hier is het een schakelaar, zodat beide kanten te bekijken zijn
 * zonder twee accounts.
 */
const rol = new URLSearchParams(location.search).get('rol')
if (rol === 'personeel' || rol === 'staff') {
  // Geen await: de in-memory schrijver heeft geen asynchrone body, dus dit is
  // rond voor main.jsx verder gaat — en top-level await mag hier niet.
  updateDoc(doc(null, 'profiles', 'u-jasper'), { role: 'staff', fullName: 'Lotte Vrijsen' })
}

/**
 * `?rol=social` toont wat een socialmedewerker ziet: de socials, en verder
 * niets — geen bedragen, geen offertes, geen klantenfiches.
 *
 * In de echte tool komt dat verschil uit de beveiligingsregels: haar rol mag de
 * events niet lezen en werkt met een kale kopie zonder bedragen. Deze demo
 * heeft geen regels, dus hier doet de schakelaar alsof. Wat de browsertest
 * hiermee nakijkt is dus of het scherm klopt; dat de gegevens echt afgeschermd
 * zijn, staat in `firestore.rules` en in de trigger die de kopie bijhoudt.
 */
if (rol === 'social') {
  updateDoc(doc(null, 'profiles', 'u-jasper'), { role: 'social', fullName: 'Charish Nolmans' })
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
