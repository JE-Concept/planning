import { useEffect, useState } from 'react'
import { deleteDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { taakUitAgendapunt } from '@lib/agenda-taak'
import { createTask } from './tasks'

/**
 * De agenda van het teamoverleg.
 *
 * Iedereen in het team zet er punten op, niet alleen wie het overleg leidt —
 * anders komt op de agenda wat de voorzitter toevallig onthoudt. Wie een punt
 * zet is meteen de eigenaar: iets op de agenda zetten voor een ander is hoe
 * punten ontstaan waar niemand zich verantwoordelijk voor voelt.
 *
 * Verder een omschrijving en een verwachte tijd; die tijd is wat een agenda van
 * een verlanglijst onderscheidt.
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

export function addAgendaItem({ titel, omschrijving, minuten, uid }) {
  const itemRef = newRef(COL.agendaItems)
  return setDoc(itemRef, {
    titel: titel.trim(),
    omschrijving: (omschrijving ?? '').trim(),
    ownerId: uid,
    minuten: Number(minuten) || 0,
    status: 'open',
    meetingId: null,
    besprokenOp: null,
    taskId: null,
    createdBy: uid,
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

/**
 * Een punt afronden én er meteen een taak van maken.
 *
 * In één handeling, want dat is het hele verschil. Zolang "Besproken" en
 * "maak hier een taak van" twee schermen waren, gebeurde het tweede niet: het
 * overleg loopt door, de volgende spreker is al bezig, en wat afgesproken werd
 * stond nergens meer dan in het hoofd van wie het zei.
 *
 * De taak krijgt een eigenaar en een deadline mee — zonder die twee is een
 * actiepunt een goede bedoeling. `taskId` blijft op het punt staan, zodat een
 * tweede klik niet stilletjes een tweede taak oplevert en je vanaf de agenda
 * terugvindt waar het werk terechtkwam.
 */
export async function besprekenEnTaak({ item, lijst, status, titel, eigenaar, deadline }) {
  const payload = taakUitAgendapunt({ item, lijst, status, titel, eigenaar, deadline })
  if (!payload) throw new Error('Dit punt heeft geen titel om een taak van te maken.')

  const taskId = await createTask(payload)
  await updateAgendaItem(item.id, {
    status: 'besproken',
    besprokenOp: new Date(),
    taskId,
  })
  return taskId
}
