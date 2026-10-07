import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@lib/cn'
import { formatDuration } from '@lib/format'
import { periodKeys } from '@lib/time-math'
import { Avatar, Button, Icon, IconButton, Logotype } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useEvents, useWeekEntries } from '@data/events'
import { stopTimer, useRunningTimer } from '@data/time'
import TimerStarten from '@components/time/TimerStarten'

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
export function navSecties({ isAdmin, isStaff, isSocial }) {
  /*
    Een medewerker ziet twee dingen: zijn lijsten en de events waarop hij staat.
    Niet de planning, niet de bedragen — de regels laten hem er ook niet bij.
  */
  if (isStaff) {
    return [
      { to: '/openen-sluiten', icon: 'clipboard-check', sleutel: 'nav.openensluiten', kinderen: [] },
      { to: '/mijn-events', icon: 'kanban', sleutel: 'nav.mijnevents', kinderen: [] },
      // Zijn eigen uren, en alleen die: de regels laten hem de uren van een
      // collega niet zien, want dat gaat over diens loon.
      { to: '/uren', icon: 'clock', sleutel: 'nav.uren', kinderen: [] },
    ]
  }

  // De socialrol heeft één plek. De rest weigeren de regels toch; dit zorgt dat
  // ze er niet op stuit in plaats van op een leeg scherm met foutmeldingen.
  if (isSocial) {
    return [{ to: '/social', icon: 'share-2', sleutel: 'nav.socials', kinderen: [] }]
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
    /*
      Events heeft geen tweede niveau meer.

      Er stonden vier regels onder: Bord en Kalender waren de tabs van de
      pagina zelf, Klanten staat nu op het eerste niveau, en het postvak hangt
      aan een envelopje rechtsboven op de eventpagina — daar kijk je erin, en
      daar maak je er een event van. Een menu-ingang naar een scherm dat
      meestal leeg is, is een ingang die je elke dag passeert voor niets.
    */
    {
      to: '/',
      icon: 'kanban',
      sleutel: 'nav.events',
      end: true,
      match: (p) => p === '/' || p.startsWith('/events') || p === '/kalender' || p === '/aanvragen',
      kinderen: [],
    },
    /*
      Klanten staat op zichzelf en niet onder Events.

      Een klant is geen weergave van de eventlijst: hij heeft zijn eigen
      dossier, zijn eigen adressen en zijn eigen geschiedenis, en je komt er
      net zo vaak vanuit een offerte of een factuur als vanuit een event.
      Weggestopt onder Events moest je eerst naar het eventbord om bij een
      klant te raken.
    */
    { to: '/klanten', icon: 'building', sleutel: 'nav.klanten', kinderen: [] },
    /*
      Socials staat op zichzelf en niet meer onder Events.

      Het hing daar omdat de content uit een event komt, maar dat is niet hoe
      er gewerkt wordt: wie de socials doet, doet de hele week socials en komt
      niet eerst langs het eventbord. En er is nu een rol die niets anders doet.
    */
    { to: '/social', icon: 'share-2', sleutel: 'nav.socials', kinderen: [] },
    /*
      Materiaal staat op zichzelf. Het hing onder Team, maar Team klapt alleen
      open op zijn eigen pagina's en /materiaal hoorde daar niet bij: wie op
      Materiaal stond, zag de ingang nergens, en wie elders stond, moest raden
      dat de voorraad van de verhuur onder Team zat.
    */
    { to: '/materiaal', icon: 'package', sleutel: 'nav.materiaal', kinderen: [] },
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
      sleutel: 'nav.checklists',
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
      match: (p) =>
        p === '/overleg' || p === '/uren' || p === '/rooster' || p === '/logboek'
        || p === '/medewerkers' || p === '/planning',
      kinderen: [
        { to: '/overleg', icon: 'messages-square', sleutel: 'nav.teamoverleg' },
        // De ploeg die komt werken: studenten en flexi's. Staat bij Team en
        // niet achter het tandwiel, want dit is wekelijks werk en geen instelling.
        { to: '/medewerkers', icon: 'users', sleutel: 'nav.medewerkers' },
        /*
          De planning uit AAPI staat naast het eigen rooster en niet erin. Het
          ene is met de hand gemaakt en hangt aan profielen hier, het andere
          komt uit AAPI en hangt aan mensen die hier geen account hebben. Dat
          die twee op termijn dubbel werk zijn, klopt; welke blijft is een
          beslissing van wie ermee plant.
        */
        { to: '/planning', icon: 'users', sleutel: 'nav.planning' },
        { to: '/rooster', icon: 'calendar-days', sleutel: 'nav.rooster' },
        { to: '/uren', icon: 'timer', sleutel: 'nav.uren' },
        { to: '/logboek', icon: 'file-text', sleutel: 'nav.logboek' },
      ],
    },
    ...(isAdmin ? [{ to: '/instellingen', icon: 'settings', sleutel: 'nav.instellingen', kinderen: [] }] : []),
  ]
}

