import { cn } from '@lib/cn'
import { formatTime } from '@lib/dates'
import { channelMeta, reviewMeta, statusMeta } from '@data/social'

/** A post as it appears in a calendar cell: brand colour, time, thumbnail, channels. */
export default function PostCard({ post, brand, compact = false, dragging, onOpen, onDragStart, onDragEnd }) {
  const status = statusMeta(post.status)
  const review = post.reviewState && post.reviewState !== 'none' ? reviewMeta(post.reviewState) : null

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
      aria-label={`${post.title} — ${status.label}`}
      className={cn(
        'group cursor-pointer overflow-hidden rounded-md border bg-white text-left transition hover:shadow-md',
        dragging && 'drag-ghost'
      )}
      style={{ borderLeft: `3px solid ${brand?.color ?? '#8593a9'}` }}
    >
      {post.canvaThumbnailUrl && !compact ? (
        <img
          src={post.canvaThumbnailUrl}
          alt=""
          loading="lazy"
          className="h-16 w-full bg-ink-100 object-cover"
        />
      ) : null}

      <div className="px-1.5 py-1">
        <div className="flex items-center gap-1">
          {post.scheduledAt ? (
            <span className="text-[10px] tabular-nums text-ink-500">{formatTime(post.scheduledAt)}</span>
          ) : null}
          <span
            aria-hidden="true"
            title={status.label}
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span className="truncate text-[11px] font-medium text-ink-800">{post.title}</span>
          {review ? (
            <span
              aria-hidden="true"
              title={review.label}
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

        {post.channels?.length ? (
          <div className="mt-0.5 flex flex-wrap gap-0.5">
            {post.channels.map((key) => {
              const channel = channelMeta(key)
              return (
                <span
                  key={key}
                  title={channel.label}
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: channel.color }}
                />
              )
            })}
          </div>
        ) : null}
      </div>
    </article>
  )
}
