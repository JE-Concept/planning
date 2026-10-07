import { useState } from 'react'
import { Link } from 'react-router-dom'
import { prijsVoorPeriode } from '@lib/huurprijs'
import Prijs from './Prijs'
import Foto from './Foto'
import Aantal from './Aantal'
import Beschikbaar from './Beschikbaar'

/**
 * Eén artikel in een raster: foto, naam, prijs, wat vrij is, en meteen in de mand.
 *
 * Het aantal staat op de kaart zelf: wie twaalf statafels zoekt, wil niet
 * twaalf keer klikken en ook niet eerst naar de artikelpagina.
 */
export default function Kaart({ artikel, dagen, vrij, laadtVrij, onErbij }) {
  const [aantal, setAantal] = useState(1)
  const prijs = prijsVoorPeriode(artikel, dagen)
  const volzet = dagen.length > 0 && vrij === 0

  return (
    <li className={`vh__kaart${volzet ? ' vh__kaart--volzet' : ''}`}>
      <Link to={`/artikel/${artikel.id}`} className="vh__kaart-link">
        <Foto artikel={artikel} />
        <h3>{artikel.naam}</h3>
      </Link>

      <div className="vh__kaart-rij">
        <Prijs artikel={artikel} dagen={dagen} bedrag={prijs.bedrag} />
        {dagen.length > 0 ? <Beschikbaar vrij={vrij} voorraad={artikel.voorraad} laadt={laadtVrij} /> : null}
      </div>

      <div className="vh__kaart-rij">
        {volzet ? (
          <span className="vh__klein">Andere dagen kiezen kan bovenaan.</span>
        ) : (
          <Aantal waarde={aantal} onWijzig={setAantal} klein naam={`Aantal ${artikel.naam}`} />
        )}
        <button
          type="button"
          className="je-btn je-btn--primary je-btn--sm"
          onClick={() => {
            onErbij(aantal)
            setAantal(1)
          }}
          disabled={volzet}
        >
          {volzet ? 'Volzet' : 'In de mand'}
        </button>
      </div>
    </li>
  )
}
