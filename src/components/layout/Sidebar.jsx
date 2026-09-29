import { useMemo, useState } from 'react'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { cn } from '@lib/cn'
import { formatDuration } from '@lib/format'
import { periodKeys } from '@lib/time-math'
import { Button, Hex, Icon, IconButton, Logotype, initialsOf } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useEvents, useWeekEntries } from '@data/events'
import { stopTimer, useRunningTimer } from '@data/time'
import { InstallMenuItem, PushMenuItem } from './AppMenuItems'

/**
 * De navigatie in twee niveaus.
 *
 * Er waren twaalf bestemmingen onder elkaar plus de borden eronder, en op een
 * laptop paste dat niet: je moest in de zijbalk scrollen om bij Instellingen te
 * komen, en de timer onderaan was dan helemaal weg. Scrollen in een menu is een
 * menu dat te lang is.
 *
 * Nu staan er zes plekken, elk met zijn eigen tweede niveau, en dat tweede
 * niveau staat er alleen voor de sectie waar je in zit. Wat je ziet gaat dus over
 * waar je bent, en het aantal regels blijft ruim onder wat op een scherm past.
 *
 * `match` bestaat omdat het pad niet altijd het menu-item is: /events/<id> hoort
 * bij Events, en /bord/<id> bij het bord waar je op klikte.
 */
export function navSecties({ isAdmin, isStaff }) {
  if (isStaff) {
    return [{ to: '/openen-sluiten', icon: 'clipboard-check', label: 'Openen & sluiten', kinderen: [] }]
  }

  /*
    De borden staan hier niet meer als eigen ingang.

    Ze stonden naast "Alle taken", met dezelfde taken erin — twee wegen naar
    hetzelfde werk, en een menu dat "Tasks" onder "Tasks" toont. Het bord is nu
    een weergave van de Tasks-pagina: kies daar een lijst en de bordweergave, en
    je krijgt de kolommen van die lijst met slepen en al. Die keuze wordt
    onthouden, dus wie er dagelijks werkt komt er meteen weer op uit.
  */

  return [
    { to: '/dashboard', icon: 'layout-dashboard', label: 'Dashboard', kinderen: [] },
    {
      to: '/',
      icon: 'kanban',
      label: 'Events',
      end: true,
      match: (p) => p === '/' || p.startsWith('/events') || p === '/kalender' || p === '/klanten' || p === '/social',
      kinderen: [
        { to: '/', icon: 'kanban', label: 'Bord', end: true, match: (p) => p === '/' || p.startsWith('/events') },
        { to: '/kalender', icon: 'calendar-days', label: 'Kalender' },
        { to: '/klanten', icon: 'building', label: 'Klanten' },
        { to: '/social', icon: 'share-2', label: 'Socials' },
      ],
    },
    {
      to: '/tasks',
      icon: 'check-circle',
      label: 'Tasks',
      match: (p) => p === '/tasks' || p === '/werklast' || p === '/goals' || p.startsWith('/bord'),
      kinderen: [
        { to: '/werklast', icon: 'users', label: 'Werklast' },
        { to: '/goals', icon: 'target', label: 'Goals' },
      ],
    },
    {
      to: '/openen-sluiten',
      icon: 'clipboard-check',
      label: 'Bistro',
      match: (p) => p.startsWith('/openen-sluiten') || p.startsWith('/registraties'),
      kinderen: [
        { to: '/openen-sluiten', icon: 'clipboard-check', label: 'Openen & sluiten' },
        { to: '/registraties', icon: 'file-text', label: 'Registraties' },
      ],
    },
    {
      to: '/overleg',
      icon: 'messages-square',
      label: 'Team',
      match: (p) => p === '/overleg' || p === '/uren',
      kinderen: [
        { to: '/overleg', icon: 'messages-square', label: 'Teamoverleg' },
        { to: '/uren', icon: 'timer', label: 'Uren' },
      ],
    },
    ...(isAdmin ? [{ to: '/instellingen', icon: 'settings', label: 'Instellingen', kinderen: [] }] : []),
  ]
}

