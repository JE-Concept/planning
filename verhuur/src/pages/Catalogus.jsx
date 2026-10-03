import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { prijsVoorPeriode } from '@lib/huurprijs'
import { dagenTussen } from '../lib/mand'
import Periode from '../onderdelen/Periode'
import Prijs from '../onderdelen/Prijs'
import Foto from '../onderdelen/Foto'

/**
 * De etalage: wat er te huren is, en wat er vrij is op jouw datum.
 *
 * ── Waarom er geen "niet beschikbaar" verdwijnt ───────────────────────────
 * Een artikel dat vol zit blijft staan, met "volzet op deze datum" erbij. Weg
 * laten zou de bezoeker laten denken dat we het niet hébben, en dan belt hij
 * niet eens — terwijl een andere datum of bijhuren vaak gewoon kan.
 */
export default function Catalogus({ catalogus, mand, zetPeriode, erbij, vrij, laadtVrij }) {
  const [categorie, setCategorie] = useState('alle')

  const dagen = useMemo(() => dagenTussen(mand.van, mand.tot), [mand.van, mand.tot])

  const getoond = useMemo(
    () => (catalogus?.artikelen ?? []).filter((m) => categorie === 'alle' || m.categorie === categorie),
    [catalogus, categorie]
  )

  if (!catalogus) return <p className="vh__laden">Het aanbod wordt opgehaald…</p>

  return (
    <>
      <section className="vh__hero">
        <h1>Huren bij JE Concept</h1>
        <p>
          Tenten, meubilair, koeling en bars. Kies je datum, dan zie je meteen wat er vrij is — en
          wat het kost.
        </p>
      </section>

      <Periode van={mand.van} tot={mand.tot} onWijzig={zetPeriode} />

      {catalogus.categorieen.length > 1 ? (
        <div className="vh__filters" role="group" aria-label="Filter op categorie">
          <button
            type="button"
            className={`vh__filter${categorie === 'alle' ? ' vh__filter--aan' : ''}`}
            onClick={() => setCategorie('alle')}
          >
            Alles
          </button>
          {catalogus.categorieen.map((c) => (
            <button
              key={c}
              type="button"
              className={`vh__filter${categorie === c ? ' vh__filter--aan' : ''}`}
              onClick={() => setCategorie(c)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {getoond.length === 0 ? (
        <p className="vh__leeg">In deze categorie staat op dit moment niets.</p>
      ) : (
        <ul className="vh__raster">
          {getoond.map((m) => (
            <Kaart
              key={m.id}
              artikel={m}
              dagen={dagen}
              vrij={vrij.get(m.id)}
              laadtVrij={laadtVrij}
              onErbij={() => erbij(m.id, 1)}
            />
          ))}
        </ul>
      )}

      <section className="vh__anders">
        <h2>Staat wat je zoekt er niet bij?</h2>
        <p>
          Tenten die geplaatst moeten worden, mobiele bars en volledige catering regelen we op maat.
          Vertel kort wat je plan is, dan rekenen we het voor je uit.
        </p>
        <Link to="/offerte" className="je-btn je-btn--primary je-btn--md">
          Vraag een offerte
        </Link>
      </section>
    </>
  )
}

function Kaart({ artikel, dagen, vrij, laadtVrij, onErbij }) {
  const prijs = prijsVoorPeriode(artikel, dagen)
  const volzet = vrij === 0
  const weinig = vrij !== undefined && vrij > 0 && vrij <= 3

  return (
    <li className={`vh__kaart${volzet ? ' vh__kaart--volzet' : ''}`}>
      <Link to={`/artikel/${artikel.id}`} className="vh__kaart-link">
        <Foto artikel={artikel} />
        <h3>{artikel.naam}</h3>
        {artikel.omschrijving ? <p className="vh__kaart-tekst">{artikel.omschrijving}</p> : null}
      </Link>

      <div className="vh__kaart-voet">
        <Prijs artikel={artikel} dagen={dagen} bedrag={prijs.bedrag} />

        {/*
          Het aantal vrije stuks staat er alleen wanneer er een datum gekozen
          is. Zonder datum is "nog drie vrij" een getal over vandaag, en dat
          is zelden de dag waarop iemand het nodig heeft.
        */}
        {dagen.length > 0 ? (
          <span className={`vh__vrij${volzet ? ' vh__vrij--volzet' : ''}${weinig ? ' vh__vrij--weinig' : ''}`}>
            {laadtVrij && vrij === undefined
              ? 'nakijken…'
              : volzet
                ? 'volzet op deze datum'
                : `${vrij ?? artikel.voorraad} vrij`}
          </span>
        ) : null}
      </div>

      <button type="button" className="je-btn je-btn--primary je-btn--sm" onClick={onErbij} disabled={volzet}>
        {volzet ? 'Volzet' : 'In de mand'}
      </button>
    </li>
  )
}
