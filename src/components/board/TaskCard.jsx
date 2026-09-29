import { memo } from 'react'
import { cn } from '@lib/cn'
import { formatDuration, priorityOf } from '@lib/format'
import { prioSleutel, vervaldag } from '@lib/task-view'
import { isTeLaat } from '@lib/laat'
import { AvatarStack, Badge } from '@ui/index'
import { useTaal } from '@context/TaalProvider'

/**
 * One card on the board. Everything it shows is already on the task document —
 * no card triggers a read of its own.
 */
function TaskCard({ task, profiles, tags, subtaskCount = 0, onOpen, dragging, onDragStart, onDragEnd }) {
  const { t } = useTaal()
  const priority = priorityOf(task.priority)
  const assignees = (task.assignees ?? [])
    .map((uid) => profiles[uid])
    .filter(Boolean)
  const overdue = isTeLaat(task)

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart?.(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen?.(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(task)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={task.title}
      className={cn(
        'group cursor-pointer rounded-lg border border-ink-200 bg-white p-2.5 shadow-card transition hover:border-ink-300 hover:shadow-md',
        dragging && 'drag-ghost'
      )}
    >
      <div className="flex items-start gap-2">
        {priority ? (
          <span
            title={t(prioSleutel(priority.value))}
            aria-label={t('bord.prioriteit_van', { naam: t(prioSleutel(priority.value)) })}
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: priority.color }}
          />
        ) : null}
        <p className="min-w-0 flex-1 text-sm leading-snug text-ink-900">{task.title}</p>
      </div>

      {task.tags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((name) => (
            <Badge key={name} color={tags[name]?.color ?? '#8593a9'} subtle>
              {name}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
        {task.dueDate ? (
          <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-red-600')}>
            <span aria-hidden="true">◷</span>
            {vervaldag(t, task.dueDate)}
          </span>
        ) : null}

        {subtaskCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">⊞</span>
            {subtaskCount}
          </span>
        ) : null}

        {task.commentCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">💬</span>
            {task.commentCount}
          </span>
        ) : null}

        {task.trackedSeconds > 0 ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <span aria-hidden="true">⏱</span>
            {formatDuration(task.trackedSeconds)}
          </span>
        ) : null}

        <span className="ml-auto">
          <AvatarStack profiles={assignees} />
        </span>
      </div>
    </article>
  )
}

/**
 * Een kaart hertekent alleen wanneer er aan die kaart iets verandert.
 *
 * Zonder dit tekent het hele bord zich opnieuw bij elke muisbeweging tijdens
 * het slepen — op het eventbord zijn dat honderden kaarten per seconde.
 */
export default memo(TaskCard)
