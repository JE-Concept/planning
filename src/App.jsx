import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import ErrorBoundary from '@components/layout/ErrorBoundary'
import { pagina } from '@lib/paginalader'

/**
 * De schakelaar tussen twee applicaties die toevallig hetzelfde adres delen.
 *
 * ── Waarom dit bestand zo klein is ────────────────────────────────────────
 * Alles wat hier staat, wordt door iedereen opgehaald — ook door een klant die
 * één keer op een offertelink klikt. Dus staat er bijna niets: twee
 * verwijzingen en een vangnet.
 *
 * De tool zelf zit in `AppPrive.jsx` en komt pas binnen wanneer iemand haar
 * opent. Dat scheelt de klantenpagina's het aanmelden, de werkruimte en
 * Firebase — samen ruim een halve megabyte, voor een pagina die één offerte
 * moet tonen. Iemand die op een parkeerplaats op zijn telefoon een voorstel
 * opent, wacht daar niet op.
 *
 * ── Waarom dat ook voor de belasting uitmaakt ─────────────────────────────
 * Een offertelink gaat naar één klant, maar een klantenpagina kan rondgaan in
 * een familie of een bedrijf. Die pagina's praten met één functie en verder
 * met niets: geen database-abonnementen, geen aanmelding, geen verbinding die
 * openblijft. Wat ze kosten is één HTTP-verzoek, en dat cachet.
 */

const AppPrive       = lazy(() => import('./AppPrive'))
// De klantenpagina's dragen hun eigen teksten mee, net als de schermen in de
// tool; zie de routetabel in `AppPrive.jsx`. Zonder dat zou de offerteklant
// de woordenlijst van de hele tool ophalen om één voorstel te lezen.
const OffertePubliek = pagina(() => import('@pages/OffertePubliek'), 'offerte', 'voorstel')
const KlantPortaal   = pagina(() => import('@pages/KlantPortaal'))

/*
  Geen spinner en geen skelet tijdens het laden.

  De schil staat al in `index.html` en wordt vervangen zodra de app er is; een
  tweede laadindicator die daar een fractie van een seconde overheen flitst,
  maakt het onrustiger in plaats van sneller.
*/
const Wachten = null

export default function App() {
  return (
    // Het buitenste vangnet: wat hierbinnen omvalt, hoort niet op een wit
    // scherm uit te komen — ook niet bij een klant.
    <ErrorBoundary>
      <Suspense fallback={Wachten}>
        <Routes>
          {/*
            De klantenpagina's gaan vóór het aanmelden. Een offerte goedkeuren
            mag geen account kosten, en wie deze link opent hoort geen
            inlogscherm te zien — dat is de snelste manier om iemand kwijt te
            spelen op het moment dat hij ja wilde zeggen.
          */}
          <Route path="/offerte/:token" element={<OffertePubliek />} />
          <Route path="/klant/:token" element={<KlantPortaal />} />
          <Route path="*" element={<AppPrive />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
