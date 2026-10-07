import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { prijsVoorPeriode, regelPrijs } from '@lib/huurprijs'
import { dagenTussen } from '../lib/mand'
import { euro, metBtw, slug } from '../lib/weergave'
import Periode from '../onderdelen/Periode'
import Prijs from '../onderdelen/Prijs'
import Foto from '../onderdelen/Foto'
import Aantal from '../onderdelen/Aantal'
import Beschikbaar from '../onderdelen/Beschikbaar'

/**
 * Eén artikel: foto, prijs voor jouw periode, en de staffel erbij.
 *
 * ── Waarom de hele staffel zichtbaar is ──────────────────────────────────
 * Omdat de regel die erachter zit niet vanzelfsprekend is: zes dagen kosten
 * hoogstens een week. Wie alleen een dagprijs ziet, rekent zelf uit dat zes
 * dagen zes keer de dagprijs is, komt op een hoger bedrag dan het onze en
 * gaat elders kijken. De tabel laat zien dat langer huren per dag goedkoper
 * wordt, en dat is precies het argument.
 */
export default function Artikel({ catalogus, opId, mand, zetPeriode, erbij, vrij, laadtVrij }) {
  const { id } = useParams()
  const artikel = opId.get(id)
  const [aantal, setAantal] = useState(1)
  const [erin, setErin] = useState(false)

  const dagen = useMemo(() => dagenTussen(mand.van, mand.tot), [mand.van, mand.tot])
  const beschikbaar = vrij.get(id)

  // Wat er vaak bij hoort: eerst uit dezelfde categorie, anders iets anders.
  const erbijHoort = useMemo(() => {
    const anderen = (catalogus?.artikelen ?? []).filter((a) => a.id !== id)
    return [...anderen.filter((a) => a.categorie === artikel?.categorie), ...anderen.filter((a) => a.categorie !== artikel?.categorie)].slice(0, 3)
  }, [catalogus, id, artikel?.categorie])

  if (!artikel) {
    return (
      <p className="vh__wrap vh__leeg">
        Dit artikel bestaat niet of is niet meer te huren.{' '}
        <Link to="/" className="vh__inlink">
          Terug naar het aanbod
        </Link>
        .
      </p>
    )
  }

  const regel = regelPrijs({ materiaal: artikel, aantal, dagen })
  const teveel = beschikbaar !== undefined && aantal > beschikbaar
  const volzet = dagen.length > 0 && beschikbaar === 0

  return (
    <>
      <section className="vh__wrap vh__pagina" aria-labelledby="art-kop">
        <nav className="vh__kruim" aria-label="Kruimelpad">
          <Link to="/" className="vh__terug">
            Verhuur
          </Link>
          <span aria-hidden="true">/</span>
          <Link to={`/aanbod/${slug(artikel.categorie)}`}>{artikel.categorie}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{artikel.naam}</span>
        </nav>

        <article className="vh__artikel">
          <Foto artikel={artikel} groot />

          <div className="vh__koop">
            <header className="vh__koop-kop">
              <span className="je-eyebrow">{artikel.categorie}</span>
              <h1 id="art-kop" className="je-sect__title vh__h1">
                {artikel.naam}
              </h1>
              {artikel.omschrijving ? <p className="je-sect__intro">{artikel.omschrijving}</p> : null}
            </header>

            <div className="je-card vh__koop-kaart">
              <div className="vh__kaart-rij">
                {dagen.length > 0 ? (
                  <Prijs artikel={artikel} dagen={dagen} bedrag={prijsVoorPeriode(artikel, dagen).bedrag} groot />
                ) : (
                  <Prijs artikel={artikel} dagen={dagen} groot />
                )}
                {dagen.length > 0 ? (
                  <Beschikbaar vrij={beschikbaar} voorraad={artikel.voorraad} laadt={laadtVrij} metPeriode />
                ) : null}
              </div>

              <Periode van={mand.van} tot={mand.tot} onWijzig={zetPeriode} vorm="balk" titel="Je periode" />

              <div className="vh__koop-actie">
                <Aantal waarde={aantal} onWijzig={setAantal} naam="Aantal" />
                <button
                  type="button"
                  className="je-btn je-btn--primary je-btn--md"
                  onClick={() => {
                    erbij(artikel.id, aantal)
                    setErin(true)
                  }}
                  disabled={volzet || teveel}
                >
                  In de mand
                </button>
              </div>

              {dagen.length > 0 && aantal > 1 ? (
                <p className="vh__klein">
                  {aantal} stuks: {euro(metBtw(regel.netto))} incl. btw voor de hele periode.
                </p>
              ) : dagen.length === 0 ? (
                <p className="vh__klein">Kies een datum om de prijs voor jouw periode te zien.</p>
              ) : null}

              {teveel ? (
                <p className="je-notice je-notice--warning">
                  Er zijn er maar {beschikbaar} vrij in deze periode. Kies een ander aantal of een andere datum, of{' '}
                  <Link to="/offerte" className="vh__inlink">
                    vraag het ons
                  </Link>
                  : vaak kunnen we bijhuren.
                </p>
              ) : null}

              {erin ? (
                <p className="je-notice je-notice--success" role="status">
                  In je mand.{' '}
                  <Link to="/mand" className="vh__inlink">
                    Naar je mand
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        </article>
      </section>

      <section className="vh__lijn" aria-label="Meer over dit artikel">
        <div className="vh__wrap vh__sectie vh__twee">
          <div className="vh__staffel">
            <h2 className="je-sect__title vh__h3">Wat het kost</h2>
            <table>
              <tbody>
                {[
                  ['Per dag', artikel.prijsPerDag],
                  ['Weekend (vrijdag tot maandag)', artikel.prijsWeekend],
                  ['Per week', artikel.prijsWeek],
                ]
                  .filter(([, bedrag]) => bedrag != null)
                  .map(([wat, bedrag]) => (
                    <tr key={wat}>
                      <th scope="row">{wat}</th>
                      <td>{euro(metBtw(bedrag))}</td>
                    </tr>
                  ))}
                {artikel.waarborg ? (
                  <tr>
                    <th scope="row">Waarborg</th>
                    <td>
                      {euro(artikel.waarborg)}
                      <span className="vh__klein"> per stuk, krijg je terug</span>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <p className="vh__klein">
              Je betaalt nooit meer dan het eerstvolgende grotere tarief: zes dagen kosten hoogstens een week. Alle
              huurprijzen zijn inclusief 21% btw; de waarborg valt erbuiten.
              {artikel.minDagen > 1 ? ` Dit artikel huur je minstens ${artikel.minDagen} dagen.` : ''}
            </p>
          </div>

          {erbijHoort.length > 0 ? (
            <div className="vh__erbij">
              <h2 className="je-sect__title vh__h3">
                Vaak samen <em>gehuurd</em>
              </h2>
              <ul className="vh__mini">
                {erbijHoort.map((a) => (
                  <li key={a.id}>
                    <Link to={`/artikel/${a.id}`} className="vh__mini-link">
                      <Foto artikel={a} />
                      <span className="vh__mini-naam">{a.naam}</span>
                      <span className="vh__klein">vanaf {euro(metBtw(a.prijsPerDag))} per dag</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
