/**
 * De planning uit AAPI, zoals de schermen ze lezen.
 *
 * Schrijven gebeurt hier niet: `aapiShifts` en `aapiEmployees` staan in de
 * regels dicht voor de browser, want wat uit AAPI komt hoort niet in een
 * tabblad aangepast te kunnen worden. Wat een mens wél beslist — bij welk event
 * een shift hoort — loopt via een Cloud Function, zodat er één plek is waar
 * vastligt wat een geldige koppeling is.
 *
 * Dit bestand verving de lege stub die hier stond te wachten op documentatie
 * van AAPI. Die documentatie is er nog altijd niet; wat er wél is, is een
 * export. Zie `functions/aapi/` voor hoe die gelezen wordt.
 */
import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { COL, col, fromQuery } from '@lib/collections'
import { app } from '@lib/firebase'

// Dezelfde regio als de functies zelf; zie `src/data/meetings.js`.
const functions = getFunctions(app, 'europe-west1')

/** Alle shifts met een start binnen dit bereik, op tijd. */
export function useAapiShifts({ van, tot } = {}) {
  const [shifts, setShifts] = useState([])
  const [laadt, setLaadt] = useState(Boolean(van && tot))
  const [fout, setFout] = useState(null)

  const vanTijd = van?.getTime()
  const totTijd = tot?.getTime()

  useEffect(() => {
    if (!vanTijd || !totTijd) {
      setShifts([])
      setLaadt(false)
      return undefined
    }
    setLaadt(true)
    return onSnapshot(
      query(col(COL.aapiShifts), where('start', '>=', new Date(vanTijd)), where('start', '<=', new Date(totTijd))),
      (snap) => {
        setShifts(fromQuery(snap).sort((a, b) => new Date(a.start) - new Date(b.start)))
        setLaadt(false)
        setFout(null)
      },
      (err) => {
        setFout(err)
        setLaadt(false)
      }
    )
  }, [vanTijd, totTijd])

  return { shifts, laadt, fout }
}

/** De shifts die aan één event hangen. */
export function useShiftsVanEvent(eventId) {
  const [shifts, setShifts] = useState([])
  const [laadt, setLaadt] = useState(Boolean(eventId))

  useEffect(() => {
    if (!eventId) {
      setShifts([])
      setLaadt(false)
      return undefined
    }
    setLaadt(true)
    return onSnapshot(
      query(col(COL.aapiShifts), where('eventRef', '==', eventId), orderBy('start')),
      (snap) => {
        setShifts(fromQuery(snap))
        setLaadt(false)
      },
      () => setLaadt(false)
    )
  }, [eventId])

  return { shifts, laadt }
}

/** De medewerkers uit AAPI, op id. */
export function useAapiMedewerkers() {
  const [medewerkers, setMedewerkers] = useState([])

  useEffect(
    () =>
      onSnapshot(query(col(COL.aapiEmployees)), (snap) => setMedewerkers(fromQuery(snap)), () => setMedewerkers([])),
    []
  )

  const opId = useMemo(
    () => Object.fromEntries(medewerkers.map((m) => [m.aapiEmployeeId ?? m.id, m])),
    [medewerkers]
  )

  return { medewerkers, opId }
}

/** De vorige importbeurten, nieuwste eerst. */
export function useImportRuns(max = 10) {
  const [runs, setRuns] = useState([])

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.aapiImportRuns), orderBy('startedAt', 'desc')),
        (snap) => setRuns(fromQuery(snap).slice(0, max)),
        () => setRuns([])
      ),
    [max]
  )

  return { runs }
}

/**
 * Een bestand importeren.
 *
 * `dryRun` leest alles en rekent alles uit, maar raakt geen document aan — dat
 * is wat de uploadpagina toont vóór er iets gebeurt. Dezelfde som, dezelfde
 * uitkomst, alleen zonder de schrijfbeurt.
 */
export async function importeerPlanning(bestand, { dryRun = false } = {}) {
  const buffer = await bestand.arrayBuffer()
  let binair = ''
  const bytes = new Uint8Array(buffer)
  // In stukken, want `String.fromCharCode(...)` met een hele megabyte aan
  // argumenten blaast de stapel op.
  for (let i = 0; i < bytes.length; i += 8192) {
    binair += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }

  const aanroep = httpsCallable(functions, 'aapiImport')
  const { data } = await aanroep({
    bestandBase64: btoa(binair),
    bestandsnaam: bestand.name,
    dryRun,
  })
  return data
}

/** Een shift aan een event hangen, of er juist niet. */
export async function koppelShift({ planningId, eventId = null, status }) {
  const aanroep = httpsCallable(functions, 'aapiKoppel')
  const { data } = await aanroep({ planningId, eventId, status })
  return data
}
