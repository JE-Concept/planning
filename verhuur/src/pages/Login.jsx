import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { loginGebruiken, loginVragen, zetSessie } from '../lib/api'
import { CONTACT } from '../lib/instellingen'

/**
 * Inloggen met een link in je mail.
 *
 * ── Waarom geen wachtwoord ───────────────────────────────────────────────
 * Een klant huurt twee keer per jaar een partij statafels. Een wachtwoord
 * daarvoor is er een dat hij vergeet, hergebruikt van zijn webmail, of
 * opschrijft. Een link in zijn mailbox is precies even veilig als die
 * mailbox — en dat is wat we toch al vertrouwen voor de bevestiging.
 *
 * Twee gezichten: het formulier (`/login`) en de link zelf (`/login/<token>`).
 * De tweede doet zijn werk en stuurt door; de eerste zegt na het versturen
 * alleen "kijk in je mail", ook als het adres onbekend is. Anders is dit
 * formulier een manier om onze klantenlijst na te lopen.
 */
export default function Login({ onIngelogd }) {
  const { token } = useParams()
  return token ? <LinkGebruiken token={token} onIngelogd={onIngelogd} /> : <LinkVragen />
}

function LinkVragen() {
  const [email, setEmail] = useState('')
  const [bezig, setBezig] = useState(false)
  const [verstuurd, setVerstuurd] = useState(false)
  const [fout, setFout] = useState(null)
  const kan = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)

  const versturen = async () => {
    setBezig(true)
    setFout(null)
    try {
      await loginVragen(email.trim())
      setVerstuurd(true)
    } catch {
      setFout(`Het versturen lukte niet. Probeer het opnieuw, of mail ons op ${CONTACT.email}.`)
    } finally {
      setBezig(false)
    }
  }

  if (verstuurd) {
    return (
      <section className="vh__afloop">
        <h1>Kijk in je mail</h1>
        <p>
          We stuurden een inloglink naar <strong>{email.trim()}</strong>. Ze werkt een kwartier en één keer.
          Geen mail? Kijk bij je ongewenste post, of vraag een nieuwe.
        </p>
        <button type="button" className="je-btn je-btn--ghost je-btn--md" onClick={() => setVerstuurd(false)}>
          Nieuwe link vragen
        </button>
      </section>
    )
  }

  return (
    <section className="vh__offerte">
      <h1>Inloggen</h1>
      <p>
        Geen wachtwoord: je krijgt een link in je mail. Ingelogd zie je wat je huurde, en geldt je
        klantenkorting ook online.
      </p>
      <form className="vh__velden" onSubmit={(e) => { e.preventDefault(); if (kan && !bezig) versturen() }}>
        <label className="vh__veld-breed">
          <span className="je-caps">E-mail</span>
          <input
            className="je-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </form>
      {fout ? <p className="vh__waarschuwing">{fout}</p> : null}
      <button type="button" className="je-btn je-btn--primary je-btn--md" onClick={versturen} disabled={!kan || bezig}>
        {bezig ? 'Versturen…' : 'Stuur me een inloglink'}
      </button>
    </section>
  )
}

function LinkGebruiken({ token, onIngelogd }) {
  const navigate = useNavigate()
  const [stand, setStand] = useState('bezig')

  useEffect(() => {
    let geldig = true
    loginGebruiken(token)
      .then((uit) => {
        if (!geldig) return
        zetSessie(uit.sessie)
        onIngelogd?.(uit)
        navigate('/mijn', { replace: true })
      })
      .catch((err) => geldig && setStand(err.code || 'mislukt'))
    return () => {
      geldig = false
    }
  }, [token, navigate, onIngelogd])

  if (stand === 'bezig') return <p className="vh__laden">Een ogenblik, we loggen je in…</p>

  const uitleg = {
    al_gebruikt: 'Deze link is al gebruikt. Een link werkt één keer — vraag gewoon een nieuwe.',
    verlopen: 'Deze link is verlopen. Ze werkt een kwartier — vraag gewoon een nieuwe.',
    onbekend: 'Deze link klopt niet. Vraag een nieuwe.',
  }[stand] ?? 'Inloggen lukte niet. Vraag een nieuwe link.'

  return (
    <section className="vh__afloop">
      <h1>Deze link werkt niet meer</h1>
      <p>{uitleg}</p>
      <Link to="/login" className="je-btn je-btn--primary je-btn--md">
        Nieuwe link vragen
      </Link>
    </section>
  )
}
