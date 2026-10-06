import { useState } from 'react'
import { Acties, Button, Icon, Logotype, Spinner } from '@components/ds'
import CodeAanmelden from '@components/ploeg/CodeAanmelden'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'

/**
 * Aanmelden, zoals in het design: één witte kaart op nachtblauw, één knop.
 * Google is de enige manier; wie geen toegang heeft, ziet waarom.
 */
export default function Login() {
  const { state, signIn, error, logOut, user, herstelZonderCache } = useAuth()
  const { t } = useTaal()
  /*
    Twee wegen naar binnen, en de ene staat niet in de weg van de andere.

    Het bureau meldt zich aan met Google; de ploeg met een naam en vier
    cijfers. Beide knoppen naast elkaar op het eerste scherm zou van elke
    aanmelding een keuze maken, en de meeste mensen hoeven niet te kiezen.
    Dus: Google blijft de knop, en eronder staat één regel voor wie komt
    werken.
  */
  const [metCode, setMetCode] = useState(false)

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
        {/* Het volledige logo: hier is plaats voor de letters, en dit is het
            enige scherm waar het merk op zichzelf staat. De pagina draagt
            `je-night`, dus de omgekeerde versie. */}
        <Logotype size={132} volledig invert />
        <div>
          <div className="je-eyebrow" style={{ color: 'var(--navy-700)' }}>
            JE Plan
          </div>
          <h1 style={{ font: 'var(--type-h2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-h2)', margin: '8px 0 0', color: 'var(--navy-950)' }}>
            {t('login.aanmelden')}
          </h1>
        </div>

        {state === 'misconfigured' ? (
          <Notice>
            {t('login.niet_ingesteld')}
          </Notice>
        ) : null}

        {state === 'denied' ? (
          <>
            <Notice>
              {t('login.geen_toegang', { wie: user?.email || t('login.dit_account') })}
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
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('login.technische_melding')}</summary>
                <p style={{ marginTop: 6, fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-word' }}>{error}</p>
              </details>
            ) : null}
            <Button variant="secondary" size="lg" block onClick={logOut}>
              {t('login.ander_account')}
            </Button>
          </>
        ) : null}

        {state === 'signed-out' && metCode ? <CodeAanmelden onTerug={() => setMetCode(false)} /> : null}

        {state === 'signed-out' && !metCode ? (
          <>
            <Acties plaats="stapel" hoofd={{ label: t('login.met_google'), size: 'lg', icon: 'log-in', onClick: signIn }} />
            {error ? <Notice>{error}</Notice> : null}
            <p style={{ margin: 0, font: 'var(--type-caption)', fontWeight: 400, color: 'var(--slate-500)', textAlign: 'center' }}>
              {t('login.enkel_voor')}
            </p>
            <Button variant="ghost" size="md" block iconLeft="users" onClick={() => setMetCode(true)}>
              {t('ploeg.ik_kom_werken')}
            </Button>
          </>
        ) : null}

        {/*
          Vastgelopen is geen weigering en geen fout: er komt niets terug. Dat
          gebeurt wanneer het cacheslot van een tabblad dat niet netjes afsloot
          blijft staan en dit tabblad erop wacht. Eerder draaide de spinner dan
          eeuwig door, en wie dat een paar keer meemaakt vertrouwt de tool niet
          meer. Hier staat wat er aan de hand is en één knop die het oplost.
        */}
        {state === 'stuck' ? (
          <>
            <Notice>
              {t('login.vastgelopen')}
            </Notice>
            <Acties
              plaats="stapel"
              terug={{ label: t('schil.afmelden'), onClick: logOut }}
              hoofd={{ label: t('schil.opnieuw_beginnen'), size: 'lg', onClick: herstelZonderCache }}
            />
          </>
        ) : null}

        {state === 'loading' ? (
          <div className="je-muted-caption" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner /> {t('alg.laden')}
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
