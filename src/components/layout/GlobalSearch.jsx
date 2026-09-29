import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatDay } from '@lib/dates'
import { labelOf } from '@lib/pipeline'
import { Icon } from '@components/ds'
import { useAssistant } from '@context/AssistantProvider'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { isDone, useEvents } from '@data/events'
import { templateSummary } from '@data/templates'

/**
 * De zoekbalk bovenaan: events, taken, mensen en (voor beheerders) templates.
 * Druk op / om te zoeken. Vindt hij niets, dan gaat de vraag naar de assistent.
 */
export default function GlobalSearch({ narrow }) {
  const { isAdmin } = useAuth()
  const { profiles, templates, eventStatuses } = useWorkspace()
  const { events, tasks, eventById } = useEvents()
  const { ask } = useAssistant()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const { pathname } = useLocation()

  // Naar een ander scherm: de zoekopdracht hoort bij het vorige.
  useEffect(() => {
    setQ('')
    setOpen(false)
    setIdx(0)
  }, [pathname])

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !e.target.isContentEditable) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const done = () => {
    setQ('')
    setOpen(false)
    setIdx(0)
  }

  const groups = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return []
    const has = (...xs) => xs.some((x) => (x ?? '').toString().toLowerCase().includes(n))
    const first = (id) => (profiles.find((p) => p.id === id)?.fullName ?? '').split(' ')[0]
    const out = [
      [
        'Events',
        events
          .filter((e) => has(e.name, e.customerName, e.concept, e.location, e.eventType))
          .slice(0, 4)
          .map((e) => ({
            icon: 'calendar-days',
            title: e.name,
            sub: [e.eventDate ? formatDay(e.eventDate) : null, e.concept, labelOf(e.statusName, eventStatuses)]
              .filter(Boolean)
              .join(' · '),
            go: () => navigate(`/events/${e.id}`),
          })),
      ],
      [
        'Taken',
        tasks
          .filter((t) => has(t.title))
          .slice(0, 5)
          .map((t) => ({
            icon: isDone(t) ? 'check-circle' : 'circle',
            title: t.title,
            sub: [eventById[t.parentId]?.name, first(t.assignees?.[0]), t.dueDate ? formatDay(t.dueDate) : null]
              .filter(Boolean)
              .join(' · '),
            go: () => navigate(`/events/${t.parentId}?taak=${t.id}`),
          })),
      ],
      [
        'Mensen',
        profiles
          .filter((p) => p.active !== false && p.role !== 'staff' && has(p.fullName, p.email))
          .slice(0, 4)
          .map((p) => ({
            icon: 'users',
            title: p.fullName || p.email,
            sub: `${tasks.filter((t) => !isDone(t) && t.assignees?.includes(p.id)).length} open taken · werklast bekijken`,
            go: () => navigate('/werklast'),
          })),
      ],
    ]
    if (isAdmin) {
      out.push([
        'Templates',
        templates
          .filter((tp) => has(tp.name))
          .map((tp) => ({
            icon: tp.icon,
            title: tp.name,
            sub: `Template · ${templateSummary(tp)}`,
            go: () => navigate(`/instellingen?tab=templates&template=${tp.id}`),
          })),
      ])
    }
    return out.filter(([, items]) => items.length)
  }, [q, events, tasks, profiles, templates, isAdmin, eventById, eventStatuses, navigate])

  const flat = groups.flatMap(([, items]) => items)
  const active = Math.min(idx, Math.max(0, flat.length - 1))

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx(Math.min(active + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx(Math.max(active - 1, 0))
    } else if (e.key === 'Enter') {
      if (flat[active]) {
        flat[active].go()
        done()
      } else if (q.trim()) {
        const vraag = q
        done()
        ask(vraag)
      }
    } else if (e.key === 'Escape') {
      done()
      e.currentTarget.blur()
    }
  }

  let k = 0
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 560, minWidth: 0 }}>
      <div className={`je-search${open ? ' je-search--open' : ''}`}>
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setIdx(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Zoek events, taken, mensen, templates"
          aria-label="Zoeken"
        />
        {narrow ? null : <span className="je-kbd">/</span>}
      </div>
      {open && q.trim() ? (
        <div className="je-results" role="listbox">
          {groups.map(([label, items]) => (
            <div key={label}>
              <div
                style={{
                  padding: 'var(--space-3) var(--space-5) var(--space-2)',
                  font: 'var(--type-eyebrow)',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--text-2)',
                }}
              >
                {label}
              </div>
              {items.map((r) => {
                const my = k++
                const on = my === active
                return (
                  <button
                    key={`${label}-${my}`}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onMouseDown={() => {
                      r.go()
                      done()
                    }}
                    onMouseEnter={() => setIdx(my)}
                    className="je-plainbtn"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-3) var(--space-5)',
                      background: on ? 'var(--accent-quiet)' : 'transparent',
                    }}
                  >
                    <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
                      <Icon name={r.icon} size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', font: 'var(--type-body-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </span>
                      <span style={{ display: 'block', font: 'var(--type-caption)', fontWeight: 400, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.sub}
                      </span>
                    </span>
                    {on ? (
                      <span style={{ color: 'var(--text-3)', display: 'flex' }}>
                        <Icon name="corner-down-left" size={14} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-3)',
              padding: 'var(--space-4) var(--space-5) var(--space-2)',
              borderTop: '1px solid var(--border-hairline)',
            }}
          >
            <span className="je-muted-caption" style={{ flex: 1 }}>
              {flat.length
                ? `${flat.length} ${flat.length === 1 ? 'resultaat' : 'resultaten'}`
                : `Niets gevonden voor “${q.trim()}”.`}
            </span>
            <button
              type="button"
              className="je-plainbtn"
              onMouseDown={() => {
                const vraag = q
                done()
                ask(vraag)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--type-caption)', color: 'var(--text-accent)' }}
            >
              <Icon name="sparkles" size={14} />
              Vraag het de assistent
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
