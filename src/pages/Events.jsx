import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { addMonths, dayKey, startOfDay, startOfMonth } from '@lib/dates'
import { PHASES, PIPELINE, indexOf, labelOf } from '@lib/pipeline'
import { useNarrow } from '@lib/useNarrow'
import { Bar, Button, Icon, IconButton, Stat, Tabs, Tag } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import NewEventDialog from '@components/events/NewEventDialog'
import EventRow from '@components/events/EventRow'
import EventBoardCard from '@components/events/EventBoardCard'
import {
  MONTHS_FULL,
  StatusBadge,
  TeamHexes,
  dayLabel,
  euro,
  progressOf,
} from '@components/events/parts'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { BlockedError, byEventDate, moveEvent, useEvents } from '@data/events'
import { Spinner } from '@ui/index'

const VIEWS = [
  { value: 'lijst', label: 'Lijst' },
  { value: 'bord', label: 'Bord' },
  { value: 'kalender', label: 'Kalender' },
]
const LOS = '__los'

function rememberedView() {
  try {
    return localStorage.getItem('je-events-weergave') || 'bord'
  } catch {
    return 'bord'
  }
}

/**
 * Events: de pijplijn van aanvraag tot betaling, als lijst per fase, als bord
 * per status, of als maandkalender. Het bord is de standaard.
 */
export default function Events() {
  const location = useLocation()
  const navigate = useNavigate()
  const narrow = useNarrow()
  const [params, setParams] = useSearchParams()
  const { brands, brandById, eventStatuses, profileById } = useWorkspace()
  const { events, tasksByEvent, loading } = useEvents()
  const [dialog, setDialog] = useState(false)

  const onCalendarRoute = location.pathname === '/kalender'
  const view = onCalendarRoute ? 'kalender' : params.get('weergave') || rememberedView()
  const concept = params.get('concept') || 'Alle'

  const setView = (v) => {
    try {
      localStorage.setItem('je-events-weergave', v)
    } catch {
      /* niet erg */
    }
    if (v === 'kalender') navigate('/kalender')
    else navigate(`/?weergave=${v}${concept !== 'Alle' ? `&concept=${encodeURIComponent(concept)}` : ''}`)
  }
  const setConcept = (c) => {
    const next = new URLSearchParams(params)
    if (c === 'Alle') next.delete('concept')
    else next.set('concept', c)
    setParams(next, { replace: true })
  }

  // Concepten: de actieve merken, plus "Los event" voor wat aan geen merk hangt.
  const conceptTags = useMemo(() => {
    const active = brands.filter((b) => !b.archived)
    const tags = [{ key: 'Alle', label: 'Alle' }, ...active.map((b) => ({ key: b.id, label: b.name.split(' — ')[0] }))]
    if (events.some((e) => !e.brandId || !brandById[e.brandId])) tags.push({ key: LOS, label: 'Los event' })
    return tags
  }, [brands, brandById, events])

  const filtered = useMemo(
    () =>
      events
        .filter((e) => concept === 'Alle' || (concept === LOS ? !e.brandId || !brandById[e.brandId] : e.brandId === concept))
        .sort(byEventDate),
    [events, concept, brandById]
  )

  const lopend = events.filter((e) => indexOf(e.statusName) >= 0 && indexOf(e.statusName) < indexOf('ready to invoice'))
  const monthLabel = MONTHS_FULL[new Date().getMonth()]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={view === 'kalender' ? null : `JE Concept · ${lopend.length} lopend`}
        title={view === 'kalender' ? 'Kalender' : 'Events'}
        actions={
          <Button size="sm" iconLeft="plus" onClick={() => setDialog(true)}>
            Nieuw event
          </Button>
        }
      />

      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
          <Tabs items={VIEWS} value={view} onChange={setView} />
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {conceptTags.map((c) => (
              <Tag key={c.key} selectable selected={concept === c.key} onClick={() => setConcept(c.key)}>
                {c.label}
              </Tag>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spinner /> Events laden…
          </div>
        ) : view === 'lijst' ? (
          <ListView
            events={filtered}
            all={events}
            tasksByEvent={tasksByEvent}
            profileById={profileById}
            statuses={eventStatuses}
            narrow={narrow}
            monthLabel={monthLabel}
          />
        ) : view === 'kalender' ? (
          <CalendarView events={filtered} narrow={narrow} />
        ) : (
          <BoardView events={filtered} tasksByEvent={tasksByEvent} profileById={profileById} statuses={eventStatuses} />
        )}
      </div>

      <NewEventDialog open={dialog} onClose={() => setDialog(false)} />
    </div>
  )
}

