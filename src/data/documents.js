import { useEffect, useState } from 'react'
import { deleteDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { app, auth } from '@lib/firebase'

/**
 * Documenten: logo's, huisstijl, contracten, plannen.
 *
 * Ze hangen aan een klant óf aan een event. Dat onderscheid is het hele punt:
 * een logo hoort bij de klant en niet bij het feest van vorig jaar, anders
 * moet je het bij elke nieuwe opdracht opnieuw gaan zoeken. Een grondplan
 * hoort wél bij dat ene event.
 *
 * De Storage-SDK wordt pas ingeladen op het moment dat er echt een bestand
 * gaat, niet bij het opstarten van de app. Dat scheelt iedereen die nooit iets
 * uploadt een paar tientallen kilobytes.
 */

const MAX_BYTES = 25 * 1024 * 1024 // zelfde grens als in storage.rules

export function useDocuments({ customerId = null, taskId = null } = {}) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const veld = customerId ? 'customerId' : 'taskId'
    const waarde = customerId ?? taskId
    if (!waarde) {
      setDocuments([])
      setLoading(false)
      return undefined
    }

    return onSnapshot(
      query(col(COL.attachments), where(veld, '==', waarde), orderBy('createdAt', 'desc')),
      (snap) => {
        setDocuments(fromQuery(snap))
        setLoading(false)
      },
      () => {
        setDocuments([])
        setLoading(false)
      }
    )
  }, [customerId, taskId])

  return { documents, loading }
}

const veiligeNaam = (naam) =>
  (naam ?? 'bestand')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(-80)

/**
 * Een bestand erbij.
 *
 * Het pad draagt de klant of het event in zich, zodat in de opslag te zien is
 * waar iets bij hoort zonder de database erbij te halen. De verwijzing in
 * Firestore komt er pas nadat het bestand er echt staat — een rij naar een
 * bestand dat niet bestaat, is erger dan geen rij.
 */
export async function uploadDocument({ file, customerId = null, taskId = null, label = '' }) {
  if (!file) throw new Error('Geen bestand gekozen.')
  if (file.size > MAX_BYTES) throw new Error('Dit bestand is groter dan 25 MB.')

  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage')

  const map = customerId ? `klanten/${customerId}` : `events/${taskId}`
  const pad = `attachments/${map}/${Date.now()}-${veiligeNaam(file.name)}`
  const bestand = storageRef(getStorage(app), pad)

  await uploadBytes(bestand, file)
  const url = await getDownloadURL(bestand)

  const documentRef = newRef(COL.attachments)
  await setDoc(documentRef, {
    customerId,
    taskId,
    postId: null,
    name: file.name,
    label: label.trim(),
    storagePath: pad,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    url,
    uploadedBy: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  })

  return documentRef.id
}

/** Weg uit de opslag én uit de lijst; blijft er één van beide staan, dan klopt het niet meer. */
export async function deleteDocument(document) {
  try {
    const { getStorage, ref: storageRef, deleteObject } = await import('firebase/storage')
    if (document.storagePath) await deleteObject(storageRef(getStorage(app), document.storagePath))
  } catch (err) {
    // Al weg, of nooit aangekomen. De rij hieronder is wat je in de app ziet.
    if (err?.code !== 'storage/object-not-found') console.warn('JE Plan: bestand niet verwijderd', err)
  }

  await deleteDoc(ref(COL.attachments, document.id))
}

export const isAfbeelding = (document) => (document.contentType ?? '').startsWith('image/')

/** 1,2 MB in plaats van 1234567. */
export function leesbareGrootte(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
