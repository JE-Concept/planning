import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { aanbod, beschikbaar, sessie } from './lib/api'
import { useMand } from './lib/mand'
import { CONTACT } from './lib/instellingen'
import Kop from './onderdelen/Kop'
import Voet from './onderdelen/Voet'
import Start from './pages/Start'

/*
  De startpagina zit in de eerste download, want daar komt iedereen binnen. De
  rest komt pas wanneer iemand erheen gaat: wie alleen even kijkt wat een
  statafel kost, hoeft het afrekenformulier niet te laden. Op een telefoon in
  een tuin is elke kilobyte die niet nodig is, een kilobyte wachten.
*/
const Aanbod = lazy(() => import('./pages/Aanbod'))
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
 * `src/` en dus zonder kopie die kan verlopen. Wat alleen deze site nodig heeft
 * (periode, prijs, voorraad, mand), komt uit het JE Concept Design System:
 * `styles/reserveren.css`.
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
          <p className="vh__wrap vh__fout">
            Het aanbod is nu even niet op te halen. Probeer het zo opnieuw, of mail ons op{' '}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
          </p>
        ) : (
          <Suspense fallback={<p className="vh__wrap vh__laden">Een ogenblik…</p>}>
            <Routes>
              <Route path="/" element={<Start {...gedeeld} />} />
              <Route path="/aanbod" element={<Aanbod {...gedeeld} />} />
              <Route path="/aanbod/:categorie" element={<Aanbod {...gedeeld} />} />
              <Route path="/artikel/:id" element={<Artikel {...gedeeld} />} />
              <Route path="/mand" element={<Mand {...gedeeld} />} />
              <Route path="/offerte" element={<Smal><Offerte /></Smal>} />
              <Route path="/gelukt" element={<Smal><Afloop gelukt /></Smal>} />
              <Route path="/afgebroken" element={<Smal><Afloop /></Smal>} />
              <Route path="/login" element={<Smal><Login onIngelogd={() => setIngelogd(true)} /></Smal>} />
              <Route path="/login/:token" element={<Smal><Login onIngelogd={() => setIngelogd(true)} /></Smal>} />
              <Route path="/mijn" element={<Smal><Mijn onUitgelogd={() => setIngelogd(false)} /></Smal>} />
              <Route path="*" element={<Start {...gedeeld} />} />
            </Routes>
          </Suspense>
        )}
      </main>
      <Voet />
    </div>
  )
}

/*
  Formulieren en bevestigingen staan in een smalle kolom: een regel van
  honderdvijftig tekens leest niemand, en een knop helemaal rechts op een
  breed scherm ziet niemand.
*/
function Smal({ children }) {
  return <div className="vh__wrap vh__smal">{children}</div>
}
