import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@lib/cn'
import { herstelZonderCache } from '@lib/firebase'
import { formatDuration } from '@lib/format'
import { indexOf } from '@lib/pipeline'
import { useNarrow } from '@lib/useNarrow'
import { useNieuweVersie } from '@lib/useNieuweVersie'
import { Button, Icon, IconButton, Logotype } from '@components/ds'
import { Spinner } from '@ui/index'
import { AssistantProvider, useAssistant } from '@context/AssistantProvider'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { EventsProvider, useEvents } from '@data/events'
import { useNavCounts } from '@data/counts'
import { stopTimer, useRunningTimer } from '@data/time'
import { luisterNaarMeldingen } from '@lib/push'
import AssistantPanel from './AssistantPanel'
import GlobalSearch from './GlobalSearch'
import Sidebar, { mainNav } from './Sidebar'
import Sneltoetsen from './Sneltoetsen'

/**
 * De schil uit het design: donkere zijbalk links, een witte balk met zoeken
 * en de assistent bovenaan, het scherm, en de assistent als paneel rechts.
 * Onder 1000px breed: een donkere balk met logo en timer bovenaan, en de
 * navigatie als balk onderaan.
 */
export default function AppShell({ children }) {
  return (
    <EventsProvider>
      <AssistantProvider>
        <Shell>{children}</Shell>
      </AssistantProvider>
    </EventsProvider>
  )
}

