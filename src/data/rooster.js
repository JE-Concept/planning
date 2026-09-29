import { useEffect, useState } from 'react'
import { deleteDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { weekDagen } from '@lib/rooster'

/**
 * Het weekrooster in de database.
 *
 * Eén document per dienst, met de dag als tekst ("2026-09-29") in plaats van als
 * tijdstip. Daarmee is een week op te vragen met één bereik op één veld, zonder
 * dat een tijdzone de randen kan verschuiven — een dienst op zondagavond hoort
 * bij die zondag, waar je ook staat.
 */

export function useShifts(datum = new Date()) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  const dagen = weekDagen(datum)
  const van = dagen[0].sleutel
  const tot = dagen[6].sleutel

  useEffect(() => {
    setLoading(true)
    return onSnapshot(
      query(col(COL.shifts), where('date', '>=', van), where('date', '<=', tot)),
      (snap) => {
        setShifts(fromQuery(snap))
        setLoading(false)
      },
      (err) => {
        console.error('JE Plan: het rooster is niet op te halen', err)
        setLoading(false)
      }
    )
  }, [van, tot])

  return { shifts, loading }
}

export function saveShift({ id, profileId, date, start, end, breakMinutes = 0, brandId = null, note = '' }) {
  const doelRef = id ? ref(COL.shifts, id) : newRef(COL.shifts)
  return setDoc(
    doelRef,
    {
      profileId,
      date,
      start,
      end,
      breakMinutes: Number(breakMinutes) || 0,
      brandId,
      note: note.trim(),
      updatedAt: serverTimestamp(),
      ...(id ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  ).then(() => doelRef.id)
}

export function deleteShift(id) {
  return deleteDoc(ref(COL.shifts, id))
}

/**
 * Dezelfde week nog eens, een week later.
 *
 * Een rooster in de horeca is grotendeels hetzelfde patroon: dezelfde mensen op
 * dezelfde dagen. Dat elke week opnieuw intikken is het soort werk waar deze
 * tool juist van af moest. Bestaande diensten in de doelweek blijven staan —
 * kopiëren is aanvullen, niet overschrijven, want anders gooi je weg wat iemand
 * daar al bewust had gezet.
 */
export async function kopieerWeek({ shifts, vanDatum, naarDatum }) {
  const bron = weekDagen(vanDatum)
  const doel = weekDagen(naarDatum)
  const verschuiving = Object.fromEntries(bron.map((d, i) => [d.sleutel, doel[i].sleutel]))

  const teKopieren = shifts.filter((s) => verschuiving[s.date])
  await Promise.all(
    teKopieren.map((s) =>
      saveShift({
        profileId: s.profileId,
        date: verschuiving[s.date],
        start: s.start,
        end: s.end,
        breakMinutes: s.breakMinutes,
        brandId: s.brandId ?? null,
        note: s.note ?? '',
      })
    )
  )
  return teKopieren.length
}
