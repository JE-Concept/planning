import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Avatar, Button, Spinner } from '@ui/index'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import Sidebar from './Sidebar'
import TimerWidget from './TimerWidget'

export default function AppShell({ children }) {
  const { profile, logOut, isStaff } = useAuth()
  const { loading } = useWorkspace()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const location = useLocation()

  // A tap on a sidebar link should not leave the drawer covering the page.
  useEffect(() => {
    setMenuOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-full">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-3 sm:px-5">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu openen"
          >
            ☰
          </Button>

          <div className="flex-1" />

          {/* Personeel registreert geen uren in dit tool, en mag de lopende
              timers niet lezen — de widget zou dus enkel een rechtenfout
              opleveren. */}
          {isStaff ? null : <TimerWidget />}

          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-md p-1 hover:bg-ink-100"
            >
              <Avatar profile={profile} size="md" />
            </button>

            {accountOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-11 z-40 w-56 rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
              >
                <div className="border-b border-ink-100 px-3 py-2">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {profile?.fullName || profile?.email}
                  </p>
                  <p className="truncate text-xs text-ink-500">{profile?.email}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logOut}
                  className="w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                >
                  Afmelden
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-500">
              <Spinner /> Werkruimte laden…
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
