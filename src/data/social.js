import { useEffect, useMemo, useState } from 'react'
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
import { publicatieMoment } from '@lib/social-planning'

/**
 * De kanalen staan in `@lib/social-channels`, samen met hun beeldverhouding.
 *
 * Ze worden hier doorgegeven omdat andere schermen ze uit dit bestand halen —
 * het eventpaneel toont de kanalen van de posts bij een event — en die hoeven
 * daar niet allemaal voor aangeraakt te worden.
 */
export { CHANNELS, GEEN_KANAAL, channelMeta, hoofdKanaal, kanalenVan } from '@lib/social-channels'

/**
 * The production line of a post, in the order it actually moves.
 *
 * `sleutel` wijst naar de tekst in de taalcatalogus; `label` blijft ernaast
 * staan omdat schermen buiten de socials deze tabel ook lezen, en die mogen
 * niet stilvallen op een sleutel die ze niet opzoeken.
 */
export const POST_STATUSES = [
  { key: 'idea', sleutel: 'social.status.idea', label: 'Idee', color: '#8593a9' },
  { key: 'draft', sleutel: 'social.status.draft', label: 'Tekst', color: '#f59e0b' },
  { key: 'design', sleutel: 'social.status.design', label: 'Ontwerp', color: '#7c3aed' },
  { key: 'review', sleutel: 'social.status.review', label: 'Nakijken', color: '#b660e0' },
  { key: 'approved', sleutel: 'social.status.approved', label: 'Goedgekeurd', color: '#3db88b' },
  { key: 'scheduled', sleutel: 'social.status.scheduled', label: 'Ingepland', color: '#3377ff' },
  { key: 'published', sleutel: 'social.status.published', label: 'Gepubliceerd', color: '#008844' },
]

/**
 * Where a post stands in the review, which is not the same thing as its status.
 * The status says what the post is; the review state says whose move it is.
 */
export const REVIEW_STATES = [
  { key: 'none', sleutel: 'social.review.geen', label: 'Geen review', color: '#8593a9' },
  { key: 'requested', sleutel: 'social.review.wacht', label: 'Wacht op review', color: '#b660e0' },
  { key: 'changes', sleutel: 'social.review.aanpassing', label: 'Aanpassing gevraagd', color: '#e5484d' },
  { key: 'approved', sleutel: 'social.review.goedgekeurd', label: 'Goedgekeurd', color: '#3db88b' },
]

export const reviewMeta = (key) =>
  REVIEW_STATES.find((r) => r.key === (key || 'none')) ?? REVIEW_STATES[0]

export const statusMeta = (key) =>
  POST_STATUSES.find((s) => s.key === key) ?? POST_STATUSES[0]

/**
 * Wie de social content maakt.
 *
 * Onderwerpen komen altijd bij dezelfde persoon terecht — dat is hoe dit team
 * werkt. Het adres staat in config/access en niet in de code: iemand kan van
 * rol wisselen, en dan hoort er geen uitrol aan te pas te komen.
 */
export function useSocialOwner() {
  const [email, setEmail] = useState(null)

  useEffect(
    () =>
      onSnapshot(
        doc(db, COL.config, 'access'),
        (snap) => setEmail((snap.data()?.socialOwnerEmail ?? '').toLowerCase() || null),
        () => setEmail(null)
      ),
    []
  )

  return email
}

export function createPost({ brandId, publishAt, title, createdBy, ...rest }) {
  const postRef = newRef(COL.socialPosts)
  const wanneer = publishAt ? new Date(publishAt) : null

  return setDoc(postRef, {
    brandId,
    title: (title || 'Nieuwe post').trim(),
    caption: '',
    hashtags: '',
    channels: ['instagram'],
    publishAt: wanneer,
    scheduledAt: wanneer,
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

/**
 * De publicatiedatum verzetten.
 *
 * `publishAt` is vanaf nu het veld dat telt. `scheduledAt` gaat mee zolang er
 * schermen zijn die het nog lezen — het eventpaneel toont de datum van de
 * posts bij een event daaruit — want anders lopen die achter op de kalender.
 * Zodra die laatste lezer om is, mag deze tweede schrijfactie weg; de
 * fallback in `publicatieMoment` blijft wél nodig, voor de posts die al in de
 * database stonden voor dit veld bestond.
 */
export function setPublicatiedatum(id, datum) {
  const wanneer = datum ? new Date(datum) : null
  return updatePost(id, { publishAt: wanneer, scheduledAt: wanneer })
}

export function deletePost(id) {
  return deleteDoc(ref(COL.socialPosts, id))
}

export function movePostTo(id, date) {
  return setPublicatiedatum(id, date)
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

/**
 * Alle posts in een periode, op één veld tegelijk. `null` = nog aan het laden.
 *
 * Een bereik op één veld heeft geen samengestelde index nodig; Firestore
 * indexeert losse velden vanzelf.
 */
function useBereik(veld, from, to) {
  const [posts, setPosts] = useState(null)

  useEffect(() => {
    if (!from || !to) return undefined
    setPosts(null)

    return onSnapshot(
      query(col(COL.socialPosts), where(veld, '>=', from), where(veld, '<=', to), orderBy(veld)),
      (snap) => setPosts(fromQuery(snap)),
      () => setPosts([])
    )
  }, [veld, from?.getTime(), to?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  return posts
}

/**
 * Elke post die in deze periode online gaat, over de merken heen.
 *
 * Twee abonnementen in plaats van één, en dat is geen omweg: een `orderBy` op
 * `publishAt` laat elk document weg dat dat veld níét heeft, en zo staan de
 * posts erin die er al vóór deze wijziging waren. Die hebben alleen nog hun
 * oude `scheduledAt`. Één query op `publishAt` zou de halve kalender leeg
 * maken; één query op `scheduledAt` zou een verzette publicatiedatum missen.
 * Samenvoegen en daarna op het echte publicatiemoment filteren dekt beide.
 */
export function useSocialPosts({ from, to }) {
  const opPublicatiedatum = useBereik('publishAt', from, to)
  const opEventdatum = useBereik('scheduledAt', from, to)

  const posts = useMemo(() => {
    const perId = new Map()
    for (const post of [...(opPublicatiedatum ?? []), ...(opEventdatum ?? [])]) {
      perId.set(post.id, post)
    }

    return [...perId.values()]
      .filter((post) => {
        // Een post met een oude datum in deze periode maar een publicatiedatum
        // erbuiten hoort hier niet: hij gaat online in een andere week.
        const moment = publicatieMoment(post)
        return moment && moment >= from && moment <= to
      })
      .sort((a, b) => publicatieMoment(a) - publicatieMoment(b))
  }, [opPublicatiedatum, opEventdatum, from?.getTime(), to?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  return { posts, loading: opPublicatiedatum === null || opEventdatum === null }
}

/**
 * Posts zonder datum — de lijst naast de kalender.
 *
 * De query blijft op `scheduledAt` staan: een gelijkheidstoets op `publishAt`
 * zou de oudere posts overslaan, want die hebben dat veld niet en Firestore
 * beschouwt een ontbrekend veld niet als `null`. Wat er daarna nog een
 * publicatiedatum blijkt te hebben, valt er hier uit.
 */
export function useUnscheduledPosts() {
  const [posts, setPosts] = useState([])

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.socialPosts), where('scheduledAt', '==', null), orderBy('createdAt', 'desc')),
        (snap) => setPosts(fromQuery(snap).filter((post) => !publicatieMoment(post)))
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
