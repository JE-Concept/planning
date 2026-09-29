import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Spinner } from '@ui/index'
import { AuthProvider, useAuth } from '@context/AuthProvider'
import { ToastProvider } from '@context/ToastProvider'
import { WorkspaceProvider } from '@context/WorkspaceProvider'
import AppShell from '@components/layout/AppShell'
import ErrorBoundary from '@components/layout/ErrorBoundary'
import Login from '@pages/Login'

/**
 * Elke pagina komt apart binnen, zodat het eerste scherm niet wacht op code
 * voor schermen die je misschien nooit opent. De keerzijde daarvan is dat een
 * uitrol terwijl je tabblad openstaat een bestandsnaam kan weghalen die deze
 * pagina nog wil ophalen — daar staat de ErrorBoundary hieronder voor.
 */
const Dashboard      = lazy(() => import('@pages/Dashboard'))
const Tasks          = lazy(() => import('@pages/Tasks'))
const Events         = lazy(() => import('@pages/Events'))
const EventDetail    = lazy(() => import('@pages/EventDetail'))
const Workload       = lazy(() => import('@pages/Workload'))
const More           = lazy(() => import('@pages/More'))
const Board          = lazy(() => import('@pages/Board'))
const SocialCalendar = lazy(() => import('@pages/SocialCalendar'))
const Checklists     = lazy(() => import('@pages/Checklists'))
const Meetings       = lazy(() => import('@pages/Meetings'))
const TimeTracking   = lazy(() => import('@pages/TimeTracking'))
const Goals          = lazy(() => import('@pages/Goals'))
const Customers      = lazy(() => import('@pages/Customers'))
const Settings       = lazy(() => import('@pages/Settings'))
const NotFound       = lazy(() => import('@pages/NotFound'))

function Loading() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <Spinner className="h-6 w-6" />
    </div>
  )
}

/**
 * De pagina's, met een vangnet eromheen.
 *
 * De grens staat binnen de schil en niet eromheen: gaat één pagina onderuit,
 * dan blijft de zijbalk staan en kun je ergens anders heen klikken. De sleutel
 * op het pad zorgt dat die stap ook echt helpt — anders blijft de foutmelding
 * staan na het wegklikken.
 */
function Pages({ children }) {
  const { pathname } = useLocation()

  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

function Authenticated() {
  const { state, isStaff } = useAuth()

  if (state === 'loading') return <Loading />
  if (state !== 'ready') return <Login />

  // Personeel heeft één scherm. De rules weigeren de rest sowieso; dit zorgt
  // dat ze er niet op stuiten in plaats van een lege pagina met foutmeldingen.
  if (isStaff) {
    return (
      <WorkspaceProvider>
        <AppShell>
          <Pages>
            <Routes>
              <Route path="/openen-sluiten" element={<Checklists />} />
              <Route path="*" element={<Navigate to="/openen-sluiten" replace />} />
            </Routes>
          </Pages>
        </AppShell>
      </WorkspaceProvider>
    )
  }

  return (
    <WorkspaceProvider>
      <AppShell>
        <Pages>
          <Routes>
            <Route path="/" element={<Events />} />
            <Route path="/kalender" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/tasks" element={<Tasks />} />
            {/* De twee oude adressen blijven werken: ze staan in bladwijzers,
                in mails en in de adresbalk van wie de tool dagelijks gebruikt. */}
            <Route path="/mijn-taken" element={<Navigate to="/tasks" replace />} />
            <Route path="/mijn-werk" element={<Navigate to="/tasks" replace />} />
            <Route path="/werklast" element={<Workload />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* "Vandaag" heette het eerder; dat adres blijft werken. */}
            <Route path="/vandaag" element={<Navigate to="/dashboard" replace />} />
            <Route path="/meer" element={<More />} />
            <Route path="/bord/:listId" element={<Board />} />
            <Route path="/social" element={<SocialCalendar />} />
            <Route path="/klanten" element={<Customers />} />
            <Route path="/openen-sluiten" element={<Checklists />} />
            <Route path="/overleg" element={<Meetings />} />
            <Route path="/uren" element={<TimeTracking />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/instellingen" element={<Settings />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Pages>
      </AppShell>
    </WorkspaceProvider>
  )
}

export default function App() {
  return (
    // Twee grenzen, met opzet: deze vangt wat er buiten een pagina misgaat —
    // het aanmelden, de werkruimte, de schil zelf. Zonder deze zou dat nog
    // altijd een wit scherm zijn.
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Authenticated />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
