import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { COL, col, fromQuery } from '@lib/collections'
import { app } from '@lib/firebase'

const functions = getFunctions(app, 'europe-west1')

/**
 * Teamoverleg.
 *
 * De samenvatting staat in een eigen collectie met een lijst van wie ze mag
 * lezen, en de query filtert op datzelfde veld. Dat is geen dubbel werk maar
 * een voorwaarde: Firestore weigert een query die documenten zou kunnen
 * teruggeven die de regels afwijzen, dus de filter móét overeenkomen met de
 * regel of het hele overzicht faalt in plaats van korter te worden.
 */
export function useMeetings(uid) {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setMeetings([])
      setLoading(false)
      return undefined
    }

    return onSnapshot(
      query(col(COL.meetings), where('viewerIds', 'array-contains', uid), orderBy('datum', 'desc')),
      (snap) => {
        setMeetings(fromQuery(snap))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [uid])

  return { meetings, loading }
}

/** De actiepunten van één overleg — gewone taken, dus ook zichtbaar in Mijn werk. */
export function useMeetingTasks(meetingId) {
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (!meetingId) {
      setTasks([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.tasks), where('meetingId', '==', meetingId)),
      (snap) => setTasks(fromQuery(snap)),
      () => setTasks([])
    )
  }, [meetingId])

  return tasks
}

/**
 * Een transcript samenvatten. De functie doet het werk server-side: de
 * Claude-sleutel hoort niet in een browser, en de samenvatting moet ook lukken
 * als niemand het tabblad openhoudt.
 */
export function summariseMeeting({ transcript, datum, bron }) {
  return httpsCallable(functions, 'summariseMeeting')({ transcript, datum, bron }).then((r) => r.data)
}

/**
 * Alle actiepunten van alle verslagen, in één abonnement.
 *
 * Nodig om te kunnen zoeken: wie "leverancier" intikt, verwacht ook het verslag
 * terug waarin dat woord alleen in een actiepunt stond. Per verslag apart
 * ophalen zou één query per verslag betekenen, en dat zijn er elke week één
 * meer.
 *
 * De filter `meetingId >= ''` is de manier waarop Firestore "dit veld is een
 * tekst" zegt: taken zonder actiepunt-herkomst hebben er `null` staan, en null
 * sorteert vóór elke tekst. Dat scheelt het hele takenbord binnenhalen.
 *
 * Alleen wanneer het zoekscherm openstaat, want daarbuiten is het een
 * abonnement dat niemand leest.
 */
export function useAlleActiepunten(actief = true) {
  const [taken, setTaken] = useState([])

  useEffect(() => {
    if (!actief) {
      setTaken([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.tasks), where('meetingId', '>=', '')),
      (snap) => setTaken(fromQuery(snap)),
      () => setTaken([])
    )
  }, [actief])

  return taken
}
