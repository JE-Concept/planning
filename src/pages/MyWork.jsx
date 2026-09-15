import { useMemo, useState } from 'react'
import { addDays, dayKey, isOverdue, relativeDay } from '@lib/dates'
import { formatDuration, priorityOf } from '@lib/format'
import { Badge, EmptyState, Select, Spinner } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import TaskDrawer from '@components/board/TaskDrawer'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useMyTasks } from '@data/tasks'

const BUCKETS = [
  { key: 'overdue', label: 'Te laat', tone: 'text-red-600' },
  { key: 'today', label: 'Vandaag', tone: 'text-ink-700' },
  { key: 'week', label: 'Deze week', tone: 'text-ink-700' },
  { key: 'later', label: 'Later', tone: 'text-ink-500' },
  { key: 'someday', label: 'Zonder datum', tone: 'text-ink-500' },
]

/** Everything assigned to one person, bucketed by when it is actually due. */
export default function MyWork() {
  const { uid } = useAuth()
  const { profiles, listById, tags } = useWorkspace()
  const [who, setWho] = useState(uid)
  const [openTaskId, setOpenTaskId] = useState(null)

  const { tasks, loading } = useMyTasks(who)
  const tagsByName = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])

  const buckets = useMemo(() => {
    const today = dayKey(new Date())
    const weekEnd = addDays(new Date(), 7)
    const out = { overdue: [], today: [], week: [], later: [], someday: [] }

    for (const task of tasks) {
      if (!task.dueDate) out.someday.push(task)
      else if (isOverdue(task.dueDate)) out.overdue.push(task)
      else if (dayKey(task.dueDate) === today) out.today.push(task)
      else if (new Date(task.dueDate) <= weekEnd) out.week.push(task)
      else out.later.push(task)
    }
    return out
  }, [tasks])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Mijn werk"
        subtitle={`${tasks.length} open taken`}
        actions={
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-auto" aria-label="Persoon">
            {profiles.filter((p) => p.active !== false).map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === uid ? 'Ik' : p.fullName || p.email}
              </option>
            ))}
          </Select>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState title="Niets open" description="Geen enkele open taak toegewezen." />
        ) : (
          <div className="space-y-6">
            {BUCKETS.map((bucket) => {
              const items = buckets[bucket.key]
              if (items.length === 0) return null

              return (
                <section key={bucket.key}>
                  <h2 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${bucket.tone}`}>
                    {bucket.label} ({items.length})
                  </h2>

                  <ul className="divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-200 bg-white">
                    {items.map((task) => {
                      const priority = priorityOf(task.priority)
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            onClick={() => setOpenTaskId(task.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50"
                          >
                            {priority ? (
                              <span
                                title={priority.label}
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: priority.color }}
                              />
                            ) : (
                              <span className="h-2 w-2 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1 truncate text-ink-900">{task.title}</span>
                            {task.tags?.map((name) => (
                              <Badge key={name} color={tagsByName[name]?.color ?? '#8593a9'} subtle>
                                {name}
                              </Badge>
                            ))}
                            <span className="hidden w-32 shrink-0 truncate text-xs text-ink-500 sm:block">
                              {listById[task.listId]?.name}
                            </span>
                            {task.trackedSeconds ? (
                              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-500">
                                {formatDuration(task.trackedSeconds)}
                              </span>
                            ) : null}
                            <span
                              className={`w-24 shrink-0 text-right text-xs ${
                                bucket.key === 'overdue' ? 'font-medium text-red-600' : 'text-ink-500'
                              }`}
                            >
                              {relativeDay(task.dueDate)}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {openTaskId ? <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} /> : null}
    </div>
  )
}