// ─── Lijst ─────────────────────────────────────────────────────────────────

function ListView({ events, all, tasksByEvent, profileById, statuses, narrow }) {
  const navigate = useNavigate()
  // Vast, zodat de gememoriseerde rijen niet hertekenen bij elke render.
  const openEvent = useCallback((id) => navigate(`/events/${id}`), [navigate])
  const today = startOfDay()

  const open = all.filter((e) => indexOf(e.statusName) >= 0 && indexOf(e.statusName) < indexOf('ready to invoice'))
  // De maand die er nu toe doet: deze, tot de laatste tien dagen — dan de volgende.
  const focus = today.getDate() > 20 ? addMonths(startOfMonth(today), 1) : startOfMonth(today)
  const focusKey = dayKey(focus).slice(0, 7)
  const inMonth = all.filter((e) => e.eventDate && dayKey(e.eventDate).slice(0, 7) === focusKey).sort(byEventDate)
  const toInvoice = all.filter((e) => e.statusName === 'ready to invoice')

  const stats = [
    {
      label: 'Lopend',
      value: String(open.length),
      sub: `${open.reduce((a, e) => a + (Number(e.pax) || 0), 0).toLocaleString('nl-BE')} gasten in totaal`,
    },
    {
      label: MONTHS_FULL[focus.getMonth()],
      value: `${inMonth.length} ${inMonth.length === 1 ? 'event' : 'events'}`,
      sub: inMonth[0] ? `Eerste: ${dayLabel(inMonth[0].eventDate)}` : 'Nog niets gepland',
    },
    {
      label: 'Te factureren',
      value: euro(toInvoice.reduce((a, e) => a + (Number(e.quoteAmount) || 0), 0)) ?? '€ 0',
      sub: `${toInvoice.length} ${toInvoice.length === 1 ? 'event wacht' : 'events wachten'} op factuur`,
    },
  ]

  const groups = PHASES.map((ph) => ({
    ...ph,
    events: events.filter((e) => ph.keys.includes(e.statusName)),
  })).filter((g) => g.events.length)

  const cols = narrow ? '44px minmax(0,1fr) 16px' : '48px minmax(120px,1fr) 64px 136px 84px 96px 16px'
  const archived = all.filter((e) => e.statusName === 'complete').length

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} sub={s.sub} />
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="je-panel" style={{ padding: 'var(--space-7)', textAlign: 'center' }}>
          <div className="je-muted-caption">Geen lopende events voor deze selectie.</div>
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.label} className="je-panel">
          <div className="je-panel__head" style={{ padding: 'var(--space-5) var(--space-6)' }}>
            <span className="je-eyebrow">{g.label}</span>
            <span className="je-panel__sub">{g.sub}</span>
            <span className="je-panel__right">
              {g.events.length} {g.events.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          {g.events.map((e, i) => (
            <EventRow
              key={e.id}
              event={e}
              progress={progressOf(tasksByEvent[e.id])}
              statuses={statuses}
              profileById={profileById}
              columns={cols}
              narrow={narrow}
              first={i === 0}
              onOpen={openEvent}
            />
          ))}
        </section>
      ))}

      <div className="je-muted-caption" style={{ textAlign: 'center' }}>
        {archived} afgeronde {archived === 1 ? 'event staat' : 'events staan'} in het archief
      </div>
    </>
  )
}

// ─── Bord ──────────────────────────────────────────────────────────────────

