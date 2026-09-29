import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, projectId } from '@lib/firebase'

/**
 * Het agenda-abonnement van één persoon.
 *
 * "Kalenderfeed" en niet "agenda", want de agenda in deze app is die van het
 * teamoverleg (`data/agenda.js`). Dit gaat over de eventdatums in je eigen
 * Google Calendar of Apple Agenda.
 *
 * Eén document per persoon, met het profiel-id als naam. Dat is met opzet: zo
 * kan er maar één sleutel tegelijk bestaan, en maakt een nieuwe sleutel de oude
 * onmiddellijk ongeldig. Wie zijn adres per ongeluk doorstuurde, haalt er met
 * één klik een streep door.
 *
 * De sleutel wordt hier gemaakt en niet op de server: `crypto.getRandomValues`
 * is dezelfde generator, het scheelt een functie-aanroep, en de waarde hoeft
 * nooit ergens anders heen dan naar de database.
 */

const COLL = 'agendaSleutels'
const REGIO = 'europe-west1'

/** 32 tekens die in een adres mogen staan. */
export function nieuweSleutel() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Het adres dat je in Google Calendar plakt. */
export function agendaAdres(sleutel) {
  if (!sleutel || !projectId) return null
  return `https://${REGIO}-${projectId}.cloudfunctions.net/agenda?sleutel=${sleutel}`
}

/** De sleutel van wie er aangemeld is, live — want een nieuwe moet meteen staan. */
export function useAgendaSleutel(uid) {
  const [staat, setStaat] = useState({ laadt: true, sleutel: null, laatstGelezen: null })

  useEffect(() => {
    if (!uid) return setStaat({ laadt: false, sleutel: null, laatstGelezen: null })
    return onSnapshot(
      doc(db, COLL, uid),
      (snap) =>
        setStaat({
          laadt: false,
          sleutel: snap.exists() ? (snap.data().sleutel ?? null) : null,
          laatstGelezen: snap.exists() ? (snap.data().laatstGelezen ?? null) : null,
        }),
      () => setStaat({ laadt: false, sleutel: null, laatstGelezen: null })
    )
  }, [uid])

  return staat
}

/** Een sleutel maken of vervangen. De oude werkt daarna niet meer. */
export async function zetAgendaSleutel(uid) {
  const sleutel = nieuweSleutel()
  await setDoc(doc(db, COLL, uid), { sleutel, gemaaktOp: serverTimestamp(), laatstGelezen: null })
  return sleutel
}

/** Het abonnement opzeggen: het adres werkt daarna niet meer. */
export const wisAgendaSleutel = (uid) => deleteDoc(doc(db, COLL, uid))
