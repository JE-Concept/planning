import { useMemo, useState } from 'react'
import { SOCIAL_STAGES, stageOf } from '@lib/social-stage'
import { Button, EmptyState, Input, Spinner } from '@ui/index'
import KanbanBoard from '@components/board/KanbanBoard'
import TaskDrawer from '@components/board/TaskDrawer'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createTask, updateTask, useSocialEvents, useTasks } from '@data/tasks'

/**
 * Het socialbord: elk event dat content moet opleveren, in drie stappen.
 *
 * Dezelfde kaarten en hetzelfde slepen als op het eventbord — het zijn ook
 * dezelfde events. Wat hier verandert is alleen de stand van de content; de
 * status op het eventbord blijft wat ze is, want dat gaat over de opdracht en
 * niet over het beeldmateriaal.
 */
export default function SocialEventsBoard({ socialOwner = null }) {
  const { events: alles, loading } = useSocialEvents()
  const { profileById, tags, boards, socialLists } = useWorkspace()
  const toast = useToast()
  const { uid } = useAuth()
  const [openTaskId, setOpenTaskId] = useState(null)
  const [nieuw, setNieuw] = useState('')
  const [bezig, setBezig] = useState(false)

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

  /*
    Niet alles op dit bord komt uit een event.

    Er is socialwerk dat op zichzelf staat: een reel over de nieuwe kaart, een
    reeks over het seizoen. Dat hoort hier thuis maar heeft geen opdracht van een
    klant eronder, en het moest tot nu toe aan een event gehangen worden dat er
    niet was. Zulke taken staan op de sociallijst zelf; die herken je aan de soort
    van de lijst, dus er is geen extra veld voor nodig.
  */
  const socialLijsten = useMemo(
    () => new Set(socialLists.map((l) => l.id)),
    [socialLists]
  )

  const events = useMemo(
    () => alles.filter((taak) => eventBorden.has(taak.listId) || socialLijsten.has(taak.listId)),
    [alles, eventBorden, socialLijsten]
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

  /*
    Een socialtaak die niet uit een event komt.

    Ze landt op de sociallijst met de eerste stap erop, en gaat standaard naar
    wie de content maakt — die staat in de instellingen en niet hier, want dat is
    een persoon en geen regel. Zonder toewijzing zou zo'n taak op niemands lijst
    verschijnen, en dat is precies waar los werk blijft liggen.
  */
  const maakLosseTaak = async () => {
    const titel = nieuw.trim()
    const lijst = socialLists[0]
    if (!titel || !lijst) return

    setBezig(true)
    try {
      await createTask({
        list: lijst,
        status: (lijst.statuses ?? [])[0] ?? null,
        title: titel,
        assignees: socialOwner?.id ? [socialOwner.id] : [],
        socialStage: SOCIAL_STAGES[0].key,
        socialWanted: true,
        createdBy: uid,
      })
      setNieuw('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const nieuweTaakKnop = socialLists.length ? (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        maakLosseTaak()
      }}
      className="je-sociallos"
    >
      <Input
        value={nieuw}
        onChange={(e) => setNieuw(e.target.value)}
        placeholder="Los socialwerk, zonder event"
        aria-label="Nieuwe socialtaak"
      />
      <Button type="submit" size="sm" disabled={!nieuw.trim() || bezig}>
        Toevoegen
      </Button>
    </form>
  ) : null

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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <EmptyState
          icon="▦"
          title="Nog geen social content"
          description="Een event komt hier vanzelf op te staan zodra het op “ready to invoice” komt. Eerder kan ook: zet het aan in het event zelf. Werk dat los van een event staat, voeg je hier toe."
        />
        {nieuweTaakKnop}
      </div>
    )
  }

  return (
    <>
      {nieuweTaakKnop}
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
