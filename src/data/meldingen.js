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

/** Wat er in het scherm staat: de naam van elk bericht en wanneer het komt. */
export const SOORT_UITLEG = [
  {
    key: 'toewijzing',
    titel: 'Een taak komt op jouw naam',
    uitleg: 'Zodra iemand je aan een taak toevoegt. Niet wanneer je dat zelf doet.',
  },
  {
    key: 'reactie',
    titel: 'Iemand reageert op je taak',
    uitleg: 'Op taken die op jouw naam staan en op taken waar je zelf op reageerde.',
  },
  {
    key: 'deadline',
    titel: 'Een deadline van morgen',
    uitleg: "Elke ochtend om zeven uur, alleen als er morgen iets van jou vervalt.",
  },
  {
    key: 'telaat',
    titel: 'Ochtendlijst van wat te laat staat',
    uitleg: 'Om half acht, en alleen op de dagen dat er iets op jouw naam over tijd staat.',
  },
]

export const KANALEN = [
  { key: 'push', label: 'Melding' },
  { key: 'email', label: 'E-mail' },
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
