import { useMemo, useRef, useState } from 'react'
import { cn } from '@lib/cn'
import { byPosition } from '@lib/position'
import { Button } from '@ui/index'
import TaskCard from './TaskCard'

/**
 * Drag and drop with the browser's own API — no dependency, and it keeps
 * keyboard users on the drawer's status picker rather than inventing a second
 * interaction model.
 *
 * A drop is described by (column, index). The index comes from where the
 * pointer sits relative to each card's midpoint, which is what makes dropping
 * *between* two cards possible instead of only appending to a column.
 */
export default function KanbanBoard({
  columns,
  tasksByColumn,
  profiles,
  tags,
  subtaskCounts = {},
  onOpen,
  onDrop,
  onAdd,
  emptyHint,
}) {
  const [dragId, setDragId] = useState(null)
  const [target, setTarget] = useState(null)
  const dragged = useRef(null)

  const handleDragStart = (e, task) => {
    dragged.current = task
    setDragId(task.id)
    e.dataTransfer.effectAllowed = 'move'
    // Firefox refuses to start a drag without payload.
    e.dataTransfer.setData('text/plain', task.id)
  }

  const handleDragEnd = () => {
    dragged.current = null
    setDragId(null)
    setTarget(null)
  }

  const indexAt = (columnKey, clientY) => {
    const cards = Array.from(
      document.querySelectorAll(`[data-column="${CSS.escape(columnKey)}"] [data-card]`)
    ).filter((el) => el.dataset.card !== dragged.current?.id)

    for (let i = 0; i < cards.length; i += 1) {
      const box = cards[i].getBoundingClientRect()
      if (clientY < box.top + box.height / 2) return i
    }
    return cards.length
  }

  const handleDragOver = (e, columnKey) => {
    if (!dragged.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setTarget({ columnKey, index: indexAt(columnKey, e.clientY) })
  }

  const handleDrop = (e, columnKey) => {
    e.preventDefault()
    const task = dragged.current
    const index = target?.columnKey === columnKey ? target.index : indexAt(columnKey, e.clientY)
    handleDragEnd()
    if (task) onDrop?.({ task, columnKey, index })
  }

  const totals = useMemo(
    () =>
      Object.fromEntries(
        columns.map((c) => [c.key, (tasksByColumn[c.key] ?? []).length])
      ),
    [columns, tasksByColumn]
  )

  return (
    <div className="flex h-full gap-3 overflow-x-auto px-4 pb-4 sm:px-6">
      {columns.map((column) => {
        const tasks = [...(tasksByColumn[column.key] ?? [])].sort(byPosition)
        const isTarget = target?.columnKey === column.key

        return (
          <section
            key={column.key}
            data-column={column.key}
            onDragOver={(e) => handleDragOver(e, column.key)}
            onDragLeave={() => setTarget((t) => (t?.columnKey === column.key ? null : t))}
            onDrop={(e) => handleDrop(e, column.key)}
            aria-label={`${column.label} (${totals[column.key]})`}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-lg bg-ink-100/70 transition-colors',
              isTarget && 'bg-accent-50 ring-1 ring-accent-300'
            )}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: column.color }}
              />
              <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-ink-700">
                {column.label}
              </h2>
              <span className="rounded bg-white px-1.5 text-[11px] font-medium text-ink-500">
                {totals[column.key]}
              </span>
              {onAdd ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 w-6 p-0"
                  aria-label={`Taak toevoegen in ${column.label}`}
                  onClick={() => onAdd(column)}
                >
                  +
                </Button>
              ) : null}
            </header>

            <div className="flex min-h-[3rem] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
              {tasks.map((task, i) => (
                <div key={task.id} data-card={task.id}>
                  {isTarget && target.index === i ? <DropLine /> : null}
                  <TaskCard
                    task={task}
                    profiles={profiles}
                    tags={tags}
                    subtaskCount={subtaskCounts[task.id] ?? 0}
                    dragging={dragId === task.id}
                    onOpen={onOpen}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              ))}

              {isTarget && target.index >= tasks.filter((t) => t.id !== dragId).length ? (
                <DropLine />
              ) : null}

              {tasks.length === 0 && !isTarget ? (
                <p className="px-2 py-4 text-center text-xs text-ink-400">
                  {emptyHint ?? 'Sleep hier een taak naartoe'}
                </p>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function DropLine() {
  return <div aria-hidden="true" className="my-1 h-0.5 rounded-full bg-accent-500" />
}
