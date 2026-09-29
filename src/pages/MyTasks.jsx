import { useMemo, useState } from 'react'
import { daysUntil } from '@lib/dates'
import TaskDrawer from '@components/board/TaskDrawer'
import PageHeader from '@components/layout/PageHeader'
import TaskRow from '@components/events/TaskRow'
import { MONTHS_FULL, WD_FULL } from '@components/events/parts'
import { useAuth } from '@context/AuthProvider'
import { byDue, isDone, useEvents } from '@data/events'
import { useMyTasks } from '@data/tasks'
import { useRunningTimer } from '@data/time'

/**
 * Mijn taken: alles wat op mijn naam staat, gegroepeerd op wanneer het moet.
 *
 * De taken onder events komen uit de eventlijst (ook wat vandaag afgevinkt
 * werd, zodat je ziet wat je al deed); de open taken op andere borden komen
 * erbij, zodat niets van je lijst valt.
 */
export default function MyTasks() {
  const { uid, profile } = useAuth()
  const { tasks: eventTasks, eventById } = useEvents()
  const { tasks: openElsewhere } = useMyTasks(uid)
  const { timer } = useRunningTimer(uid)
  const [drawer, setDrawer] = useState(null)

  const mine = useMemo(() => {
    const fromEvents = eventTasks.filter((t) => t.assignees?.includes(uid) && (!isDone(t) || (t.dueDate && daysUntil(t.dueDate) >= -1)))
    const ids = new Set(fromEvents.map((t) => t.id))
    // Events zelf staan niet in Mijn taken: die staan op het bord.
    const other = openElsewhere.filter((t) => !ids.has(t.id) && !eventById[t.id])
    return [...fromEvents, ...other].sort(byDue)
  }, [eventTasks, openElsewhere, uid, eventById])

  const groups = [
    { label: 'Te laat', color: 'var(--danger)', test: (t) => !isDone(t) && t.dueDate && daysUntil(t.dueDate) < 0 },
    { label: 'Vandaag', color: 'var(--text-accent)', test: (t) => t.dueDate && daysUntil(t.dueDate) === 0 },
    { label: 'Deze week', color: 'var(--text-accent)', test: (t) => t.dueDate && daysUntil(t.dueDate) > 0 && daysUntil(t.dueDate) <= 6 },
    { label: 'Later', color: 'var(--text-2)', test: (t) => t.dueDate && daysUntil(t.dueDate) > 6 },
    { label: 'Zonder deadline', color: 'var(--text-2)', test: (t) => !t.dueDate },
  ]
    .map((g) => ({ ...g, tasks: mine.filter((t) => g.test(t) && !(isDone(t) && daysUntil(t.dueDate) < 0)) }))
    .filter((g) => g.tasks.length)

  const now = new Date()
  const first = (profile?.fullName || '').split(' ')[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={`Dag ${first} · ${WD_FULL[now.getDay()]} ${now.getDate()} ${MONTHS_FULL[now.getMonth()]}`}
        title="Mijn taken"
      />
      <div className="je-pagebody">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 880 }}>
          {groups.length === 0 ? (
            <div className="je-panel" style={{ padding: 'var(--space-7)' }}>
              <div style={{ font: 'var(--type-body)', fontWeight: 600 }}>Niets op je lijst.</div>
              <div className="je-muted-caption">Taken die aan jou toegewezen worden, verschijnen hier.</div>
            </div>
          ) : null}
          {groups.map((g) => (
            <section key={g.label} className="je-panel">
              <div className="je-panel__head" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <span className="je-eyebrow" style={{ color: g.color }}>
                  {g.label}
                </span>
                <span className="je-panel__right">
                  {g.tasks.length} {g.tasks.length === 1 ? 'taak' : 'taken'}
                </span>
              </div>
              {g.tasks.map((t, i) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  event={eventById[t.parentId]}
                  first={i === 0}
                  variant="mine"
                  running={timer?.taskId === t.id}
                  onDetails={() => setDrawer(t.id)}
                />
              ))}
            </section>
          ))}
        </div>
      </div>
      {drawer ? <TaskDrawer taskId={drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  )
}
