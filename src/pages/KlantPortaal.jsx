import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { haalPortaal } from '@data/portaal'

/**
 * Alles wat één klant bij JE Concept lopen heeft, op één adres.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * Een klant is zelden één event. Blum heeft een kerstfeest, een jubileum en
 * een dossier dat op de factuur wacht; een familie heeft een communie in mei
 * en een trouw in het najaar. Wie daarvoor drie losse links in drie mails moet
 * terugzoeken, belt uiteindelijk gewoon — en dat is precies het werk dat deze
 * tool moest wegnemen.
 *
 * Hier staat het bij elkaar, met van elk dossier de stand: er wordt aan
 * gewerkt, het ligt bij jou, het is bevestigd, het is afgerond. Vier woorden,
 * en geen enkele ervan is een van onze pijplijnnamen — "ready to invoice" zegt
 * een klant niets en "planning ongoing" leest hij verkeerd.
 *
 * ── Waarom er geen bedragen op staan ──────────────────────────────────────
 * Alleen wat op een verstuurde offerte staat is met de klant gedeeld. Een
 * dossier waar nog aan gerekend wordt, toont hier zijn stand en verder niets;
 * het bedrag ziet hij zodra we het sturen.
 */
export default function KlantPortaal() {
  const { token } = useParams()
  const [staat, setStaat] = useState({ laadt: true })

  useEffect(() => {
    let levend = true
    haalPortaal(`klant/${token}`)
      .then((data) => levend && setStaat({ laadt: false, ...data }))
      .catch(() => levend && setStaat({ laadt: false, fout: true }))
    return () => {
      levend = false
    }
  }, [token])

  if (staat.laadt) {
    return (
      <div className="je-publiek je-publiek--midden">
        <p>Even geduld…</p>
      </div>
    )
  }

  if (staat.fout || !staat.klant) {
    return (
      <div className="je-publiek je-publiek--midden">
        <span className="je-publiek__merk">
          JE<em>Concept</em>
        </span>
        <h1>Deze pagina bestaat niet (meer)</h1>
        <p>
          Mail ons gerust op <a href="mailto:info@jeconcept.be">info@jeconcept.be</a>.
        </p>
      </div>
    )
  }

  const { klant, contact, events } = staat
  const open = events.filter((e) => e.stand !== 'afgerond')
  const klaar = events.filter((e) => e.stand === 'afgerond')

  return (
    <div className="je-publiek">
      <header className="je-publiek__kop">
        <span className="je-publiek__merk">
          JE<em>Concept</em>
        </span>
        <h1>{contact?.voornaam ? `Dag ${contact.voornaam},` : 'Dag,'}</h1>
        <p className="je-publiek__intro">
          Dit is het overzicht van wat we voor <strong>{klant.naam}</strong> lopen hebben.
          {open.length === 0
            ? ' Er staat op dit moment niets open.'
            : ` ${open.length === 1 ? 'Eén dossier' : `${open.length} dossiers`} in behandeling.`}
        </p>
      </header>

      {open.length ? (
        <section className="je-publiek__lijst">
          {open.map((e) => (
            <Dossier key={e.id} event={e} />
          ))}
        </section>
      ) : null}

      {klaar.length ? (
        <section className="je-publiek__lijst je-publiek__lijst--stil">
          <h2>Eerder</h2>
          {klaar.map((e) => (
            <Dossier key={e.id} event={e} />
          ))}
        </section>
      ) : null}

      <footer className="je-publiek__voet">
        <p>
          Vragen over een van deze dossiers? Mail ons op{' '}
          <a href="mailto:info@jeconcept.be">info@jeconcept.be</a> — vermeld gerust de datum,
          dan weten we meteen welk feest je bedoelt.
        </p>
      </footer>
    </div>
  )
}

const STAND = {
  in_behandeling: { label: 'We werken eraan', toon: 'bezig' },
  bij_jou: { label: 'Wacht op jouw akkoord', toon: 'jij' },
  bevestigd: { label: 'Bevestigd', toon: 'goed' },
  afgerond: { label: 'Afgerond', toon: 'stil' },
}

function Dossier({ event }) {
  const stand = STAND[event.stand] ?? STAND.in_behandeling

  return (
    <article className="je-publiek__dossier" data-toon={stand.toon}>
      <div className="je-publiek__dossierkop">
        <h3>{event.title}</h3>
        <span className="je-publiek__stand" data-toon={stand.toon}>
          {stand.label}
        </span>
      </div>
      <p className="je-publiek__meta">
        {[
          event.eventDate ? periode(event) : 'datum nog te bepalen',
          event.location,
          event.pax ? `${event.pax} personen` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {event.offerte ? (
        <Link className="je-publiek__link" to={`/offerte/${event.offerte.token}`}>
          {event.offerte.status === 'goedgekeurd'
            ? `Offerte ${event.offerte.nummer} — goedgekeurd`
            : `Bekijk offerte ${event.offerte.nummer}`}
        </Link>
      ) : null}
    </article>
  )
}

/**
 * De datum zoals een klant ze leest: één dag, of "van ... tot en met ...".
 *
 * Een klant die een weekend boekt, hoort op zijn eigen pagina te zien dat het
 * een weekend is. Twee volledige datums met "tot en met" ertussen, want dit is
 * de pagina waar hij op afgaat — hier is kort zijn niet de bedoeling.
 */
const periode = (event) => {
  const einde = event?.eventEndDate
  if (!einde || String(einde) <= String(event.eventDate)) return langeDatum(event.eventDate)
  return `van ${langeDatum(event.eventDate)} tot en met ${langeDatum(einde)}`
}

const langeDatum = (waarde) =>
  new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(waarde)
  )