/** De platte lijst die de onderbalk op een telefoon nodig heeft. */
export function mainNav({ isAdmin, isStaff, isSocial }) {
  if (isStaff) {
    return [
      { to: '/openen-sluiten', icon: 'clipboard-check', sleutel: 'nav.openensluiten' },
      { to: '/mijn-events', icon: 'kanban', sleutel: 'nav.mijnevents' },
    ]
  }
  if (isSocial) return [{ to: '/social', icon: 'share-2', sleutel: 'nav.socials' }]
  return [
    { to: '/dashboard', icon: 'layout-dashboard', sleutel: 'nav.dashboard' },
    { to: '/', icon: 'kanban', sleutel: 'nav.events', end: true, match: (p) => p === '/' || p.startsWith('/events') },
    { to: '/tasks', icon: 'check-circle', sleutel: 'nav.tasks' },
    { to: '/social', icon: 'share-2', sleutel: 'nav.socials' },
    { to: '/werklast', icon: 'users', sleutel: 'nav.werklast' },
    ...(isAdmin ? [{ to: '/instellingen', icon: 'settings', sleutel: 'nav.instellingen' }] : []),
  ]
}

/** Alles wat niet in de onderbalk past, voor het scherm "Meer" op een telefoon. */
export const MORE = [
  { to: '/dashboard', icon: 'layout-dashboard', sleutel: 'nav.dashboard' },
  { to: '/klanten', icon: 'building', sleutel: 'nav.klanten' },
  { to: '/materiaal', icon: 'package', sleutel: 'nav.materiaal' },
  { to: '/kalender', icon: 'calendar-days', sleutel: 'nav.kalender' },
  { to: '/openen-sluiten', icon: 'clipboard-check', sleutel: 'nav.openensluiten' },
  { to: '/registraties', icon: 'file-text', sleutel: 'nav.registraties' },
  { to: '/overleg', icon: 'messages-square', sleutel: 'nav.teamoverleg' },
  { to: '/uren', icon: 'timer', sleutel: 'nav.uren' },
  { to: '/goals', icon: 'target', sleutel: 'nav.goals' },
  { to: '/logboek', icon: 'file-text', sleutel: 'nav.logboek' },
]

/** De rol zoals ze op het scherm staat. De sleutel, de tekst hangt aan de taal. */
export const ROLE_LABEL = {
  owner: 'rol.owner',
  admin: 'rol.admin',
  member: 'rol.member',
  staff: 'rol.staff',
  social: 'rol.social',
  guest: 'rol.guest',
}

export default function Sidebar({ counts = {} }) {
  const { isAdmin, isStaff, isSocial } = useAuth()
  const { t } = useTaal()
  const location = useLocation()
  const [zoekArgs] = useSearchParams()

  const secties = useMemo(() => navSecties({ isAdmin, isStaff, isSocial }), [isAdmin, isStaff, isSocial])

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

      {/* De socialrol boekt ook tijd op haar posts, dus de timer blijft staan. */}
      {isStaff ? null : <SideTimer />}

      <Me />
    </aside>
  )
}

