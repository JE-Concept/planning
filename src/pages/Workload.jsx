import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, dayKey, startOfWeek } from '@lib/dates'
import { periodKeys } from '@lib/time-math'
import { Bar, Hex, IconButton, initialsOf } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { hours, shortDate } from '@components/events/parts'
import { useTaal } from '@context/TaalProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { isDone, useEvents, useWeekEntries } from '@data/events'

// Op de volgorde van `Date.getDay()`, dus zondag eerst.
const WD = ['tasks.wd.zo', 'tasks.wd.ma', 'tasks.wd.di', 'tasks.wd.wo', 'tasks.wd.do', 'tasks.wd.vr', 'tasks.wd.za']
const WEEK_HOURS = 38

/**
 * Werklast: per persoon de taken met een deadline in deze week, de events die
 * erop vallen, en wat er al geboekt is tegenover een week van 38 uur.
 * Wat te laat is, telt mee op vandaag — dat is wanneer het nog moet gebeuren.
 */
export default function Workload() {
  const navigate = useNavigate()
  const { t } = useTaal()
  const { profiles } = useWorkspace()
  const { events, tasks, eventById } = useEvents()
  const [offset, setOffset] = useState(0)

  const monday = addDays(startOfWeek(new Date()), offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const keys = days.map(dayKey)
  const todayKey = dayKey(new Date())
  const { week } = periodKeys(monday)
  const entries = useWeekEntries(week)

  const people = useMemo(
    () => profiles.filter((p) => p.active !== false && p.role !== 'staff' && p.role !== 'guest'),
    [profiles]
  )

  const rows = people.map((p) => {
    const open = tasks.filter((t) => !isDone(t) && t.assignees?.includes(p.id))
    const bookedS = entries.filter((e) => e.profileId === p.id).reduce((a, e) => a + (e.durationSeconds ?? 0), 0)
    const h = bookedS / 3600
    return {
      p,
      open,
      bookedS,
      over: h > 30,
      pct: Math.min(100, Math.round((h / WEEK_HOURS) * 100)),
      days: keys.map((k) => {
        // Wat te laat is, staat op vandaag; een voorbije dag blijft leeg.
        const dayT = open.filter((t) => {
          if (!t.dueDate || k < todayKey) return false
          const dk = dayKey(t.dueDate)
          return dk === k || (k === todayKey && dk < todayKey)
        })
        const est = dayT.reduce((a, t) => a + (t.timeEstimateMinutes ?? 60), 0) / 60
        return {
          k,
          tasks: dayT,
          label: dayT.length ? t('tasks.werklast.uren', { uren: Math.round(est * 100) / 100 }) : '',
        }
      }),
    }
  })

  const weekNo = week.split('-W')[1]
  const range = `${shortDate(days[0])} – ${shortDate(days[6])}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={t('tasks.werklast.week', { week: Number(weekNo), reeks: range })}
        title={t('nav.werklast')}
        actions={
          <>
            <IconButton icon="chevron-left" label={t('tasks.werklast.vorige')} variant="outline" size="sm" onClick={() => setOffset((o) => o - 1)} />
            <IconButton icon="chevron-right" label={t('tasks.werklast.volgende')} variant="outline" size="sm" onClick={() => setOffset((o) => o + 1)} />
          </>
        }
      />
      <div className="je-pagebody">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 1120 }}>
          <div className="je-panel" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '200px repeat(7, minmax(56px, 1fr)) 150px', minWidth: 760 }}>
              <div className="je-eyebrow" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-hairline)', letterSpacing: '.14em', color: 'var(--text-2)' }}>
                {t('nav.team')}
              </div>
              {days.map((d, i) => {
                const k = keys[i]
                const isT = k === todayKey
                const dayEvents = events.filter((e) => e.eventDate && dayKey(e.eventDate) === k)
                return (
                  <div
                    key={k}
                    style={{
                      padding: 'var(--space-4) var(--space-3)',
                      borderBottom: '1px solid var(--border-hairline)',
                      borderLeft: '1px solid var(--border-hairline)',
                      background: isT ? 'var(--navy-50)' : 'transparent',
                    }}
                  >
                    <div className="je-eyebrow" style={{ letterSpacing: '.14em', color: isT ? 'var(--text-accent)' : 'var(--text-2)' }}>
                      {t(WD[d.getDay()])} {d.getDate()}
                    </div>
                    {dayEvents.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        title={e.name}
                        onClick={() => navigate(`/events/${e.id}`)}
                        style={{
                          marginTop: 6,
                          display: 'block',
                          width: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'left',
                          background: 'var(--navy-900)',
                          color: 'var(--white)',
                          border: 0,
                          borderRadius: 2,
                          padding: '3px 6px',
                          font: 'var(--type-caption)',
                          cursor: 'pointer',
                        }}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                )
              })}
              <div className="je-eyebrow" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-hairline)', borderLeft: '1px solid var(--border-hairline)', letterSpacing: '.14em', color: 'var(--text-2)' }}>
                {t('tasks.werklast.geboekt', { uren: WEEK_HOURS })}
              </div>

              {rows.map((r) => (
                <Row key={r.p.id} r={r} todayKey={todayKey} eventById={eventById} />
              ))}
            </div>
          </div>
          <div className="je-muted-caption" style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 6, background: 'var(--navy-700)' }} />
              {t('tasks.werklast.legenda_taak')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 6, background: 'var(--red-600)' }} />
              {t('tasks.werklast.legenda_telaat')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 6, background: 'var(--navy-900)' }} />
              {t('tasks.werklast.legenda_event')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ r, todayKey, eventById }) {
  const { t } = useTaal()
  const cell = { borderBottom: '1px solid var(--border-hairline)', borderLeft: '1px solid var(--border-hairline)' }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-hairline)' }}>
        <Hex size={30} tone="ink">
          {initialsOf(r.p)}
        </Hex>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: 'var(--type-body-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.p.fullName || r.p.email}
          </div>
          <div className="je-muted-caption">{t('tasks.werklast.open', { aantal: r.open.length })}</div>
        </div>
      </div>
      {r.days.map((c) => (
        <div
          key={c.k}
          style={{
            ...cell,
            padding: 'var(--space-3)',
            background: c.k === todayKey ? 'var(--navy-50)' : 'transparent',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            justifyContent: 'center',
          }}
        >
          {c.tasks.map((t) => {
            const late = t.dueDate && dayKey(t.dueDate) < todayKey
            return (
              <span
                key={t.id}
                title={`${t.title} — ${eventById[t.parentId]?.name ?? ''}`}
                style={{ display: 'block', height: 6, background: late || t.priority === 1 ? 'var(--red-600)' : 'var(--navy-700)' }}
              />
            )
          })}
          <span className="je-muted-caption">{c.label}</span>
        </div>
      ))}
      <div style={{ ...cell, padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
        <span style={{ font: 'var(--fw-medium) 18px/1 var(--font-display)', color: r.over ? 'var(--amber-600)' : 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
          {hours(r.bookedS)}
        </span>
        <Bar pct={r.pct} height={4} color={r.over ? 'var(--amber-600)' : 'var(--navy-700)'} />
      </div>
    </>
  )
}
