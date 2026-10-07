import { Link } from 'react-router-dom'
import { CENTRAAL, CONTACT } from '../lib/instellingen'

/**
 * De voet: wie we zijn, waar je ons bereikt, en de voorwaarden.
 *
 * Alleen mail, geen telefoon: beslissing van Jasper. Komt er later een
 * nummer, dan staat het in `CONTACT` en verschijnt het hier vanzelf.
 */
export default function Voet() {
  return (
    <footer className="vh__voet je-night">
      <div className="vh__wrap vh__voet-raster">
        <div className="vh__voet-kolom">
          <span className="je-logotype vh__voet-merk">
            <span className="je-logotype__word">
              <span className="je-logotype__je">
                JE <span className="je-logotype__concept">Concept</span>
              </span>
            </span>
          </span>
          <p>Verhuur van feestmateriaal vanuit {CONTACT.plaats}.</p>
          {CONTACT.telefoon ? <a href={CONTACT.telefoonLink}>{CONTACT.telefoon}</a> : null}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </div>
        <nav className="vh__voet-kolom" aria-label="Verhuur">
          <span className="je-eyebrow">Verhuur</span>
          <Link to="/aanbod">Het aanbod</Link>
          <Link to="/offerte">Offerte vragen</Link>
          <Link to="/mijn">Mijn huren</Link>
        </nav>
        <nav className="vh__voet-kolom" aria-label="Voorwaarden en klantendienst">
          <span className="je-eyebrow">Voorwaarden</span>
          <a href={CENTRAAL.voorwaarden}>Algemene voorwaarden</a>
          <a href={CENTRAAL.privacy}>Privacybeleid</a>
          <a href={CENTRAAL.klantendienst}>Klantendienst</a>
        </nav>
        <p className="vh__voet-klein">
          Prijzen inclusief 21% btw. De waarborg valt buiten de btw en krijg je terug bij onbeschadigde teruggave.
        </p>
      </div>
    </footer>
  )
}
