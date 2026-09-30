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
import { OfflineProvider } from '@context/OfflineProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { EventsProvider, useEvents } from '@data/events'
import { useNavCounts } from '@data/counts'
import { stopTimer, useRunningTimer } from '@data/time'
import { luisterNaarMeldingen } from '@lib/push'
import { isSchrijffout, leesSchrijffout } from '@lib/schrijffout'
import AssistantPanel from './AssistantPanel'
import GlobalSearch from './GlobalSearch'
import OfflineBar from './OfflineBar'
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
    <OfflineProvider>
      <EventsProvider>
        <AssistantProvider>
          <Shell>{children}</Shell>
        </AssistantProvider>
      </EventsProvider>
    </OfflineProvider>
  )
}

function Shell({ children }) {
  const { isStaff, isAdmin, isSocial, uid } = useAuth()
  const { loading, error, vastgelopen } = useWorkspace()
  const { events } = useEvents()
  const navCounts = useNavCounts()
  const toast = useToast()
  const narrow = useNarrow()
  const location = useLocation()
  const { open, setOpen } = useAssistant()
  const { t } = useTaal()
  const nieuweVersie = useNieuweVersie()
  const [hulpOpen, setHulpOpen] = useState(false)

  // Zoals in het design: op een breed scherm staat de assistent open tot je
  // hem sluit (dat wordt onthouden), op een telefoon dicht — daar zou hij het
  // hele scherm afdekken.
  const chatOpen = !isStaff && !isSocial && (narrow ? open === true : open ?? true)

  /*
    Een schrijfactie die niet doorging, zichtbaar maken.

    De velden in de panelen schrijven zonder `await` en zonder `catch` — bij een
    los veld valt er ook weinig zinnigs te doen. Maar Firestore past een
    schrijving eerst lokaal toe: het scherm toont de nieuwe waarde alsof ze
    bewaard is, en rolt ze pas een moment later stilletjes terug wanneer de
    server weigert. Voor een planningstool is dat de ergste fout die er is — een
    taak die niet bewaard wordt zonder dat iemand het merkt.

    Daarom hier, op één plek, in plaats van tientallen keren in de schermen. Wat
    van de database of een functie komt wordt een toast; de rest laten we met
    rust, want een programmeerfout hoort in de console en niet als melding bij
    iemand die aan het werk is.
  */
  useEffect(() => {
    const opAfwijzing = (e) => {
      if (!isSchrijffout(e.reason)) return
      e.preventDefault()
      toast.error(leesSchrijffout(e.reason))
    }
    window.addEventListener('unhandledrejection', opAfwijzing)
    return () => window.removeEventListener('unhandledrejection', opAfwijzing)
  }, [toast])

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

  const nav = mainNav({ isAdmin, isStaff, isSocial })

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
            <span>{t('schil.nieuwe_versie')}</span>
            <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
              {t('alg.herladen')}
            </Button>
          </div>
        ) : null}

        {/*
          En dezelfde plek voor de andere mededeling die je moet weten voor je
          de app wegklikt: dat er geen verbinding is, of dat er nog vinkjes op
          dit toestel staan. Zie @lib/offline.
        */}
        <OfflineBar />

        {narrow ? <MobileBar uid={uid} isStaff={isStaff} /> : null}

        {isStaff || isSocial ? null : (
          <div className="je-topbar">
            <GlobalSearch narrow={narrow} />
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {/* Sneltoetsen zijn onvindbaar als je niet weet dat ze bestaan;
                  dit knopje is de enige plek waar ze zichzelf aankondigen. */}
              {narrow ? null : (
                <IconButton icon="keyboard" label={t('menu.sneltoetsen')} variant="bare" onClick={() => setHulpOpen(true)} />
              )}
              {narrow ? (
                <IconButton icon="sparkles" label={t('schil.assistent')} variant="outline" onClick={() => setOpen(!chatOpen)} />
              ) : (
                <Button variant={chatOpen ? 'primary' : 'secondary'} size="sm" iconLeft="sparkles" onClick={() => setOpen(!chatOpen)}>
                  {t('schil.assistent')}
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
                <h2 style={{ font: 'var(--type-h3)', textTransform: 'uppercase' }}>{t('schil.duurt_te_lang_titel')}</h2>
                <p style={{ marginTop: 8, font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
                  {t('schil.duurt_te_lang_tekst')}
                </p>
                <Button size="sm" style={{ marginTop: 16 }} onClick={herstelZonderCache}>
                  {t('schil.opnieuw_beginnen')}
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }} className="je-muted-caption">
              <Spinner /> {t('schil.werkruimte_laadt')}
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
              <div style={{ maxWidth: 380 }}>
                <h2 style={{ font: 'var(--type-h3)', textTransform: 'uppercase' }}>{t('schil.laadt_niet_titel')}</h2>
                <p style={{ marginTop: 8, font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
                  {t('schil.laadt_niet_tekst', { fout: error.code ?? error.message })}
                </p>
                <Button size="sm" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
                  {t('alg.herladen')}
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
                {t(item.sleutel)}
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
  const { t } = useTaal()

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
            toast.success(id ? t('timer.gestopt', { tijd: formatDuration(elapsed) }) : t('timer.te_kort'))
          }}
          aria-label={t('timer.stoppen')}
        >
          <Icon name="square" size={14} />
          {formatDuration(elapsed, { withSeconds: true })}
        </button>
      ) : null}
      {/* Afmelden en de extra schermen: op een telefoon via Meer. */}
      <span style={{ marginLeft: timer ? 0 : 'auto', color: 'var(--navy-300)', display: 'flex', gap: 4 }}>
        {isStaff ? null : (
          <NavLink to="/meer" aria-label={t('menu.meer')} className="je-iconbtn je-iconbtn--sm" style={{ color: 'inherit', border: 0 }}>
            <Icon name="menu" size={16} />
          </NavLink>
        )}
        <IconButton icon="log-out" label={t('schil.afmelden')} size="sm" onClick={logOut} />
      </span>
    </div>
  )
}
