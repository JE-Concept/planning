import { stukken } from '@lib/vermelding'

/**
 * De tekst van een notitie, met de vermelde namen eruit gelicht.
 *
 * In de database staat `@[Elke Vandeput](u-elke)`; op het scherm hoort daar
 * "@Elke Vandeput" te staan, en zichtbaar anders dan de rest — een vermelding
 * die eruitziet als gewone tekst is geen vermelding maar een woord.
 *
 * De naam komt uit de tekst en niet uit het profiel: zo blijft een oud bericht
 * lezen zoals het geschreven is, ook nadat iemand hernoemd is. Wie het is,
 * bepaalt de id ernaast — die staat in `mentions` en gaat naar de melding.
 */
export default function Notitietekst({ tekst, mij, className, style }) {
  return (
    <span className={className} style={style}>
      {stukken(tekst).map((stuk, i) =>
        stuk.soort === 'naam' ? (
          <strong
            key={i}
            className="je-vermelding"
            // Wat over jou gaat, hoort op te vallen tussen wat over de rest
            // gaat: dat is het verschil tussen meelezen en aangesproken worden.
            data-mij={stuk.uid === mij ? '' : undefined}
          >
            {stuk.tekst}
          </strong>
        ) : (
          <span key={i}>{stuk.tekst}</span>
        )
      )}
    </span>
  )
}
