import { GELDIG_DAGEN, VOORSCHOT_DEEL, perRubriek, regelBedrag, totalenVan, voorschotVan } from '@lib/offerte'
import { overzicht, paginas, prijsVan, soortVan } from '@lib/voorstel'
import { useTaal } from '@context/taal-context'

/**
 * Het conceptvoorstel zoals de klant het ziet.
 *
 * Eén layout voor alles: het voorbeeld in de app, de afdruk, de PDF en de
 * publieke goedkeuringspagina. Dit blad rekent zelf niets uit — de totalen
 * komen uit `@lib/offerte` en de prijzen per onderdeel uit `@lib/voorstel`,
 * waar ze getest zijn — en het bewaart niets. Het tekent wat het krijgt.
 *
 * ── Waarom het pagina's zijn en geen doorlopend blad ──────────────────────
 * Omdat het als pagina's gelezen wordt. Dit document gaat per mail naar een
 * klant die het doorstuurt naar drie collega's, en een van hen drukt het af.
 * Wie de pagina's pas bij het afdrukken laat ontstaan, krijgt een prijs die
 * los van zijn formule op de volgende bladzijde staat. Hier is de pagina de
 * eenheid, op het scherm en op papier — zie `paginas()` voor hoe de
 * onderdelen verdeeld worden.
 *
 * ── De opbouw ────────────────────────────────────────────────────────────
 * Cover · Wie zijn wij met het overzicht · de onderdelen · de offertetabel.
 * Dat is de opbouw van het Canva-sjabloon waar JE Concept al jaren mee werkt,
 * en elke klant die eerder een voorstel kreeg, herkent ze.
 *
 * De stijl staat in `src/styles/offerte.css`, apart van de rest van de app,
 * zodat dit blad ook buiten de app te renderen is zonder dat de kleuren
 * wegvallen. Dat is met opzet: twee kopieën van deze layout betekent dat de
 * klant iets anders ziet dan het scherm.
 */

/*
  De motor rekent in euro's, afgerond op de cent (`centen()` in `formules.js`
  doet dat en geeft euro's terug, geen centen — de naam is verraderlijk). Hier
  dus niet delen: dat maakte van €16.399 eerst €163,99.
*/
const euro = (bedrag, locale = 'nl-BE') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(bedrag) || 0)

/**
 * De naam van de klant over twee regels op de cover.
 *
 * Eén lange naam op één regel wordt op A4 onleesbaar klein; twee regels geeft
 * de letter de hoogte die de huisstijl vraagt. Breken op de láátste spatie en
 * niet op de eerste: "Koninklijke Harmonie Sint-Cecilia" hoort als
 * "Koninklijke Harmonie / Sint-Cecilia" te staan, niet andersom.
 */
export function splitsNaam(naam = '') {
  const schoon = String(naam ?? '').trim()
  if (!schoon) return ['', '']
  const spatie = schoon.lastIndexOf(' ')
  return spatie === -1 ? [schoon, ''] : [schoon.slice(0, spatie), schoon.slice(spatie + 1)]
}

