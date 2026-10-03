import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMand } from '../lib/mand'
import { CONTACT } from '../lib/instellingen'

/**
 * Wat er na Stripe op het scherm komt.
 *
 * ── Waarom de mand hier pas leeggaat, en alleen bij "gelukt" ─────────────
 * Leegmaken vóór het betalen zou betekenen dat iemand die afbreekt alles
 * opnieuw moet zoeken — en afbreken gebeurt vaak omdat iemand zijn kaart gaat
 * halen. Nu staat zijn mand er nog precies zo.
 *
 * ── Waarom hier niet staat "je betaling is gelukt" ───────────────────────
 * Omdat deze pagina dat niet weet. Ze wordt geopend doordat Stripe de browser
 * terugstuurt, en een browser is geen bewijs: iemand kan dit adres ook
 * gewoon intikken. Wat er écht gebeurde, hoort de server van Stripe zelf via
 * de webhook. Dus staat er wat we zeker weten — dat de betaling is
 * doorgegeven — en komt de bevestiging per mail.
 */
export default function Afloop({ gelukt = false }) {
  const [params] = useSearchParams()
  const { leegmaken } = useMand()
  const order = params.get('order')

  useEffect(() => {
    if (gelukt) leegmaken()
  }, [gelukt, leegmaken])

  if (!gelukt) {
    return (
      <section className="vh__afloop">
        <h1>Je afrekening is afgebroken</h1>
        <p>
          Er is niets betaald en niets vastgelegd. Je mand staat er nog precies zoals je hem
          achterliet.
        </p>
        <Link to="/mand" className="je-btn je-btn--primary je-btn--md">
          Terug naar je mand
        </Link>
      </section>
    )
  }

  return (
    <section className="vh__afloop">
      <h1>Bedankt — je betaling is doorgegeven</h1>
      <p>
        Zodra ze bevestigd is, staat het materiaal op jouw naam en krijg je een mail met de
        bevestiging en de afhaalafspraak. Dat duurt meestal minder dan een minuut.
      </p>
      {order ? (
        <p className="vh__klein">
          Je kenmerk is <strong>{order}</strong>. Handig om bij de hand te hebben als je ons belt.
        </p>
      ) : null}
      <p>
        Komt er na een kwartier niets binnen? Mail ons op{' '}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> met je kenmerk — wij zien je bestelling aan
        onze kant staan.
      </p>
      <Link to="/" className="je-btn je-btn--primary je-btn--md">
        Terug naar het aanbod
      </Link>
    </section>
  )
}
