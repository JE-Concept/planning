import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

/**
 * De kop van elke pagina: het merk, het aanbod, zoeken, inloggen en de mand.
 *
 * Het logo is tekst in de huisletters (Prata en Parisienne, zelf gehost), geen
 * afbeelding: scherp op elk scherm, en een schermlezer leest "JE Concept".
 * Er staat geen taalkeuze: NL, FR en EN komen samen met de vertaling van de
 * artikels, en een knop die naar dezelfde Nederlandse pagina leidt, belooft
 * iets wat er niet is.
 */
export default function Kop({ stuks, ingelogd }) {
  const { pathname, search } = useLocation()
  const navigeer = useNavigate()
  const [zoek, setZoek] = useState(() => new URLSearchParams(search).get('zoek') ?? '')
  useOmhoogBijWissel(pathname)

  return (
    <header className="vh__kop">
      <div className="vh__wrap vh__kop-rij">
        <Link to="/" className="je-logotype vh__merk" aria-label="JE Concept verhuur, naar de startpagina">
          <span className="je-logotype__word">
            <span className="je-logotype__je">
              JE <span className="je-logotype__concept">Concept</span>
            </span>
            <span className="je-logotype__tagline">Verhuur</span>
          </span>
        </Link>
        <nav className="vh__nav" aria-label="Hoofdmenu">
          <Link to="/aanbod">Aanbod</Link>
          <Link to="/offerte">Offerte vragen</Link>
        </nav>
        <div className="vh__tools">
          <form
            role="search"
            className="vh__zoek"
            onSubmit={(e) => {
              e.preventDefault()
              navigeer(zoek.trim() ? `/aanbod?zoek=${encodeURIComponent(zoek.trim())}` : '/aanbod')
            }}
          >
            <input
              className="je-input"
              type="search"
              placeholder="Zoek een artikel"
              aria-label="Zoek een artikel"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
            />
          </form>
          <Link to={ingelogd ? '/mijn' : '/login'} className="je-btn je-btn--ghost je-btn--sm">
            {ingelogd ? 'Mijn huren' : 'Inloggen'}
          </Link>
          <Link to="/mand" className="je-btn je-btn--primary je-btn--sm">
            Mand{stuks > 0 ? ` (${stuks})` : ''}
          </Link>
        </div>
      </div>
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
