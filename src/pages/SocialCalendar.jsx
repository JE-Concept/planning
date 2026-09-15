import { useMemo, useState } from 'react'
import { cn } from '@lib/cn'
import {
  addMonths,
  dayKey,
  formatMonth,
  isToday,
  monthGrid,
  startOfMonth,
  WEEKDAYS,
} from '@lib/dates'
import { Badge, Button, EmptyState, Spinner } from '@ui/index'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import PostCard from '@components/social/PostCard'
import PostDrawer from '@components/social/PostDrawer'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  POST_STATUSES,
  createPost,
  movePostTo,
  updatePost,
  useSocialPosts,
  useUnscheduledPosts,
} from '@data/social'

/**
 * The content calendar. Brands share one grid rather than getting a tab each,
 * because the question the team asks is "what goes out this week", not "what
 * does Bar Vue do".
 */
export default function SocialCalendar() {
  const { brands, brandById } = useWorkspace()
  const { uid } = useAuth()
  const toast = useToast()

  const [month, setMonth] = useState(() => startOfMonth())
  const [view, setView] = useState('calendar')
  const [brandFilter, setBrandFilter] = useState([])
  const [openPostId, setOpenPostId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [overDay, setOverDay] = useState(null)

  const range = useMemo(() => {
    const weeks = monthGrid(month)
    return { from: weeks[0][0], to: weeks[weeks.length - 1][6] }
  }, [month])

  const { posts, loading } = useSocialPosts(range)
  const backlog = useUnscheduledPosts()

  const shown = useMemo(
    () => (brandFilter.length === 0 ? posts : posts.filter((p) => brandFilter.includes(p.brandId))),
    [posts, brandFilter]
  )

  const byDay = useMemo(() => {
    const map = {}
    for (const post of shown) {
      if (!post.scheduledAt) continue
      const key = dayKey(post.scheduledAt)
      ;(map[key] ??= []).push(post)
    }
    return map
  }, [shown])

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
    const previous = post.scheduledAt ? new Date(post.scheduledAt) : null
    const next = new Date(date)
    next.setHours(previous?.getHours() ?? 10, previous?.getMinutes() ?? 0, 0, 0)

    try {
      await movePostTo(post.id, next)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addOn = async (date) => {
    const brandId = brandFilter[0] ?? brands[0]?.id
    if (!brandId) {
      toast.error('Maak eerst een merk aan bij Instellingen.')
      return
    }
    const when = new Date(date)
    when.setHours(10, 0, 0, 0)

    try {
      const id = await createPost({ brandId, scheduledAt: when, title: 'Nieuwe post', createdBy: uid })
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
        title="Social kalender"
        subtitle={`${shown.length} posts in ${formatMonth(month)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Vorige maand">
              ‹
            </Button>
            <Button variant="secondary" onClick={() => setMonth(startOfMonth())}>
              Vandaag
            </Button>
            <Button variant="secondary" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Volgende maand">
              ›
            </Button>
            <Button variant="primary" onClick={() => addOn(new Date())}>
              + Post
            </Button>
          </>
        }
        tabs={
          <>
            <Tab active={view === 'calendar'} onClick={() => setView('calendar')}>
              Kalender
            </Tab>
            <Tab active={view === 'board'} onClick={() => setView('board')}>
              Productie
            </Tab>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-200 bg-white px-4 py-2 sm:px-6">
        {brands.map((brand) => (
          <button key={brand.id} type="button" onClick={() => toggleBrand(brand.id)} aria-pressed={brandFilter.includes(brand.id)}>
            <Badge color={brand.color} subtle={brandFilter.length > 0 && !brandFilter.includes(brand.id)}>
              {brand.name}
            </Badge>
          </button>
        ))}
        {brandFilter.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setBrandFilter([])}>
            Alles tonen
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : view === 'board' ? (
        <ProductionBoard
          posts={shown}
          brandById={brandById}
          onOpen={(p) => setOpenPostId(p.id)}
          onMove={(post, status) => updatePost(post.id, { status }).catch((e) => toast.error(e.message))}
        />
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden px-4 pb-4 sm:px-6">
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
                        aria-label={`Post toevoegen op ${key}`}
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
              Nog in te plannen ({backlog.length})
            </h2>
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
                  Alles staat ingepland.
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
        <EmptyState title="Nog geen posts deze maand" description="Voeg er een toe in de kalender." />
      </div>
    )
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto px-4 pb-4 sm:px-6">
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
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-700">{status.label}</h2>
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
