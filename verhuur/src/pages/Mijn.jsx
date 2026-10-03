import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mijnHuren, zetSessie } from '../lib/api'

const euro = (n) => `€ ${Number(n ?? 0).toFixed(2).replace('.', ',')}`

/**
 * Wat je huurde, en wat je huurt.
 *
 * Alleen de eigen huren — de server zoekt ze op het adres van de sessie en
 * niet op iets wat deze pagina meestuurt. En alleen wat een klant ervan
 * hoeft te zien: de stukken, de periode, het bedrag en of de waarborg al
 * terug is. Geen interne stand, geen kenmerken van Stripe.
 */
export default function Mijn({ klant, onUitgelogd }) {
  const [gegevens, setGegevens] = useState(null)
  const [fout, setFout] = useState(null)

  useEffect(() => {
    let geldig = true
    mijnHuren()
      .then((uit) => geldig && setGegevens(uit))
      .catch((err) => {
        if (!geldig) return
        if (err.status === 401) {
          zetSessie(null)
          onUitgelogd?.()
        }
        setFout(err.status === 401 ? 'niet_ingelogd' : 'mislukt')
      })
    return () => {
      geldig = false
    }
  }, [onUitgelogd])

  if (fout === 'niet_ingelogd') {
    return (
      <section className="vh__afloop">
        <h1>Je bent niet ingelogd</h1>
        <p>Je sessie is verlopen of je was nog niet ingelogd. Een nieuwe link duurt een halve minuut.</p>
        <Link to="/login" className="je-btn je-btn--primary je-btn--md">
          Inloggen
        </Link>
      </section>
    )
  }
  if (fout) return <p className="vh__fout">Je huren zijn nu even niet op te halen. Probeer het zo opnieuw.</p>
  if (!gegevens) return <p className="vh__laden">Je huren worden opgehaald…</p>

  return (
    <section className="vh__mand">
      <h1>Mijn huren</h1>
      <p className="vh__klein">
        Ingelogd als {gegevens.naam ? `${gegevens.naam} (${gegevens.email})` : gegevens.email}
        {gegevens.kortingPercent > 0 ? ` · je klantenkorting van ${gegevens.kortingPercent}% geldt bij het afrekenen` : ''}
        {' · '}
        <button
          type="button"
          className="vh__tekstknop"
          onClick={() => {
            zetSessie(null)
            onUitgelogd?.()
            klant?.weg?.()
          }}
        >
          uitloggen
        </button>
      </p>

      {gegevens.huren.length === 0 ? (
        <p className="vh__leeg">
          Nog geen huren op dit adres. <Link to="/">Bekijk het aanbod</Link>.
        </p>
      ) : (
        <ul className="vh__mandlijst">
          {gegevens.huren.map((h) => (
            <li key={h.id} className="vh__mandregel">
              <span className="vh__mandregel-naam">
                <span>{h.regels.map((r) => `${r.aantal} × ${r.naam}`).join(', ')}</span>
                <span className="vh__klein">
                  {h.van === h.tot ? h.van : `${h.van} tot en met ${h.tot}`} · kenmerk {h.id}
                  {h.status === 'nakijken' ? ' · we kijken je betaling na' : ''}
                </span>
              </span>
              <span className="vh__mandregel-bedrag">
                {euro(h.teBetalen)}
                {h.waarborg > 0 ? (
                  <span className="vh__klein" style={{ display: 'block' }}>
                    {h.waarborgTerug != null ? `waarborg ${euro(h.waarborgTerug)} terug` : `waarin ${euro(h.waarborg)} waarborg`}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