function Shell({ children }) {
  const { isStaff, isAdmin, uid } = useAuth()
  const { loading, error, vastgelopen } = useWorkspace()
  const { events } = useEvents()
  const navCounts = useNavCounts()
  const toast = useToast()
  const narrow = useNarrow()
  const location = useLocation()
  const { open, setOpen } = useAssistant()
  const nieuweVersie = useNieuweVersie()
  const [hulpOpen, setHulpOpen] = useState(false)

  // Zoals in het design: op een breed scherm staat de assistent open tot je
  // hem sluit (dat wordt onthouden), op een telefoon dicht — daar zou hij het
  // hele scherm afdekken.
  const chatOpen = !isStaff && (narrow ? open === true : open ?? true)

  // Een melding terwijl de app open staat toont de browser niet zelf — dan
  // wordt het een toast.
  useEffect(() => {
    let stop = () => {}
    luisterNaarMeldingen(({ title, body }) => toast.success([title, body].filter(Boolean).join(' — ')))
      .then((f) => {
        stop = f
      })
      .catch(() => {})
    return () => stop()
  }, [toast])

  // Wie op een telefoon naar een ander scherm gaat, wil de assistent niet
  // eroverheen zien liggen.
  useEffect(() => {
    if (narrow) setOpen((o) => (o === true ? null : o))
  }, [location.pathname, narrow, setOpen])

  const counts = useMemo(
    () => ({
      ...navCounts,
      '/': events.filter((e) => indexOf(e.statusName) >= 0 && indexOf(e.statusName) < indexOf('ready to invoice')).length || null,
    }),
    [navCounts, events]
  )

  const nav = mainNav({ isAdmin, isStaff })

  return (
    <div className="je-shell">
      {narrow ? null : <Sidebar counts={counts} />}

      <main className="je-main">
        {/*
          Een tabblad dat openstaat tijdens een uitrol vraagt straks een bestand
          op dat niet meer bestaat. Dat was een wit scherm; nu is het een regel
          bovenaan, en herlaad je op je eigen moment in plaats van middenin een
          lijst afvinken.
        */}
        {nieuweVersie ? (
          <div className="je-updatebar" role="status">
            <Icon name="sparkles" size={15} />
            <span>Er staat een nieuwe versie van JE Plan klaar.</span>
            <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
              Herladen
            </Button>
          </div>
        ) : null}

        {narrow ? <MobileBar uid={uid} isStaff={isStaff} /> : null}

        {isStaff ? null : (
          <div className="je-topbar">
            <GlobalSearch narrow={narrow} />
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {/* Sneltoetsen zijn onvindbaar als je niet weet dat ze bestaan;
                  dit knopje is de enige plek waar ze zichzelf aankondigen. */}
              {narrow ? null : (
                <IconButton icon="keyboard" label="Sneltoetsen" variant="bare" onClick={() => setHulpOpen(true)} />
              )}
              {narrow ? (
                <IconButton icon="sparkles" label="Assistent" variant="outline" onClick={() => setOpen(!chatOpen)} />
              ) : (
                <Button variant={chatOpen ? 'primary' : 'secondary'} size="sm" iconLeft="sparkles" onClick={() => setOpen(!chatOpen)}>
                  Assistent
                </Button>
              )}
            </div>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {loading && vastgelopen ? (
            // Geen fout en geen gegevens: de opgeslagen kopie op dit toestel
            // antwoordt niet. Eerder bleef hier alleen een molentje draaien.
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
              <div style={{ maxWidth: 380 }}>
                <h2 style={{ font: 'var(--type-h3)', textTransform: 'uppercase' }}>Dit duurt te lang</h2>
                <p style={{ marginTop: 8, font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
                  De gegevens die op dit toestel bewaard zijn, antwoorden niet. Opnieuw beginnen lost het op — er gaat
                  niets verloren, want alles staat ook online.
                </p>
                <Button size="sm" style={{ marginTop: 16 }} onClick={herstelZonderCache}>
                  Opnieuw beginnen
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }} className="je-muted-caption">
              <Spinner /> Werkruimte laden…
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
              <div style={{ maxWidth: 380 }}>
                <h2 style={{ font: 'var(--type-h3)', textTransform: 'uppercase' }}>De werkruimte laadt niet</h2>
                <p style={{ marginTop: 8, font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
                  Er ging iets mis bij het ophalen van de lijsten en de mensen. Herlaad de pagina; blijft het staan, geef
                  dan deze melding door: {error.code ?? error.message}
                </p>
                <Button size="sm" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
                  Herladen
                </Button>
              </div>
            </div>
          ) : (
            children
          )}
        </div>

        {narrow && nav.length > 1 ? (
          <nav className="je-bottomnav" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn((item.match ? item.match(location.pathname) : isActive) && 'je-on')}
              >
                <Icon name={item.icon} size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </main>

      {chatOpen ? <AssistantPanel /> : null}
      <Sneltoetsen hulpOpen={hulpOpen} setHulpOpen={setHulpOpen} />
    </div>
  )
}

function MobileBar({ uid, isStaff }) {
  const { timer, elapsed } = useRunningTimer(isStaff ? null : uid)
  const toast = useToast()
  const { logOut } = useAuth()

  return (
    <div className="je-mobilebar je-night">
      <NavLink to="/" style={{ border: 0 }}>
        <Logotype size={28} invert />
      </NavLink>
      {timer ? (
        <button
          type="button"
          className="je-mobilebar__timer"
          onClick={async () => {
            const id = await stopTimer(uid)
            toast.success(id ? `Gestopt — ${formatDuration(elapsed)} geboekt.` : 'Te kort, niets geboekt.')
          }}
          aria-label="Timer stoppen en boeken"
        >
          <Icon name="square" size={14} />
          {formatDuration(elapsed, { withSeconds: true })}
        </button>
      ) : null}
      {/* Afmelden en de extra schermen: op een telefoon via Meer. */}
      <span style={{ marginLeft: timer ? 0 : 'auto', color: 'var(--navy-300)', display: 'flex', gap: 4 }}>
        {isStaff ? null : (
          <NavLink to="/meer" aria-label="Meer" className="je-iconbtn je-iconbtn--sm" style={{ color: 'inherit', border: 0 }}>
            <Icon name="menu" size={16} />
          </NavLink>
        )}
        <IconButton icon="log-out" label="Afmelden" size="sm" onClick={logOut} />
      </span>
    </div>
  )
}
