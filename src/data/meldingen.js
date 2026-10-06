import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@lib/firebase'
import { SOORTEN, STANDAARD, voorkeurenVan } from '../../functions/notify.js'

/**
 * Wat je wel en niet wil horen, per persoon.
 *
 * De voorkeuren staan op je eigen profiel, onder `prefs.meldingen`. Dat is geen
 * toevallige plek: de beveiligingsregels laten je je eigen `prefs` bewerken en
 * je rol of je toegang niet, dus dit scherm heeft geen enkele nieuwe deur nodig.
 * De Cloud Functions lezen datzelfde veld met beheerdersrechten wanneer ze
 * moeten beslissen of er iets vertrekt.
 *
 * De soorten en de standaardwaarden komen uit `functions/notify.js` en worden
 * hier niet overgeschreven. Wie een bericht krijgt, wordt op de server beslist;
 * stond de lijst hier een tweede keer, dan zou dit scherm na een wijziging
 * vakjes tonen waar de server niets mee doet — en dat ziet niemand, want het
 * bericht dat uitblijft merk je pas weken later.
 */

export { SOORTEN, STANDAARD, voorkeurenVan }

/**
 * Wat er in het scherm staat: de naam van elk bericht en wanneer het komt.
 *
 * Hier staan sleutels en geen zinnen, want dit scherm bestaat in twee talen. De
 * teksten zelf staan in `src/lib/taal/team.js`; de volgorde en de `key` blijven
 * hier, want die horen bij wat de server verstuurt en niet bij een taal.
 */
export const SOORT_UITLEG = [
  { key: 'toewijzing', titel: 'melding.toewijzing_titel', uitleg: 'melding.toewijzing_uitleg' },
  { key: 'reactie', titel: 'melding.reactie_titel', uitleg: 'melding.reactie_uitleg' },
  { key: 'deadline', titel: 'melding.deadline_titel', uitleg: 'melding.deadline_uitleg' },
  { key: 'telaat', titel: 'melding.telaat_titel', uitleg: 'melding.telaat_uitleg' },
  { key: 'verhuur', titel: 'melding.verhuur_titel', uitleg: 'melding.verhuur_uitleg' },
  { key: 'messaging', titel: 'melding.messaging_titel', uitleg: 'melding.messaging_uitleg' },
]

export const KANALEN = [
  { key: 'push', label: 'melding.kanaal_push' },
  { key: 'email', label: 'melding.kanaal_email' },
]

/**
 * Eén vakje omzetten.
 *
 * Met een samenvoegende schrijving en niet met een puntpad: `merge` voegt in
 * Firestore diep samen, dus het andere kanaal van deze soort, de andere soorten
 * en wat er verder ooit in `prefs` komt te staan blijven allemaal staan. Een
 * scherm dat de instellingen van een ander scherm wist, is een fout die niemand
 * terugvindt — je merkt hem pas aan het bericht dat uitbleef.
 */
export function zetVoorkeur(uid, soort, kanaal, aan) {
  if (!uid || !SOORTEN.includes(soort)) return Promise.resolve()
  return setDoc(
    doc(db, 'profiles', uid),
    {
      prefs: { meldingen: { [soort]: { [kanaal]: Boolean(aan) } } },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}
