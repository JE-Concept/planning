import { useEffect, useState } from 'react'
import {
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { COL, col, fromQuery, newRef, normalise, ref } from '@lib/collections'
import { db } from '@lib/firebase'

export const CHANNELS = [
  { key: 'instagram', label: 'Instagram', color: '#d62976' },
  { key: 'facebook', label: 'Facebook', color: '#1877f2' },
  { key: 'tiktok', label: 'TikTok', color: '#161a22' },
  { key: 'linkedin', label: 'LinkedIn', color: '#0a66c2' },
  { key: 'google', label: 'Google Business', color: '#34a853' },
  { key: 'newsletter', label: 'Nieuwsbrief', color: '#f59e0b' },
]

/** The production line of a post, in the order it actually moves. */
export const POST_STATUSES = [
  { key: 'idea', label: 'Idee', color: '#8593a9' },
  { key: 'draft', label: 'Tekst', color: '#f59e0b' },
  { key: 'design', label: 'Ontwerp', color: '#7c3aed' },
  { key: 'review', label: 'Nakijken', color: '#b660e0' },
  { key: 'approved', label: 'Goedgekeurd', color: '#3db88b' },
  { key: 'scheduled', label: 'Ingepland', color: '#3377ff' },
  { key: 'published', label: 'Gepubliceerd', color: '#008844' },
]

export const statusMeta = (key) =>
  POST_STATUSES.find((s) => s.key === key) ?? POST_STATUSES[0]

export const channelMeta = (key) =>
  CHANNELS.find((c) => c.key === key) ?? { key, label: key, color: '#8593a9' }

export function createPost({ brandId, scheduledAt, title, createdBy, ...rest }) {
  const postRef = newRef(COL.socialPosts)

  return setDoc(postRef, {
    brandId,
    title: (title || 'Nieuwe post').trim(),
    caption: '',
    hashtags: '',
    channels: ['instagram'],
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    status: 'idea',
    assigneeId: null,
    taskId: null,
    canvaDesignId: null,
    canvaEditUrl: null,
    canvaViewUrl: null,
    canvaThumbnailUrl: null,
    canvaSyncedAt: null,
    assetUrl: null,
    publishedUrl: null,
    notes: '',
    createdBy: createdBy ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...rest,
  }).then(() => postRef.id)
}

export function updatePost(id, patch) {
  return updateDoc(ref(COL.socialPosts, id), { ...patch, updatedAt: serverTimestamp() })
}

export function deletePost(id) {
  return deleteDoc(ref(COL.socialPosts, id))
}

export function movePostTo(id, date) {
  return updatePost(id, { scheduledAt: date ? new Date(date) : null })
}

export function toggleChannel(post, key) {
  const next = post.channels?.includes(key)
    ? post.channels.filter((c) => c !== key)
    : [...(post.channels ?? []), key]
  return updatePost(post.id, { channels: next })
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

/** Every scheduled post between two dates, across brands. */
export function useSocialPosts({ from, to }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return undefined
    setLoading(true)

    return onSnapshot(
      query(
        col(COL.socialPosts),
        where('scheduledAt', '>=', from),
        where('scheduledAt', '<=', to),
        orderBy('scheduledAt')
      ),
      (snap) => {
        setPosts(fromQuery(snap))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [from?.getTime(), to?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  return { posts, loading }
}

/** Posts without a date yet — the backlog rail next to the calendar. */
export function useUnscheduledPosts() {
  const [posts, setPosts] = useState([])

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.socialPosts), where('scheduledAt', '==', null), orderBy('createdAt', 'desc')),
        (snap) => setPosts(fromQuery(snap))
      ),
    []
  )

  return posts
}

export function usePost(id) {
  const [post, setPost] = useState(null)

  useEffect(() => {
    if (!id) {
      setPost(null)
      return undefined
    }
    return onSnapshot(doc(db, COL.socialPosts, id), (snap) =>
      setPost(snap.exists() ? normalise({ id: snap.id, ...snap.data() }) : null)
    )
  }, [id])

  return post
}
