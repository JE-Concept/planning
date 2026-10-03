import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { prijsVoorPeriode, regelPrijs } from '@lib/huurprijs'
import { dagenTussen } from '../lib/mand'
import Periode from '../onderdelen/Periode'
import Prijs from '../onderdelen/Prijs'
import Foto from '../onderdelen/Foto'

/**
 * Eén artikel, met de staffel erbij.
 *
 * ── Waarom de hele staffel zichtbaar is ──────────────────────────────────
 * Omdat de regel die erachter zit niet vanzelfsprekend is: zes dagen kosten
 * hoogstens een week. Wie alleen een dagprijs ziet, rekent zelf uit dat zes
 * dagen zes keer de dagprijs is, komt op een hoger bedrag dan het onze en
 * gaat elders kijken. De tabel laat zien dat langer huren per dag goedkoper
 * wordt, en dat is precies het argument.
 */
export default function Artikel({ opId, mand, zetPeriode, erbij, vrij, laadtVrij }) {
  const { id } = useParams()
  const artikel = opId.get(id)
  const [aantal, setAantal] = useState(1)

  const dagen = useMemo(() => dagenTussen(mand.van, mand.tot), [mand.van, mand.tot])
  const beschikbaar = vrij.get(id)

  if (!artikel) {
    return (
      <p className="vh__leeg">
        Dit artikel bestaat niet of is niet meer te huren. <Link to="/">Terug naar het aanbod</Link>.
      </p>
    )
  }

  const regel = regelPrijs({ materiaal: artikel, aantal, dagen })
  const teveel = beschikbaar !== undefined && aantal > beschikbaar

  return (
    <article className="vh__artikel">
      <Link to="/" className="vh__terug">
        ← Alle artikelen
      </Link>

      <Foto artikel={artikel} groot />

      <header>
        <span className="je-eyebrow">{artikel.categorie}</span>
        <h1>{artikel.naam}</h1>
        {artikel.omschrijving ? <p className="vh__artikel-tekst">{artikel.omschrijving}</p> : null}
      </header>

      <Periode van={mand.van} tot={mand.tot} onWijzig={zetPeriode} />

      <section className="vh__staffel">
        <h2>Wat het kost</h2>
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
                  <td>€ {Number(bedrag).toFixed(2).replace('.', ',')}</td>
                </tr>
              ))}
            {artikel.waarborg ? (
              <tr>
                <th scope="row">Waarborg</th>
                <td>
                  € {Number(artikel.waarborg).toFixed(2).replace('.', ',')}
                  <span className="vh__klein"> per stuk, krijg je terug</span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <p className="vh__klein">
          Je betaalt nooit meer dan het eerstvolgende grotere tarief: zes dagen kosten hoogstens een
          week. Alle bedragen zijn exclusief 21% btw.
          {artikel.minDagen > 1 ? ` Dit artikel huur je minstens ${artikel.minDagen} dagen.` : ''}
        </p>
      </section>

      <section className="vh__bestel">
        <div className="vh__bestel-regel">
          <label htmlFor="aantal">Aantal</label>
          <input
            id="aantal"
            className="je-input"
            type="number"
            min="1"
            value={aantal}
            onChange={(e) => setAantal(Math.max(1, Math.round(Number(e.target.value) || 1)))}
          />
          {dagen.length > 0 ? (
            <span className="vh__klein">
              {laadtVrij && beschikbaar === undefined
                ? 'beschikbaarheid nakijken…'
                : beschikbaar === 0
                  ? 'volzet op deze datum'
                  : `${beschikbaar ?? artikel.voorraad} vrij in deze periode`}
            </span>
          ) : null}
        </div>

        {dagen.length > 0 ? (
          <p className="vh__totaal">
            <Prijs artikel={artikel} dagen={dagen} bedrag={prijsVoorPeriode(artikel, dagen).bedrag} />
            {aantal > 1 ? (
              <span className="vh__klein">
                {' '}
                × {aantal} = € {regel.netto.toFixed(2).replace('.', ',')} excl. btw
              </span>
            ) : null}
          </p>
        ) : (
          <p className="vh__klein">Kies een datum om de prijs voor jouw periode te zien.</p>
        )}

        {teveel ? (
          <p className="vh__waarschuwing">
            Er zijn er maar {beschikbaar} vrij in deze periode. Kies een ander aantal of een andere
            datum — of <Link to="/offerte">vraag het ons</Link>, vaak kunnen we bijhuren.
          </p>
        ) : null}

        <button
          type="button"
          className="je-btn je-btn--primary je-btn--md"
          onClick={() => erbij(artikel.id, aantal)}
          disabled={beschikbaar === 0 || teveel}
        >
          In de mand
        </button>
      </section>
    </article>
  )
}