/** De platte lijst die de onderbalk op een telefoon nodig heeft. */
export function mainNav({ isAdmin, isStaff }) {
  if (isStaff) return [{ to: '/openen-sluiten', icon: 'clipboard-check', label: 'Openen & sluiten' }]
  return [
    { to: '/dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { to: '/', icon: 'kanban', label: 'Events', end: true, match: (p) => p === '/' || p.startsWith('/events') },
    { to: '/tasks', icon: 'check-circle', label: 'Tasks' },
    { to: '/kalender', icon: 'calendar-days', label: 'Kalender' },
    { to: '/werklast', icon: 'users', label: 'Werklast' },
    ...(isAdmin ? [{ to: '/instellingen', icon: 'settings', label: 'Instellingen' }] : []),
  ]
}

/** Alles wat niet in de onderbalk past, voor het scherm "Meer" op een telefoon. */
export const MORE = [
  { to: '/dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
  { to: '/klanten', icon: 'building', label: 'Klanten' },
  { to: '/social', icon: 'share-2', label: 'Socials' },
  { to: '/openen-sluiten', icon: 'clipboard-check', label: 'Openen & sluiten' },
  { to: '/registraties', icon: 'file-text', label: 'Registraties' },
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
  const location = useLocation()
  const [zoekArgs] = useSearchParams()

  const secties = useMemo(() => navSecties({ isAdmin, isStaff }), [isAdmin, isStaff])

  // De borden van Tasks staan op hetzelfde pad en verschillen alleen in de lijst
  // die erbij hoort; daarom kijkt `match` ook naar wat er achter het vraagteken
  // staat.
  const actief = (item, pad) =>
    item.match ? item.match(pad, zoekArgs) : item.end ? pad === item.to : pad.startsWith(item.to)

  /*
    Het tweede niveau staat er voor de sectie waar je in zit — niet voor alle
    secties tegelijk, want dan is het weer één lange lijst. Wie ergens anders
    heen wil, klikt de sectie aan en ziet er de onderdelen van.
  */
  const [geopend, setGeopend] = useState(null)
  const huidige = secties.find((sectie) => actief(sectie, location.pathname))
  const openSectie = geopend ?? huidige?.to ?? null

  return (
    <aside className="je-side je-night" aria-label="Hoofdnavigatie">
      <NavLink to="/" className="je-side__logo">
        <Logotype size={38} invert />
      </NavLink>

      {/* De navigatie is het enige dat mag schuiven; de timer en jouw naam
          blijven staan, want een timer die je moet gaan zoeken vergeet je. */}
      <div className="je-side__scroll">
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {secties.map((sectie) => {
            const aan = actief(sectie, location.pathname)
            const uitgeklapt = sectie.kinderen.length > 0 && openSectie === sectie.to

            return (
              <div key={sectie.to}>
                <NavLink
                  to={sectie.to}
                  end={sectie.end}
                  onClick={() => setGeopend(sectie.to)}
                  className={cn('je-nav', aan && 'je-nav--on')}
                  aria-expanded={sectie.kinderen.length ? uitgeklapt : undefined}
                >
                  <Icon name={sectie.icon} size={17} />
                  <span style={{ flex: 1 }}>{sectie.label}</span>
                  {counts[sectie.to] ? <span className="je-nav__count">{counts[sectie.to]}</span> : null}
                  {sectie.kinderen.length ? (
                    <Icon name={uitgeklapt ? 'chevron-down' : 'chevron-right'} size={13} />
                  ) : null}
                </NavLink>

                {uitgeklapt ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {sectie.kinderen.map((kind) => (
                      <NavLink
                        key={kind.to + kind.label}
                        to={kind.to}
                        end={kind.end}
                        className={cn('je-nav je-nav--minor', actief(kind, location.pathname) && 'je-nav--on')}
                      >
                        <Icon name={kind.icon} size={15} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {kind.label}
                        </span>
                        {counts[kind.to] ? <span className="je-nav__count">{counts[kind.to]}</span> : null}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>
      </div>

      {isStaff ? null : <SideTimer />}

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
