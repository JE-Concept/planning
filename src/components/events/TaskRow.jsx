import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { daysUntil } from '@lib/dates'
import { isTeLaat } from '@lib/laat'
import { Avatar, Badge, Checkbox, Icon, IconButton } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { isDone, toggleChecklistItem, toggleTaskDone } from '@data/events'
import { startTimer, stopTimer } from '@data/time'
import { updateTask } from '@data/tasks'
import { dayLabel } from './parts'

/**
 * "Vandaag", "Morgen", "2 dagen te laat" of de dag — met de kleur die erbij
 * hoort. `t` komt van buiten: dit is een gewone functie en geen component, en
 * een tekst die van de taal afhangt hoort niet in een rekensom.
 */
export function dueOf(task, t) {
  if (isDone(task)) return { label: t('events.taak.afgerond'), color: 'var(--text-2)' }
  if (!task.dueDate) return { label: t('events.taak.geen_deadline'), color: 'var(--text-3)' }
  const d = daysUntil(task.dueDate)
  if (d < 0 && isTeLaat(task))
    return { label: t('events.taak.te_laat', { aantal: -d }), color: 'var(--danger)', late: true }
  if (d < 0) return { label: t('events.taak.geweest'), color: 'var(--text-3)' }
  if (d === 0) return { label: t('alg.vandaag'), color: 'var(--text-accent)' }
  if (d === 1) return { label: t('alg.morgen'), color: 'var(--text-2)' }
  return { label: dayLabel(task.dueDate), color: 'var(--text-2)' }
}

export const prioOf = (task, t) =>
  isDone(task)
    ? null
    : task.priority === 1
      ? { label: t('events.prio.urgent'), tone: 'danger' }
      : task.priority === 2
        ? { label: t('events.prio.hoog'), tone: 'warning' }
        : null

/**
 * Eén taak: afvinken, openklappen voor de checklist, de timer starten.
 *
 * `variant="mine"` is de vorm uit Mijn taken: het event eronder in plaats van
 * de metagegevens, en de deadline rechts.
 */
export default function TaskRow({ task, event, first, open, onExpand, onDetails, running, variant = 'event' }) {
  const { statusesOf, profileById, listById } = useWorkspace()
  const { uid } = useAuth()
  const { t } = useTaal()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const done = isDone(task)
  const due = dueOf(task, t)
  const prio = prioOf(task, t)
  const checklist = task.checklist ?? []
  const who = profileById[task.assignees?.[0]]

  const toggle = () => {
    toggleTaskDone(task, { event, statuses: statusesOf(task.listId) }).catch((err) => toast.error(err.message))
  }

  const timer = async () => {
    setBusy(true)
    try {
      if (running) {
        await stopTimer(uid)
        toast.success(t('events.taak.tijd_geboekt'))
      } else {
        await startTimer({ uid, task, list: listById[task.listId] })
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const titleEl = (
    <div style={{ font: 'var(--type-body-sm)', fontWeight: 600, color: done ? 'var(--text-3)' : 'var(--text-1)', textDecoration: done ? 'line-through' : 'none' }}>
      {task.title}
    </div>
  )

  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--border-hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-5)' }}>
        <Checkbox checked={done} onChange={toggle} aria-label={t('events.taak.afvinken')} />

        {variant === 'mine' ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            {titleEl}
            {event ? (
              <button
                type="button"
                className="je-plainbtn je-link-quiet"
                onClick={() => navigate(`/events/${event.id}?taak=${task.id}`)}
                style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--text-2)' }}
              >
                {event.name}
              </button>
            ) : (
              <button type="button" className="je-plainbtn je-link-quiet" onClick={onDetails} style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--text-2)' }}>
                {task.listName}
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={onExpand} className="je-plainbtn" style={{ flex: 1, minWidth: 0 }} aria-expanded={open}>
            {titleEl}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', font: 'var(--type-caption)', fontWeight: 400, color: 'var(--text-2)', marginTop: 2 }}>
              <span style={{ color: due.color }}>{due.label}</span>
              {checklist.length ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="list-checks" size={14} />
                  {checklist.filter((c) => c.done).length}/{checklist.length}
                </span>
              ) : null}
              {task.repeat ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="repeat" size={14} />
                  {task.repeat}
                </span>
              ) : null}
              {task.commentCount ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="message-square" size={14} />
                  {task.commentCount}
                </span>
              ) : null}
            </div>
          </button>
        )}

        {prio ? <Badge tone={prio.tone}>{prio.label}</Badge> : null}
        {variant === 'mine' ? (
          <span style={{ font: 'var(--type-caption)', color: due.color, whiteSpace: 'nowrap' }}>{due.label}</span>
        ) : (
          <Avatar profile={who} size={26} />
        )}
        <IconButton
          icon={running ? 'square' : 'play'}
          label={running ? t('timer.stoppen') : t('timer.starten')}
          variant={running ? 'accent' : 'bare'}
          size="sm"
          disabled={busy}
          onClick={timer}
        />
      </div>

      {open && variant !== 'mine' ? (
        <div style={{ padding: '0 var(--space-5) var(--space-4) 54px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {checklist.map((c, i) => (
            <Checkbox
              key={`${c.text}-${i}`}
              checked={!!c.done}
              label={c.text}
              onChange={() => toggleChecklistItem(task, i).catch((err) => toast.error(err.message))}
            />
          ))}
          <input
            className="je-underline-input"
            placeholder={t('events.taak.checklist_hint')}
            aria-label={t('events.taak.checklist_toevoegen')}
            style={{ width: 220 }}
            onKeyDown={(e) => {
              const text = e.currentTarget.value.trim()
              if (e.key !== 'Enter' || !text) return
              e.currentTarget.value = ''
              updateTask(task.id, { checklist: [...checklist, { text, done: false }] }).catch((err) => toast.error(err.message))
            }}
          />
          <span className="je-muted-caption">
            {checklist.length ? null : t('events.taak.geen_checklist')}
            {t('events.taak.geschat', {
              tijd: task.timeEstimateMinutes
                ? t('events.taak.uren', { uren: Math.round((task.timeEstimateMinutes / 60) * 100) / 100 })
                : '—',
            })}
            {onDetails ? (
              <>
                {' · '}
                <button type="button" className="je-plainbtn" style={{ color: 'var(--text-accent)' }} onClick={onDetails}>
                  {t('events.taak.details')}
                </button>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  )
}
