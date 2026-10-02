import { hostNetjes } from '@lib/links'
import { useLinkVoorbeeld } from '@data/linkvoorbeeld'

/**
 * Het kaartje onder een notitie met een link: titel, omschrijving, plaatje.
 *
 * ── Eén kaartje per notitie ───────────────────────────────────────────────
 * Ook wanneer er drie links in staan. Drie kaartjes onder een zin van twee
 * regels is geen hulp maar een muur, en de eerste link is zo goed als altijd
 * waar het bericht over gaat.
 *
 * ── Het verschijnt pas wanneer het iets te zeggen heeft ───────────────────
 * Geen plaatshouder die aan het laden is, geen leeg vlak bij een site die
 * niets meegeeft. Dan staat er alleen de link, en dat is wat er zonder dit
 * kaartje ook stond — nooit minder dan voorheen.
 */
export default function LinkVoorbeeld({ url }) {
  const kaartje = useLinkVoorbeeld(url)
  if (!kaartje || kaartje.leeg || !kaartje.titel) return null

  return (
    <a
      className="je-linkkaart"
      href={kaartje.url ?? url}
      target="_blank"
      rel="noopener noreferrer nofollow"
    >
      {kaartje.afbeelding ? (
        <img
          className="je-linkkaart__beeld"
          src={kaartje.afbeelding}
          alt=""
          loading="lazy"
          // Een plaatje dat niet laadt, laat anders een grijs gat achter waar
          // de rest van het kaartje omheen staat.
          onError={(e) => e.currentTarget.remove()}
        />
      ) : null}
      <span className="je-linkkaart__tekst">
        <span className="je-linkkaart__host">{kaartje.site || hostNetjes(kaartje.url ?? url)}</span>
        <span className="je-linkkaart__titel">{kaartje.titel}</span>
        {kaartje.omschrijving ? (
          <span className="je-linkkaart__uitleg">{kaartje.omschrijving}</span>
        ) : null}
      </span>
    </a>
  )
}
