import { useState } from 'react'
import { cn } from '@lib/cn'
import { formatDateTime } from '@lib/dates'
import { Avatar, Badge, Button, Field, Select, Spinner, Textarea } from '@ui/index'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { pullCanvaComments, reviewPost } from '@data/canva'
import { reviewMeta, setReviewer, usePostReviews } from '@data/social'

const DECISION_LABELS = {
  request: 'Review gevraagd',
  approve: 'Goedgekeurd',
  changes: 'Aanpassing gevraagd',
}

/**
 * The review, and its road back into Canva.
 *
 * Every decision is written here first and pushed onto the Canva design as a
 * comment second, because a Canva outage must not lose an approval. The reply
 * the designer leaves in Canva comes back the other way, so the conversation
 * reads the same on both sides without anybody copying it over.
 */
export default function ReviewPanel({ post }) {
  const { profiles, profileById } = useWorkspace()
  const toast = useToast()
  const reviews = usePostReviews(post.id)

  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const review = reviewMeta(post.reviewState)
  const reviewer = post.reviewerId ? profileById[post.reviewerId] : null
  const comments = post.canvaComments ?? []

  const act = async (action) => {
    setBusy(true)
    try {
      const result = await reviewPost({
        postId: post.id,
        action,
        note,
        reviewerId: post.reviewerId ?? null,
      })
      setNote('')

      if (!post.canvaDesignId) {
        toast.success(`${DECISION_LABELS[action]}.`)
      } else if (result.pushedToCanva) {
        toast.success(`${DECISION_LABELS[action]} — ook als reactie in Canva gezet.`)
      } else {
        toast.info(
          `${DECISION_LABELS[action]}, maar Canva nam de reactie niet aan${result.canvaError ? `: ${result.canvaError}` : ''}.`
        )
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const pull = async () => {
    setBusy(true)
    try {
      const { items } = await pullCanvaComments(post.id)
      toast.success(
        items.length === 0 ? 'Nog geen reacties in Canva.' : `${items.length} reactie(s) opgehaald.`
      )
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="label mb-0">Review</h3>
        <Badge color={review.color}>{review.label}</Badge>
        {post.reviewRound > 0 ? (
          <span className="text-[11px] text-ink-400">ronde {post.reviewRound}</span>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl bg-ink-50 p-3">
        <Field label="Nakijken door">
          <Select
            value={post.reviewerId ?? ''}
            onChange={(e) => setReviewer(post.id, e.target.value)}
          >
            <option value="">Wie dan ook</option>
            {profiles
              .filter((p) => p.active !== false)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName || p.email}
                </option>
              ))}
          </Select>
        </Field>

        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            post.canvaDesignId
              ? 'Wat moet de ontwerper weten? Komt ook als reactie op het Canva-ontwerp.'
              : 'Wat moet de ontwerper weten?'
          }
        />

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => act('request')}>
            Review vragen
          </Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => act('approve')}>
            Goedkeuren
          </Button>
          <Button variant="danger" size="sm" disabled={busy} onClick={() => act('changes')}>
            Aanpassing vragen
          </Button>
          {post.canvaDesignId ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={pull}>
              Reacties uit Canva halen
            </Button>
          ) : null}
        </div>

        {busy ? (
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Spinner className="h-3 w-3" /> Bezig…
          </p>
        ) : null}

        {!post.canvaDesignId ? (
          <p className="text-[11px] text-ink-500">
            Er hangt nog geen Canva-ontwerp aan deze post, dus de review blijft binnen dit tool.
          </p>
        ) : null}
      </div>

      {reviewer && post.reviewState === 'requested' ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-600">
          <Avatar profile={reviewer} size="xs" />
          Wacht op {reviewer.fullName || reviewer.email}
          {post.reviewRequestedAt ? ` sinds ${formatDateTime(post.reviewRequestedAt)}` : ''}
        </p>
      ) : null}

      {comments.length > 0 ? (
        <div className="mt-3">
          <h4 className="label">Uit Canva ({comments.length})</h4>
          <ul className="space-y-1.5">
            {comments.map((c) => (
              <li
                key={c.id}
                className={cn(
                  'rounded-xl border border-ink-200 bg-white px-3 py-2',
                  c.isReply && 'ml-4'
                )}
              >
                <div className="flex items-center gap-2 text-[11px] text-ink-500">
                  <strong className="text-ink-800">{c.authorName}</strong>
                  <span>{formatDateTime(c.createdAt)}</span>
                  {c.resolved ? <Badge color="#3db88b" subtle>opgelost</Badge> : null}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-800">{c.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reviews.length > 0 ? (
        <div className="mt-3">
          <h4 className="label">Beslissingen</h4>
          <ol className="space-y-1">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-1.5 text-xs text-ink-600">
                <span className="font-medium text-ink-800">{DECISION_LABELS[r.decision] ?? r.decision}</span>
                <span>· {r.authorName}</span>
                <span>· {formatDateTime(r.createdAt)}</span>
                {r.pushedToCanva ? (
                  <span className="text-ink-400">· in Canva gezet</span>
                ) : post.canvaDesignId ? (
                  <span className="text-amber-600">· niet in Canva gezet</span>
                ) : null}
                {r.note ? (
                  <p className="w-full whitespace-pre-wrap pl-0 text-ink-700">{r.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
