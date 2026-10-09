import { useMemo, useState } from 'react'
import { cn } from '@lib/cn'
import {
  addDays,
  addMonths,
  dayKey,
  endOfDay,
  formatDate,
  formatMonth,
  isToday,
  monthGrid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  WEEKDAYS,
} from '@lib/dates'
import { bucketPerDag, publicatieMoment, weekDagen, weekNummer } from '@lib/social-planning'
import { Badge, Button, EmptyState, Input, PeriodeKiezer, Select, Spinner } from '@components/ds'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import PostCard from '@components/social/PostCard'
import PostDrawer from '@components/social/PostDrawer'
import SocialEventsBoard from '@components/social/SocialEventsBoard'
import WeekBoard from '@components/social/WeekBoard'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  POST_STATUSES,
  createPost,
  movePostTo,
  updatePost,
  useSocialOwner,
  useSocialPosts,
  useUnscheduledPosts,
} from '@data/social'

/**
 * The content calendar. Brands share one grid rather than getting a tab each,
 * because the question the team asks is "what goes out this week", not "what
 * does Bar Vue do".
 */
export default function SocialCalendar() {
  const { brands, brandById, profiles } = useWorkspace()
  const { uid } = useAuth()
  const { t } = useTaal()
  const toast = useToast()

  const [month, setMonth] = useState(() => startOfMonth())
  const [week, setWeek] = useState(() => startOfWeek())
  // Het eventbord staat vooraan: dat is de vraag waarmee de week begint —
  // van welke events moet er nog content komen?
  const [view, setView] = useState('events')
  const [brandFilter, setBrandFilter] = useState([])
  const [projectFilter, setProjectFilter] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [openPostId, setOpenPostId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [overDay, setOverDay] = useState(null)
  const [onderwerp, setOnderwerp] = useState('')

  // Onderwerpen komen altijd bij dezelfde persoon terecht; wie dat is, staat
  // in de instellingen en niet in deze code.
  const socialOwnerEmail = useSocialOwner()
  const socialOwner = useMemo(
    () => profiles.find((p) => (p.email ?? '').toLowerCase() === socialOwnerEmail) ?? null,
    [profiles, socialOwnerEmail]
  )

  /**
   * Wat er opgehaald wordt hangt af van de weergave.
   *
   * De laatste dag loopt tot middernacht en niet tot het begin ervan: een post
   * die op de laatste dag om 18:00 online gaat viel er anders buiten, en dan
   * ontbreekt hij op de kalender zonder dat iemand ziet waarom.
   */
  const range = useMemo(() => {
    if (view === 'week') {
      const dagen = weekDagen(week)
      return { from: startOfDay(dagen[0]), to: endOfDay(dagen[6]) }
    }
    const weeks = monthGrid(month)
    return { from: weeks[0][0], to: endOfDay(weeks[weeks.length - 1][6]) }
  }, [view, week, month])

  const { posts, loading } = useSocialPosts(range)
  const backlog = useUnscheduledPosts()

  // The projects that actually have a post this month; a dropdown of every task
  // in the workspace would be a wall of options nobody scrolls through.
  const projects = useMemo(() => {
    const map = new Map()
    for (const post of [...posts, ...backlog]) {
      if (post.taskId) map.set(post.taskId, post.taskTitle || t('social.project.kop'))
    }
    return [...map].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title))
  }, [posts, backlog, t])

  const waitingForReview = useMemo(
    () => posts.filter((p) => p.reviewState === 'requested').length,
    [posts]
  )

  const shown = useMemo(() => {
    let out = posts
    if (brandFilter.length > 0) out = out.filter((p) => brandFilter.includes(p.brandId))
    if (projectFilter) out = out.filter((p) => p.taskId === projectFilter)
    if (reviewOnly) out = out.filter((p) => p.reviewState === 'requested')
    return out
  }, [posts, brandFilter, projectFilter, reviewOnly])

  const byDay = useMemo(() => bucketPerDag(shown), [shown])

  const toggleBrand = (id) =>
    setBrandFilter((f) => (f.includes(id) ? f.filter((b) => b !== id) : [...f, id]))

  const dropOn = async (date) => {
    setOverDay(null)
    if (!dragId) return
    const post = [...posts, ...backlog].find((p) => p.id === dragId)
    setDragId(null)
    if (!post) return

    // Dropping on a day keeps the hour the post already had; a post that never
    // had one lands at 10:00, which is when this team usually posts.
    const previous = publicatieMoment(post)
    const next = new Date(date)
    next.setHours(previous?.getHours() ?? 10, previous?.getMinutes() ?? 0, 0, 0)

    try {
      await movePostTo(post.id, next)
    } catch (err) {
      toast.error(err.message)
    }
  }

  /**
   * Een onderwerp op de kalender zetten.
   *
   * Zonder datum: het is een idee, geen afspraak. Het landt in de lijst
   * "zonder datum" ernaast en wordt een post zodra iemand het op een dag
   * sleept.
   */
  const addOnderwerp = async (e) => {
    e.preventDefault()
    const titel = onderwerp.trim()
    if (!titel) return

    const brandId = brandFilter[0] ?? brands[0]?.id
    if (!brandId) {
      toast.error(t('social.geen_merk'))
      return
    }

    try {
      await createPost({
        brandId,
        publishAt: null,
        title: titel,
        createdBy: uid,
        assigneeId: socialOwner?.id ?? null,
      })
      setOnderwerp('')
    } catch (err) {
      toast.error(err.message)
    }
  }

  /**
   * Een post op een dag zetten.
   *
   * Vanuit de weekweergave komt het kanaal mee: je klikt daar in de rij van
   * een kanaal, en dan is dát het kanaal — anders staat de nieuwe post meteen
   * in de verkeerde rij.
   */
  const addOn = async (date, channel) => {
    const brandId = brandFilter[0] ?? brands[0]?.id
    if (!brandId) {
      toast.error(t('social.geen_merk'))
      return
    }
    const when = new Date(date)
    when.setHours(10, 0, 0, 0)

    try {
      const id = await createPost({
        brandId,
        publishAt: when,
        title: 'Nieuwe post',
        createdBy: uid,
        assigneeId: socialOwner?.id ?? null,
        ...(channel ? { channels: [channel] } : {}),
      })
      setOpenPostId(id)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const weeks = monthGrid(month)
  const monthIndex = startOfMonth(month).getMonth()

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('nav.socials')}
        subtitle={
          view === 'events'
            ? t('social.kop.events')
            : view === 'week'
              ? t('social.kop.week', {
                  aantal: shown.length,
                  week: weekNummer(week),
                  van: formatDate(weekDagen(week)[0]),
                  tot: formatDate(weekDagen(week)[6]),
                })
              : t('social.kop.maand', { aantal: shown.length, maand: formatMonth(month) })
        }
        bediening={
          view === 'events' ? null : view === 'week' ? (
            <PeriodeKiezer
              vorige={{ label: t('social.week.vorige'), onClick: () => setWeek((w) => addDays(w, -7)) }}
              nu={{ label: t('social.week.deze'), onClick: () => setWeek(startOfWeek()) }}
              volgende={{ label: t('social.week.volgende'), onClick: () => setWeek((w) => addDays(w, 7)) }}
            />
          ) : (
            <PeriodeKiezer
              vorige={{ label: t('social.maand.vorige'), onClick: () => setMonth((m) => addMonths(m, -1)) }}
              nu={{ label: t('alg.vandaag'), onClick: () => setMonth(startOfMonth()) }}
              volgende={{ label: t('social.maand.volgende'), onClick: () => setMonth((m) => addMonths(m, 1)) }}
            />
          )
        }
        acties={
          view === 'events' ? null : { hoofd: { label: t('social.post.nieuw'), icon: 'plus', onClick: () => addOn(new Date()) } }
        }
        tabs={
          <>
            <Tab active={view === 'events'} onClick={() => setView('events')}>
              {t('nav.events')}
            </Tab>
            <Tab active={view === 'calendar'} onClick={() => setView('calendar')}>
              {t('nav.kalender')}
            </Tab>
            <Tab active={view === 'week'} onClick={() => setView('week')}>
              {t('social.tab.week')}
            </Tab>
            <Tab active={view === 'board'} onClick={() => setView('board')}>
              {t('social.tab.posts')}
            </Tab>
          </>
        }
      />

      {view === 'events' ? null : (
      <div className="je-paginarand flex flex-wrap items-center gap-1.5 border-b border-ink-200 bg-white py-2">
        {brands.map((brand) => (
          <button key={brand.id} type="button" onClick={() => toggleBrand(brand.id)} aria-pressed={brandFilter.includes(brand.id)}>
            <Badge color={brand.color} subtle={brandFilter.length > 0 && !brandFilter.includes(brand.id)}>
              {brand.name}
            </Badge>
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" aria-hidden="true" />

        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label={t('social.filter.project')}
          className="h-7 w-44 py-0 text-xs"
        >
          <option value="">{t('social.filter.alle_projecten')}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </Select>

        <button type="button" onClick={() => setReviewOnly((v) => !v)} aria-pressed={reviewOnly}>
          <Badge tone={reviewOnly ? 'solid' : 'accent'}>
            {t('social.filter.wacht_op_review', { aantal: waitingForReview })}
          </Badge>
        </button>

        {brandFilter.length > 0 || projectFilter || reviewOnly ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBrandFilter([])
              setProjectFilter('')
              setReviewOnly(false)
            }}
          >
            {t('social.filter.alles_tonen')}
          </Button>
        ) : null}
      </div>
      )}

      {view === 'events' ? (
        <SocialEventsBoard socialOwner={socialOwner} />
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : view === 'week' ? (
        <WeekBoard
          week={week}
          posts={shown}
          brandById={brandById}
          onOpen={(p) => setOpenPostId(p.id)}
          onAdd={addOn}
          drag={{
            id: dragId,
            over: overDay,
            onStart: (e, p) => {
              setDragId(p.id)
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', p.id)
            },
            onEnd: () => setDragId(null),
            onOver: (key) => setOverDay(key),
            onLeave: (key) => setOverDay((d) => (d === key ? null : d)),
            onDrop: dropOn,
          }}
        />
      ) : view === 'board' ? (
        <ProductionBoard
          posts={shown}
          brandById={brandById}
          onOpen={(p) => setOpenPostId(p.id)}
          onMove={(post, status) => updatePost(post.id, { status }).catch((e) => toast.error(e.message))}
        />
      ) : (
        <div className="je-paginarand flex min-h-0 flex-1 gap-3 overflow-hidden pb-4">
          <div className="flex min-w-0 flex-1 flex-col overflow-auto">
            <div className="grid grid-cols-7 border-b border-ink-200 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1.5">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid flex-1 grid-cols-7 gap-px bg-ink-200">
              {weeks.flat().map((date) => {
                const key = dayKey(date)
                const dayPosts = byDay[key] ?? []
                const outside = date.getMonth() !== monthIndex

                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setOverDay(key)
                    }}
                    onDragLeave={() => setOverDay((d) => (d === key ? null : d))}
                    onDrop={() => dropOn(date)}
                    onDoubleClick={() => addOn(date)}
                    className={cn(
                      'group min-h-[7rem] bg-white p-1',
                      outside && 'bg-ink-50/70',
                      overDay === key && 'bg-accent-50 ring-1 ring-inset ring-accent-400'
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px]',
                          isToday(date)
                            ? 'bg-accent-600 font-semibold text-white'
                            : outside
                              ? 'text-ink-300'
                              : 'text-ink-500'
                        )}
                      >
                        {date.getDate()}
                      </span>
                      <button
                        type="button"
                        onClick={() => addOn(date)}
                        aria-label={t('social.post.toevoegen_op', { dag: key })}
                        className="rounded px-1 text-xs text-ink-300 opacity-0 transition group-hover:opacity-100 hover:bg-ink-100 hover:text-ink-700"
                      >
                        +
                      </button>
                    </div>

                    <div className="space-y-1">
                      {dayPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          brand={brandById[post.brandId]}
                          compact={dayPosts.length > 2}
                          dragging={dragId === post.id}
                          onOpen={(p) => setOpenPostId(p.id)}
                          onDragStart={(e, p) => {
                            setDragId(p.id)
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', p.id)
                          }}
                          onDragEnd={() => setDragId(null)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto rounded-lg bg-ink-100/70 p-2 lg:flex">
            <h2 className="px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-600">
              {t('social.in_te_plannen', { aantal: backlog.length })}
            </h2>

            {/* Een onderwerp is een idee zonder datum. Het komt altijd bij
                dezelfde persoon terecht; wie dat is staat in de instellingen. */}
            <form onSubmit={addOnderwerp} className="mb-2 px-1">
              <Input
                value={onderwerp}
                onChange={(e) => setOnderwerp(e.target.value)}
                placeholder={t('social.onderwerp.plaatshouder')}
                aria-label={t('social.onderwerp.label')}
                className="h-8 text-sm"
              />
              {onderwerp.trim() ? (
                <p className="mt-1 text-[11px] text-ink-500">
                  {socialOwner
                    ? t('social.onderwerp.enter', { wie: socialOwner.fullName || socialOwner.email })
                    : t('social.onderwerp.enter_niemand')}
                </p>
              ) : null}
            </form>
            <div className="space-y-1.5">
              {backlog.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  brand={brandById[post.brandId]}
                  dragging={dragId === post.id}
                  onOpen={(p) => setOpenPostId(p.id)}
                  onDragStart={(e, p) => {
                    setDragId(p.id)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', p.id)
                  }}
                  onDragEnd={() => setDragId(null)}
                />
              ))}
              {backlog.length === 0 ? (
                <p className="px-1 py-3 text-center text-[11px] text-ink-400">
                  {t('social.alles_ingepland')}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      {openPostId ? <PostDrawer postId={openPostId} onClose={() => setOpenPostId(null)} /> : null}
    </div>
  )
}

/** The same posts, seen as a production line instead of as a month. */
function ProductionBoard({ posts, brandById, onOpen, onMove }) {
  const { t } = useTaal()
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(POST_STATUSES.map((s) => [s.key, []]))
    for (const post of posts) (map[post.status] ??= []).push(post)
    return map
  }, [posts])

  if (posts.length === 0) {
    return (
      <div className="p-8">
        <EmptyState title={t('social.posts.leeg.titel')} description={t('social.posts.leeg.tekst')} />
      </div>
    )
  }

  return (
    <div className="je-paginarand flex h-full gap-3 overflow-x-auto pb-4">
      {POST_STATUSES.map((status) => (
        <section
          key={status.key}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(status.key)
          }}
          onDragLeave={() => setOver((s) => (s === status.key ? null : s))}
          onDrop={() => {
            const post = posts.find((p) => p.id === dragId)
            setOver(null)
            setDragId(null)
            if (post && post.status !== status.key) onMove(post, status.key)
          }}
          className={cn(
            'flex w-64 shrink-0 flex-col rounded-lg bg-ink-100/70',
            over === status.key && 'bg-accent-50 ring-1 ring-accent-300'
          )}
        >
          <header className="flex items-center gap-2 px-3 py-2.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-700">{t(status.sleutel)}</h2>
            <span className="rounded bg-white px-1.5 text-[11px] text-ink-500">
              {(byStatus[status.key] ?? []).length}
            </span>
          </header>

          <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-3">
            {(byStatus[status.key] ?? []).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                brand={brandById[post.brandId]}
                dragging={dragId === post.id}
                onOpen={onOpen}
                onDragStart={(e, p) => {
                  setDragId(p.id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', p.id)
                }}
                onDragEnd={() => setDragId(null)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
