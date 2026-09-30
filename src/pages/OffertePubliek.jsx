import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GELDIG_DAGEN, isVerlopen } from '@lib/offerte'
import { kaartLink } from '@lib/kaart'
import OfferteBlad from '@components/events/OfferteBlad'
import { haalPortaal, stuurAntwoord } from '@data/portaal'

/**
 * De offerte zoals de klant ze opent.
 *
 * ── Waarom dit geen kale PDF is ───────────────────────────────────────────
 * Een offerte als bijlage is een bestand dat je downloadt, opent, kwijtraakt
 * en drie weken later terugvindt in een mailtje van iemand anders. Een pagina
 * met een adres blijft staan, is op een telefoon te lezen, en kan iets wat een
 * PDF nooit kan: antwoorden. Goedkeuren is hier één knop, en dat is precies
 * het moment waar het bij een offerte om draait.
 *
 * ── Waarom ze zo persoonlijk is ───────────────────────────────────────────
 * De klant schreef ons eerst. Die vraag staat als omschrijving op het event,
 * dus die kunnen we teruggeven: "Je schreef ons over…". Daaronder staat wat
 * we begrepen hebben — datum, plek, aantal — zodat een misverstand opvalt
 * vóór het geld kost, en niet erna. En er staat één naam bij met een adres:
 * wie dit dossier doet. Een offerte van een bedrijf zonder gezicht is een
 * prijs; een offerte van Elke is een gesprek.
 *
 * ── Wat er níét op staat ──────────────────────────────────────────────────
 * Alles wat de functie niet meestuurt: marges, interne notities, andere
 * klanten. Zie `functions/portaal.js` — de selectie gebeurt aan de serverkant,
 * niet hier.
 */
export default function OffertePubliek() {
  const { token } = useParams()
  const [staat, setStaat] = useState({ laadt: true })

  useEffect(() => {
    let levend = true
    haalPortaal(`offerte/${token}`)
      .then((data) => levend && setStaat({ laadt: false, ...data }))
      .catch(() => levend && setStaat({ laadt: false, fout: true }))
    return () => {
      levend = false
    }
  }, [token])

  if (staat.laadt) return <Wachten />
  if (staat.fout || !staat.offerte) return <NietGevonden />

  return <Offerte {...staat} token={token} />
}