function BoardView({ events, tasksByEvent, profileById, statuses }) {
  const navigate = useNavigate()

  // Vaste functies: de kaarten zijn gememoriseerd en hertekenen anders alsnog
  // bij elke muisbeweging tijdens het slepen.
  const openEvent = useCallback((id) => navigate(`/events/${id}`), [navigate])
  const toast = useToast()
  const [dragging, setDragging] = useState(null)
  const [over, setOver] = useState(null)

  const beginSleep = useCallback((e, id) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragging(id)
  }, [])

  const eindSleep = useCallback(() => {
    setDragging(null)
    setOver(null)
  }, [])

  // Afgerond staat niet op het bord: dat is het archief.
  const columns = PIPELINE.slice(0, 8).map((step, i) => ({
    ...step,
    n: String(i + 1).padStart(2, '0'),
    label: labelOf(step.key, statuses),
    events: events.filter((e) => e.statusName === step.key),
  }))

  const drop = async (key) => {
    const ev = events.find((e) => e.id === dragging)
    setDragging(null)
    setOver(null)
    if (!ev || ev.statusName === key) return
    try {
      await moveEvent(ev, key, statuses)
    } catch (err) {
      toast.error(err instanceof BlockedError ? `${ev.name}: ${err.message}` : err.message)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto', paddingBottom: 'var(--space-5)', alignItems: 'flex-start' }}>
      {columns.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => {
            if (!dragging) return
            e.preventDefault()
            setOver(col.key)
          }}
          onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            drop(col.key)
          }}
          style={{
            flex: '0 0 248px',
            background: 'var(--surface-2)',
            border: `1px solid ${over === col.key ? 'var(--border-accent)' : 'var(--border-hairline)'}`,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '1px solid var(--border-hairline)',
            }}
          >
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{col.n}</span>
            <span className="je-eyebrow" style={{ letterSpacing: '.14em', color: 'var(--text-1)' }}>
              {col.label}
            </span>
            <span style={{ marginLeft: 'auto', font: 'var(--type-caption)', color: 'var(--text-2)' }}>{col.events.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3)', minHeight: 80 }}>
            {col.events.map((e) => (
              <EventBoardCard
                key={e.id}
                event={e}
                progress={progressOf(tasksByEvent[e.id])}
                profileById={profileById}
                dragging={dragging === e.id}
                onOpen={openEvent}
                onDragStart={beginSleep}
                onDragEnd={eindSleep}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Kalender ──────────────────────────────────────────────────────────────

function CalendarView({ events, narrow }) {
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const todayKey = dayKey(new Date())

  const first = new Date(month)
  const lead = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead, 12)
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const nCells = Math.ceil((lead + daysIn) / 7) * 7

  const byDay = {}
  for (const e of events) {
    if (!e.eventDate) continue
    ;(byDay[dayKey(e.eventDate)] ??= []).push(e)
  }
  const monthKey = dayKey(first).slice(0, 7)
  const count = events.filter((e) => e.eventDate && dayKey(e.eventDate).slice(0, 7) === monthKey).length

  const cells = Array.from({ length: nCells }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { d, key: dayKey(d), inMonth: d.getMonth() === first.getMonth(), col: i % 7 }
  })

  return (
    <div className="je-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-hairline)' }}>
        <IconButton icon="chevron-left" label="Vorige maand" size="sm" onClick={() => setMonth((m) => addMonths(m, -1))} />
        <span style={{ font: 'var(--type-h3)', textTransform: 'uppercase', minWidth: narrow ? 140 : 180, textAlign: 'center' }}>
          {MONTHS_FULL[first.getMonth()]} {first.getFullYear()}
        </span>
        <IconButton icon="chevron-right" label="Volgende maand" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))} />
        <span className="je-muted-caption" style={{ marginLeft: 'auto' }}>
          {count} {count === 1 ? 'event' : 'events'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((w) => (
          <div
            key={w}
            className="je-eyebrow"
            style={{ padding: 'var(--space-3) var(--space-4)', letterSpacing: '.14em', color: 'var(--text-2)', borderBottom: '1px solid var(--border-hairline)' }}
          >
            {w}
          </div>
        ))}
        {cells.map((c) => (
          <div
            key={c.key}
            style={{
              minHeight: narrow ? 64 : 112,
              padding: 'var(--space-3)',
              borderRight: c.col < 6 ? '1px solid var(--border-hairline)' : 'none',
              borderBottom: '1px solid var(--border-hairline)',
              background: c.inMonth ? 'var(--surface-1)' : 'var(--paper)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 0,
            }}
          >
            <span
              style={{
                font: 'var(--fw-medium) 15px/1 var(--font-display)',
                color: c.key === todayKey ? 'var(--text-accent)' : c.inMonth ? 'var(--text-1)' : 'var(--text-3)',
              }}
            >
              {c.d.getDate()}
            </span>
            {(byDay[c.key] ?? []).map((e) => (
              <button
                key={e.id}
                type="button"
                title={e.name}
                onClick={() => navigate(`/events/${e.id}`)}
                className="je-calchip"
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    flex: '0 0 6px',
                    background: indexOf(e.statusName) >= indexOf('offer accepted') ? 'var(--navy-700)' : 'var(--navy-300)',
                  }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {narrow ? e.name.split(' ')[0] : e.name}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

