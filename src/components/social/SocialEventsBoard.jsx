import { useMemo, useState } from 'react'
import { SOCIAL_STAGES, stageOf } from '@lib/social-stage'
import { EmptyState, Spinner } from '@ui/index'
import KanbanBoard from '@components/board/KanbanBoard'
import TaskDrawer from '@components/board/TaskDrawer'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { updateTask, useSocialEvents, useTasks } from '@data/tasks'

/**
 * Het socialbord: elk event dat content moet opleveren, in drie stappen.
 *
 * Dezelfde kaarten en hetzelfde slepen als op het eventbord — het zijn ook
 * dezelfde events. Wat hier verandert is alleen de stand van de content; de
 * status op het eventbord blijft wat ze is, want dat gaat over de opdracht en
 * niet over het beeldmateriaal.
 */
export default function SocialEventsBoard() {
  const { events: alles, loading } = useSocialEvents()
  const { profileById, tags, boards } = useWorkspace()
  const toast = useToast()
  const [openTaskId, setOpenTaskId] = useState(null)

  /**
   * Alleen events, geen losse taken.
   *
   * "complete" bestaat ook op het requirementsbord, en zo'n taak is geen event
   * met content. Welke borden het wél zijn, staat niet hardgecodeerd maar volgt
   * uit de kolommen: een bord dat een facturatiefase kent, is een bord met
   * opdrachten voor klanten.
   */
  const eventBorden = useMemo(
    () =>
      new Set(
        boards
          .filter((bord) =>
            (bord.statuses ?? []).some((s) => (s.name ?? '').toLowerCase() === 'ready to invoice')
          )
          .map((bord) => bord.id)
      ),
    [boards]
  )

  const events = useMemo(
    () => alles.filter((event) => eventBorden.has(event.listId)),
    [alles, eventBorden]
  )

  const columns = useMemo(
    () => SOCIAL_STAGES.map((stap) => ({ key: stap.key, label: stap.label, color: stap.color })),
    []
  )

  const tasksByColumn = useMemo(() => {
    const map = Object.fromEntries(SOCIAL_STAGES.map((s) => [s.key, []]))
    for (const event of events) map[stageOf(event)].push(event)
    return map
  }, [events])

  const tagsByName = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])

  const drop = ({ task, columnKey }) => {
    if (stageOf(task) === columnKey) return
    // Alleen de stand; de positie hoort bij het eventbord en mag hier niet
    // verschuiven, anders zet slepen op dit bord het andere bord door elkaar.
    updateTask(task.id, { socialStage: columnKey, socialWanted: true }).catch((err) =>
      toast.error(err.message)
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon="▦"
        title="Nog geen events met social content"
        description="Een event komt hier vanzelf op te staan zodra het op “ready to invoice” komt. Eerder kan ook: zet het aan in het event zelf."
      />
    )
  }

  return (
    <>
      <div className="min-h-0 flex-1">
        <KanbanBoard
          columns={columns}
          tasksByColumn={tasksByColumn}
          profiles={profileById}
          tags={tagsByName}
          onOpen={(task) => setOpenTaskId(task.id)}
          onDrop={drop}
          emptyHint="Sleep hier een event naartoe"
        />
      </div>

      {openTaskId ? (
        <EventPaneel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      ) : null}
    </>
  )
}

/**
 * Hetzelfde paneel als op het eventbord.
 *
 * De subtaken komen uit de lijst waar het event op staat; het socialbord kent
 * die lijst niet vooraf, dus wordt ze hier opgehaald op het moment dat je een
 * kaart opent en niet voor alle events tegelijk.
 */
function EventPaneel({ taskId, onClose }) {
  const { events } = useSocialEvents()
  const event = events.find((e) => e.id === taskId)
  const { subtasks } = useTasks(event?.listId)

  if (!event) return null

  return (
    <TaskDrawer
      taskId={taskId}
      subtasks={subtasks.filter((s) => s.parentId === taskId)}
      onClose={onClose}
    />
  )
}