export default function OfferteBlad({ offerte, bedrijf = BEDRIJF }) {
  const { t, locale } = useTaal()
  const regels = offerte?.regels ?? []
  const onderdelen = offerte?.onderdelen ?? []
  const totalen = totalenVan(regels)
  const groepen = perRubriek(regels)
  const geld = (v) => euro(v, locale)

  const datum = (waarde) => {
    const d = waarde?.toDate?.() ?? (waarde ? new Date(waarde) : null)
    return d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
      : '—'
  }

  const bladen = paginas(onderdelen)
  const reeks = overzicht(onderdelen, regels)
  const [eersteRegel, tweedeRegel] = splitsNaam(offerte?.klantNaam)

  // De cover telt mee, de tabel ook; daartussen staan "wie zijn wij" en de
  // onderdeelpagina's. Zo klopt "03 / 06" met wat iemand in zijn hand heeft.
  const totaalPaginas = 2 + bladen.length + 1
  const kopregel = [offerte?.klantNaam, datum(offerte?.eventDatum)].filter((v) => v && v !== '—').join(' · ')

  return (
    <article className="je-offerteblad">
      {/* ── 01 Cover ──────────────────────────────────────────────────── */}
      <section className="je-vblad je-vblad--cover">
        <div className="je-vblad__coverbinnen">
          <span className="je-vblad__eyebrow">{t('voorstel.cover_eyebrow')}</span>
          <h1 className="je-vblad__covernaam">
            {eersteRegel}
            {tweedeRegel ? (
              <>
                <br />
                {tweedeRegel}
              </>
            ) : null}
          </h1>
          <p className="je-vblad__leus">{t('voorstel.leus')}</p>
          <p className="je-vblad__coverdatum">{datum(offerte?.eventDatum)}</p>
        </div>
        <Voet nummer={1} totaal={totaalPaginas} bedrijf={bedrijf} />
      </section>

      {/* ── 02 Wie zijn wij, met het voorstel in één oogopslag ────────── */}
      <section className="je-vblad">
        <Kop tekst={kopregel} />
        <div className="je-vblad__binnen">
          <span className="je-vblad__eyebrow">{t('voorstel.over_eyebrow')}</span>
          <h2 className="je-vblad__titel">
            {t('voorstel.wie_titel')} <em className="je-vblad__script">{t('voorstel.wie_accent')}</em>
          </h2>

          {/*
            Deze tekst staat letterlijk in het Canva-sjabloon en wordt niet
            herschreven. Hij is van Jasper en Elke zelf; een vlottere versie
            zou beter lezen en minder van hen zijn.
          */}
          <div className="je-vblad__wie">
            {t('voorstel.wie_tekst')
              .split('|')
              .map((alinea) => (
                <p key={alinea}>{alinea}</p>
              ))}
            <p className="je-vblad__ondertekening">{t('voorstel.wie_ondertekening')}</p>
          </div>

          {reeks.length ? (
            <>
              <h3 className="je-vblad__subtitel">{t('voorstel.oogopslag')}</h3>
              <ol className="je-vblad__reeks">
                {reeks.map((rij) => (
                  <li key={rij.id}>
                    <span className="je-vblad__reeksnummer">{rij.nummer}</span>
                    <span className="je-vblad__reekstitel">{rij.titel}</span>
                    <span className="je-vblad__reeksprijs">
                      {rij.perPersoon == null ? '—' : t('voorstel.pp', { bedrag: geld(rij.perPersoon) })}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
        <Voet nummer={2} totaal={totaalPaginas} bedrijf={bedrijf} />
      </section>

      {/* ── De onderdelen, twee per pagina ────────────────────────────── */}
      {bladen.map((blad, i) => (
        <section className="je-vblad" key={blad.map((o) => o.id).join('-')}>
          <Kop tekst={kopregel} />
          <div className="je-vblad__binnen je-vblad__binnen--delen">
            {blad.map((onderdeel) => (
              <Onderdeel
                key={onderdeel.id}
                onderdeel={onderdeel}
                nummer={reeks.find((r) => r.id === onderdeel.id)?.nummer ?? null}
                prijs={prijsVan(onderdeel, regels)}
                geld={geld}
                t={t}
              />
            ))}
          </div>
          <Voet nummer={3 + i} totaal={totaalPaginas} bedrijf={bedrijf} />
        </section>
      ))}

      {/* ── De offertetabel ───────────────────────────────────────────── */}
      <section className="je-vblad je-vblad--tabel">
        <Kop tekst={kopregel} />
        <div className="je-vblad__binnen">
          <header className="je-offerteblad__kop">
            <div className="je-offerteblad__merk">
              <span className="je-offerteblad__logo">
                JE<em>Concept</em>
              </span>
              <span className="je-offerteblad__adres">
                {bedrijf.regels.map((r) => (
                  <span key={r} style={{ display: 'block' }}>
                    {r}
                  </span>
                ))}
              </span>
            </div>
            <div className="je-offerteblad__titel">
              <h1>{t('offerte.titel')}</h1>
              <span className="je-offerteblad__nummer">{offerte?.nummer ?? '—'}</span>
            </div>
          </header>

          <section className="je-offerteblad__partijen">
            <div className="je-offerteblad__blok">
              <h2>{t('offerte.voor')}</h2>
              <dl>
                <dt>{t('offerte.klant')}</dt>
                <dd>{offerte?.klantNaam || '—'}</dd>
              </dl>
            </div>
            <div className="je-offerteblad__blok">
              <h2>{t('offerte.event')}</h2>
              <dl>
                <dt>{t('offerte.wat')}</dt>
                <dd>{offerte?.eventNaam || '—'}</dd>
                <dt>{t('offerte.wanneer')}</dt>
                <dd>{datum(offerte?.eventDatum)}</dd>
                <dt>{t('offerte.waar')}</dt>
                <dd>{offerte?.locatie || '—'}</dd>
                <dt>{t('offerte.personen')}</dt>
                <dd>{offerte?.personen ? t('offerte.pax', { aantal: offerte.personen }) : '—'}</dd>
              </dl>
            </div>
          </section>

          <table className="je-offerteblad__tabel">
            <thead>
              <tr>
                <th>{t('offerte.kolom.omschrijving')}</th>
                <th className="je-offerteblad__num">{t('offerte.kolom.aantal')}</th>
                <th className="je-offerteblad__num">{t('offerte.kolom.eenheid')}</th>
                <th className="je-offerteblad__num">{t('offerte.kolom.btw')}</th>
                <th className="je-offerteblad__num">{t('offerte.kolom.bedrag')}</th>
              </tr>
            </thead>
            <tbody>
              {groepen.length === 0 ? (
                <tr>
                  <td colSpan={5}>{t('offerte.geen_regels')}</td>
                </tr>
              ) : null}
              {groepen.map((groep) => (
                <RubriekGroep key={groep.rubriek} groep={groep} geld={geld} t={t} />
              ))}
            </tbody>
          </table>

          <section className="je-offerteblad__totalen">
            <div className="je-offerteblad__rij">
              <span>{t('offerte.excl')}</span>
              <span>{geld(totalen.excl)}</span>
            </div>
            {totalen.btwRegels.map((r) => (
              <div key={r.percent} className="je-offerteblad__rij je-offerteblad__rij--btw">
                <span>{t('offerte.btw_op', { percent: r.percent, basis: geld(r.basis) })}</span>
                <span>{geld(r.btw)}</span>
              </div>
            ))}
            <div className="je-offerteblad__rij je-offerteblad__rij--eind">
              <span>{t('offerte.incl')}</span>
              <span>{geld(totalen.incl)}</span>
            </div>
            {totalen.optioneelExcl ? (
              <div className="je-offerteblad__rij je-offerteblad__rij--btw">
                <span>{t('offerte.optioneel_totaal')}</span>
                <span>{geld(totalen.optioneelExcl)}</span>
              </div>
            ) : null}
          </section>

          <section className="je-offerteblad__slot">
            {t('offerte.voorschot_zin', {
              deel: Math.round(VOORSCHOT_DEEL * 100),
              bedrag: geld(voorschotVan(totalen.excl)),
            })}
          </section>

          <footer className="je-offerteblad__voet">
            <div>
              <h2>{t('offerte.geldig')}</h2>
              <p style={{ margin: 0 }}>
                {t('offerte.geldig_zin', { dagen: GELDIG_DAGEN, datum: datum(offerte?.geldigTot) })}
              </p>
            </div>
            <div>
              <h2>{t('offerte.annulatie')}</h2>
              <ul>
                {t('offerte.annulatie_regels')
                  .split('|')
                  .map((regel) => (
                    <li key={regel}>{regel}</li>
                  ))}
              </ul>
            </div>
          </footer>
        </div>
        <Voet nummer={totaalPaginas} totaal={totaalPaginas} bedrijf={bedrijf} />
      </section>
    </article>
  )
}

/** De kopregel die op elke pagina herhaalt wie dit voorstel krijgt. */
function Kop({ tekst }) {
  if (!tekst) return null
  return <div className="je-vblad__kop">{tekst}</div>
}

/** De voetregel: het adres links, het paginanummer rechts. */
function Voet({ nummer, totaal, bedrijf }) {
  return (
    <div className="je-vblad__voet">
      <span>{bedrijf.web}</span>
      <span>
        {String(nummer).padStart(2, '0')} / {String(totaal).padStart(2, '0')}
      </span>
    </div>
  )
}

/**
 * Eén onderdeel: wat het is, wat erin zit, wat het kost.
 *
 * De prijs staat onderaan en apart. Dat is geen opmaak maar volgorde van
 * lezen: wie eerst het bedrag ziet, leest de beschrijving als verantwoording.
 * Wie eerst de beschrijving leest, leest het bedrag als prijs.
 */
function Onderdeel({ onderdeel, nummer, prijs, geld, t }) {
  const soort = soortVan(onderdeel.soort)
  return (
    <div className="je-vdeel">
      <span className="je-vblad__eyebrow">
        {nummer ? `${nummer} — ` : ''}
        {t(`voorstel.soort.${soort.key}`)}
      </span>
      <h2 className="je-vblad__titel">
        {onderdeel.titel}
        {onderdeel.accent ? <em className="je-vblad__script"> {onderdeel.accent}</em> : null}
      </h2>

      {onderdeel.tekst ? <p className="je-vdeel__tekst">{onderdeel.tekst}</p> : null}

      {onderdeel.punten.length ? (
        <ul className="je-vdeel__punten">
          {onderdeel.punten.map((punt) => (
            <li key={punt}>{punt}</li>
          ))}
        </ul>
      ) : null}

      {prijs != null ? (
        <div className="je-vdeel__prijs">
          <span className="je-vdeel__prijslabel">{t('voorstel.kostprijs')}</span>
          <span className="je-vdeel__prijsbedrag">{geld(prijs)}</span>
          <span className="je-vdeel__prijsnoot">{onderdeel.prijsNoot || t('voorstel.per_persoon')}</span>
        </div>
      ) : null}
    </div>
  )
}

function RubriekGroep({ groep, geld, t }) {
  return (
    <>
      <tr className="je-offerteblad__rubriek">
        <td colSpan={5}>{t(`offerte.rubriek.${groep.rubriek}`)}</td>
      </tr>
      {groep.regels.map((regel) => (
        <tr key={regel.id} className={regel.optioneel ? 'je-offerteblad__optioneel' : undefined}>
          <td>
            {regel.omschrijving || '—'}
            {regel.optioneel ? <span className="je-offerteblad__merkje">{t('offerte.optioneel')}</span> : null}
          </td>
          <td className="je-offerteblad__num">{regel.aantal}</td>
          <td className="je-offerteblad__num">{geld(regel.eenheidExcl)}</td>
          <td className="je-offerteblad__num">{regel.btwPercent}%</td>
          <td className="je-offerteblad__num">{geld(regelBedrag(regel))}</td>
        </tr>
      ))}
    </>
  )
}

/**
 * De gegevens van het huis.
 *
 * Staan hier en niet in de database: ze veranderen zelden, en een offerte die
 * bij het uitrollen zijn btw-nummer kwijt is omdat er een document ontbreekt,
 * is erger dan een regel code die iemand aanpast.
 */
export const BEDRIJF = {
  regels: ['JE Concept', 'Sint-Truiden', 'info@jeconcept.be'],
  web: 'www.jeconcept.be',
}
