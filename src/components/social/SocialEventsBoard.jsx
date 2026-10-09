import { useMemo, useState } from 'react'
import { SOCIAL_STAGES, isSociaalGearchiveerd, moetNaarSociaalArchief, stageOf } from '@lib/social-stage'
import { Acties, Button, EmptyState, Input, Schakelknop, Spinner } from '@components/ds'
import KanbanBoard from '@components/board/KanbanBoard'
import TaskDrawer from '@components/board/TaskDrawer'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createTask, updateTask, useSocialEvents, useTasks, zetSociaalArchief } from '@data/tasks'
import { useSocialEventKaarten } from '@data/social-events'
import SocialEventPaneel from './SocialEventPaneel'

/**
 * Het socialbord: elk event dat content moet opleveren, in drie stappen.
 *
 * Dezelfde kaarten en hetzelfde slepen als op het eventbord — het zijn ook
 * dezelfde events. Wat hier verandert is alleen de stand van de content; de
 * status op het eventbord blijft wat ze is, want dat gaat over de opdracht en
 * niet over het beeldmateriaal.
 */
export default function SocialEventsBoard({ socialOwner = null }) {
  const { t } = useTaal()
  const toast = useToast()
  const { uid, isSocial } = useAuth()

  /*
    Twee bronnen voor dezelfde kaarten, en met opzet maar één tegelijk open.

    Het team leest de events zelf. De socialrol mag dat niet — daar staan de
    bedragen op — en leest de kale kopie uit `socialEvents`. Het `aan`-vlaggetje
    zorgt dat er geen abonnement opengaat dat de regels toch weigeren: zo'n
    geweigerde vraag laat het hele scherm op een foutmelding stranden.
  */
  const team = useSocialEvents({ aan: !isSocial })
  const kopie = useSocialEventKaarten({ aan: isSocial })
  const { events: alles, loading } = isSocial ? kopie : team

  const { profileById, tags, boards, socialLists } = useWorkspace()
  const [openTaskId, setOpenTaskId] = useState(null)
  const [nieuw, setNieuw] = useState('')
  const [bezig, setBezig] = useState(false)
  // Het archief bekijken in plaats van het bord. Zie `isSociaalGearchiveerd`.
  const [archief, setArchief] = useState(false)
  const [opruimen, setOpruimen] = useState(false)

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

  const alleEvents = useMemo(
    () => alles.filter((taak) => eventBorden.has(taak.listId) || socialLijsten.has(taak.listId)),
    [alles, eventBorden, socialLijsten]
  )
  const gearchiveerd = useMemo(() => alleEvents.filter(isSociaalGearchiveerd), [alleEvents])
  const events = useMemo(
    () => (archief ? gearchiveerd : alleEvents.filter((e) => !isSociaalGearchiveerd(e))),
    [archief, alleEvents, gearchiveerd]
  )
  const voorbij = useMemo(() => {
    const vandaag = new Date()
    return alleEvents.filter((e) => moetNaarSociaalArchief(e, vandaag))
  }, [alleEvents])

  const archiveer = async (ids, aan) => {
    setOpruimen(true)
    try {
      await zetSociaalArchief(ids, aan)
      toast.success(t(aan ? 'social.bord.gearchiveerd' : 'social.bord.teruggezet', { aantal: ids.length }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setOpruimen(false)
    }
  }

  const columns = useMemo(
    () => SOCIAL_STAGES.map((stap) => ({ key: stap.key, label: stap.label, color: stap.color })),
    []
  )

  const tasksByColumn = useMemo(() => {
    const map = Object.fromEntries(SOCIAL_STAGES.map((s) => [s.key, []]))
    for (const event of events) {
      /*
        Wat gepost is, is voor dit bord klaar. Een socialtaak op een sociallijst
        heeft daar geen afgeronde status voor, en de kaart zei dan "22 dagen te
        laat" in de kolom waar niets meer te laat kán zijn. `open: false` is
        hoe een kaart weet dat er niets meer te doen is (zie `@lib/laat`); het
        wordt alleen hier gezet en nooit weggeschreven.
      */
      const stand = stageOf(event)
      map[stand].push(stand === 'posted' ? { ...event, open: false } : event)
    }
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
        placeholder={t('social.bord.los_plaatshouder')}
        aria-label={t('social.bord.nieuwe_taak')}
      />
      <Button variant="secondary" type="submit" size="sm" disabled={!nieuw.trim() || bezig}>
        {t('alg.toevoegen')}
      </Button>
    </form>
  ) : null

  const drop = ({ task, columnKey }) => {
    // Een kaart uit het archief naar een kolom slepen zet haar terug, ook in
    // dezelfde kolom: dat is de manier om er één terug te halen.
    if (stageOf(task) === columnKey && !isSociaalGearchiveerd(task)) return
    // Alleen de stand; de positie hoort bij het eventbord en mag hier niet
    // verschuiven, anders zet slepen op dit bord het andere bord door elkaar.
    updateTask(task.id, {
      socialStage: columnKey,
      socialWanted: true,
      ...(isSociaalGearchiveerd(task) ? { socialArchived: false } : {}),
    }).catch((err) => toast.error(err.message))
  }

  /*
    De balk boven het bord: links een losse taak, rechts het opruimen.

    Opruimen gebeurt met de hand en niet vanzelf. Een kaart die vanzelf
    verdwijnt, is een kaart waarvan niemand weet waar ze heen is; één knop met
    een telling en een vraag ervoor laat zien wat er gaat gebeuren. En het is
    terug te draaien — daarom een tweede actie en geen gevaar.
  */
  const balk = (
    <div className="je-socialbalk">
      {archief ? <p className="je-muted-caption">{t('social.bord.archief_uitleg')}</p> : nieuweTaakKnop}
      <div className="je-socialbalk__rechts">
        <Schakelknop aan={archief} onClick={() => setArchief((a) => !a)}>
          {t('social.bord.archief', { aantal: gearchiveerd.length })}
        </Schakelknop>
        {archief ? (
          gearchiveerd.length ? (
            <Acties
              plaats="rij"
              tweede={{
                label: t('social.bord.alles_terug'),
                bezig: opruimen,
                vraag: t('social.bord.alles_terug_vraag', { aantal: gearchiveerd.length }),
                onClick: () => archiveer(gearchiveerd.map((e) => e.id), false),
              }}
            />
          ) : null
        ) : voorbij.length ? (
          <Acties
            plaats="rij"
            tweede={{
              label: t('social.bord.opruimen', { aantal: voorbij.length }),
              bezig: opruimen,
              vraag: t('social.bord.opruimen_vraag', { aantal: voorbij.length }),
              onClick: () => archiveer(voorbij.map((e) => e.id), true),
            }}
          />
        ) : null}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <>
        {alleEvents.length ? balk : null}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <EmptyState
            icon="▦"
            // Leeg omdat alles opgeruimd is, is iets anders dan leeg omdat er
            // nog nooit iets stond; de uitleg over "ready to invoice" hoort
            // alleen bij het tweede.
            title={t(
              archief
                ? 'social.bord.archief_leeg'
                : alleEvents.length
                  ? 'social.bord.opgeruimd'
                  : 'social.bord.leeg.titel'
            )}
            description={archief ? null : alleEvents.length ? t('social.bord.opgeruimd_tekst') : t('social.bord.leeg.tekst')}
          />
          {alleEvents.length ? null : nieuweTaakKnop}
        </div>
      </>
    )
  }

  return (
    <>
      {balk}
      <div className="min-h-0 flex-1">
        <KanbanBoard
          columns={columns}
          tasksByColumn={tasksByColumn}
          profiles={profileById}
          tags={tagsByName}
          onOpen={(task) => setOpenTaskId(task.id)}
          onDrop={drop}
          emptyHint={t('social.bord.sleep_hier')}
        />
      </div>

      {openTaskId ? (
        isSocial ? (
          <SocialEventPaneel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
        ) : (
          <EventPaneel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
        )
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
