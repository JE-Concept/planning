import { useEffect, useMemo, useState } from 'react'
import { formatDate, formatDateTime, toLocalInput, fromLocalInput } from '@lib/dates'
import { formatCurrency, formatDuration, PRIORITIES } from '@lib/format'
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
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  archiveTask,
  createTask,
  deleteTask,
  setTaskStatus,
  toggleAssignee,
  toggleTag,
  updateTask,
  useTask,
} from '@data/tasks'
import { addComment, deleteComment, useComments } from '@data/comments'
import { addManualEntry, startTimer, stopTimer, useRunningTimer, useTaskTimeEntries, deleteEntry } from '@data/time'

/** Saves on blur rather than on every keystroke: one write per edit, not per letter. */
function useDraft(value, save) {
  const [draft, setDraft] = useState(value ?? '')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(value ?? '')
  }, [value, dirty])

  return {
    value: draft,
    onChange: (e) => {
      setDraft(e.target.value)
      setDirty(true)
    },
    onBlur: () => {
      if (!dirty) return
      setDirty(false)
      if ((value ?? '') !== draft) save(draft)
    },
  }
}

export default function TaskDrawer({ taskId, subtasks = [], onClose }) {
  const task = useTask(taskId)
  const { profiles, profileById, tags, listById, statusesOf } = useWorkspace()
  const { uid, profile } = useAuth()
  const toast = useToast()

  const title = useDraft(task?.title, (v) => v.trim() && updateTask(task.id, { title: v.trim() }))
  const description = useDraft(task?.description, (v) => updateTask(task.id, { description: v }))

  const list = task ? listById[task.listId] : null
  const statuses = useMemo(() => (task ? statusesOf(task.listId) : []), [task, statusesOf])

  if (!task) return null

  const tagsByName = Object.fromEntries(tags.map((t) => [t.name, t]))

  return (
    <Drawer
      open
      onClose={onClose}
      title={task.title}
      subtitle={list ? `${list.name}${task.statusName ? ` · ${task.statusName}` : ''}` : undefined}
      footer={
        <>
          <span className="text-xs text-ink-400">
            Aangemaakt {formatDate(task.createdAt?.toDate?.() ?? task.createdAt)}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => archiveTask(task.id).then(onClose)}>
              Archiveren
            </Button>
            <ConfirmButton
              variant="danger"
              size="sm"
              question="Deze taak en alle subtaken definitief verwijderen?"
              onConfirm={() =>
                deleteTask(task.id)
                  .then(onClose)
                  .catch((err) => toast.error(err.message))
              }
            >
              Verwijderen
            </ConfirmButton>
          </div>
        </>
      }
    >
      <div className="space-y-6 px-5 py-4">
        <input
          className="w-full rounded-md border border-transparent px-2 py-1.5 text-base font-semibold text-ink-900 hover:border-ink-200 focus:border-accent-500 focus:outline-none"
          aria-label="Titel"
          {...title}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select
              value={task.statusId ?? ''}
              onChange={(e) =>
                setTaskStatus(task.id, statuses.find((s) => s.id === e.target.value) ?? null)
              }
            >
              <option value="">Geen status</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prioriteit">
            <Select
              value={task.priority ?? ''}
              onChange={(e) =>
                updateTask(task.id, {
                  priority: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Geen</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Startdatum">
            <Input
              type="datetime-local"
              value={toLocalInput(task.startDate?.toDate?.() ?? task.startDate)}
              onChange={(e) => updateTask(task.id, { startDate: fromLocalInput(e.target.value) })}
            />
          </Field>

          <Field label="Deadline">
            <Input
              type="datetime-local"
              value={toLocalInput(task.dueDate?.toDate?.() ?? task.dueDate)}
              onChange={(e) => updateTask(task.id, { dueDate: fromLocalInput(e.target.value) })}
            />
          </Field>

          <Field label="Raming (minuten)">
            <Input
              type="number"
              min="0"
              step="15"
              value={task.timeEstimateMinutes ?? ''}
              onChange={(e) =>
                updateTask(task.id, {
                  timeEstimateMinutes: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </Field>

          <Field label="Budget" hint={task.budget ? formatCurrency(task.budget) : undefined}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={task.budget ?? ''}
              onChange={(e) =>
                updateTask(task.id, { budget: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>

          <Field label="Locatie" className="sm:col-span-2">
            <Input
              defaultValue={task.location ?? ''}
              onBlur={(e) => updateTask(task.id, { location: e.target.value || null })}
              placeholder="Adres of zaal"
            />
          </Field>
        </div>

        <section>
          <h3 className="label">Toegewezen aan</h3>
          <div className="flex flex-wrap gap-1.5">
            {profiles
              .filter((p) => p.active !== false)
              .map((p) => {
                const on = task.assignees?.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleAssignee(task, p.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition ${
                      on
                        ? 'border-accent-300 bg-accent-50 text-accent-800'
                        : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                    }`}
                  >
                    <Avatar profile={p} size="xs" />
                    {p.fullName || p.email}
                  </button>
                )
              })}
          </div>
        </section>

        <section>
          <h3 className="label">Labels</h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = task.tags?.includes(t.name)
              return (
                <button key={t.id} type="button" onClick={() => toggleTag(task, t.name)} aria-pressed={on}>
                  <Badge color={t.color} subtle={!on}>
                    {t.name}
                  </Badge>
                </button>
              )
            })}
            {tags.length === 0 ? (
              <p className="text-xs text-ink-400">
                Nog geen labels — maak ze aan bij Instellingen.
              </p>
            ) : null}
          </div>
        </section>

        <Field label="Omschrijving">
          <Textarea rows={5} placeholder="Wat moet er precies gebeuren?" {...description} />
        </Field>

        <Subtasks task={task} subtasks={subtasks} tagsByName={tagsByName} profileById={profileById} />

        <TimeSection task={task} list={list} uid={uid} toast={toast} profileById={profileById} />

        <CommentSection taskId={task.id} profile={profile} />
      </div>
    </Drawer>
  )
}

// ─── Subtasks ───────────────────────────────────────────────────────────────

function Subtasks({ task, subtasks, profileById }) {
  const { listById, statusesOf } = useWorkspace()
  const [title, setTitle] = useState('')
  const statuses = statusesOf(task.listId)
  const done = statuses.find((s) => s.kind === 'closed' || s.kind === 'done')
  const open = statuses.find((s) => s.kind === 'open') ?? statuses[0]

  const add = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await createTask({
      list: listById[task.listId],
      status: open,
      title,
      parentId: task.id,
    })
    setTitle('')
  }

  return (
    <section>
      <h3 className="label">Subtaken ({subtasks.length})</h3>
      <ul className="space-y-1">
        {subtasks.map((sub) => {
          const finished = sub.open === false
          return (
            <li key={sub.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-ink-50">
              <input
                type="checkbox"
                checked={finished}
                aria-label={`${sub.title} afwerken`}
                onChange={() => setTaskStatus(sub.id, finished ? open : done ?? open)}
                className="h-4 w-4 rounded border-ink-300 text-accent-600 focus:ring-accent-500"
              />
              <span className={`flex-1 text-sm ${finished ? 'text-ink-400 line-through' : 'text-ink-800'}`}>
                {sub.title}
              </span>
              {(sub.assignees ?? []).slice(0, 1).map((assignee) => (
                <Avatar key={assignee} profile={profileById[assignee]} size="xs" />
              ))}
              <ConfirmButton
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-ink-400"
                question="Subtaak verwijderen?"
                onConfirm={() => deleteTask(sub.id)}
                aria-label="Subtaak verwijderen"
              >
                ✕
              </ConfirmButton>
            </li>
          )
        })}
      </ul>

      <form onSubmit={add} className="mt-2 flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Subtaak toevoegen…"
        />
        <Button type="submit" variant="secondary" disabled={!title.trim()}>
          Toevoegen
        </Button>
      </form>
    </section>
  )
}

// ─── Time ───────────────────────────────────────────────────────────────────

function TimeSection({ task, list, uid, toast, profileById }) {
  const entries = useTaskTimeEntries(task.id)
  const { timer, elapsed } = useRunningTimer(uid)
  const [manual, setManual] = useState(false)
  const runningHere = timer?.taskId === task.id

  const estimate = (task.timeEstimateMinutes ?? 0) * 60
  const tracked = task.trackedSeconds ?? 0

  const toggle = async () => {
    try {
      if (runningHere) {
        await stopTimer(uid)
        toast.success('Tijd geboekt.')
      } else {
        await startTimer({ uid, task, list })
        toast.success('Timer loopt op deze taak.')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="label mb-0">Tijd</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setManual((m) => !m)}>
            Handmatig
          </Button>
          <Button variant={runningHere ? 'danger' : 'secondary'} size="sm" onClick={toggle}>
            {runningHere ? `■ ${formatDuration(elapsed, { withSeconds: true })}` : '▶ Start'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-ink-600">
        <strong className="tabular-nums text-ink-900">{formatDuration(tracked)}</strong> geboekt
        {estimate > 0 ? (
          <>
            {' '}
            van {formatDuration(estimate)} geraamd
            {tracked > estimate ? (
              <span className="ml-1 text-red-600">
                (+{formatDuration(tracked - estimate)})
              </span>
            ) : null}
          </>
        ) : null}
      </p>

      {manual ? <ManualEntryForm task={task} list={list} uid={uid} toast={toast} onDone={() => setManual(false)} /> : null}

      {entries.length > 0 ? (
        <ul className="mt-2 divide-y divide-ink-100 rounded-md border border-ink-200">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <Avatar profile={profileById[entry.profileId]} size="xs" />
              <span className="tabular-nums font-medium text-ink-800">
                {formatDuration(entry.durationSeconds)}
              </span>
              <span className="truncate text-ink-500">
                {formatDateTime(entry.startedAt)}
                {entry.description ? ` · ${entry.description}` : ''}
              </span>
              <ConfirmButton
                variant="ghost"
                size="sm"
                className="ml-auto h-6 w-6 p-0 text-ink-400"
                question="Tijdsregistratie verwijderen?"
                onConfirm={() => deleteEntry(entry)}
                aria-label="Verwijderen"
              >
                ✕
              </ConfirmButton>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function ManualEntryForm({ task, list, uid, toast, onDone }) {
  const now = new Date()
  const [startedAt, setStartedAt] = useState(toLocalInput(new Date(now.getTime() - 3600000)))
  const [endedAt, setEndedAt] = useState(toLocalInput(now))
  const [description, setDescription] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    try {
      await addManualEntry({
        uid,
        task,
        list,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        description,
      })
      toast.success('Tijd toegevoegd.')
      onDone()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 grid gap-2 rounded-md bg-ink-50 p-3 sm:grid-cols-2">
      <Field label="Van">
        <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
      </Field>
      <Field label="Tot">
        <Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
      </Field>
      <Field label="Omschrijving" className="sm:col-span-2">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" size="sm">
          Toevoegen
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Annuleren
        </Button>
      </div>
    </form>
  )
}

// ─── Comments ───────────────────────────────────────────────────────────────

function CommentSection({ taskId, profile }) {
  const comments = useComments({ taskId })
  const [body, setBody] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    await addComment({ taskId, body, author: profile })
    setBody('')
  }

  return (
    <section>
      <h3 className="label">Reacties ({comments.length})</h3>
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md bg-ink-50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-ink-500">
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
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reactie schrijven…"
        />
        <Button type="submit" variant="primary" disabled={!body.trim()}>
          Plaatsen
        </Button>
      </form>
    </section>
  )
}