/**
 * De timer onderaan de zijbalk.
 *
 * De klok staat er altijd, ook op 00:00:00, met een startknop ernaast. Eerst
 * stond er een zin — "start een timer vanaf een taak" — en dat betekende dat je
 * eerst de juiste taak moest gaan opzoeken voor je kon beginnen. Nu begin je
 * waar je staat: klikken, kiezen waaraan, lopen.
 *
 * Kiezen waaraan blijft verplicht. Tijd zonder event of taak is tijd die
 * nergens op een kostenplaats terechtkomt, en dat is precies waarom de losse
 * boeking eruit ging.
 */
function SideTimer() {
  const { uid } = useAuth()
  const { t } = useTaal()
  const toast = useToast()
  const { timer, elapsed } = useRunningTimer(uid)
  const { events, tasks, eventById } = useEvents()
  const week = periodKeys(new Date()).week
  // Alleen de eigen uren opvragen. Er stond hier al een filter op `profileId`,
  // maar pas ná het ophalen — en de socialrol mag de rijen van de ploeg niet
  // lezen, dus faalde de vraag in zijn geheel. Zie `useWeekEntries`.
  const entries = useWeekEntries(week, { profileId: uid })
  const [busy, setBusy] = useState(false)
  const [kiezen, setKiezen] = useState(false)

  const booked = useMemo(
    () => entries.reduce((a, e) => a + (e.durationSeconds ?? 0), 0),
    [entries]
  )

  /*
    De startknop verschijnt alleen als er iets te kiezen valt.

    De socialrol leest de events en hun taken niet — die staan vol bedragen —
    dus zou de kiezer voor haar leeg openen. Zij start haar timer op de post
    zelf, en een knop die naar een lege lijst leidt is erger dan geen knop.
  */
  const kanStarten = (events?.length ?? 0) + (tasks?.length ?? 0) > 0

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div className="je-side__clock">{formatDuration(timer ? elapsed : 0, { withSeconds: true })}</div>
        {timer ? (
          <IconButton
            icon="square"
            label={t('timer.stoppen')}
            size="sm"
            onClick={stop}
            disabled={busy}
            style={{ color: 'var(--white)' }}
          />
        ) : kanStarten ? (
          <IconButton
            icon="play"
            label={t('timer.starten')}
            size="sm"
            onClick={() => setKiezen(true)}
            style={{ color: 'var(--white)' }}
          />
        ) : null}
      </div>

      {timer ? (
        <>
          <div style={{ font: 'var(--type-body-sm)', color: 'var(--navy-200)' }}>
            {timer.taskTitle || timer.description || t('timer.losse_tijd')}
          </div>
          <div style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--navy-400)' }}>
            {eventName}
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
        <div style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--navy-400)' }}>
          {t('timer.week_geboekt', { tijd: formatDuration(booked) })}
        </div>
      )}

      {kiezen ? <TimerStarten uid={uid} onClose={() => setKiezen(false)} /> : null}
    </div>
  )
}

/**
 * Jij, onderaan de zijbalk.
 *
 * Hier hing een menu met zes regels: je taal, twee soorten meldingen, je
 * agenda, afmelden. Dat was een tweede navigatie geworden op de plek waar de
 * eerste al staat, en je moest erin zoeken naar iets wat je één keer instelt.
 *
 * Nu brengt een klik op je foto of je naam je naar je profiel, en staat alles
 * wat alleen over jou gaat dáár bij elkaar. Afmelden blijft als icoon ernaast
 * — dat is het enige wat je van hieruit meteen wil kunnen.
 */
function Me() {
  const { profile, logOut } = useAuth()
  const { t } = useTaal()
  const navigeer = useNavigate()

  return (
    <div className="je-side__me">
      {/* Je eigen gezicht; zonder foto dezelfde zeshoek met je initialen. */}
      <Avatar profile={profile} size={34} tone="ink" />
      <button
        type="button"
        className="je-plainbtn"
        style={{ minWidth: 0, flex: 1, textAlign: 'left' }}
        onClick={() => navigeer('/profiel')}
        title={t('profiel.titel')}
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
    </div>
  )
}
