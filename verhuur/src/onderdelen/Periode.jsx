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
 *
 * ── Twee vormen ──────────────────────────────────────────────────────────
 * `vol` is het blok "Wanneer is je feest?" op de startpagina en in de mand;
 * `balk` is de smalle strook boven het aanbod en op een artikel. Dezelfde
 * velden en dezelfde uitleg, zodat de datum overal op dezelfde manier werkt.
 */
import { CONTACT, MIN_DAGEN_VOORAF, boekingsvenster, buitenVenster } from '../lib/instellingen'
import { dagenTussen } from '../lib/mand'

export default function Periode({ van, tot, onWijzig, vorm = 'vol', titel = 'Wanneer is je feest?', children }) {
  const { vroegst: minimum, laatst: maximum } = boekingsvenster()
  const buiten = buitenVenster(van)
  const dagen = dagenTussen(van, tot).length

  return (
    <section className={`je-period vh__periode${vorm === 'balk' ? ' je-period--bar vh__periode--balk' : ''}`} aria-label="Je huurperiode">
      <div className="je-period__q">
        <span className="je-period__title">{titel}</span>
        {dagen > 0 && !buiten ? (
          <span className="je-period__sum">
            {dagen} {dagen === 1 ? 'dag' : 'dagen'} · prijzen en voorraad voor deze dagen
          </span>
        ) : null}
      </div>
      <label className="je-period__field" htmlFor="van">
        <span className="je-field__label">Van</span>
        <input
          id="van"
          type="date"
          className="je-input"
          min={minimum}
          max={maximum}
          value={van}
          onChange={(e) => onWijzig(e.target.value, tot && tot >= e.target.value ? tot : e.target.value)}
        />
      </label>
      <label className="je-period__field" htmlFor="tot">
        <span className="je-field__label">Tot en met</span>
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
      </label>
      {children}
      {buiten === 'te_vroeg' ? (
        <p className="je-notice je-notice--danger je-period__hint" role="alert">
          Online boeken kan vanaf {MIN_DAGEN_VOORAF} dagen vooraf. Heb je het eerder nodig? Mail ons op{' '}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>; last minute regelen we per mail, en vaak kan het.
        </p>
      ) : buiten === 'te_ver' ? (
        <p className="je-notice je-notice--danger je-period__hint" role="alert">
          Online boeken kan tot een jaar vooruit. Voor later: mail ons op{' '}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
        </p>
      ) : van ? (
        <p className="je-period__hint">Allebei de dagen tellen mee: van de 12e tot en met de 14e is drie dagen.</p>
      ) : (
        <p className="je-period__hint">
          Kies een datum, dan zie je bij elk artikel wat er vrij is en wat het kost. Online boeken kan vanaf{' '}
          {MIN_DAGEN_VOORAF} dagen vooraf; last minute regelen we per mail.
        </p>
      )}
    </section>
  )
}
