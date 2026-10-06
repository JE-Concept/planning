import { useState } from 'react'
import { formatDateTime, fromLocalInput, toLocalInput } from '@lib/dates'
import { CHANNELS, channelMeta, hoofdKanaal } from '@lib/social-channels'
import { heeftEigenPublicatiedatum, publicatieMoment } from '@lib/social-planning'
import { Acties, Avatar, Badge, Drawer, Field, GevaarKnop, Input, Select, Textarea } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
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
import PostTimer from './PostTimer'
import ReviewPanel from './ReviewPanel'

export default function PostDrawer({ postId, onClose }) {
  const post = usePost(postId)
  const { brands, profiles, brandById } = useWorkspace()
  const { profile, isSocial } = useAuth()
  const { t } = useTaal()

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
          ? `${brand.name} · ${formatDateTime(moment) || t('social.post.geen_datum_klein')}`
          : undefined
      }
      footer={
        <Acties
          uitleg={
            post.publishedUrl ? (
              <a href={post.publishedUrl} target="_blank" rel="noreferrer" className="underline">
                {t('social.post.bekijk_publicatie')}
              </a>
            ) : (
              t('social.post.niet_gepubliceerd')
            )
          }
          gevaar={{
            label: t('alg.verwijderen'),
            size: 'sm',
            vraag: t('social.post.verwijder_vraag'),
            onConfirm: () => deletePost(post.id).then(onClose),
          }}
        />
      }
    >
      <div className="space-y-6 px-5 py-4">
        <Input
          defaultValue={post.title}
          onBlur={(e) => e.target.value.trim() && updatePost(post.id, { title: e.target.value.trim() })}
          aria-label={t('social.veld.titel')}
          className="text-base font-semibold"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('social.veld.merk')}>
            <Select value={post.brandId} onChange={(e) => updatePost(post.id, { brandId: e.target.value })}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('social.veld.status')}>
            <Select value={post.status} onChange={(e) => updatePost(post.id, { status: e.target.value })}>
              {POST_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {t(s.sleutel)}
                </option>
              ))}
            </Select>
          </Field>

          {/* De publicatiedatum staat los van het event: een aankondiging gaat
              weken vooraf online, een nabeschouwing dagen erna. Zolang niemand
              er een gekozen heeft, staat hier de datum die van het event kwam —
              met de melding erbij, want die datum heeft niemand bedoeld. */}
          <Field
            label={t('social.veld.publiceren_op')}
            hint={moment && !eigenDatum ? t('social.veld.publiceren_op_hint') : undefined}
          >
            <Input
              type="datetime-local"
              value={toLocalInput(moment)}
              onChange={(e) => setPublicatiedatum(post.id, fromLocalInput(e.target.value))}
            />
          </Field>

          <Field label={t('social.veld.verantwoordelijke')}>
            <Select
              value={post.assigneeId ?? ''}
              onChange={(e) => updatePost(post.id, { assigneeId: e.target.value || null })}
            >
              <option value="">{t('alg.niemand')}</option>
              {profiles.filter((p) => p.active !== false).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName || p.email}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <section>
          <h3 className="label">{t('social.veld.kanalen')}</h3>
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

        <PostTimer post={post} />

        <Field
          label={t('social.veld.ontwerp_link')}
          hint={
            post.assetUrl ? (
              <a href={post.assetUrl} target="_blank" rel="noreferrer" className="underline">
                {t('social.veld.ontwerp_openen')}
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
          label={t('social.veld.caption')}
          hint={
            kanaal.captionMax != null && captionLength > kanaal.captionMax
              ? t('social.caption.te_lang', {
                  aantal: captionLength,
                  kanaal: kanaal.label,
                  max: kanaal.captionMax,
                })
              : t('social.caption.tekens', { aantal: captionLength })
          }
        >
          <Textarea
            rows={6}
            defaultValue={post.caption ?? ''}
            onBlur={(e) => updatePost(post.id, { caption: e.target.value })}
            placeholder={t('social.caption.plaatshouder')}
          />
        </Field>

        <Field label={t('social.veld.hashtags')}>
          <Textarea
            rows={2}
            defaultValue={post.hashtags ?? ''}
            onBlur={(e) => updatePost(post.id, { hashtags: e.target.value })}
            placeholder="#barvue #sinttruiden"
          />
        </Field>

        <Field label={t('social.veld.publicatie_link')}>
          <Input
            type="url"
            defaultValue={post.publishedUrl ?? ''}
            onBlur={(e) => updatePost(post.id, { publishedUrl: e.target.value || null })}
            placeholder="https://www.instagram.com/p/…"
          />
        </Field>

        <Field label={t('social.veld.notities')}>
          <Textarea
            rows={3}
            defaultValue={post.notes ?? ''}
            onBlur={(e) => updatePost(post.id, { notes: e.target.value })}
          />
        </Field>

        {/*
          De reactiedraad staat er niet voor de socialrol.

          `comments` is één collectie voor de reacties op posts én die op taken,
          en op taken staat waar het over gaat: bedragen, klanten, marges. De
          regels laten haar die collectie daarom niet lezen, en dus kreeg ze hier
          een draad die niets toonde en een knop die haar tekst opslokte zonder
          iets te zeggen. Wat ze wél heeft is het reviewpaneel hierboven: dat is
          de weg waarlangs de terugkoppeling op een post loopt.

          Dit weghalen is dus geen verlies — het was er al niet. Wil je haar toch
          in de draad, dan is dat een beveiligingsbeslissing: de reacties op posts
          moeten dan eerst uit dezelfde collectie als die op taken.
        */}
        {isSocial ? null : <PostComments postId={post.id} profile={profile} />}
      </div>
    </Drawer>
  )
}

function PostComments({ postId, profile }) {
  const { t } = useTaal()
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
      <h3 className="label">{t('social.feedback.kop', { aantal: comments.length })}</h3>
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md bg-ink-50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <Avatar profile={{ fullName: c.authorName }} size="xs" />
              <strong className="text-ink-800">{c.authorName}</strong>
              <span>{formatDateTime(c.createdAt)}</span>
              {c.authorId === profile?.id ? (
                <GevaarKnop
                  icon="x"
                  size="sm"
                  className="ml-auto"
                  vraag={t('social.feedback.verwijder_vraag')}
                  onConfirm={() => deleteComment(c)}
                  aria-label={t('social.feedback.verwijderen')}
                />
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">{c.body}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('social.feedback.plaatshouder')} />
        <Acties plaats="rij" hoofd={{ label: t('social.feedback.plaatsen'), type: 'submit', uit: !body.trim() }} />
      </form>
    </section>
  )
}
