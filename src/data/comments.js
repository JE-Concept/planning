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
      (snap) => setFiles(fromQuery(snap))
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
