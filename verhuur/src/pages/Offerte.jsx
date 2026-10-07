import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { aanvragen } from '../lib/api'
import { CONTACT } from '../lib/instellingen'

/**
 * Een offerteaanvraag, voor alles wat niet zomaar de deur uit kan.
 *
 * ── Waarom dit formulier kort is ─────────────────────────────────────────
 * Omdat het einde van een aanvraag een gesprek is, geen bestand. Alles wat we
 * hier níét vragen, vragen we straks aan de telefoon, en dan weten we ook
 * meteen waaróm iemand het vraagt. Wat hier staat is het minimum om terug te
 * kunnen bellen en om te weten of het die week überhaupt kan.
 */
export default function Offerte() {
  // Vanuit de mand (levering): de artikels en de datum staan er al in.
  const uitMand = useLocation().state ?? {}
  const [vorm, setVorm] = useState({
    naam: '',
    email: '',
    telefoon: '',
    datum: typeof uitMand.datum === 'string' ? uitMand.datum : '',
    gasten: '',
    wat: typeof uitMand.wat === 'string' ? uitMand.wat : '',
    // Het lokvakje. Zie het verborgen veld onderaan het formulier.
    bedrijfsnaam: '',
  })
  const [bezig, setBezig] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [fout, setFout] = useState(null)

  const zet = (patch) => setVorm((oud) => ({ ...oud, ...patch }))
  const kan = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vorm.email) && vorm.wat.trim().length > 2

  const versturen = async () => {
    setBezig(true)
    setFout(null)
    try {
      await aanvragen(vorm)
      setKlaar(true)
    } catch {
      setFout(`Het versturen lukte niet. Probeer het opnieuw, of mail ons op ${CONTACT.email}.`)
      setBezig(false)
    }
  }

  if (klaar) {
    return (
      <section className="vh__afloop">
        <h1>Bedankt — we hebben je aanvraag</h1>
        <p>
          We bekijken wat er kan en bellen of mailen je binnen één werkdag. Is het dringend, mail
          dan even naar <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
        </p>
        <Link to="/" className="je-btn je-btn--primary je-btn--md">
          Terug naar het aanbod
        </Link>
      </section>
    )
  }

  return (
    <section className="vh__offerte">
      <span className="je-eyebrow">Groot, met levering of met opbouw</span>
      <h1 className="je-sect__title vh__h1">
        Vraag een <em>offerte</em>
      </h1>
      <p className="je-sect__intro">
        Voor levering, tenten die geplaatst moeten worden, mobiele bars, en catering van ontbijt tot walking
        dinner. Vertel kort wat je plan is, dan rekenen we het uit.
      </p>

      <form className="vh__velden" onSubmit={(e) => e.preventDefault()}>
        <label>
          <span className="je-caps">Naam</span>
          <input className="je-input" value={vorm.naam} onChange={(e) => zet({ naam: e.target.value })} autoComplete="name" />
        </label>
        <label>
          <span className="je-caps">E-mail</span>
          <input
            className="je-input"
            type="email"
            required
            value={vorm.email}
            onChange={(e) => zet({ email: e.target.value })}
            autoComplete="email"
          />
        </label>
        <label>
          <span className="je-caps">Telefoon</span>
          <input className="je-input" type="tel" value={vorm.telefoon} onChange={(e) => zet({ telefoon: e.target.value })} autoComplete="tel" />
        </label>
        <label>
          <span className="je-caps">Datum</span>
          <input className="je-input" type="date" value={vorm.datum} onChange={(e) => zet({ datum: e.target.value })} />
        </label>
        <label>
          <span className="je-caps">Aantal personen</span>
          <input className="je-input" type="number" min="1" value={vorm.gasten} onChange={(e) => zet({ gasten: e.target.value })} />
        </label>
        <label className="vh__veld-breed">
          <span className="je-caps">Wat heb je in gedachten?</span>
          <textarea
            className="je-input"
            rows={4}
            required
            value={vorm.wat}
            onChange={(e) => zet({ wat: e.target.value })}
            placeholder="Een tuinfeest voor zestig man, tent en statafels, drank erbij…"
          />
        </label>

        {/*
          Het lokvakje. Het staat buiten beeld en buiten de tabvolgorde, en
          een schermlezer slaat het over — een mens komt het dus nooit tegen.
          Een bot vult elk veld dat hij vindt, en dan weten we genoeg.

          `display: none` zou het juist verraden: daar kijken ze op. Dit staat
          er wel, maar nergens.
        */}
        <div aria-hidden="true" className="vh__lokvak">
          <label>
            Bedrijfsnaam
            <input
              tabIndex={-1}
              autoComplete="off"
              value={vorm.bedrijfsnaam}
              onChange={(e) => zet({ bedrijfsnaam: e.target.value })}
            />
          </label>
        </div>
      </form>

      {fout ? <p className="vh__waarschuwing">{fout}</p> : null}

      <button type="button" className="je-btn je-btn--primary je-btn--md" onClick={versturen} disabled={!kan || bezig}>
        {bezig ? 'Versturen…' : 'Verstuur de aanvraag'}
      </button>
    </section>
  )
}
