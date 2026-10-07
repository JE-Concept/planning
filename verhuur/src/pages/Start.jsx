import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { dagenTussen } from '../lib/mand'
import { CONTACT } from '../lib/instellingen'
import { slug } from '../lib/weergave'
import Periode from '../onderdelen/Periode'
import Foto from '../onderdelen/Foto'
import Kaart from '../onderdelen/Kaart'

/** Zoveel artikels staan op de startpagina; de rest staat onder Aanbod. */
const OP_DE_START = 12

/**
 * De startpagina: eerst de datum, dan het aanbod.
 *
 * ── Waarom de periode bovenaan staat ─────────────────────────────────────
 * Omdat "is dat vrij op mijn datum" de eerste vraag is en niet de laatste.
 * Met de datum bovenaan staat bij elk artikel meteen wat er vrij is en wat
 * het voor die dagen kost; zonder loopt iemand pas bij het afrekenen tegen
 * een nee aan.
 *
 * ── Waarom het aanbod hier ook staat ─────────────────────────────────────
 * Zolang het aanbod klein is, is een startpagina met alleen categorieën een
 * omweg: één klik meer om te zien dat er drie artikels zijn. De categorieën
 * staan erboven zodra er meer dan één is; de artikels zelf eronder.
 *
 * Pakketten (uit het conceptvoorstel) staan er nog niet: welke pakketten er
 * komen, beslist Jasper later.
 */
