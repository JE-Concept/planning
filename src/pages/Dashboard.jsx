import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { addDays, dayKey, daysUntil, formatDay, isOverdue, relativeDay, startOfWeek } from '@lib/dates'
import { publicatieMoment } from '@lib/social-planning'
import { isTeLaat } from '@lib/laat'
import { formatDuration, priorityOf } from '@lib/format'
import { runProgress } from '@lib/checklist-templates'
import { Badge, Bar, Button, Icon, ProgressBar, Spinner } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { byEventDate, isDone, useEvents } from '@data/events'
import { useChecklists, useRunsForDay } from '@data/checklists'
import { useMyTasks } from '@data/tasks'
import { useReviewQueue, useSocialPosts, statusMeta } from '@data/social'
import { useTimeEntries } from '@data/time'
import { useGoals, goalProgress } from '@data/goals'

/**
 * Het scherm waarop iemand 's morgens begint.
 *
 * Dit heette "Vandaag" en toonde alleen wat op jouw naam stond. Dat is nuttig,
 * maar het is niet hetzelfde als weten hoe het ervoor staat: of er een event
 * aankomt waar nog niets voor gebeurd is, of de bistro vanmorgen opengegaan is,
 * of er iemand op een goedkeuring van jou wacht.
 *
 * Vandaar één pagina die vier vragen beantwoordt, in die volgorde: wat is er
 * mis, wat komt eraan, wat ligt er bij mij, en hoe staat de rest ervoor. De
 * bovenste rij is daarbij geen sierrand — elk getal is een link naar de plek
 * waar je het oplost. Een cijfer dat zegt dat er drie dingen te laat zijn en je
 * daarna laat zoeken waar, is een verwijt in plaats van een hulp.
 *
 * De meeste gegevens komen uit abonnementen die de schil toch al openheeft
 * (events, lijsten, profielen), dus dit scherm kost weinig extra.
 */
