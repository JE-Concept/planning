import { useState } from 'react'
import { formatDateTime } from '@lib/dates'
import { Avatar, Badge, Button, Field, Select, Spinner, Textarea } from '@ui/index'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { reviewMeta, reviewPost, setReviewer, usePostReviews } from '@data/social'

const DECISION_LABELS = {
  request: 'Review gevraagd',
  approve: 'Goedgekeurd',
  changes: 'Aanpassing gevraagd',
}

/**
 * The review of a post: who looks at it, what they decided, and why.
 * Every decision lands in the review log, so the history reads top to bottom.
 */
export default function ReviewPanel({ post }) {
  const { profile } = useAuth()
  const { profiles, profileById } = useWorkspace()
  const toast = useToast()
  const reviews = usePostReviews(post.id)

  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const review = reviewMeta(post.reviewState)
  const reviewer = post.reviewerId ? profileById[post.reviewerId] : null

  const act = async (action) => {
    setBusy(true)
    try {
      await reviewPost({ post, action, note, actor: profile })
      setNote('')
      toast.success(`${DECISION_LABELS[action]}.`)
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
          placeholder="Wat moet de ontwerper weten?"
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
        </div>

        {busy ? (
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Spinner className="h-3 w-3" /> Bezig…
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

      {reviews.length > 0 ? (
        <div className="mt-3">
          <h4 className="label">Beslissingen</h4>
          <ol className="space-y-1">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-1.5 text-xs text-ink-600">
                <span className="font-medium text-ink-800">{DECISION_LABELS[r.decision] ?? r.decision}</span>
                <span>· {r.authorName}</span>
                <span>· {formatDateTime(r.createdAt)}</span>
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
