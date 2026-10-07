import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { prijsVoorPeriode } from '@lib/huurprijs'
import { dagenTussen } from '../lib/mand'
import { slug } from '../lib/weergave'
import Periode from '../onderdelen/Periode'
import Kaart from '../onderdelen/Kaart'

const SORTEER = {
  naam: { label: 'Op naam', fn: (a, b) => a.naam.localeCompare(b.naam, 'nl') },
  goedkoop: { label: 'Prijs laag naar hoog', fn: (a, b) => a.prijs - b.prijs },
  duur: { label: 'Prijs hoog naar laag', fn: (a, b) => b.prijs - a.prijs },
}

/**
 * Het aanbod: alles, één categorie (`/aanbod/koeling`) of een zoekopdracht.
 *
 * ── Waarom volzet niet verdwijnt ─────────────────────────────────────────
 * Een artikel dat vol zit, blijft staan met "volzet op deze datum". Weglaten
 * zou de bezoeker laten denken dat we het niet hébben, en dan mailt hij niet
 * eens — terwijl een andere datum of bijhuren vaak gewoon kan. "Alleen wat
 * vrij is" is een keuze van de bezoeker, niet van ons.
 */
export default function Aanbod({ catalogus, mand, zetPeriode, erbij, vrij, laadtVrij }) {
  const { categorie: gekozen } = useParams()
  const [zoekParams] = useSearchParams()
  const zoek = (zoekParams.get('zoek') ?? '').trim().toLowerCase()
  const [sorteer, setSorteer] = useState('naam')
  const [alleenVrij, setAlleenVrij] = useState(false)

  const dagen = useMemo(() => dagenTussen(mand.van, mand.tot), [mand.van, mand.tot])
  const categorie = (catalogus?.categorieen ?? []).find((c) => slug(c) === gekozen) ?? null

  const getoond = useMemo(() => {
    const lijst = (catalogus?.artikelen ?? [])
      .filter((m) => !categorie || m.categorie === categorie)
      .filter((m) => !zoek || `${m.naam} ${m.omschrijving ?? ''} ${m.categorie ?? ''}`.toLowerCase().includes(zoek))
      .filter((m) => !alleenVrij || dagen.length === 0 || vrij.get(m.id) !== 0)
      .map((m) => ({ ...m, prijs: dagen.length ? prijsVoorPeriode(m, dagen).bedrag : m.prijsPerDag }))
    return lijst.sort(SORTEER[sorteer].fn)
  }, [catalogus, categorie, zoek, alleenVrij, dagen, vrij, sorteer])

  if (!catalogus) return <p className="vh__wrap vh__laden">Het aanbod wordt opgehaald…</p>

  const titel = categorie ?? (zoek ? `Zoeken: ${zoekParams.get('zoek')}` : 'Het aanbod')

  return (
    <>
      <div className="vh__balk">
        <div className="vh__wrap">
          <Periode van={mand.van} tot={mand.tot} onWijzig={zetPeriode} vorm="balk" titel="Je periode" />
        </div>
      </div>

      <section className="vh__wrap vh__pagina" aria-labelledby="aanbod-kop">
        <nav className="vh__kruim" aria-label="Kruimelpad">
          <Link to="/">Verhuur</Link>
          <span aria-hidden="true">/</span>
          {categorie || zoek ? <Link to="/aanbod">Aanbod</Link> : <span aria-current="page">Aanbod</span>}
          {categorie ? (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{categorie}</span>
            </>
          ) : null}
        </nav>

        <div className="vh__sectie-kop vh__sectie-kop--rij">
          <div className="je-sect">
            <span className="je-sect__eyebrow">
              {getoond.length} {getoond.length === 1 ? 'artikel' : 'artikels'}
            </span>
            <h1 id="aanbod-kop" className="je-sect__title vh__h1">
              {titel}
            </h1>
          </div>
          <label className="je-field vh__sorteer">
            <span className="je-field__label">Sorteer</span>
            <select className="je-input je-select je-select--boxed" value={sorteer} onChange={(e) => setSorteer(e.target.value)}>
              {Object.entries(SORTEER).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="vh__aanbod">
          <aside className="vh__filter" aria-label="Filters">
            {catalogus.categorieen.length > 1 ? (
              <div className="vh__filter-groep">
                <span className="je-field__label">Categorie</span>
                <div className="vh__filter-tags">
                  <Link to="/aanbod" className={`je-tag je-tag--selectable${!categorie ? ' je-tag--selected' : ''}`}>
                    Alles
                  </Link>
                  {catalogus.categorieen.map((c) => (
                    <Link
                      key={c}
                      to={`/aanbod/${slug(c)}`}
                      className={`je-tag je-tag--selectable${categorie === c ? ' je-tag--selected' : ''}`}
                      aria-current={categorie === c ? 'page' : undefined}
                    >
                      {c}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {dagen.length > 0 ? (
              <label className={`je-choice${laadtVrij ? ' je-choice--disabled' : ''}`}>
                <input
                  type="checkbox"
                  className="je-choice__native"
                  checked={alleenVrij}
                  onChange={(e) => setAlleenVrij(e.target.checked)}
                />
                <span className={`je-switch${alleenVrij ? ' je-switch--on' : ''}`} aria-hidden="true">
                  <span className="je-switch__knob" />
                </span>
                <span>
                  Alleen wat vrij is
                  <span className="je-choice__desc">in je gekozen periode</span>
                </span>
              </label>
            ) : null}
            <p className="je-notice">
              <span className="je-notice__title">Meer nodig dan er staat?</span>
              Grote aantallen, opbouw of levering regelen we met een offerte.{' '}
              <Link to="/offerte" className="vh__inlink">
                Offerte vragen
              </Link>
            </p>
          </aside>

          {getoond.length === 0 ? (
            <p className="vh__leeg">
              {zoek ? 'Niets gevonden voor deze zoekopdracht.' : 'Hier staat op dit moment niets.'}{' '}
              <Link to="/aanbod" className="vh__inlink">
                Alles bekijken
              </Link>
            </p>
          ) : (
            <ul className="vh__raster">
              {getoond.map((m) => (
                <Kaart
                  key={m.id}
                  artikel={m}
                  dagen={dagen}
                  vrij={vrij.get(m.id)}
                  laadtVrij={laadtVrij}
                  onErbij={(aantal) => erbij(m.id, aantal)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
