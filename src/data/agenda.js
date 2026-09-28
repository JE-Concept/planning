import { useEffect, useState } from 'react'
import { deleteDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'

/**
 * De agenda van het teamoverleg.
 *
 * Iedereen in het team zet er punten op, niet alleen wie het overleg leidt —
 * anders komt op de agenda wat de voorzitter toevallig onthoudt. Elk punt heeft
 * een eigenaar, een omschrijving en een verwachte tijd; die tijd is wat een
 * agenda van een verlanglijst onderscheidt.
 *
 * Een besproken punt verdwijnt niet maar krijgt een datum. Wie een week later
 * vraagt "hebben we dat nu besproken?" wil het antwoord kunnen terugvinden.
 */

export function useAgenda(status = 'open') {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    return onSnapshot(
      query(col(COL.agendaItems), where('status', '==', status), orderBy('createdAt')),
      (snap) => {
        setItems(fromQuery(snap))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [status])

  return { items, loading }
}

export function addAgendaItem({ titel, omschrijving, ownerId, minuten, createdBy }) {
  const itemRef = newRef(COL.agendaItems)
  return setDoc(itemRef, {
    titel: titel.trim(),
    omschrijving: (omschrijving ?? '').trim(),
    ownerId: ownerId || null,
    minuten: Number(minuten) || 0,
    status: 'open',
    meetingId: null,
    besprokenOp: null,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then(() => itemRef.id)
}

export function updateAgendaItem(id, patch) {
  return updateDoc(ref(COL.agendaItems, id), { ...patch, updatedAt: serverTimestamp() })
}

/** Afvinken bewaart wanneer, zodat de agenda ook het geheugen van het team is. */
export function markDiscussed(id, meetingId = null) {
  return updateAgendaItem(id, {
    status: 'besproken',
    meetingId,
    besprokenOp: new Date(),
  })
}

export function reopenAgendaItem(id) {
  return updateAgendaItem(id, { status: 'open', meetingId: null, besprokenOp: null })
}

export function deleteAgendaItem(id) {
  return deleteDoc(ref(COL.agendaItems, id))
}

/** De geplande tijd van de hele agenda — één blik of het overleg past. */
export const totalMinutes = (items) => items.reduce((n, i) => n + (Number(i.minuten) || 0), 0)
