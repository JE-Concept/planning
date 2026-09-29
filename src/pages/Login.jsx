import { Button, Icon, Logotype } from '@components/ds'
import { Spinner } from '@ui/index'
import { useAuth } from '@context/AuthProvider'

/**
 * Aanmelden, zoals in het design: één witte kaart op nachtblauw, één knop.
 * Google is de enige manier; wie geen toegang heeft, ziet waarom.
 */
export default function Login() {
  const { state, signIn, error, logOut, user } = useAuth()

  return (
    <div
      className="je-night"
      style={{ minHeight: '100%', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--white)',
          borderRadius: 4,
          boxShadow: 'var(--shadow-3)',
          padding: 'var(--space-8) var(--space-7)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
          '--text-1': 'var(--navy-950)',
          '--text-2': 'var(--slate-500)',
          '--text-3': 'var(--slate-300)',
          '--text-accent': 'var(--navy-700)',
          '--accent': 'var(--navy-700)',
          '--accent-hover': 'var(--navy-600)',
          '--accent-press': 'var(--navy-900)',
          '--accent-quiet': 'rgba(27,58,107,.07)',
          '--text-on-accent': 'var(--white)',
          '--border-hairline': 'rgba(0,48,96,.14)',
          '--border-subtle': 'rgba(0,48,96,.22)',
          '--border-accent': 'var(--navy-700)',
          '--canvas': 'var(--white)',
          color: 'var(--navy-950)',
        }}
      >
        <Logotype size={44} />
        <div>
          <div className="je-eyebrow" style={{ color: 'var(--navy-700)' }}>
            JE Plan
          </div>
          <h1 style={{ font: 'var(--type-h2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-h2)', margin: '8px 0 0', color: 'var(--navy-950)' }}>
            Aanmelden
          </h1>
        </div>

        {state === 'misconfigured' ? (
          <Notice>
            De Firebase-configuratie ontbreekt in deze build. Zet de <code>VITE_FIREBASE_*</code> variabelen en deploy
            opnieuw.
          </Notice>
        ) : null}

        {state === 'denied' ? (
          <>
            <Notice>
              {user?.email ? <strong>{user.email}</strong> : 'Dit account'} heeft geen toegang. Vraag een beheerder om een
              uitnodiging.
            </Notice>
            {/*
              "Geen toegang" is maar één van de redenen waarom dit scherm
              verschijnt: een functie die niet uitgerold is, een netwerkfout of
              een geweigerde regel komen hier ook terecht. Zonder de echte
              melding erbij lijkt elk van die gevallen op een ontbrekende
              uitnodiging.
            */}
            {error ? (
              <details style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--slate-500)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Technische melding</summary>
                <p style={{ marginTop: 6, fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-word' }}>{error}</p>
              </details>
            ) : null}
            <Button variant="secondary" size="lg" block onClick={logOut}>
              Met een ander account aanmelden
            </Button>
          </>
        ) : null}

        {state === 'signed-out' ? (
          <>
            <Button size="lg" block iconLeft="log-in" onClick={signIn}>
              Aanmelden met Google
            </Button>
            {error ? <Notice>{error}</Notice> : null}
            <p style={{ margin: 0, font: 'var(--type-caption)', fontWeight: 400, color: 'var(--slate-500)', textAlign: 'center' }}>
              Enkel voor @jeconcept.be en @kenjeklanten.be, of op uitnodiging.
            </p>
          </>
        ) : null}

        {state === 'loading' ? (
          <div className="je-muted-caption" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner /> Even geduld…
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Notice({ children }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-4) var(--space-5)',
        border: '1px solid rgba(179,53,47,.4)',
        borderRadius: 2,
        font: 'var(--type-body-sm)',
        color: 'var(--navy-950)',
      }}
    >
      <span style={{ color: 'var(--red-600)', display: 'flex', marginTop: 2 }}>
        <Icon name="alert-triangle" size={16} />
      </span>
      <span>{children}</span>
    </div>
  )
}
