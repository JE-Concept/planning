import { cn } from '@lib/cn'
import { formatTime } from '@lib/dates'
import { channelMeta, kanalenVan } from '@lib/social-channels'
import { heeftEigenPublicatiedatum, publicatieMoment } from '@lib/social-planning'
import { useTaal } from '@context/TaalProvider'
import { reviewMeta, statusMeta } from '@data/social'
import { STANDAARD_KLEUR } from '@lib/kleur'

/** A post as it appears in a calendar cell: brand colour, time, thumbnail, channels. */
export default function PostCard({ post, brand, compact = false, dragging, onOpen, onDragStart, onDragEnd }) {
  const { t } = useTaal()
  const status = statusMeta(post.status)
  const review = post.reviewState && post.reviewState !== 'none' ? reviewMeta(post.reviewState) : null
  const moment = publicatieMoment(post)
  const kanalen = kanalenVan(post)
  const statusNaam = t(status.sleutel)

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart?.(e, post)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.(post)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen?.(post)
      }}
      role="button"
      tabIndex={0}
      aria-label={
        kanalen.length
          ? t('social.kaart.label_kanalen', {
              titel: post.title,
              status: statusNaam,
              kanalen: kanalen.map((k) => channelMeta(k).label).join(', '),
            })
          : t('social.kaart.label', { titel: post.title, status: statusNaam })
      }
      className={cn(
        'group cursor-pointer overflow-hidden rounded-md border bg-white text-left transition hover:shadow-md',
        dragging && 'drag-ghost'
      )}
      style={{ borderLeft: `3px solid ${brand?.color ?? STANDAARD_KLEUR}` }}
    >
      <div className="px-1.5 py-1">
        <div className="flex items-center gap-1">
          {moment ? (
            <span
              className="text-[10px] tabular-nums text-ink-500"
              // Een datum die nog van het event komt heeft niemand gekozen; dat
              // hoort te zien te zijn vóór de post de deur uit gaat.
              title={
                heeftEigenPublicatiedatum(post)
                  ? t('social.kaart.publicatiedatum')
                  : t('social.kaart.van_event')
              }
            >
              {formatTime(moment)}
              {heeftEigenPublicatiedatum(post) ? '' : '*'}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            title={statusNaam}
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span className="truncate text-[11px] font-medium text-ink-800">{post.title}</span>
          {review ? (
            <span
              aria-hidden="true"
              title={t(review.sleutel)}
              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white"
              style={{ backgroundColor: review.color }}
            />
          ) : null}
        </div>

        {post.taskTitle && !compact ? (
          <p className="truncate text-[10px] text-ink-500" title={post.taskTitle}>
            ▤ {post.taskTitle}
          </p>
        ) : null}

        {/* Het kanaal met zoveel letters dat je het herkent zonder de kleuren
            uit je hoofd te kennen — op een gedeeld scherm kijkt niet iedereen
            even goed, en IG is niet FB. */}
        {kanalen.length > 0 ? (
          <div className="je-postcard__kanalen">
            {kanalen.map((key) => {
              const channel = channelMeta(key)
              return (
                <span
                  key={key}
                  title={channel.label}
                  className="je-postcard__kanaal"
                  style={{ color: channel.color, borderColor: `${channel.color}59` }}
                >
                  {channel.short}
                </span>
              )
            })}
          </div>
        ) : null}
      </div>
    </article>
  )
}
