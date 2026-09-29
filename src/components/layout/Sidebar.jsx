import { useMemo, useState } from 'react'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { cn } from '@lib/cn'
import { formatDuration } from '@lib/format'
import { periodKeys } from '@lib/time-math'
import { Button, Hex, Icon, IconButton, Logotype, initialsOf } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useEvents, useWeekEntries } from '@data/events'
import { stopTimer, useRunningTimer } from '@data/time'
import { AgendaMenuItem, InstallMenuItem, MeldingsVoorkeurenMenuItem, PushMenuItem, TaalMenuItem } from './AppMenuItems'
import MeldingsVoorkeuren from '@components/notifications/MeldingsVoorkeuren'
import AgendaAbonnement from '@components/kalenderfeed/AgendaAbonnement'

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
    return [{ to: '/openen-sluiten', icon: 'clipboard-check', sleutel: 'nav.openensluiten', kinderen: [] }]
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
    { to: '/dashboard', icon: 'layout-dashboard', sleutel: 'nav.dashboard', kinderen: [] },
    {
      to: '/',
      icon: 'kanban',
      sleutel: 'nav.events',
      end: true,
      match: (p) => p === '/' || p.startsWith('/events') || p === '/kalender' || p === '/klanten' || p === '/social',
      kinderen: [
        { to: '/', icon: 'kanban', sleutel: 'nav.bord', end: true, match: (p) => p === '/' || p.startsWith('/events') },
        { to: '/kalender', icon: 'calendar-days', sleutel: 'nav.kalender' },
        { to: '/klanten', icon: 'building', sleutel: 'nav.klanten' },
        { to: '/social', icon: 'share-2', sleutel: 'nav.socials' },
      ],
    },
    {
      to: '/tasks',
      icon: 'check-circle',
      sleutel: 'nav.tasks',
      match: (p) => p === '/tasks' || p === '/werklast' || p === '/goals' || p.startsWith('/bord'),
      kinderen: [
        { to: '/werklast', icon: 'users', sleutel: 'nav.werklast' },
        { to: '/goals', icon: 'target', sleutel: 'nav.goals' },
      ],
    },
    {
      to: '/openen-sluiten',
      icon: 'clipboard-check',
      sleutel: 'nav.bistro',
      match: (p) => p.startsWith('/openen-sluiten') || p.startsWith('/registraties'),
      kinderen: [
        { to: '/openen-sluiten', icon: 'clipboard-check', sleutel: 'nav.openensluiten' },
        { to: '/registraties', icon: 'file-text', sleutel: 'nav.registraties' },
      ],
    },
    {
      to: '/overleg',
      icon: 'messages-square',
      sleutel: 'nav.team',
      match: (p) => p === '/overleg' || p === '/uren' || p === '/rooster',
      kinderen: [
        { to: '/overleg', icon: 'messages-square', sleutel: 'nav.teamoverleg' },
        { to: '/rooster', icon: 'calendar-days', sleutel: 'nav.rooster' },
        { to: '/uren', icon: 'timer', sleutel: 'nav.uren' },
      ],
    },
    ...(isAdmin ? [{ to: '/instellingen', icon: 'settings', sleutel: 'nav.instellingen', kinderen: [] }] : []),
  ]
}

/** De platte lijst die de onderbalk op een telefoon nodig heeft. */
export function mainNav({ isAdmin, isStaff }) {
  if (isStaff) return [{ to: '/openen-sluiten', icon: 'clipboard-check', sleutel: 'nav.openensluiten' }]
  return [
    { to: '/dashboard', icon: 'layout-dashboard', sleutel: 'nav.dashboard' },
    { to: '/', icon: 'kanban', sleutel: 'nav.events', end: true, match: (p) => p === '/' || p.startsWith('/events') },
    { to: '/tasks', icon: 'check-circle', sleutel: 'nav.tasks' },
    { to: '/kalender', icon: 'calendar-days', sleutel: 'nav.kalender' },
    { to: '/werklast', icon: 'users', sleutel: 'nav.werklast' },
    ...(isAdmin ? [{ to: '/instellingen', icon: 'settings', sleutel: 'nav.instellingen' }] : []),
  ]
}

