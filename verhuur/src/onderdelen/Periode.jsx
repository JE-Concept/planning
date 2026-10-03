/**
 * Van wanneer tot wanneer.
 *
 * ── Waarom twee datumvelden en geen kalenderwidget ───────────────────────
 * Een eigen kalender is op een telefoon altijd slechter dan die van het
 * toestel zelf: die kent de taal, de week­indeling en de duimafstand van zijn
 * eigenaar. `type="date"` geeft precies dat, kost niets aan bundel, en werkt
 * met een schermlezer zonder dat wij er iets voor hoeven te doen.
 *
 * ── Waarom de einddatum meeschuift ───────────────────────────────────────
 * Wie een begindatum ná de einddatum kiest, heeft zich vergist en wil bijna
 * altijd één dag. Een foutmelding is hier onnodig streng: we schuiven de
 * einddatum mee en laten hem verder kiezen.
 */
import { MIN_DAGEN_VOORAF, boekingsvenster } from '../lib/instellingen'

export default function Periode({ van, tot, onWijzig }) {
  const { vroegst: minimum, laatst: maximum } = boekingsvenster()

  return (
    <section className="vh__periode" aria-label="Je huurperiode">
      <div>
        <label className="je-caps" htmlFor="van">
          Van
        </label>
        <input
          id="van"
          type="date"
          className="je-input"
          min={minimum}
          max={maximum}
          value={van}
          onChange={(e) => onWijzig(e.target.value, tot && tot >= e.target.value ? tot : e.target.value)}
        />
      </div>
      <div>
        <label className="je-caps" htmlFor="tot">
          Tot en met
        </label>
        <input
          id="tot"
          type="date"
          className="je-input"
          min={van || minimum}
          max={maximum}
          value={tot}
          onChange={(e) => onWijzig(van, e.target.value)}
          disabled={!van}
        />
      </div>
      {van ? (
        <p className="vh__klein vh__periode-uitleg">
          Allebei de dagen tellen mee: van de 12e tot en met de 14e is drie dagen.
        </p>
      ) : (
        <p className="vh__klein vh__periode-uitleg">
          Kies een datum, dan zie je bij elk artikel wat er vrij is en wat het kost. Online boeken kan
          vanaf {MIN_DAGEN_VOORAF} dagen vooraf; last minute regelen we per mail.
        </p>
      )}
    </section>
  )
}
