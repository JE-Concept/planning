import { useEffect, useState } from 'react'
import {
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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

/**
 * Where a post stands in the review, which is not the same thing as its status.
 * The status says what the post is; the review state says whose move it is.
 */
export const REVIEW_STATES = [
  { key: 'none', label: 'Geen review', color: '#8593a9' },
  { key: 'requested', label: 'Wacht op review', color: '#b660e0' },
  { key: 'changes', label: 'Aanpassing gevraagd', color: '#e5484d' },
  { key: 'approved', label: 'Goedgekeurd', color: '#3db88b' },
]

export const reviewMeta = (key) =>
  REVIEW_STATES.find((r) => r.key === (key || 'none')) ?? REVIEW_STATES[0]

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
    source: 'manual',
    assigneeId: null,
    taskId: null,
    taskTitle: null,
    taskListName: null,
    reviewState: 'none',
    reviewRound: 0,
    reviewerId: null,
    reviewNote: null,
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

/**
 * Hangs a post on a project.
 *
 * The task's title and list travel with the post: a calendar cell has to say
 * which project a post belongs to without reading the task, and Firestore has
 * no join to do that for us.
 */
export function linkPostToTask(postId, task) {
  return updatePost(postId, {
    taskId: task?.id ?? null,
    taskTitle: task?.title ?? null,
    taskListName: task?.listName ?? null,
  })
}

const REVIEW_ACTIONS = {
  request: { reviewState: 'requested', status: 'review' },
  approve: { reviewState: 'approved', status: 'approved' },
  changes: { reviewState: 'changes', status: 'design' },
}

/**
 * Asks for a review, approves, or sends a post back for changes.
 *
 * The post and the entry in the review log are written in one batch, so the
 * state on the card and the history under it can never disagree.
 */
export async function reviewPost({ post, action, note = '', actor }) {
  const shape = REVIEW_ACTIONS[action]
  if (!shape) throw new Error('Onbekende reviewactie.')

  const trimmed = note.trim() || null
  const round = action === 'request' ? (post.reviewRound ?? 0) + 1 : (post.reviewRound || 1)

  const patch = {
    reviewState: shape.reviewState,
    status: shape.status,
    reviewRound: round,
    reviewNote: trimmed,
    updatedAt: serverTimestamp(),
  }
  if (action === 'request') {
    patch.reviewRequestedAt = serverTimestamp()
    patch.reviewRequestedBy = actor.id
    patch.reviewedAt = null
    patch.reviewedBy = null
  } else {
    patch.reviewedAt = serverTimestamp()
    patch.reviewedBy = actor.id
  }

  const batch = writeBatch(db)
  batch.update(ref(COL.socialPosts, post.id), patch)
  batch.set(newRef(COL.postReviews), {
    postId: post.id,
    round,
    decision: action,
    note: trimmed,
    authorId: actor.id,
    authorName: actor.fullName || actor.email || 'iemand',
    createdAt: serverTimestamp(),
  })
  await batch.commit()
}

export function setReviewer(postId, reviewerId) {
  return updatePost(postId, { reviewerId: reviewerId || null })
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

/** The posts hanging on one project — the social side of a task. */
export function usePostsForTask(taskId) {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    if (!taskId) {
      setPosts([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.socialPosts), where('taskId', '==', taskId), orderBy('scheduledAt')),
      (snap) => setPosts(fromQuery(snap)),
      () => setPosts([])
    )
  }, [taskId])

  return posts
}

/**
 * Alles wat op een review wacht — alles, of alleen het mijne.
 *
 * `enabled: false` slaat het abonnement over. Personeel mag socialPosts niet
 * lezen, en een query die toch vertrekt levert daar een rechtenfout op in
 * plaats van een leeg lijstje.
 */
export function useReviewQueue(reviewerId, { enabled = true } = {}) {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    if (!enabled) {
      setPosts([])
      return undefined
    }

    const clauses = [where('reviewState', '==', 'requested')]
    if (reviewerId) clauses.push(where('reviewerId', '==', reviewerId))

    return onSnapshot(
      query(col(COL.socialPosts), ...clauses, limit(50)),
      (snap) => setPosts(fromQuery(snap)),
      () => setPosts([])
    )
  }, [reviewerId, enabled])

  return posts
}

/** The decisions taken on one post, newest first. */
export function usePostReviews(postId) {
  const [reviews, setReviews] = useState([])

  useEffect(() => {
    if (!postId) {
      setReviews([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.postReviews), where('postId', '==', postId), orderBy('createdAt', 'desc')),
      (snap) => setReviews(fromQuery(snap)),
      () => setReviews([])
    )
  }, [postId])

  return reviews
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
