import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PRIORITIES, formatDuration, priorityOf } from '@lib/format'
import { isOverdue, relativeDay } from '@lib/dates'
import {
  AvatarStack,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
} from '@ui/index'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import KanbanBoard from '@components/board/KanbanBoard'
import TaskDrawer from '@components/board/TaskDrawer'
import ColumnEditor from '@components/board/ColumnEditor'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { createTask, moveTaskTo, useTasks } from '@data/tasks'

const GROUPINGS = [
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Persoon' },
  { key: 'priority', label: 'Prioriteit' },
]

const NOBODY = '—unassigned—'

export default function Board() {
  const { listId } = useParams()
  const { listById, spaceById, statusesOf, profiles, profileById, tags } = useWorkspace()
  const { uid } = useAuth()
  const toast = useToast()

  const list = listById[listId]
  const statuses = useMemo(() => statusesOf(listId), [listId, statusesOf])
  const { top, subtasks, loading } = useTasks(listId)

  const [view, setView] = useState('board')
  const [groupBy, setGroupBy] = useState('status')
  const [filters, setFilters] = useState({ q: '', assignee: '', priority: '', tag: '', openOnly: false })
  const [openTaskId, setOpenTaskId] = useState(null)
  const [newTask, setNewTask] = useState(null)
  const [editingColumns, setEditingColumns] = useState(false)

  const tagsByName = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])

  const subtaskCounts = useMemo(() => {
    const counts = {}
    for (const sub of subtasks) counts[sub.parentId] = (counts[sub.parentId] ?? 0) + 1
    return counts
  }, [subtasks])

  // Filtering happens in the browser on purpose: a board is a few hundred
  // documents that are already subscribed, and every extra Firestore filter
  // would need its own composite index.
  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase()

    return top.filter((task) => {
      if (q && !task.title.toLowerCase().includes(q)) return false
      if (filters.assignee === NOBODY && (task.assignees ?? []).length > 0) return false
      if (filters.assignee && filters.assignee !== NOBODY && !task.assignees?.includes(filters.assignee)) return false
      if (filters.priority && String(task.priority ?? '') !== filters.priority) return false
      if (filters.tag && !task.tags?.includes(filters.tag)) return false
      if (filters.openOnly && task.open === false) return false
      return true
    })
  }, [top, filters])

  const { columns, tasksByColumn } = useMemo(() => {
    if (groupBy === 'assignee') {
      const cols = [
        { key: NOBODY, label: 'Niet toegewezen', color: '#8593a9' },
        ...profiles
          .filter((p) => p.active !== false)
          .map((p) => ({ key: p.id, label: p.fullName || p.email, color: '#3377ff' })),
      ]
      const buckets = Object.fromEntries(cols.map((c) => [c.key, []]))
      for (const task of visible) {
        const owners = task.assignees?.length ? task.assignees : [NOBODY]
        for (const owner of owners) if (buckets[owner]) buckets[owner].push(task)
      }
      return { columns: cols, tasksByColumn: buckets }
    }

    if (groupBy === 'priority') {
      const cols = [
        ...PRIORITIES.map((p) => ({ key: String(p.value), label: p.label, color: p.color })),
        { key: '', label: 'Geen prioriteit', color: '#8593a9' },
      ]
      const buckets = Object.fromEntries(cols.map((c) => [c.key, []]))
      for (const task of visible) buckets[String(task.priority ?? '')]?.push(task)
      return { columns: cols, tasksByColumn: buckets }
    }

    const cols = statuses.map((s) => ({ key: s.id, label: s.name, color: s.color }))
    const buckets = Object.fromEntries(cols.map((c) => [c.key, []]))
    const orphans = []
    for (const task of visible) {
      if (buckets[task.statusId]) buckets[task.statusId].push(task)
      else orphans.push(task)
    }
    if (orphans.length > 0) {
      cols.unshift({ key: '', label: 'Zonder status', color: '#8593a9' })
      buckets[''] = orphans
    }
    return { columns: cols, tasksByColumn: buckets }
  }, [groupBy, visible, statuses, profiles])

  const handleDrop = async ({ task, columnKey, index }) => {
    try {
      if (groupBy === 'status') {
        const status = statuses.find((s) => s.id === columnKey) ?? null
        await moveTaskTo({
          taskId: task.id,
          status,
          columnTasks: (tasksByColumn[columnKey] ?? []).filter((t) => t.id !== task.id),
          index,
        })
        return
      }

      // Outside the status grouping, a drop changes the grouped attribute
      // rather than the column order — moving a card onto "Elke" means
      // "assign this to Elke", which is what people expect it to mean.
      const { updateTask } = await import('@data/tasks')
      if (groupBy === 'assignee') {
        await updateTask(task.id, { assignees: columnKey === NOBODY ? [] : [columnKey] })
      } else {
        await updateTask(task.id, { priority: columnKey ? Number(columnKey) : null })
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (!list) {
    return (
      <div className="p-8">
        <EmptyState
          title="Bord niet gevonden"
          description="Dit bord bestaat niet meer, of je hebt er geen toegang toe."
        />
      </div>
    )
  }

  const activeFilters =
    Object.values({ ...filters, openOnly: filters.openOnly ? '1' : '' }).filter(Boolean).length

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={list.name}
        subtitle={spaceById[list.spaceId]?.name}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditingColumns(true)}>
              Kolommen
            </Button>
            <Button variant="primary" onClick={() => setNewTask({ status: statuses[0] })}>
              + Nieuwe taak
            </Button>
          </>
        }
        tabs={
          <>
            <Tab active={view === 'board'} onClick={() => setView('board')}>
              Bord
            </Tab>
            <Tab active={view === 'list'} onClick={() => setView('list')}>
              Lijst
            </Tab>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-white px-4 py-2 sm:px-6">
        <Input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Zoeken in taken…"
          className="h-8 w-44 text-xs"
          aria-label="Zoeken"
        />
        <Select
          value={filters.assignee}
          onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
          className="h-8 w-auto text-xs"
          aria-label="Filter op persoon"
        >
          <option value="">Iedereen</option>
          <option value={NOBODY}>Niet toegewezen</option>
          {profiles.filter((p) => p.active !== false).map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName || p.email}
            </option>
          ))}
        </Select>
        <Select
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className="h-8 w-auto text-xs"
          aria-label="Filter op prioriteit"
        >
          <option value="">Elke prioriteit</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select
          value={filters.tag}
          onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
          className="h-8 w-auto text-xs"
          aria-label="Filter op label"
        >
          <option value="">Elk label</option>
          {tags.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-ink-600">
          <input
            type="checkbox"
            checked={filters.openOnly}
            onChange={(e) => setFilters((f) => ({ ...f, openOnly: e.target.checked }))}
            className="h-3.5 w-3.5 rounded border-ink-300 text-accent-600"
          />
          Enkel open
        </label>

        {activeFilters > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ q: '', assignee: '', priority: '', tag: '', openOnly: false })}
          >
            Filters wissen ({activeFilters})
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-ink-500">Groeperen</span>
          <Select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-8 w-auto text-xs"
            aria-label="Groeperen op"
          >
            {GROUPINGS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 pt-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : view === 'board' ? (
          <KanbanBoard
            columns={columns}
            tasksByColumn={tasksByColumn}
            profiles={profileById}
            tags={tagsByName}
            subtaskCounts={subtaskCounts}
            onOpen={(task) => setOpenTaskId(task.id)}
            onDrop={handleDrop}
            onAdd={
              groupBy === 'status'
                ? (column) => setNewTask({ status: statuses.find((s) => s.id === column.key) })
                : undefined
            }
          />
        ) : (
          <ListView
            columns={columns}
            tasksByColumn={tasksByColumn}
            profileById={profileById}
            tagsByName={tagsByName}
            onOpen={(task) => setOpenTaskId(task.id)}
          />
        )}
      </div>

      {openTaskId ? (
        <TaskDrawer
          taskId={openTaskId}
          subtasks={subtasks.filter((s) => s.parentId === openTaskId)}
          onClose={() => setOpenTaskId(null)}
        />
      ) : null}

      {newTask ? (
        <NewTaskModal
          list={list}
          statuses={statuses}
          initialStatus={newTask.status}
          uid={uid}
          onClose={() => setNewTask(null)}
          onCreated={(id) => {
            setNewTask(null)
            setOpenTaskId(id)
          }}
        />
      ) : null}

      {editingColumns ? (
        <ColumnEditor list={list} statuses={statuses} onClose={() => setEditingColumns(false)} />
      ) : null}
    </div>
  )
}