export default function Dashboard() {
  const { uid, profile } = useAuth()
  const { t, locale } = useTaal()
  const { profileById, brandById } = useWorkspace()

  const { events, tasksByEvent, loading: eventsLoading } = useEvents()
  const { tasks, loading } = useMyTasks(uid)
  const toReview = useReviewQueue()
  const week = useMemo(() => {
    const from = startOfWeek()
    return { from, to: addDays(from, 7) }
  }, [])
  const { posts } = useSocialPosts(week)
  const { entries } = useTimeEntries({ month: dayKey(new Date()).slice(0, 7), profileId: uid })
  const { goals } = useGoals()
  const { checklists } = useChecklists()
  const { byChecklist } = useRunsForDay(dayKey(new Date()))

  const today = dayKey(new Date())

  // Te laat op deadline, niet op de volgorde waarin de database het gaf: iets
  // van vorige maand hoort boven iets van gisteren.
  const overdue = useMemo(
    () =>
      tasks
        .filter(isTeLaat)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [tasks]
  )
  const dueToday = tasks.filter((t) => t.dueDate && dayKey(t.dueDate) === today && !isOverdue(t.dueDate))
  const soon = tasks.filter(
    (t) => t.dueDate && dayKey(t.dueDate) > today && new Date(t.dueDate) <= addDays(new Date(), 7)
  )

  /*
    De events die eraan komen, met wat er nog voor te doen is.

    Alleen de toekomst, en niet wat al afgesloten is: een dashboard dat volstaat
    met wat voorbij is, is een archief. Het aantal open taken hoort erbij — dat
    is waarom een event om aandacht vraagt, niet de datum alleen.
  */
  const komende = useMemo(
    () =>
      events
        .filter((e) => !isDone(e) && e.eventDate && daysUntil(e.eventDate) >= 0)
        .sort(byEventDate)
        .slice(0, 6)
        .map((e) => {
          const eigen = tasksByEvent[e.id] ?? []
          const open = eigen.filter((t) => !isDone(t))
          return { ...e, openTaken: open.length, teLaat: open.filter(isTeLaat).length }
        }),
    [events, tasksByEvent]
  )

  const dezeMaand = useMemo(() => {
    const maand = today.slice(0, 7)
    return events.filter((e) => e.eventDate && dayKey(e.eventDate).startsWith(maand)).length
  }, [events, today])

  /*
    Wat er nog aan de facturatie hangt.

    Een event op "ready to invoice" is werk dat gedaan is maar nog geen geld. Dat
    is het soort ding dat wegzakt omdat het niet meer dringend voelt, en juist
    daarom hoort het op een dashboard.
  */
  const teFactureren = useMemo(() => events.filter((e) => e.statusName === 'ready to invoice'), [events])

  const weekSeconds = entries
    .filter((e) => new Date(e.startedAt) >= week.from)
    .reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0)

  /*
    Wat niemand op zijn naam heeft.

    Dit is het werk dat blijft liggen omdat iedereen aanneemt dat een ander het
    doet. Het staat in geen enkele persoonlijke lijst, dus hoort het hier — als
    getal en niet als lijst, want het is een vraag aan het team en niet aan jou.
  */
  const zonderUitvoerder = useMemo(
    () => tasks.filter((t) => (t.assignees ?? []).length === 0),
    [tasks]
  )

  const atRisk = goals
    .filter((g) => g.status === 'active')
    .filter((g) => goalProgress(g) < 0.5 && new Date(g.dueDate) < addDays(new Date(), 30))

  /* De lijsten van vandaag, geteld met dezelfde ogen als de pagina zelf. */
  const lijsten = useMemo(
    () =>
      checklists.map((lijst) => {
        const run = byChecklist[lijst.id]
        return { ...lijst, ...runProgress(lijst, run, { date: new Date(), person: profile }), run }
      }),
    [checklists, byChecklist, profile]
  )

  const firstName = (profile?.fullName || profile?.email || '').split(/[\s@]/)[0]

  // De datum bovenaan en de maand op de eventkaartjes volgen de gekozen taal;
  // een Engelse pagina met "1 oktober" erop leest als een fout.
  const vandaagVoluit = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    [locale]
  )
  const maandKort = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short' }), [locale])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={vandaagVoluit.format(new Date())}
        title={t('nav.dashboard')}
        subtitle={t('dashboard.groet', { naam: firstName })}
      />

      <div className="je-pagebody">
        <div className="je-dash__cijfers">
          <Cijfer
            label={t('dashboard.telaat')}
            waarde={overdue.length}
            naar="/tasks"
            toon={overdue.length ? 'slecht' : 'goed'}
            onder={overdue.length ? t('dashboard.telaat_onder') : t('dashboard.telaat_geen')}
          />
          <Cijfer
            label={t('dashboard.vandaag_af')}
            waarde={dueToday.length}
            naar="/tasks"
            onder={t('dashboard.vandaag_af_onder')}
          />
          <Cijfer
            label={t('dashboard.te_factureren')}
            waarde={teFactureren.length}
            naar="/"
            toon={teFactureren.length ? 'letop' : undefined}
            onder={t('dashboard.te_factureren_onder')}
          />
          <Cijfer
            label={t('dashboard.niemand_toegewezen')}
            waarde={zonderUitvoerder.length}
            naar="/tasks?weergave=lijst&groep=persoon&wie=iedereen"
            toon={zonderUitvoerder.length ? 'letop' : undefined}
            onder={t('dashboard.niemand_toegewezen_onder')}
          />
          <Cijfer
            label={t('dashboard.events_deze_maand')}
            waarde={dezeMaand}
            naar="/kalender"
            onder={t('dashboard.events_deze_maand_onder')}
          />
          <Cijfer
            label={t('dashboard.week_geboekt')}
            waarde={formatDuration(weekSeconds)}
            naar="/uren"
            onder={t('dashboard.week_geboekt_onder')}
          />
        </div>

        <div className="je-dash__kolommen">
          <div className="je-dash__kolom">
            <Paneel
              titel={t('dashboard.aankomst')}
              naar="/"
              naarLabel={t('dashboard.aankomst_naar')}
              leeg={t('dashboard.aankomst_leeg')}
              leegAls={!eventsLoading && komende.length === 0}
            >
              {eventsLoading ? (
                <Laden />
              ) : (
                <ul className="je-tasklist">
                  {komende.map((event) => (
                    <li key={event.id}>
                      <Link to={`/events/${event.id}`} className="je-plainbtn je-taskline">
                        <span className="je-dash__dag">
                          <b>{new Date(event.eventDate).getDate()}</b>
                          <span>
                            {maandKort.format(new Date(event.eventDate))}
                          </span>
                        </span>
                        <span className="je-taskline__title">
                          {event.name}
                          <span className="je-dash__sub">
                            {[event.conceptShort, event.customerName, event.statusName].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {event.teLaat ? (
                          <Badge
                            style={{
                              background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                              color: 'var(--danger)',
                              borderColor: 'transparent',
                            }}
                          >
                            {t('dashboard.telaat_aantal', { aantal: event.teLaat })}
                          </Badge>
                        ) : null}
                        <span className="je-taskline__due">
                          {event.openTaken
                            ? t('dashboard.open_aantal', { aantal: event.openTaken })
                            : t('dashboard.event_klaar')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Paneel>

            <Paneel
              titel={t('dashboard.bij_jou')}
              naar="/tasks"
              naarLabel={t('dashboard.bij_jou_naar')}
              leeg={t('dashboard.bij_jou_leeg')}
              leegAls={!loading && tasks.length === 0}
            >
              {loading ? (
                <Laden />
              ) : (
                <div>
                  <TaakGroep titel={t('dashboard.telaat')} taken={overdue} slecht profileById={profileById} />
                  <TaakGroep titel={t('alg.vandaag')} taken={dueToday} profileById={profileById} />
                  <TaakGroep titel={t('dashboard.deze_week')} taken={soon} profileById={profileById} />
                </div>
              )}
            </Paneel>
          </div>

          <div className="je-dash__kolom">
            <Paneel
              titel={t('dashboard.bistro')}
              naar="/openen-sluiten"
              naarLabel={t('dashboard.bistro_naar')}
              leeg={t('dashboard.bistro_leeg')}
              leegAls={lijsten.length === 0}
            >
              <ul className="je-dash__lijsten">
                {lijsten.map((lijst) => (
                  <li key={lijst.id}>
                    <div className="je-dash__lijstkop">
                      <span>{lijst.name}</span>
                      <span className="je-dash__getal">
                        {lijst.done}/{lijst.total}
                      </span>
                    </div>
                    <Bar pct={Math.round(lijst.ratio * 100)} />
                    <span className="je-dash__sub">
                      {lijst.run?.closedAt
                        ? t('dashboard.afgerond_door', { wie: lijst.run.closedByName })
                        : lijst.run?.participants?.length
                          ? t('dashboard.bezig', { aantal: lijst.run.participants.length })
                          : t('dashboard.nog_niemand')}
                    </span>
                  </li>
                ))}
              </ul>
            </Paneel>

            {toReview.length ? (
              <Paneel
                titel={t('dashboard.wacht_op_jou')}
                naar="/social"
                naarLabel={t('dashboard.wacht_op_jou_naar')}
              >
                <ul className="je-tasklist">
                  {toReview.slice(0, 5).map((post) => (
                    <li key={post.id}>
                      <Link to="/social" className="je-plainbtn je-taskline">
                        <span
                          className="je-taskline__prio"
                          style={{ background: brandById[post.brandId]?.color ?? 'var(--text-3)' }}
                        />
                        <span className="je-taskline__title">{post.title}</span>
                        {post.reviewerId === uid ? <Badge>{t('dashboard.voor_jou')}</Badge> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Paneel>
            ) : null}

            <Paneel
              titel={t('dashboard.socials')}
              naar="/social"
              naarLabel={t('dashboard.socials_naar')}
              leeg={t('dashboard.socials_leeg')}
              leegAls={posts.length === 0}
            >
              <ul className="je-tasklist">
                {posts.slice(0, 6).map((post) => {
                  const status = statusMeta(post.status)
                  return (
                    <li key={post.id}>
                      <Link to="/social" className="je-plainbtn je-taskline">
                        <span
                          className="je-taskline__prio"
                          style={{ background: brandById[post.brandId]?.color ?? 'var(--text-3)' }}
                        />
                        <span className="je-dash__wanneer">{formatDay(publicatieMoment(post))}</span>
                        <span className="je-taskline__title">{post.title}</span>
                        <Badge
                          style={{ background: `${status.color}1f`, color: status.color, borderColor: 'transparent' }}
                        >
                          {status.label}
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Paneel>

            <Paneel
              titel={t('dashboard.goals')}
              naar="/goals"
              naarLabel={t('dashboard.goals_naar')}
              leeg={t('dashboard.goals_leeg')}
              leegAls={atRisk.length === 0}
            >
              <ul className="je-dash__lijsten">
                {atRisk.map((goal) => (
                  <li key={goal.id}>
                    <div className="je-dash__lijstkop">
                      <span>{goal.name}</span>
                      <span className="je-dash__getal">{Math.round(goalProgress(goal) * 100)}%</span>
                    </div>
                    <ProgressBar value={goalProgress(goal)} color={goal.color} />
                  </li>
                ))}
              </ul>
            </Paneel>
          </div>
        </div>
      </div>
    </div>
  )
}

const Laden = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
    <Spinner />
  </div>
)

/** Eén getal uit de bovenste rij — als link, want een cijfer zonder uitweg helpt niet. */
function Cijfer({ label, waarde, onder, toon, naar }) {
  return (
    <Link to={naar} className={`je-plainbtn je-kpi${toon ? ` je-kpi--${toon}` : ''}`}>
      <span className="je-caps">{label}</span>
      <span className="je-kpi__waarde">{waarde}</span>
      {onder ? <span className="je-dash__sub">{onder}</span> : null}
    </Link>
  )
}

function Paneel({ titel, naar, naarLabel, leeg, leegAls = false, children }) {
  return (
    <section className="je-panel">
      <div className="je-panel__head" style={{ padding: 'var(--space-4) var(--space-5)' }}>
        <span className="je-eyebrow">{titel}</span>
        {naar ? (
          <span className="je-panel__right">
            <Button as={Link} to={naar} variant="ghost" size="sm" iconRight="arrow-right">
              {naarLabel}
            </Button>
          </span>
        ) : null}
      </div>
      {leegAls ? (
        <p className="je-dash__leeg">
          <Icon name="check-circle" size={15} />
          {leeg}
        </p>
      ) : (
        children
      )}
    </section>
  )
}

function TaakGroep({ titel, taken, slecht }) {
  const { t } = useTaal()
  if (taken.length === 0) return null

  return (
    <div>
      <h3 className="je-dash__groep" style={slecht ? { color: 'var(--danger)' } : undefined}>
        {titel} <span>{taken.length}</span>
      </h3>
      <ul className="je-tasklist">
        {taken.slice(0, 6).map((task) => {
          const prio = priorityOf(task.priority)
          return (
            <li key={task.id}>
              <Link to={`/bord/${task.listId}`} className="je-plainbtn je-taskline">
                <span
                  className="je-taskline__prio"
                  title={prio?.label ?? t('dashboard.geen_prioriteit')}
                  style={{ background: prio?.color ?? 'transparent' }}
                />
                <span className="je-taskline__title">{task.title}</span>
                <span className="je-taskline__due" style={slecht ? { color: 'var(--danger)' } : undefined}>
                  {relativeDay(task.dueDate)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