/** Alles wat niet in de onderbalk past, voor het scherm "Meer" op een telefoon. */
export const MORE = [
  { to: '/dashboard', icon: 'layout-dashboard', sleutel: 'nav.dashboard' },
  { to: '/klanten', icon: 'building', sleutel: 'nav.klanten' },
  { to: '/social', icon: 'share-2', sleutel: 'nav.socials' },
  { to: '/openen-sluiten', icon: 'clipboard-check', sleutel: 'nav.openensluiten' },
  { to: '/registraties', icon: 'file-text', sleutel: 'nav.registraties' },
  { to: '/overleg', icon: 'messages-square', sleutel: 'nav.teamoverleg' },
  { to: '/uren', icon: 'timer', sleutel: 'nav.uren' },
  { to: '/goals', icon: 'target', sleutel: 'nav.goals' },
]

/** De rol zoals ze op het scherm staat. De sleutel, de tekst hangt aan de taal. */
export const ROLE_LABEL = {
  owner: 'rol.owner',
  admin: 'rol.admin',
  member: 'rol.member',
  staff: 'rol.staff',
  guest: 'rol.guest',
}

export default function Sidebar({ counts = {} }) {
  const { isAdmin, isStaff } = useAuth()
  const { t } = useTaal()
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
    <aside className="je-side je-night" aria-label={t('nav.hoofdnavigatie')}>
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
                  <span style={{ flex: 1 }}>{t(sectie.sleutel)}</span>
                  {counts[sectie.to] ? <span className="je-nav__count">{counts[sectie.to]}</span> : null}
                  {sectie.kinderen.length ? (
                    <Icon name={uitgeklapt ? 'chevron-down' : 'chevron-right'} size={13} />
                  ) : null}
                </NavLink>

                {uitgeklapt ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {sectie.kinderen.map((kind) => (
                      <NavLink
                        key={kind.to + kind.sleutel}
                        to={kind.to}
                        end={kind.end}
                        className={cn('je-nav je-nav--minor', actief(kind, location.pathname) && 'je-nav--on')}
                      >
                        <Icon name={kind.icon} size={15} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t(kind.sleutel)}
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
  const { t } = useTaal()
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
      toast.success(id ? t('timer.gestopt', { tijd: formatDuration(elapsed) }) : t('timer.te_kort'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="je-side__timer">
      <span className="je-eyebrow" style={{ color: 'var(--navy-300)' }}>
        {t('timer.titel')}
      </span>
      {timer ? (
        <>
          <div className="je-side__clock">{formatDuration(elapsed, { withSeconds: true })}</div>
          <div style={{ font: 'var(--type-body-sm)', color: 'var(--navy-200)' }}>
            {timer.taskTitle || timer.description || t('timer.losse_tijd')}
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
              {t('timer.stop_en_boek')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ font: 'var(--type-body-sm)', color: 'var(--navy-300)' }}>
            {t('timer.leeg')}
          </div>
          <div style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--navy-400)' }}>
            {t('timer.week_geboekt', { tijd: formatDuration(booked) })}
          </div>
        </>
      )}
    </div>
  )
}

function Me() {
  const { profile, logOut } = useAuth()
  const { t } = useTaal()
  const [menu, setMenu] = useState(false)
  // Buiten het menu, want het menu klapt dicht bij de klik erop.
  const [voorkeuren, setVoorkeuren] = useState(false)
  const [agenda, setAgenda] = useState(false)

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
          {profile?.role ? t(ROLE_LABEL[profile.role] ?? profile.role) : null}
        </div>
      </button>
      <span style={{ color: 'var(--navy-300)' }}>
        <IconButton icon="log-out" label={t('schil.afmelden')} size="sm" onClick={logOut} />
      </span>
      {menu ? (
        <div className="je-menu" role="menu" onClick={() => setMenu(false)}>
          <TaalMenuItem />
          <InstallMenuItem />
          <PushMenuItem />
          <MeldingsVoorkeurenMenuItem onOpen={() => setVoorkeuren(true)} />
          <AgendaMenuItem onOpen={() => setAgenda(true)} />
          <button type="button" role="menuitem" onClick={logOut}>
            {t('schil.afmelden')}
          </button>
        </div>
      ) : null}
      {voorkeuren ? <MeldingsVoorkeuren open onClose={() => setVoorkeuren(false)} /> : null}
      {agenda ? <AgendaAbonnement open onClose={() => setAgenda(false)} /> : null}
    </div>
  )
}
