import { useCallback, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { PRIORITIES, formatDuration, priorityOf } from '@lib/format'
import { prioSleutel, vervaldag } from '@lib/task-view'
import { isTeLaat } from '@lib/laat'
import { AvatarStack, Badge, Button, EmptyState, Input, Select, Spinner } from '@components/ds'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import KanbanBoard from '@components/board/KanbanBoard'
import TaskDrawer from '@components/board/TaskDrawer'
import NewTaskDialog from '@components/board/NewTaskDialog'
import ColumnEditor from '@components/board/ColumnEditor'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { moveTaskTo, useTasks } from '@data/tasks'
import { STANDAARD_KLEUR, STANDAARD_MERKKLEUR } from '@lib/kleur'

const GROUPINGS = [
  { key: 'status', sleutel: 'tasks.groep.status' },
  { key: 'assignee', sleutel: 'tasks.groep.persoon' },
  { key: 'priority', sleutel: 'tasks.groep.prioriteit' },
]

const NOBODY = '—unassigned—'

export default function Board() {
  const { listId } = useParams()
  const { listById, spaceById, statusesOf, profiles, profileById, tags, eventsList } = useWorkspace()
  const { uid } = useAuth()
  const { t } = useTaal()
  const toast = useToast()

  const list = listById[listId]
  const statuses = useMemo(() => statusesOf(listId), [listId, statusesOf])
  const { tasks, top, subtasks, loading } = useTasks(listId)

  const [view, setView] = useState('board')
  const [groupBy, setGroupBy] = useState('status')
  const [filters, setFilters] = useState({ q: '', assignee: '', priority: '', tag: '', openOnly: false })
  const [openTaskId, setOpenTaskId] = useState(null)
  const [newTask, setNewTask] = useState(null)
  const [editingColumns, setEditingColumns] = useState(false)

  // Vast, zodat de gememoriseerde kaarten niet bij elke render van het bord
  // opnieuw getekend worden.
  const openTask = useCallback((task) => setOpenTaskId(task.id), [])

  const tagsByName = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.name, tag])), [tags])

  /**
   * Hoeveel taken er in elke kolom staan — subtaken meegeteld.
   *
   * De kolomeditor heeft dit nodig om te kunnen zeggen wat er op het spel staat
   * wanneer je een kolom weghaalt, en om de taken mee te verhuizen.
   */
  const statusCounts = useMemo(() => {
    const counts = {}
    for (const task of tasks) {
      if (task.statusId) counts[task.statusId] = (counts[task.statusId] ?? 0) + 1
    }
    return counts
  }, [tasks])

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
        { key: NOBODY, label: t('bord.niet_toegewezen'), color: STANDAARD_KLEUR },
        ...profiles
          .filter((p) => p.active !== false)
          .map((p) => ({ key: p.id, label: p.fullName || p.email, color: STANDAARD_MERKKLEUR })),
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
        ...PRIORITIES.map((p) => ({ key: String(p.value), label: t(prioSleutel(p.value)), color: p.color })),
        { key: '', label: t('tasks.prio.geen'), color: STANDAARD_KLEUR },
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
      cols.unshift({ key: '', label: t('tasks.zonder_status'), color: STANDAARD_KLEUR })
      buckets[''] = orphans
    }
    return { columns: cols, tasksByColumn: buckets }
  }, [groupBy, visible, statuses, profiles, t])

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
        <EmptyState title={t('bord.niet_gevonden')} description={t('bord.niet_gevonden_tekst')} />
      </div>
    )
  }

  /*
    Een bord dat geen eventbord is, is nu een weergave van Tasks.

    Dat scheelt een tweede scherm met dezelfde taken erin. Het adres blijft
    werken — het staat in bladwijzers en in oude links — maar het brengt je naar
    de plek waar dat bord voortaan woont.
  */
  if (eventsList && list.id !== eventsList.id && list.kind !== 'social') {
    return (
      <Navigate
        to={`/tasks?weergave=bord&groep=status&wie=iedereen&lijst=${list.id}`}
        replace
      />
    )
  }

  const activeFilters =
    Object.values({ ...filters, openOnly: filters.openOnly ? '1' : '' }).filter(Boolean).length

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={list.name}
        subtitle={spaceById[list.spaceId]?.name}
        acties={{
          tweede: { label: t('bord.kolommen'), onClick: () => setEditingColumns(true) },
          hoofd: { label: t('bord.nieuwe_taak'), icon: 'plus', onClick: () => setNewTask({ status: statuses[0] }) },
        }}
        tabs={
          <>
            <Tab active={view === 'board'} onClick={() => setView('board')}>
              {t('tasks.weergave.bord')}
            </Tab>
            <Tab active={view === 'list'} onClick={() => setView('list')}>
              {t('tasks.weergave.lijst')}
            </Tab>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-white px-4 py-2 sm:px-6">
        <Input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder={t('bord.zoeken_in_taken')}
          className="h-8 w-44 text-xs"
          aria-label={t('alg.zoeken')}
        />
        <Select
          value={filters.assignee}
          onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
          className="h-8 w-auto text-xs"
          aria-label={t('bord.filter_persoon')}
        >
          <option value="">{t('bord.iedereen')}</option>
          <option value={NOBODY}>{t('bord.niet_toegewezen')}</option>
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
          aria-label={t('bord.filter_prioriteit')}
        >
          <option value="">{t('bord.elke_prioriteit')}</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {t(prioSleutel(p.value))}
            </option>
          ))}
        </Select>
        <Select
          value={filters.tag}
          onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
          className="h-8 w-auto text-xs"
          aria-label={t('bord.filter_label')}
        >
          <option value="">{t('bord.elk_label')}</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
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
          {t('bord.enkel_open')}
        </label>

        {activeFilters > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ q: '', assignee: '', priority: '', tag: '', openOnly: false })}
          >
            {t('bord.filters_wissen', { aantal: activeFilters })}
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-ink-500">{t('bord.groeperen')}</span>
          <Select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-8 w-auto text-xs"
            aria-label={t('tasks.groeperen_op')}
          >
            {GROUPINGS.map((g) => (
              <option key={g.key} value={g.key}>
                {t(g.sleutel)}
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
            onOpen={openTask}
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
            onOpen={openTask}
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
        <NewTaskDialog
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
        <ColumnEditor
          list={list}
          statuses={statuses}
          counts={statusCounts}
          onClose={() => setEditingColumns(false)}
        />
      ) : null}
    </div>
  )
}

// ─── List view ──────────────────────────────────────────────────────────────

function ListView({ columns, tasksByColumn, profileById, tagsByName, onOpen }) {
  const { t } = useTaal()

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
                              title={t(prioSleutel(priority.value))}
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
                                <Badge key={name} color={tagsByName[name]?.color ?? STANDAARD_KLEUR} subtle>
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
                            isTeLaat(task)
                              ? 'font-medium text-red-600'
                              : 'text-ink-500'
                          }`}
                        >
                          {vervaldag(t, task.dueDate)}
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
