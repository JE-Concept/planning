import { stukkenMetLinks } from '@lib/links'
import { stukken } from '@lib/vermelding'
import { Avatar } from '@components/ds'

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
export default function Notitietekst({ tekst, mij, profileById = {}, className, style }) {
  return (
    <span className={className} style={style}>
      {metLinks(stukken(tekst)).map((stuk, i) =>
        stuk.soort === 'naam' ? (
          <strong
            key={i}
            className="je-vermelding"
            // Wat over jou gaat, hoort op te vallen tussen wat over de rest
            // gaat: dat is het verschil tussen meelezen en aangesproken worden.
            data-mij={stuk.uid === mij ? '' : undefined}
          >
            {/*
              Het gezichtje erbij, zodat je in een draad van tien notities in
              één oogopslag ziet wie er aangesproken wordt zonder de naam te
              lezen. Alleen wanneer we het account nog kennen: bij iemand die
              vertrokken is blijft de naam staan zoals ze geschreven werd —
              dat is wat er toen gezegd is.
            */}
            {profileById[stuk.uid] ? (
              <Avatar profile={profileById[stuk.uid]} size={16} className="je-vermelding__gezicht" />
            ) : null}
            {stuk.tekst}
          </strong>
        ) : stuk.soort === 'link' ? (
          <a
            key={i}
            href={stuk.href}
            // `noreferrer` hoort bij `noopener`: zonder het eerste geeft een
            // nieuw tabblad het adres van dit scherm door aan de site die
            // geopend wordt, en daar staat een event-id in.
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="je-notitielink"
          >
            {stuk.tekst}
          </a>
        ) : (
          <span key={i}>{stuk.tekst}</span>
        )
      )}
    </span>
  )
}

/**
 * De vermeldingen zijn al uitgeknipt; de links komen daar doorheen.
 *
 * Twee keer knippen en niet één reguliere expressie voor allebei: een naam en
 * een adres zijn twee verschillende dingen met twee verschillende regels, en
 * een patroon dat ze allebei moet kennen, kent ze geen van beide goed. De
 * tweede knipbeurt slaat de naamstukken over — in `@[Jan](uid)` zit geen link,
 * en er mag er ook geen uit tevoorschijn komen.
 */
function metLinks(delen) {
  return delen.flatMap((stuk) => (stuk.soort === 'tekst' ? stukkenMetLinks(stuk.tekst) : stuk))
}