function Offerte({ offerte, contact, aanspreekpunt, aanleiding, portaal, token }) {
  const [stand, setStand] = useState(offerte.status)
  const [vraag, setVraag] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  const verlopen = isVerlopen({ geldigTot: offerte.geldigTot }, new Date())
  const dagen = offerte.geldigTot
    ? Math.ceil((new Date(offerte.geldigTot) - new Date()) / 86400000)
    : null
  const kaart = kaartLink({ location: offerte.locatie })

  const antwoord = async (akkoord) => {
    if (bezig) return
    setBezig(true)
    setFout('')
    try {
      const uit = await stuurAntwoord(token, akkoord ? { akkoord: true } : { feedback: vraag.trim() })
      setStand(uit.status)
      setVraag('')
    } catch {
      setFout('Het lukte niet om je antwoord door te sturen. Probeer het zo nog eens, of mail ons gewoon.')
    } finally {
      setBezig(false)
    }
  }

  return (
    <div className="je-publiek">
      <header className="je-publiek__kop">
        <span className="je-publiek__merk">
          JE<em>Concept</em>
        </span>
        <h1>
          {contact?.voornaam ? `Dag ${contact.voornaam},` : 'Dag,'}
        </h1>
        <p className="je-publiek__intro">
          Hieronder staat ons voorstel voor <strong>{offerte.eventNaam || 'je event'}</strong>
          {offerte.eventDatum ? ` op ${langeDatum(offerte.eventDatum)}` : ''}
          {offerte.personen ? `, voor ${offerte.personen} personen` : ''}. Neem er rustig de tijd
          voor — en klopt er iets niet, zeg het gewoon. Daar is die knop onderaan voor.
        </p>

        {/* Wat wij begrepen hebben. Een misverstand hoort op te vallen vóór
            het geld kost, niet erna. */}
        <dl className="je-publiek__samenvatting">
          {offerte.eventDatum ? (
            <Regel label="Wanneer" waarde={langeDatum(offerte.eventDatum)} />
          ) : null}
          {offerte.locatie ? (
            <Regel
              label="Waar"
              waarde={offerte.locatie}
              link={kaart ? { href: kaart, tekst: 'op de kaart' } : null}
            />
          ) : null}
          {offerte.personen ? <Regel label="Voor hoeveel" waarde={`${offerte.personen} personen`} /> : null}
          <Regel label="Referentie" waarde={offerte.nummer} />
        </dl>

        {aanleiding ? (
          <blockquote className="je-publiek__aanleiding">
            <span className="je-publiek__aanleiding-kop">Je schreef ons</span>
            {aanleiding}
          </blockquote>
        ) : null}
      </header>

      <div className="je-offerteblad-schaal">
        <OfferteBlad offerte={offerte} />
      </div>

      <section className="je-publiek__antwoord" id="antwoord">
        {stand === 'goedgekeurd' ? (
          <Bevestigd aanspreekpunt={aanspreekpunt} />
        ) : verlopen ? (
          <Verlopen aanspreekpunt={aanspreekpunt} />
        ) : (
          <>
            <h2>Klopt dit?</h2>
            <p>
              {dagen != null && dagen > 0
                ? `Dit voorstel blijft nog ${dagen} ${dagen === 1 ? 'dag' : 'dagen'} geldig.`
                : `Dit voorstel blijft ${GELDIG_DAGEN} dagen geldig.`}{' '}
              Met één klik bevestig je de datum; we sturen je daarna de voorschotfactuur.
            </p>

            <div className="je-publiek__knoppen">
              <button type="button" className="je-publiek__ja" disabled={bezig} onClick={() => antwoord(true)}>
                Ja, hiermee akkoord
              </button>
            </div>

            <div className="je-publiek__vraag">
              <label htmlFor="vraag">Of stel een vraag — dan passen we het aan.</label>
              <textarea
                id="vraag"
                rows={4}
                value={vraag}
                onChange={(e) => setVraag(e.target.value)}
                placeholder="Bijvoorbeeld: kan het een uur later beginnen? Of: we worden er waarschijnlijk 45."
              />
              <button type="button" disabled={bezig || !vraag.trim()} onClick={() => antwoord(false)}>
                Versturen
              </button>
            </div>

            {stand === 'feedback' ? (
              <p className="je-publiek__gelukt">
                Bedankt — je vraag staat bij het dossier. {aanspreekpunt?.naam ?? 'Iemand van ons'} komt erop terug.
              </p>
            ) : null}
            {fout ? <p className="je-publiek__fout">{fout}</p> : null}
          </>
        )}
      </section>

      <footer className="je-publiek__voet">
        {aanspreekpunt ? (
          <p>
            Vragen? {aanspreekpunt.naam} volgt dit dossier op
            {aanspreekpunt.email ? (
              <>
                {' — '}
                <a href={`mailto:${aanspreekpunt.email}`}>{aanspreekpunt.email}</a>
              </>
            ) : null}
            .
          </p>
        ) : (
          <p>
            Vragen? Mail ons op <a href="mailto:info@jeconcept.be">info@jeconcept.be</a>.
          </p>
        )}
        {portaal ? (
          <p>
            <a href={`#/${portaal}`}>Al je dossiers bij JE Concept staan hier bij elkaar.</a>
          </p>
        ) : null}
      </footer>
    </div>
  )
}

function Regel({ label, waarde, link }) {
  return (
    <div className="je-publiek__regel">
      <dt>{label}</dt>
      <dd>
        {waarde}
        {link ? (
          <>
            {' · '}
            <a href={link.href} target="_blank" rel="noreferrer">
              {link.tekst}
            </a>
          </>
        ) : null}
      </dd>
    </div>
  )
}

function Bevestigd({ aanspreekpunt }) {
  return (
    <div className="je-publiek__bevestigd">
      <h2>Afgesproken.</h2>
      <p>
        De datum staat vast. Je krijgt van ons de voorschotfactuur; daarna nemen we de details
        met je door.
        {aanspreekpunt?.naam ? ` ${aanspreekpunt.naam} neemt contact op.` : ''}
      </p>
    </div>
  )
}

function Verlopen({ aanspreekpunt }) {
  return (
    <div className="je-publiek__bevestigd">
      <h2>Dit voorstel is verlopen</h2>
      <p>
        Prijzen en beschikbaarheid veranderen, dus we houden een voorstel dertig dagen aan.
        Nog altijd interesse? Laat het weten
        {aanspreekpunt?.email ? (
          <>
            {' — '}
            <a href={`mailto:${aanspreekpunt.email}`}>{aanspreekpunt.email}</a>
          </>
        ) : null}
        , dan maken we een nieuwe.
      </p>
    </div>
  )
}

function Wachten() {
  return (
    <div className="je-publiek je-publiek--midden">
      <p>Even geduld…</p>
    </div>
  )
}

function NietGevonden() {
  return (
    <div className="je-publiek je-publiek--midden">
      <span className="je-publiek__merk">
        JE<em>Concept</em>
      </span>
      <h1>Deze pagina bestaat niet (meer)</h1>
      <p>
        De link klopt niet, of het voorstel is ingetrokken. Mail ons gerust op{' '}
        <a href="mailto:info@jeconcept.be">info@jeconcept.be</a> — dan sturen we een nieuwe.
      </p>
    </div>
  )
}

const langeDatum = (waarde) =>
  new Intl.DateTimeFormat('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(waarde))
