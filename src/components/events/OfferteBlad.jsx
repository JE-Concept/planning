import { GELDIG_DAGEN, VOORSCHOT_DEEL, perRubriek, regelBedrag, totalenVan, voorschotVan } from '@lib/offerte'
import { useTaal } from '@context/taal-context'

/**
 * De offerte zoals de klant ze ziet.
 *
 * Eén layout voor alles: het voorbeeld in de app, de afdruk, de PDF en straks
 * de publieke goedkeuringspagina. Dit blad rekent zelf niets uit — de totalen
 * komen uit `@lib/offerte`, waar ze getest zijn — en het bewaart niets. Het
 * tekent wat het krijgt.
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

export default function OfferteBlad({ offerte, bedrijf = BEDRIJF }) {
  const { t, locale } = useTaal()
  const regels = offerte?.regels ?? []
  const totalen = totalenVan(regels)
  const groepen = perRubriek(regels)
  const geld = (v) => euro(v, locale)

  const datum = (waarde) => {
    const d = waarde?.toDate?.() ?? (waarde ? new Date(waarde) : null)
    return d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
      : '—'
  }

  return (
    <article className="je-offerteblad">
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
          <p style={{ margin: 0 }}>{t('offerte.geldig_zin', { dagen: GELDIG_DAGEN, datum: datum(offerte?.geldigTot) })}</p>
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
    </article>
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
}
