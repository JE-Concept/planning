import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@lib/cn'
import { addDays, dayKey, formatDay, isOverdue, relativeDay, startOfWeek } from '@lib/dates'
import { formatDuration, priorityOf } from '@lib/format'
import { AvatarStack, Badge, EmptyState, ProgressBar, Spinner } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useMyTasks } from '@data/tasks'
import { useReviewQueue, useSocialPosts, statusMeta } from '@data/social'
import { useTimeEntries } from '@data/time'
import { useGoals, goalProgress } from '@data/goals'

/** The one screen somebody opens in the morning: what is late, what is today. */
export default function Dashboard() {
  const { uid, profile } = useAuth()
  const { profileById, brandById } = useWorkspace()

  const { tasks, loading } = useMyTasks(uid)
  const toReview = useReviewQueue()
  const week = useMemo(() => {
    const from = startOfWeek()
    return { from, to: addDays(from, 7) }
  }, [])
  const { posts } = useSocialPosts(week)
  const { entries } = useTimeEntries({ month: dayKey(new Date()).slice(0, 7), profileId: uid })
  const { goals } = useGoals()

  const today = dayKey(new Date())

  const overdue = tasks.filter((t) => isOverdue(t.dueDate))
  const dueToday = tasks.filter((t) => t.dueDate && dayKey(t.dueDate) === today && !isOverdue(t.dueDate))
  const soon = tasks.filter(
    (t) => t.dueDate && dayKey(t.dueDate) > today && new Date(t.dueDate) <= addDays(new Date(), 7)
  )

  const weekSeconds = entries
    .filter((e) => new Date(e.startedAt) >= week.from)
    .reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0)

  const atRisk = goals
    .filter((g) => g.status === 'active')
    .filter((g) => goalProgress(g) < 0.5 && new Date(g.dueDate) < addDays(new Date(), 30))

  const firstName = (profile?.fullName || profile?.email || '').split(/[\s@]/)[0]

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`Dag ${firstName}`}
        subtitle={new Intl.DateTimeFormat('nl-BE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date())}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <Stat label="Te laat" value={overdue.length} tone={overdue.length > 0 ? 'bad' : 'good'} />
          <Stat label="Vandaag af" value={dueToday.length} />
          <Stat label="Deze week geboekt" value={formatDuration(weekSeconds)} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="card p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
              Mijn werk
            </h2>

            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : tasks.length === 0 ? (
              <EmptyState title="Niets open" description="Alles wat aan jou toegewezen is, is afgewerkt." />
            ) : (
              <div className="space-y-4">
                <TaskGroup title="Te laat" tasks={overdue} tone="bad" profileById={profileById} />
                <TaskGroup title="Vandaag" tasks={dueToday} profileById={profileById} />
                <TaskGroup title="Komende week" tasks={soon} profileById={profileById} />
              </div>
            )}

            <Link to="/mijn-taken" className="mt-3 inline-block text-xs font-medium text-accent-700 hover:underline">
              Alles bekijken →
            </Link>
          </section>

          <div className="space-y-4">
            {toReview.length > 0 ? (
              <section className="card p-4">
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  Wacht op review
                  <Badge color="#b660e0">{toReview.length}</Badge>
                </h2>

                <ul className="divide-y divide-ink-100">
                  {toReview.slice(0, 6).map((post) => {
                    const brand = brandById[post.brandId]
                    const mine = post.reviewerId === uid

                    return (
                      <li key={post.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: brand?.color ?? '#8593a9' }}
                        />
                        <span className="min-w-0 flex-1 truncate text-ink-800">{post.title}</span>
                        {post.taskTitle ? (
                          <span className="hidden max-w-28 shrink-0 truncate text-[11px] text-ink-400 sm:block">
                            {post.taskTitle}
                          </span>
                        ) : null}
                        {mine ? <Badge color="#b660e0">voor jou</Badge> : null}
                      </li>
                    )
                  })}
                </ul>

                <Link
                  to="/social"
                  className="mt-3 inline-block text-xs font-medium text-accent-700 hover:underline"
                >
                  Nakijken →
                </Link>
              </section>
            ) : null}

            <section className="card p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                Social deze week
              </h2>

              {posts.length === 0 ? (
                <p className="py-3 text-sm text-ink-500">Er staat niets ingepland deze week.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {posts.slice(0, 8).map((post) => {
                    const brand = brandById[post.brandId]
                    const status = statusMeta(post.status)
                    return (
                      <li key={post.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: brand?.color ?? '#8593a9' }}
                        />
                        <span className="w-12 shrink-0 text-xs text-ink-500">
                          {formatDay(post.scheduledAt)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-ink-800">{post.title}</span>
                        <Badge color={status.color} subtle>
                          {status.label}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              )}

              <Link to="/social" className="mt-3 inline-block text-xs font-medium text-accent-700 hover:underline">
                Naar de kalender →
              </Link>
            </section>

            <section className="card p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                Goals die aandacht vragen
              </h2>

              {atRisk.length === 0 ? (
                <p className="py-3 text-sm text-ink-500">Alle lopende goals liggen op schema.</p>
              ) : (
                <ul className="space-y-2">
                  {atRisk.map((goal) => (
                    <li key={goal.id}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="truncate text-ink-800">{goal.name}</span>
                        <span className="text-xs tabular-nums text-ink-500">
                          {Math.round(goalProgress(goal) * 100)}%
                        </span>
                      </div>
                      <ProgressBar value={goalProgress(goal)} color={goal.color} className="mt-1 h-1.5" />
                    </li>
                  ))}
                </ul>
              )}

              <Link to="/goals" className="mt-3 inline-block text-xs font-medium text-accent-700 hover:underline">
                Alle goals →
              </Link>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 font-display text-3xl font-extrabold tabular-nums',
          tone === 'bad' ? 'text-red-600' : 'text-ink-900'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function TaskGroup({ title, tasks, tone, profileById }) {
  if (tasks.length === 0) return null

  return (
    <div>
      <h3
        className={cn(
          'mb-1 text-[11px] font-semibold uppercase tracking-wide',
          tone === 'bad' ? 'text-red-600' : 'text-ink-500'
        )}
      >
        {title} ({tasks.length})
      </h3>
      <ul className="divide-y divide-ink-100">
        {tasks.map((task) => {
          const priority = priorityOf(task.priority)
          return (
            <li key={task.id} className="flex items-center gap-2 py-1.5 text-sm">
              {priority ? (
                <span
                  title={priority.label}
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: priority.color }}
                />
              ) : (
                <span className="h-2 w-2 shrink-0" />
              )}
              <Link to={`/bord/${task.listId}`} className="min-w-0 flex-1 truncate text-ink-800 hover:underline">
                {task.title}
              </Link>
              <span className={cn('text-xs', tone === 'bad' ? 'text-red-600' : 'text-ink-500')}>
                {relativeDay(task.dueDate)}
              </span>
              <AvatarStack
                profiles={(task.assignees ?? []).map((id) => profileById[id]).filter(Boolean)}
                max={2}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
