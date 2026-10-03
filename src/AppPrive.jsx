import { Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Spinner } from '@ui/index'
import { pagina } from '@lib/paginalader'
import { AuthProvider, useAuth } from '@context/AuthProvider'
import { TaalProvider } from '@context/TaalProvider'
import { ToastProvider } from '@context/ToastProvider'
import { WorkspaceProvider } from '@context/WorkspaceProvider'
import AppShell from '@components/layout/AppShell'
import ErrorBoundary from '@components/layout/ErrorBoundary'
import Login from '@pages/Login'

/**
 * De tool zoals het team ze gebruikt: aanmelden, schil, alle schermen.
 *
 * Dit bestand wordt pas opgehaald wanneer iemand die tool ook echt opent. De
 * klantenpagina's laden het nooit — zie `App.jsx` — en halen daarmee ook
 * Firebase niet binnen, wat op die pagina's het verschil is tussen een halve
 * megabyte en bijna niets.
 */

/**
 * Elke pagina komt apart binnen, zodat het eerste scherm niet wacht op code
 * voor schermen die je misschien nooit opent. De keerzijde daarvan is dat een
 * uitrol terwijl je tabblad openstaat een bestandsnaam kan weghalen die deze
 * pagina nog wil ophalen — daar staat de ErrorBoundary hieronder voor.
 *
 * De namen achter elke pagina zijn haar woordenlijsten uit `src/lib/taal/`.
 * Die kwamen vroeger allemaal in de eerste download mee: honderddertig
 * kilobyte tekst over elk scherm van de tool, ook voor wie alleen zijn uren
 * komt boeken. Nu komen ze tegelijk met hun scherm binnen — zie `pagina()` in
 * `@lib/paginalader`. Wat op élk scherm staat, zit nog wel in de kern en
 * hoort hier dus niet bij; `tests/taalbundels.test.js` rekent beide kanten na,
 * want een vergeten lijst is een scherm vol sleutels.
 */
const Dashboard      = pagina(() => import('@pages/Dashboard'), 'planning', 'team')
const Tasks          = pagina(() => import('@pages/Tasks'), 'events', 'tasks')
const Events         = pagina(() => import('@pages/Events'), 'aanvraag', 'aapi', 'events', 'mail', 'planning')
const EventDetail    = pagina(() => import('@pages/EventDetail'), 'aapi', 'events', 'mail', 'materiaal', 'offerte', 'overzicht', 'planning', 'tasks', 'voorstel')
const Workload       = pagina(() => import('@pages/Workload'), 'planning', 'tasks')
const More           = pagina(() => import('@pages/More'))
const Board          = pagina(() => import('@pages/Board'), 'events', 'tasks')
const SocialCalendar = pagina(() => import('@pages/SocialCalendar'), 'events', 'socials', 'tasks')
const Checklists     = pagina(() => import('@pages/Checklists'), 'bistro')
const ChecklistReport = pagina(() => import('@pages/ChecklistReport'), 'bistro')
const Meetings       = pagina(() => import('@pages/Meetings'), 'team')
const Aanvragen      = pagina(() => import('@pages/Aanvragen'), 'aanvraag', 'events', 'mail')
const TimeTracking   = pagina(() => import('@pages/TimeTracking'), 'events', 'team')
const Rooster        = pagina(() => import('@pages/Rooster'), 'team')
const Logboek        = pagina(() => import('@pages/Logboek'), 'logboek')
const Goals          = pagina(() => import('@pages/Goals'), 'tasks')
const Customers      = pagina(() => import('@pages/Customers'), 'events', 'tasks')
const Settings       = pagina(() => import('@pages/Settings'), 'aapi', 'herhaling', 'instellingen', 'systeem', 'tasks')
const Profiel        = pagina(() => import('@pages/Profiel'), 'kalenderfeed', 'profiel', 'team')
const Medewerkers    = pagina(() => import('@pages/Medewerkers'), 'aapi', 'medewerkers')
const MijnEvents     = pagina(() => import('@pages/MijnEvents'), 'aapi', 'medewerkers', 'planning')
const Planning       = pagina(() => import('@pages/Planning'), 'aapi')
const Materiaal      = pagina(() => import('@pages/Materiaal'), 'materiaal')
const NotFound       = pagina(() => import('@pages/NotFound'), 'events')

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
  const { state, isStaff, isSocial } = useAuth()

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
              {/*
                De events waarop hij staat, uit de kale kopie zonder bedragen.
                Zie `@pages/MijnEvents` voor waarom dat een andere bron is.
              */}
              <Route path="/mijn-events" element={<MijnEvents />} />
              {/* Ook wie maar één scherm mag zien, heeft een naam en een foto. */}
              <Route path="/profiel" element={<Profiel />} />
              <Route path="*" element={<Navigate to="/openen-sluiten" replace />} />
            </Routes>
          </Pages>
        </AppShell>
      </WorkspaceProvider>
    )
  }

  /*
    De socialrol heeft één scherm, net als personeel.

    Ook hier geldt: de regels weigeren de rest sowieso, dit zorgt dat ze er niet
    op stuit. Het verschil met personeel is dat zij wél tijd boekt — op haar
    posts — en daarvoor is de timer in de zijbalk genoeg.
  */
  if (isSocial) {
    return (
      <WorkspaceProvider>
        <AppShell>
          <Pages>
            <Routes>
              <Route path="/social" element={<SocialCalendar />} />
              <Route path="/profiel" element={<Profiel />} />
              <Route path="*" element={<Navigate to="/social" replace />} />
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
            <Route path="/aanvragen" element={<Aanvragen />} />
            <Route path="/openen-sluiten" element={<Checklists />} />
            <Route path="/registraties" element={<ChecklistReport />} />
            <Route path="/overleg" element={<Meetings />} />
            <Route path="/uren" element={<TimeTracking />} />
            <Route path="/rooster" element={<Rooster />} />
            <Route path="/medewerkers" element={<Medewerkers />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/materiaal" element={<Materiaal />} />
            <Route path="/logboek" element={<Logboek />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/instellingen" element={<Settings />} />
            <Route path="/profiel" element={<Profiel />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Pages>
      </AppShell>
    </WorkspaceProvider>
  )
}

export default function AppPrive() {
  return (
    // Twee grenzen, met opzet: deze vangt wat er buiten een pagina misgaat —
    // het aanmelden, de werkruimte, de schil zelf. De buitenste staat in
    // `App.jsx` en vangt ook wat er bij een klant misgaat.
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          {/* Binnen het aanmelden, want de taalkeuze staat op het profiel — en
              buiten de schil, zodat ook het aanmeldscherm en de foutmeldingen
              eromheen in de gekozen taal staan. */}
          <TaalProvider>
            <Authenticated />
          </TaalProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