export default function Start({ catalogus, mand, zetPeriode, erbij, vrij, laadtVrij }) {
  const dagen = useMemo(() => dagenTussen(mand.van, mand.tot), [mand.van, mand.tot])
  const artikelen = useMemo(() => catalogus?.artikelen ?? [], [catalogus])

  const tegels = useMemo(
    () =>
      (catalogus?.categorieen ?? []).map((naam) => {
        const erin = artikelen.filter((a) => a.categorie === naam)
        return { naam, aantal: erin.length, voorbeeld: erin.find((a) => a.foto) ?? erin[0] ?? { naam, categorie: naam } }
      }),
    [catalogus?.categorieen, artikelen]
  )

  if (!catalogus) return <p className="vh__wrap vh__laden">Het aanbod wordt opgehaald…</p>

  const sfeer = [...artikelen.filter((a) => a.foto), ...artikelen.filter((a) => !a.foto)].slice(0, 3)

  return (
    <>
      <section className="vh__wrap vh__held">
        <div className="vh__held-tekst">
          <span className="je-eyebrow">Verhuur van feestmateriaal · afhalen of geleverd</span>
          <h1 className="je-sect__title vh__held-titel">
            Alles voor jouw <em>feest</em>, klaar om te huren
          </h1>
          <p className="je-sect__intro">
            Statafels, koeling, verwarming en bars voor een verjaardag, een fuif of een personeelsfeest. Kies je
            periode en zie meteen wat vrij is en wat het kost.
          </p>
          <Periode van={mand.van} tot={mand.tot} onWijzig={zetPeriode}>
            <Link to="/aanbod" className="je-btn je-btn--primary je-btn--md vh__periode-knop">
              Bekijk wat vrij is
            </Link>
          </Periode>
        </div>
        {sfeer.length > 0 ? (
          <div className={`vh__held-fotos vh__held-fotos--${sfeer.length}`} aria-hidden="true">
            {sfeer.map((a) => (
              <Foto key={a.id} artikel={a} />
            ))}
          </div>
        ) : null}
      </section>

      {tegels.length > 1 ? (
        <section className="vh__wrap vh__sectie" aria-labelledby="cat-titel">
          <div className="je-sect vh__sectie-kop">
            <span className="je-sect__eyebrow">Het aanbod</span>
            <h2 id="cat-titel" className="je-sect__title vh__h2">
              Zoek per <em>categorie</em>
            </h2>
          </div>
          <ul className="vh__tegels">
            {tegels.map((t) => (
              <li key={t.naam}>
                <Link to={`/aanbod/${slug(t.naam)}`} className="vh__tegel">
                  <Foto artikel={t.voorbeeld} />
                  <span className="vh__tegel-naam">{t.naam}</span>
                  <span className="vh__klein">
                    {t.aantal} {t.aantal === 1 ? 'artikel' : 'artikels'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="vh__wrap vh__sectie" id="aanbod" aria-labelledby="aanbod-titel">
        <div className="vh__sectie-kop vh__sectie-kop--rij">
          <div className="je-sect">
            <span className="je-sect__eyebrow">{dagen.length > 0 ? 'Voor jouw periode' : 'Te huren'}</span>
            <h2 id="aanbod-titel" className="je-sect__title vh__h2">
              Wat je <em>meteen</em> huurt
            </h2>
          </div>
          {artikelen.length > OP_DE_START ? (
            <Link to="/aanbod" className="je-btn je-btn--secondary je-btn--sm">
              Alle {artikelen.length} artikels
            </Link>
          ) : null}
        </div>
        {artikelen.length === 0 ? (
          <p className="vh__leeg">Er staat op dit moment niets online. Mail ons gerust wat je zoekt.</p>
        ) : (
          <ul className="vh__raster">
            {artikelen.slice(0, OP_DE_START).map((m) => (
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
      </section>

      <section className="je-night vh__nacht" aria-labelledby="hoe-titel">
        <div className="vh__wrap vh__sectie">
          <div className="je-sect vh__sectie-kop">
            <span className="je-sect__eyebrow">Zo werkt het</span>
            <h2 id="hoe-titel" className="je-sect__title vh__h2">
              Jij <em>viert</em>, wij zorgen voor het materiaal
            </h2>
          </div>
          <ol className="je-steps">
            <li className="je-steps__item">
              <span className="je-steps__n">1</span>
              <div>
                <div className="je-steps__title">Kies je periode</div>
                <p className="je-steps__body">Je ziet meteen wat vrij is en wat het kost voor die dagen.</p>
              </div>
            </li>
            <li className="je-steps__item">
              <span className="je-steps__n vh__stap-licht">2</span>
              <div>
                <div className="je-steps__title">Vul je mand</div>
                <p className="je-steps__body">Betaal online, of maak van je mand een offerte.</p>
              </div>
            </li>
            <li className="je-steps__item">
              <span className="je-steps__n vh__stap-licht">3</span>
              <div>
                <div className="je-steps__title">Afhalen of geleverd</div>
                <p className="je-steps__body">Haal op in {CONTACT.plaats}, of wij leveren en halen weer op.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="vh__wrap vh__sectie" id="levering" aria-labelledby="lev-titel">
        <div className="je-sect vh__sectie-kop">
          <span className="je-sect__eyebrow">Levering en ophaling</span>
          <h2 id="lev-titel" className="je-sect__title vh__h2">
            Afhalen kan, leveren <em>overal</em>
          </h2>
        </div>
        <div className="vh__twee">
          <div className="je-card vh__blok">
            <h3 className="je-card__title">Afhalen in {CONTACT.plaats}</h3>
            <p className="je-card__body">
              {CONTACT.afhaaluren[0].toUpperCase() + CONTACT.afhaaluren.slice(1)}. Je krijgt het adres bij je
              bevestiging.
            </p>
          </div>
          <div className="je-card vh__blok">
            <h3 className="je-card__title">Geleverd waar je wil</h3>
            <p className="je-card__body">
              We leveren overal; de prijs hangt af van de afstand. Kies in je mand voor levering, dan rekenen we
              het samen met je huur uit in een offerte.
            </p>
          </div>
        </div>
      </section>

      <section className="vh__lijn" aria-labelledby="off-titel">
        <div className="vh__wrap vh__sectie vh__offerteblok">
          <div className="je-sect">
            <span className="je-sect__eyebrow">Groot, of met opbouw</span>
            <h2 id="off-titel" className="je-sect__title vh__h2">
              Liever een <em>offerte</em>?
            </h2>
            <p className="je-sect__intro">
              Grote aantallen, een tent met opbouw of een tap ter plaatse: vertel ons wat je zoekt. We antwoorden
              binnen één werkdag.
            </p>
          </div>
          <Link to="/offerte" className="je-btn je-btn--primary je-btn--lg">
            Offerte vragen
          </Link>
        </div>
      </section>
    </>
  )
}
