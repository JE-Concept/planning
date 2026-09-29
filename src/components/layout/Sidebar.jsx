import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@lib/cn'
import { formatDuration } from '@lib/format'
import { periodKeys } from '@lib/time-math'
import { Button, Hex, Icon, IconButton, Logotype, initialsOf } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useEvents, useWeekEntries } from '@data/events'
import { stopTimer, useRunningTimer } from '@data/time'
import { InstallMenuItem, PushMenuItem } from './AppMenuItems'

/**
 * De hoofdnavigatie uit het design: vijf plekken, en wat verder bestaat (de
 * oudere schermen en de andere borden) onder "Meer", zodat niets verdwijnt
 * maar ook niets in de weg staat.
 */
export function mainNav({ isAdmin, isStaff }) {
  if (isStaff) return [{ to: '/openen-sluiten', icon: 'clipboard-check', label: 'Openen & sluiten' }]
  return [
    { to: '/', icon: 'layout-dashboard', label: 'Events', end: true, match: (p) => p === '/' || p.startsWith('/events') },
    { to: '/mijn-taken', icon: 'check-circle', label: 'Mijn taken' },
    { to: '/kalender', icon: 'calendar-days', label: 'Kalender' },
    { to: '/werklast', icon: 'users', label: 'Werklast' },
    ...(isAdmin ? [{ to: '/instellingen', icon: 'settings', label: 'Instellingen' }] : []),
  ]
}

export const MORE = [
  { to: '/vandaag', icon: 'sun', label: 'Vandaag' },
  { to: '/mijn-werk', icon: 'list-checks', label: 'Taken per persoon' },
  { to: '/klanten', icon: 'building', label: 'Klanten' },
  { to: '/social', icon: 'share-2', label: 'Socials' },
  { to: '/openen-sluiten', icon: 'clipboard-check', label: 'Openen & sluiten' },
  { to: '/overleg', icon: 'messages-square', label: 'Teamoverleg' },
  { to: '/uren', icon: 'timer', label: 'Uren' },
  { to: '/goals', icon: 'target', label: 'Goals' },
]

export const ROLE_LABEL = {
  owner: 'Eigenaar',
  admin: 'Beheerder',
  member: 'Lid',
  staff: 'Personeel',
  guest: 'Gast',
}

export default function Sidebar({ counts = {} }) {
  const { isAdmin, isStaff } = useAuth()
  const { boards, eventsList } = useWorkspace()
  const location = useLocation()
  const otherBoards = boards.filter((l) => l.id !== eventsList?.id)
  const moreActive = [...MORE.map((m) => m.to), '/bord'].some((p) => location.pathname.startsWith(p))
  const [moreOpen, setMoreOpen] = useState(moreActive)

  const nav = mainNav({ isAdmin, isStaff })

  return (
    <aside className="je-side je-night" aria-label="Hoofdnavigatie">
      <NavLink to="/" className="je-side__logo">
        <Logotype size={38} invert />
      </NavLink>

      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn('je-nav', (item.match ? item.match(location.pathname) : isActive) && 'je-nav--on')
            }
          >
            <Icon name={item.icon} size={17} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {counts[item.to] ? <span className="je-nav__count">{counts[item.to]}</span> : null}
          </NavLink>
        ))}
      </nav>

      {isStaff ? null : (
        <>
          <button
            type="button"
            className="je-side__group"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>Meer</span>
            <Icon name={moreOpen ? 'chevron-down' : 'chevron-right'} size={14} />
          </button>
          {moreOpen ? (
            <nav style={{ display: 'flex', flexDirection: 'column' }}>
              {MORE.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn('je-nav je-nav--minor', isActive && 'je-nav--on')}
                >
                  <Icon name={item.icon} size={15} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {counts[item.to] ? <span className="je-nav__count">{counts[item.to]}</span> : null}
                </NavLink>
              ))}
              {otherBoards.map((list) => (
                <NavLink
                  key={list.id}
                  to={`/bord/${list.id}`}
                  className={({ isActive }) => cn('je-nav je-nav--minor', isActive && 'je-nav--on')}
                >
                  <Icon name="kanban" size={15} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {list.name}
                  </span>
                </NavLink>
              ))}
            </nav>
          ) : null}

          <SideTimer />
        </>
      )}

      <Me />
    </aside>
  )
}

/** De timer onderaan de zijbalk: altijd zichtbaar, want een timer die je moet gaan zoeken vergeet je. */
function SideTimer() {
  const { uid } = useAuth()
  const toast = useToast()
  const { timer, elapsed } = useRunningTimer(uid)
  const { tasks, eventById } = useEvents()
  const week = periodKeys(new Date()).week
  const entries = useWeekEntries(week)
  const [busy, setBusy] = useState(false)

  const booked = useMemo(
    () => entries.filter((e) => e.profileId === uid).reduce((a, e) => a + (e.durationSeconds ?? 0), 0),
    [entries, uid]
  )

  const task = timer?.taskId ? tasks.find((t) => t.id === timer.taskId) : null
  const eventName = task ? eventById[task.parentId]?.name : eventById[timer?.taskId]?.name ?? timer?.listName

  const stop = async () => {
    setBusy(true)
    try {
      const id = await stopTimer(uid)
      toast.success(id ? `Gestopt — ${formatDuration(elapsed)} geboekt.` : 'Te kort, niets geboekt.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="je-side__timer">
      <span className="je-eyebrow" style={{ color: 'var(--navy-300)' }}>
        Timer
      </span>
      {timer ? (
        <>
          <div className="je-side__clock">{formatDuration(elapsed, { withSeconds: true })}</div>
          <div style={{ font: 'var(--type-body-sm)', color: 'var(--navy-200)' }}>
            {timer.taskTitle || timer.description || 'Losse tijd'}
          </div>
          <div style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--navy-400)' }}>
            {[eventName, timer.billable === false ? 'intern' : 'billable'].filter(Boolean).join(' · ')}
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              size="sm"
              iconLeft="square"
              onClick={stop}
              loading={busy}
              style={{ color: 'var(--white)', borderColor: 'var(--border-strong)' }}
            >
              Stop en boek
            </Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ font: 'var(--type-body-sm)', color: 'var(--navy-300)' }}>
            Start een timer vanaf een taak, of boek tijd op een kostenplaats.
          </div>
          <div style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--navy-400)' }}>
            Deze week geboekt: {formatDuration(booked)}
          </div>
        </>
      )}
    </div>
  )
}

function Me() {
  const { profile, logOut } = useAuth()
  const [menu, setMenu] = useState(false)

  return (
    <div className="je-side__me">
      <Hex size={34} tone="ink">{initialsOf(profile)}</Hex>
      <button
        type="button"
        className="je-plainbtn"
        style={{ minWidth: 0, flex: 1 }}
        onClick={() => setMenu((m) => !m)}
        aria-haspopup="menu"
        aria-expanded={menu}
      >
        <div style={{ font: 'var(--type-body-sm)', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile?.fullName || profile?.email}
        </div>
        <div style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--navy-400)' }}>
          {ROLE_LABEL[profile?.role] ?? profile?.role}
        </div>
      </button>
      <span style={{ color: 'var(--navy-300)' }}>
        <IconButton icon="log-out" label="Afmelden" size="sm" onClick={logOut} />
      </span>
      {menu ? (
        <div className="je-menu" role="menu" onClick={() => setMenu(false)}>
          <InstallMenuItem />
          <PushMenuItem />
          <button type="button" role="menuitem" onClick={logOut}>
            Afmelden
          </button>
        </div>
      ) : null}
    </div>
  )
}