// ─── List view ──────────────────────────────────────────────────────────────

function ListView({ columns, tasksByColumn, profileById, tagsByName, onOpen }) {
  return (
    <div className="space-y-5 px-4 pb-8 sm:px-6">
      {columns.map((column) => {
        const tasks = tasksByColumn[column.key] ?? []
        if (tasks.length === 0) return null

        return (
          <section key={column.key}>
            <h2 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: column.color }}
              />
              {column.label}
              <span className="font-normal text-ink-400">{tasks.length}</span>
            </h2>

            <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-100">
                  {tasks.map((task) => {
                    const priority = priorityOf(task.priority)
                    return (
                      <tr
                        key={task.id}
                        onClick={() => onOpen(task)}
                        className="cursor-pointer hover:bg-ink-50"
                      >
                        <td className="w-1 py-2 pl-3">
                          {priority ? (
                            <span
                              title={priority.label}
                              className="block h-2 w-2 rounded-full"
                              style={{ backgroundColor: priority.color }}
                            />
                          ) : null}
                        </td>
                        <td className="py-2 pl-2 pr-3">
                          <span className="text-ink-900">{task.title}</span>
                          {task.tags?.length ? (
                            <span className="ml-2 inline-flex gap-1">
                              {task.tags.map((name) => (
                                <Badge key={name} color={tagsByName[name]?.color ?? '#8593a9'} subtle>
                                  {name}
                                </Badge>
                              ))}
                            </span>
                          ) : null}
                        </td>
                        <td className="w-28 px-2 text-right text-xs tabular-nums text-ink-500">
                          {task.trackedSeconds ? formatDuration(task.trackedSeconds) : ''}
                        </td>
                        <td
                          className={`w-32 px-2 text-right text-xs ${
                            task.open !== false && isOverdue(task.dueDate)
                              ? 'font-medium text-red-600'
                              : 'text-ink-500'
                          }`}
                        >
                          {relativeDay(task.dueDate)}
                        </td>
                        <td className="w-24 py-2 pr-3">
                          <AvatarStack
                            profiles={(task.assignees ?? []).map((id) => profileById[id]).filter(Boolean)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ─── New task ───────────────────────────────────────────────────────────────

function NewTaskModal({ list, statuses, initialStatus, uid, onClose, onCreated }) {
  const toast = useToast()
  const { profiles } = useWorkspace()
  const [title, setTitle] = useState('')
  const [statusId, setStatusId] = useState(initialStatus?.id ?? statuses[0]?.id ?? '')
  const [assignee, setAssignee] = useState(uid ?? '')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const id = await createTask({
        list,
        status: statuses.find((s) => s.id === statusId) ?? null,
        title,
        assignees: assignee ? [assignee] : [],
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority ? Number(priority) : null,
        createdBy: uid,
      })
      onCreated(id)
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Nieuwe taak in ${list.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="primary" onClick={submit} disabled={!title.trim() || saving}>
            {saving ? <Spinner className="h-3 w-3" /> : null} Aanmaken
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Titel" className="sm:col-span-2">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wat moet er gebeuren?" />
        </Field>
        <Field label="Status">
          <Select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Toewijzen aan">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Niemand</option>
            {profiles.filter((p) => p.active !== false).map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName || p.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline">
          <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Prioriteit">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Geen</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}
