import { Button, Spinner } from '@ui/index'
import { useAuth } from '@context/AuthProvider'

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.4 14.3a7.1 7.1 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
  </svg>
)

export default function Login() {
  const { state, signIn, error, logOut, user } = useAuth()

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-navy px-4 py-12">
      <div className="w-full max-w-sm rounded-xl bg-white p-7 shadow-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white">
            JE
          </span>
          <div>
            <p className="font-display text-lg font-extrabold text-ink-900">JE Planning</p>
            <p className="text-xs text-ink-500">Interne planning voor JE Concept</p>
          </div>
        </div>

        {state === 'misconfigured' ? (
          <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            De Firebase-configuratie ontbreekt in deze build. Zet de{' '}
            <code className="rounded bg-amber-100 px-1">VITE_FIREBASE_*</code> variabelen en
            deploy opnieuw.
          </p>
        ) : null}

        {state === 'denied' ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {user?.email ? <strong>{user.email}</strong> : 'Dit account'} heeft geen toegang tot
              JE Planning. Vraag een beheerder om een uitnodiging.
            </p>
            <Button variant="secondary" className="w-full" onClick={logOut}>
              Met een ander account aanmelden
            </Button>
          </div>
        ) : null}

        {state === 'signed-out' ? (
          <div className="mt-6 space-y-3">
            <Button variant="primary" size="lg" className="w-full" onClick={signIn}>
              <GoogleMark />
              Aanmelden met Google
            </Button>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <p className="text-center text-xs text-ink-500">
              Enkel voor @jeconcept.be en @kenjeklanten.be, of op uitnodiging.
            </p>
          </div>
        ) : null}

        {state === 'loading' ? (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-ink-500">
            <Spinner /> Even geduld…
          </div>
        ) : null}
      </div>
    </div>
  )
}
