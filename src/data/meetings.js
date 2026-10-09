import { useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { COL, col, fromQuery } from '@lib/collections'
import { app } from '@lib/firebase'

const functions = getFunctions(app, 'europe-west1')

/*
  De verslagen zelf staan sinds de notities in `notities` met `soort:
  'overleg'` — zie `src/data/notities.js`. Hier blijft wat aan het overleg
  hangt maar geen notitie is: de actiepunten (gewone taken) en het
  samenvatten.
*/

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
