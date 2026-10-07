import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { aanbod, beschikbaar, sessie } from './lib/api'
import { useMand } from './lib/mand'
import { CENTRAAL, CONTACT } from './lib/instellingen'
import Catalogus from './pages/Catalogus'

/*
  De catalogus zit in de eerste download, want daar komt iedereen binnen. De
  rest komt pas wanneer iemand erheen gaat: wie alleen even kijkt wat een
  statafel kost, hoeft het afrekenformulier niet te laden. Op een telefoon in
  een tuin is elke kilobyte die niet nodig is, een kilobyte wachten.
*/
const Artikel = lazy(() => import('./pages/Artikel'))
const Mand = lazy(() => import('./pages/Mand'))
const Offerte = lazy(() => import('./pages/Offerte'))
const Afloop = lazy(() => import('./pages/Afloop'))
const Login = lazy(() => import('./pages/Login'))
const Mijn = lazy(() => import('./pages/Mijn'))

/**
 * De verhuursite van JE Concept.
 *
 * ── Waarom dit een eigen applicatie is en geen scherm in JE Plan ──────────
 * JE Plan is de backoffice: alles erin gaat ervan uit dat wie kijkt erbij
 * hoort. Deze pagina is van iedereen. Eén bundel van beide zou betekenen dat
 * de code van de marges, de loonkosten en de leveranciers meegeleverd wordt
 * aan elke bezoeker — niet leesbaar als gegevens, wel als logica, en dat is
 * genoeg om er conclusies uit te trekken.
 *
 * Dus: eigen bundel, eigen hosting-site, eigen adres. Wat gedeeld wordt is wat
 * gedeeld hóórt: het design system en de prijsmotor, allebei rechtstreeks uit
 * `src/` en dus zonder kopie die kan verlopen.
 *
 * ── De periode staat bovenaan en niet op de productpagina ─────────────────
 * Omdat "is dat vrij op mijn datum" de eerste vraag is en niet de laatste.
 * Een catalogus zonder datum toont dingen die op die dag niet kunnen, en dan
 * loopt iemand pas bij het afrekenen tegen een nee aan. Met de datum bovenaan
 * staat bij elk artikel meteen wat er vrij is.
 */
export default function App() {
  const [catalogus, setCatalogus] = useState(null)
  const [fout, setFout] = useState(false)
  const { mand, erbij, zetAantal, weg, zetPeriode, leegmaken, stuks } = useMand()
  const [vrij, setVrij] = useState(new Map())
  const [laadtVrij, setLaadtVrij] = useState(false)
  // Alleen óf er een sessie is; wie het is, zegt de server bij elk verzoek.
  const [ingelogd, setIngelogd] = useState(() => Boolean(sessie()))

  useEffect(() => {
    aanbod()
      .then(setCatalogus)
      .catch(() => setFout(true))
  }, [])

  /*
    De beschikbaarheid wordt opnieuw opgehaald zodra de periode verandert, en
    niet één keer bij het laden. Een getal dat "nog twee vrij" zegt voor een
    datum die de bezoeker net veranderd heeft, is erger dan geen getal.
  */
  useEffect(() => {
    if (!mand.van) {
      setVrij(new Map())
      return undefined
    }
    let geldig = true
    setLaadtVrij(true)
    beschikbaar(mand.van, mand.tot || mand.van)
      .then((uit) => {
        if (!geldig) return
        setVrij(new Map(uit.vrij.map((r) => [r.id, r.vrij])))
      })
      .catch(() => geldig && setVrij(new Map()))
      .finally(() => geldig && setLaadtVrij(false))
    return () => {
      geldig = false
    }
  }, [mand.van, mand.tot])

  const opId = useMemo(
    () => new Map((catalogus?.artikelen ?? []).map((m) => [m.id, m])),
    [catalogus]
  )

  const gedeeld = {
    catalogus,
    opId,
    mand,
    erbij,
    zetAantal,
    weg,
    zetPeriode,
    leegmaken,
    stuks,
    vrij,
    laadtVrij,
  }

  return (
    <div className="vh">
      <Kop stuks={stuks} ingelogd={ingelogd} />
      <main className="vh__body">
        {fout ? (
          <p className="vh__fout">
            Het aanbod is nu even niet op te halen. Probeer het zo opnieuw, of mail ons op{' '}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
          </p>
        ) : (
          <Suspense fallback={<p className="vh__laden">Een ogenblik…</p>}>
            <Routes>
              <Route path="/" element={<Catalogus {...gedeeld} />} />
              <Route path="/artikel/:id" element={<Artikel {...gedeeld} />} />
              <Route path="/mand" element={<Mand {...gedeeld} />} />
              <Route path="/offerte" element={<Offerte />} />
              <Route path="/gelukt" element={<Afloop gelukt />} />
              <Route path="/afgebroken" element={<Afloop />} />
              <Route path="/login" element={<Login onIngelogd={() => setIngelogd(true)} />} />
              <Route path="/login/:token" element={<Login onIngelogd={() => setIngelogd(true)} />} />
              <Route path="/mijn" element={<Mijn onUitgelogd={() => setIngelogd(false)} />} />
              <Route path="*" element={<Catalogus {...gedeeld} />} />
            </Routes>
          </Suspense>
        )}
      </main>
      <Voet />
    </div>
  )
}

