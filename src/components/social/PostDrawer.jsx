import { useState } from 'react'
import { formatDateTime, fromLocalInput, toLocalInput } from '@lib/dates'
import { CHANNELS, channelMeta, hoofdKanaal } from '@lib/social-channels'
import { heeftEigenPublicatiedatum, publicatieMoment } from '@lib/social-planning'
import {
  Avatar,
  Badge,
  Button,
  ConfirmButton,
  Drawer,
  Field,
  Input,
  Select,
  Textarea,
} from '@ui/index'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  POST_STATUSES,
  deletePost,
  setPublicatiedatum,
  toggleChannel,
  updatePost,
  usePost,
} from '@data/social'
import { addComment, deleteComment, useComments } from '@data/comments'
import PostPreview from './PostPreview'
import ProjectLink from './ProjectLink'
import ReviewPanel from './ReviewPanel'

export default function PostDrawer({ postId, onClose }) {
  const post = usePost(postId)
  const { brands, profiles, brandById } = useWorkspace()
  const { profile } = useAuth()

  if (!post) return null

  const brand = brandById[post.brandId]
  const captionLength = (post.caption ?? '').length
  const moment = publicatieMoment(post)
  const eigenDatum = heeftEigenPublicatiedatum(post)
  // De tekstlimiet verschilt per kanaal; het strengste gekozen kanaal beslist.
  const kanaal = channelMeta(hoofdKanaal(post))

  return (
    <Drawer
      open
      onClose={onClose}
      title={post.title}
      subtitle={
        brand
          ? `${brand.name} · ${formatDateTime(moment) || 'nog geen publicatiedatum'}`
          : undefined
      }
      footer={
        <>
          <span className="text-xs text-ink-400">
            {post.publishedUrl ? (
              <a href={post.publishedUrl} target="_blank" rel="noreferrer" className="underline">
                Bekijk de publicatie
              </a>
            ) : (
              'Nog niet gepubliceerd'
            )}
          </span>
          <ConfirmButton
            variant="danger"
            size="sm"
            question="Deze post verwijderen?"
            onConfirm={() => deletePost(post.id).then(onClose)}
          >
            Verwijderen
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-6 px-5 py-4">
        <Input
          defaultValue={post.title}
          onBlur={(e) => e.target.value.trim() && updatePost(post.id, { title: e.target.value.trim() })}
          aria-label="Titel"
          className="text-base font-semibold"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Merk">
            <Select value={post.brandId} onChange={(e) => updatePost(post.id, { brandId: e.target.value })}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status">
            <Select value={post.status} onChange={(e) => updatePost(post.id, { status: e.target.value })}>
              {POST_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          {/* De publicatiedatum staat los van het event: een aankondiging gaat
              weken vooraf online, een nabeschouwing dagen erna. Zolang niemand
              er een gekozen heeft, staat hier de datum die van het event kwam —
              met de melding erbij, want die datum heeft niemand bedoeld. */}
          <Field
            label="Publiceren op"
            hint={
              moment && !eigenDatum
                ? 'Overgenomen van het event. Pas aan voor een eigen publicatiemoment.'
                : undefined
            }
          >
            <Input
              type="datetime-local"
              value={toLocalInput(moment)}
              onChange={(e) => setPublicatiedatum(post.id, fromLocalInput(e.target.value))}
            />
          </Field>

          <Field label="Verantwoordelijke">
            <Select
              value={post.assigneeId ?? ''}
              onChange={(e) => updatePost(post.id, { assigneeId: e.target.value || null })}
            >
              <option value="">Niemand</option>
              {profiles.filter((p) => p.active !== false).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName || p.email}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <section>
          <h3 className="label">Kanalen</h3>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((channel) => {
              const on = post.channels?.includes(channel.key)
              return (
                <button
                  key={channel.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleChannel(post, channel.key)}
                >
                  <Badge color={channel.color} subtle={!on}>
                    {channel.label}
                  </Badge>
                </button>
              )
            })}
          </div>
        </section>

        <PostPreview post={post} brand={brand} />

        <ProjectLink post={post} />

        <Field
          label="Link naar het ontwerp"
          hint={
            post.assetUrl ? (
              <a href={post.assetUrl} target="_blank" rel="noreferrer" className="underline">
                Ontwerp openen
              </a>
            ) : undefined
          }
        >
          <Input
            type="url"
            defaultValue={post.assetUrl ?? ''}
            onBlur={(e) => updatePost(post.id, { assetUrl: e.target.value.trim() || null })}
            placeholder="https://…"
          />
        </Field>

        <ReviewPanel post={post} />

        <Field
          label="Caption"
          hint={`${captionLength} tekens${
            kanaal.captionMax != null && captionLength > kanaal.captionMax
              ? ` — te lang voor ${kanaal.label} (max ${kanaal.captionMax})`
              : ''
          }`}
        >
          <Textarea
            rows={6}
            defaultValue={post.caption ?? ''}
            onBlur={(e) => updatePost(post.id, { caption: e.target.value })}
            placeholder="De tekst zoals hij online komt…"
          />
        </Field>

        <Field label="Hashtags">
          <Textarea
            rows={2}
            defaultValue={post.hashtags ?? ''}
            onBlur={(e) => updatePost(post.id, { hashtags: e.target.value })}
            placeholder="#barvue #sinttruiden"
          />
        </Field>

        <Field label="Link naar de publicatie">
          <Input
            type="url"
            defaultValue={post.publishedUrl ?? ''}
            onBlur={(e) => updatePost(post.id, { publishedUrl: e.target.value || null })}
            placeholder="https://www.instagram.com/p/…"
          />
        </Field>

        <Field label="Interne notities">
          <Textarea
            rows={3}
            defaultValue={post.notes ?? ''}
            onBlur={(e) => updatePost(post.id, { notes: e.target.value })}
          />
        </Field>

        <PostComments postId={post.id} profile={profile} />
      </div>
    </Drawer>
  )
}

function PostComments({ postId, profile }) {
  const comments = useComments({ postId })
  const [body, setBody] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    await addComment({ postId, body, author: profile })
    setBody('')
  }

  return (
    <section>
      <h3 className="label">Feedback ({comments.length})</h3>
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md bg-ink-50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <Avatar profile={{ fullName: c.authorName }} size="xs" />
              <strong className="text-ink-800">{c.authorName}</strong>
              <span>{formatDateTime(c.createdAt)}</span>
              {c.authorId === profile?.id ? (
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-5 w-5 p-0"
                  question="Reactie verwijderen?"
                  onConfirm={() => deleteComment(c)}
                  aria-label="Reactie verwijderen"
                >
                  ✕
                </ConfirmButton>
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">{c.body}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Feedback geven…" />
        <Button type="submit" variant="primary" disabled={!body.trim()}>
          Plaatsen
        </Button>
      </form>
    </section>
  )
}
