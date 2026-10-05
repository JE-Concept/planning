import { useEffect, useState } from 'react'
import { doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { COL, col, fromQuery, newRef } from '@lib/collections'
import { auth, db } from '@lib/firebase'

/**
 * Documenten: logo's, huisstijl, contracten, plannen — op Google Drive.
 *
 * Ze hangen aan een klant óf aan een event. Dat onderscheid is het hele punt:
 * een logo hoort bij de klant en niet bij het feest van vorig jaar, anders
 * moet je het bij elke nieuwe opdracht opnieuw gaan zoeken. Een grondplan
 * hoort wél bij dat ene event.
 *
 * ── Waarom Drive en niet Firebase Storage ─────────────────────────────────
 * De bestanden van JE Concept leven al in Drive, en Jasper moet erbij kunnen
 * zonder de app: een grondplan dat een leverancier mailt, sleep je in de map
 * en het staat in de tool. Elke klant en elk event krijgt een eigen map in de
 * gedeelde Drive; wat hier in Firestore staat is een kopie van die map, zodat
 * het scherm meteen tekent.
 *
 * ── Waarom alles via de server loopt ──────────────────────────────────────
 * De browser praat niet met Drive. Hij geeft een bestand aan `/api/drive`
 * met zijn Firebase-aanmelding erbij, en de functie schrijft het in de map
 * namens de zaak — niet namens de persoon. Zie `functions/drive.js`.
 */

const MAX_BYTES = 25 * 1024 * 1024
const DEMO = import.meta.env.MODE === 'demo'

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

/**
 * De instelling: welke gedeelde Drive.
 *
 * Eén document, door een beheerder gezet. Zolang het leeg is, zegt het
 * documentenblok dat Drive nog niet ingericht is, met waar dat moet gebeuren.
 */
export function useDriveConfig() {
  const [config, setConfig] = useState(null)
  useEffect(
    () =>
      onSnapshot(
        doc(db, COL.config, 'drive'),
        (snap) => setConfig(snap.exists() ? snap.data() : {}),
        () => setConfig({})
      ),
    []
  )
  return config
}

/** Een id of een geplakte link naar de gedeelde Drive — we halen het id eruit. */
export function driveIdUit(tekst) {
  const t = String(tekst ?? '').trim()
  const m = /\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/.exec(t) || /\/folders\/([A-Za-z0-9_-]+)/.exec(t)
  return (m ? m[1] : t).replace(/[?#].*$/, '')
}

export const zetDrive = (driveId) =>
  setDoc(
    doc(db, COL.config, 'drive'),
    { driveId: driveIdUit(driveId) || null, gezetDoor: auth.currentUser?.uid ?? null, updatedAt: serverTimestamp() },
    { merge: true }
  )

// ─── De server ──────────────────────────────────────────────────────────────

const MELDING = {
  niet_aangemeld: 'Je bent niet (meer) aangemeld. Herlaad de pagina.',
  geen_drive: 'Google Drive is nog niet ingericht. Een beheerder zet de gedeelde Drive in Instellingen → Drive.',
  drive_geen_toegang: 'De tool mag niet in de gedeelde Drive. Is het serviceaccount lid, en staat de Drive API aan? Zie Instellingen → Drive.',
  drive_mislukt: 'Google Drive antwoordde niet. Probeer het zo opnieuw.',
  te_groot: 'Dit bestand is groter dan 25 MB.',
  onbekend: 'Dit event of deze klant bestaat niet (meer).',
}

async function roep(pad, { method = 'POST', body, headers = {} } = {}) {
  const token = await auth.currentUser?.getIdToken()
  const antwoord = await fetch(`/api/drive${pad}`, {
    method,
    headers: { Authorization: `Bearer ${token ?? ''}`, ...headers },
    body,
  })
  if (!antwoord.ok) {
    const uit = await antwoord.json().catch(() => ({}))
    throw new Error(MELDING[uit.fout] ?? 'Dat is niet gelukt. Probeer het zo opnieuw.')
  }
  return antwoord.json()
}

const eigenaar = ({ customerId, taskId }) => (customerId ? `customerId=${encodeURIComponent(customerId)}` : `taskId=${encodeURIComponent(taskId)}`)

/**
 * Een bestand erbij: naar de map in Drive, en de rij komt van de server terug.
 *
 * De ruwe bytes in de body en de naam in een kop — één bestand per verzoek,
 * zodat bij een mislukking duidelijk is welk bestand het was.
 */
export async function uploadDocument({ file, customerId = null, taskId = null }) {
  if (!file) throw new Error('Geen bestand gekozen.')
  if (file.size > MAX_BYTES) throw new Error(MELDING.te_groot)
  if (DEMO) return demoUpload({ file, customerId, taskId })

  return roep(`/upload?${eigenaar({ customerId, taskId })}`, {
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Bestandsnaam': encodeURIComponent(file.name) },
  })
}

/** Naar de prullenbak van Drive, en weg uit de lijst. */
export async function deleteDocument(document) {
  if (DEMO) return demoWeg(document)
  return roep(`/bestand/${encodeURIComponent(document.id)}?${eigenaar(document)}`, { method: 'DELETE' })
}

/** De lijst gelijkzetten met de map — ook wat er buiten de app om in gezet is. */
export async function syncDocuments({ customerId = null, taskId = null }) {
  if (DEMO) return { aantal: 0, erbij: 0, weg: 0 }
  return roep(`/sync?${eigenaar({ customerId, taskId })}`)
}

/** De map in Drive, aangemaakt als ze er nog niet is; geeft de link terug. */
export async function driveMap({ customerId = null, taskId = null }) {
  if (DEMO) return { id: 'demo', webViewLink: 'https://drive.google.com/' }
  return roep(`/map?${eigenaar({ customerId, taskId })}`)
}

export const isAfbeelding = (document) => (document.contentType ?? '').startsWith('image/')

/** 1,2 MB in plaats van 1234567. */
export function leesbareGrootte(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

// ─── De demo ────────────────────────────────────────────────────────────────

/*
  De demo heeft geen server en geen Drive. Ze schrijft de rij rechtstreeks,
  met een link die nergens heen gaat — genoeg om het scherm te laten doen wat
  het live ook doet.
*/
async function demoUpload({ file, customerId, taskId }) {
  const ref = newRef(COL.attachments)
  const rij = {
    bron: 'drive',
    driveId: `demo-${ref.id}`,
    name: file.name,
    contentType: file.type || 'application/octet-stream',
    soort: (file.type ?? '').startsWith('image/') ? 'afbeelding' : file.type === 'application/pdf' ? 'pdf' : 'bestand',
    size: file.size,
    url: '#',
    voorvertoning: null,
    iconLink: null,
    thumbnailLink: null,
    customerId,
    taskId,
    postId: null,
    uploadedBy: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  }
  await setDoc(ref, rij)
  return { id: ref.id, ...rij }
}

async function demoWeg(document) {
  const { deleteDoc, doc: d } = await import('firebase/firestore')
  await deleteDoc(d(db, COL.attachments, document.id))
  return { ok: true }
}