function Kop({ stuks, ingelogd }) {
  const { pathname } = useLocation()
  useOmhoogBijWissel(pathname)

  return (
    <header className="vh__kop">
      <Link to="/" className="vh__merk" aria-label="JE Concept verhuur, naar de catalogus">
        <span className="vh__merk-naam">JE Concept</span>
        <span className="vh__merk-sub">Verhuur</span>
      </Link>
      <nav className="vh__nav">
        <Link to={ingelogd ? '/mijn' : '/login'} className="je-btn je-btn--ghost je-btn--sm">
          {ingelogd ? 'Mijn huren' : 'Inloggen'}
        </Link>
        <Link to="/offerte" className="je-btn je-btn--ghost je-btn--sm">
          Offerte vragen
        </Link>
        <Link to="/mand" className="je-btn je-btn--primary je-btn--sm">
          Mand{stuks > 0 ? ` (${stuks})` : ''}
        </Link>
      </nav>
    </header>
  )
}

/*
  Na een klik op een artikel begint de nieuwe pagina waar de vorige stond —
  halverwege dus. Op een telefoon lijkt het dan of er niets gebeurd is.

  Het effect geeft bewust niets terug. Nieuwe versies van Chrome laten
  window.scrollTo een Promise teruggeven; als effect rechtstreeks doorgegeven
  hield React die voor de opruimfunctie en riep ze bij de volgende klik aan:
  "n is not a function" en een wit scherm, alleen bij doorklikken.
*/
function useOmhoogBijWissel(pathname) {
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
}

function Voet() {
  return (
    <footer className="vh__voet">
      <div>
        <strong>JE Concept</strong> · {CONTACT.plaats} ·{' '}
        {CONTACT.telefoon ? (
          <>
            <a href={CONTACT.telefoonLink}>{CONTACT.telefoon}</a> ·{' '}
          </>
        ) : null}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      </div>
      <div className="vh__voet-klein">
        Prijzen exclusief 21% btw. De waarborg wordt teruggestort bij onbeschadigde teruggave.
      </div>
      <nav className="vh__voet-klein" aria-label="Voorwaarden en klantendienst">
        <a href={CENTRAAL.voorwaarden}>Algemene voorwaarden</a> · <a href={CENTRAAL.privacy}>Privacybeleid</a> ·{' '}
        <a href={CENTRAAL.klantendienst}>Klantendienst</a>
      </nav>
    </footer>
  )
}
