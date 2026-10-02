import { useEffect, useState } from 'react'
import {
  deleteDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { db } from '@lib/firebase'
import { vermeldingenIn } from '@lib/vermelding'

export function useComments({ taskId, postId }) {
  const [comments, setComments] = useState([])

  useEffect(() => {
    const field = taskId ? 'taskId' : 'postId'
    const value = taskId ?? postId
    if (!value) {
      setComments([])
      return undefined
    }

    return onSnapshot(
      query(col(COL.comments), where(field, '==', value), orderBy('createdAt')),
      (snap) => setComments(fromQuery(snap)),
      () => setComments([])
    )
  }, [taskId, postId])

  return comments
}

/**
 * De notities waarin jij aangesproken bent.
 *
 * Voor wie met een code binnenkomt: hij leest de eventnotities niet, maar de
 * notitie waarin hij zélf genoemd wordt wel — anders is taggen een melding die
 * naar een gesloten deur wijst. De vraag is daarom zelf beperkt tot dat ene
 * veld, want de regels staan niets ruimers toe.
 *
 * Geen `orderBy`: dat zou een samengestelde index vragen voor een lijst van
 * hooguit een handvol berichten. Sorteren doet de browser.
 */
export function useMijnVermeldingen(uid) {
  const [notities, setNotities] = useState([])

  useEffect(() => {
    if (!uid) {
      setNotities([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.comments), where('mentions', 'array-contains', uid)),
      (snap) =>
        setNotities(
          fromQuery(snap).sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
        ),
      () => setNotities([])
    )
  }, [uid])

  return notities
}

export async function addComment({ taskId, postId, body, author }) {
  const trimmed = body.trim()
  if (!trimmed) return null

  const commentRef = newRef(COL.comments)
  const batch = writeBatch(db)

  batch.set(commentRef, {
    taskId: taskId ?? null,
    postId: postId ?? null,
    authorId: author?.id ?? null,
    authorName: author?.fullName || author?.email || 'Onbekend',
    body: trimmed,
    // Wie er vermeld is, staat ook los van de tekst op de reactie: de trigger
    // die de melding stuurt hoeft dan geen tekst te ontleden, en een reactie
    // die ooit anders geschreven wordt bereikt dezelfde mensen.
    mentions: vermeldingenIn(trimmed),
    createdAt: serverTimestamp(),
  })

  // The card shows a comment count, so it is kept on the task rather than
  // counted by reading the whole thread on every board render.
  if (taskId) batch.update(ref(COL.tasks, taskId), { commentCount: increment(1) })

  await batch.commit()
  return commentRef.id
}

export async function deleteComment(comment) {
  const batch = writeBatch(db)
  batch.delete(ref(COL.comments, comment.id))
  if (comment.taskId) {
    batch.update(ref(COL.tasks, comment.taskId), { commentCount: increment(-1) })
  }
  await batch.commit()
}

export function useAttachments({ taskId, postId }) {
  const [files, setFiles] = useState([])

  useEffect(() => {
    const field = taskId ? 'taskId' : 'postId'
    const value = taskId ?? postId
    if (!value) {
      setFiles([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.attachments), where(field, '==', value), orderBy('createdAt', 'desc')),
      (snap) => setFiles(fromQuery(snap)),
      // Zonder deze tak gooit Firestore de fout naar de console en stopt het
      // abonnement; het scherm blijft dan de bijlagen van de vórige taak tonen
      // alsof ze bij deze horen. Leeg is verkeerd, maar niet misleidend.
      () => setFiles([])
    )
  }, [taskId, postId])

  return files
}

export function addAttachment(data) {
  const attachmentRef = newRef(COL.attachments)
  return setDoc(attachmentRef, { ...data, createdAt: serverTimestamp() }).then(
    () => attachmentRef.id
  )
}

export function deleteAttachment(id) {
  return deleteDoc(ref(COL.attachments, id))
}
