import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spinner } from '@ui/index'
import { AuthProvider, useAuth } from '@context/AuthProvider'
import { ToastProvider } from '@context/ToastProvider'
import { WorkspaceProvider } from '@context/WorkspaceProvider'
import AppShell from '@components/layout/AppShell'
import Login from '@pages/Login'

const Dashboard      = lazy(() => import('@pages/Dashboard'))
const MyWork         = lazy(() => import('@pages/MyWork'))
const Board          = lazy(() => import('@pages/Board'))
const SocialCalendar = lazy(() => import('@pages/SocialCalendar'))
const TimeTracking   = lazy(() => import('@pages/TimeTracking'))
const Goals          = lazy(() => import('@pages/Goals'))
const Settings       = lazy(() => import('@pages/Settings'))
const NotFound       = lazy(() => import('@pages/NotFound'))

function Loading() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <Spinner className="h-6 w-6" />
    </div>
  )
}

function Authenticated() {
  const { state } = useAuth()

  if (state === 'loading') return <Loading />
  if (state !== 'ready') return <Login />

  return (
    <WorkspaceProvider>
      <AppShell>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mijn-werk" element={<MyWork />} />
            <Route path="/bord/:listId" element={<Board />} />
            <Route path="/social" element={<SocialCalendar />} />
            <Route path="/uren" element={<TimeTracking />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/instellingen" element={<Settings />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>
    </WorkspaceProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Authenticated />
      </AuthProvider>
    </ToastProvider>
  )
}
