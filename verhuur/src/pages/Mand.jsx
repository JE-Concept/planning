import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BTW_VERHUUR, huurTotaal, regelPrijs } from '@lib/huurprijs'
import { afrekenen, mijnHuren, sessie } from '../lib/api'
import { dagenTussen } from '../lib/mand'
import { euro, korteDag, metBtw } from '../lib/weergave'
import Periode from '../onderdelen/Periode'
import Foto from '../onderdelen/Foto'
import Aantal from '../onderdelen/Aantal'
import { CENTRAAL, CONTACT, buitenVenster } from '../lib/instellingen'

/**
 * De mand, en de knop die naar Stripe gaat.
 *
 * ── Waarom hier bedragen staan die de server straks overdoet ─────────────
 * Omdat iemand moet kunnen zien wat hij gaat betalen vóór hij op betalen
 * klikt. Dat die som hier óók gemaakt wordt is geen dubbel werk maar een
 * controle: het is dezelfde motor (`src/lib/huurprijs.js`), en wijkt het
 * bedrag op de Stripe-pagina af van wat hier stond, dan is er iets grondig
 * mis en hoort dat op te vallen.
 *
 * Wat deze pagina níét doet, is dat bedrag meesturen. Ze stuurt
 * artikelnummers, aantallen en een periode. De server zoekt de prijzen zelf
 * op en rekent zelf na — want elk veld dat van hier komt, kan iemand met een
 * ontwikkelaarsconsole veranderen.
 *
 * ── Waarom leveren hier naar een offerte gaat ────────────────────────────
 * Leveren kan overal, en de prijs hangt af van de afstand (beslissing van
 * Jasper). Die prijs rekent de server nog niet uit, en een leverprijs die de
 * browser verzint, is een wens en geen bedrag. Wie laat leveren, maakt dus
 * van zijn mand een offerte; afhalen in Sint-Truiden betaal je meteen.
 */
export default function Mand({ opId, mand, zetAantal, weg, zetPeriode, leegmaken }) {
  const navigeer = useNavigate()
  const [klant, setKlant] = useState({ naam: '', email: '', telefoon: '', opmerking: '', bedrijf: '', ondernemingsnummer: '' })
  const [voorBedrijf, setVoorBedrijf] = useState(false)
  const [levering, setLevering] = useState('afhalen')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState(null)
  // Ingelogd: het adres en de korting komen van de server, niet uit het formulier.
  const [account, setAccount] = useState(null)

  useEffect(() => {
    if (!sessie()) return undefined
    let geldig = true
    mijnHuren()
      .then((uit) => {
        if (!geldig) return
        setAccount(uit)
        setKlant((oud) => ({ ...oud, email: uit.email, naam: oud.naam || uit.naam || '' }))
      })
      .catch(() => geldig && setAccount(null))
    return () => {
      geldig = false
    }
  }, [])

  const dagen = useMemo(() => dagenTussen(mand.van, mand.tot), [mand.van, mand.tot])

  const regels = useMemo(
    () =>
      mand.regels
        .map((r) => ({ r, artikel: opId.get(r.materiaalId) }))
        .filter(({ artikel }) => artikel)
        .map(({ r, artikel }) => ({
          artikel,
          aantal: r.aantal,
          prijs: regelPrijs({ materiaal: artikel, aantal: r.aantal, dagen, kortingPercent: account?.kortingPercent ?? 0 }),
        })),
    [mand.regels, opId, dagen, account?.kortingPercent]
  )

  const totaal = useMemo(() => huurTotaal(regels.map((x) => x.prijs)), [regels])
  /*
    De som met btw, zo opgebouwd dat ze optelt: huur min korting plus
    waarborg is precies wat de server afrekent (`teBetalen`).
  */
  const kortingMetBtw = metBtw(totaal.korting)
  const huurMetBtw = Math.round((totaal.inclBtw + kortingMetBtw) * 100) / 100

  /*
    Een artikel met een minimum aantal dagen hoort hier al tegengehouden te
    worden en niet pas door de server. Een "nee" na het klikken op betalen
    voelt als een storing; een "nee" ernaast is een gesprek.
  */
  const teKort = regels.filter(({ artikel }) => dagen.length > 0 && dagen.length < (artikel.minDagen ?? 1))

  const bedrijfOk = !voorBedrijf || klant.bedrijf.trim().length > 1

  // Een ingetypte datum buiten het venster: de periode zegt al waarom.
  const kanBetalen =
    levering === 'afhalen' &&
    regels.length > 0 &&
    dagen.length > 0 &&
    teKort.length === 0 &&
    !buitenVenster(mand.van) &&
    bedrijfOk &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(klant.email)

  const betalen = async () => {
    setBezig(true)
    setFout(null)
    try {
      const uit = await afrekenen({
        van: mand.van,
        tot: mand.tot || mand.van,
        regels: mand.regels,
        klant: voorBedrijf ? klant : { ...klant, bedrijf: '', ondernemingsnummer: '' },
      })
      // Geen router-navigatie: Stripe staat op een ander adres.
      window.location.href = uit.url
    } catch (err) {
      setFout(melding(err, opId))
      setBezig(false)
    }
  }

  // Leveren: de mand gaat als tekst mee naar het offerteformulier.
  const naarOfferte = () => {
    const lijst = regels.map(({ artikel, aantal }) => `${aantal} × ${artikel.naam}`).join('\n')
    navigeer('/offerte', {
      state: {
        datum: mand.van,
        wat: `Graag geleverd${dagen.length ? `, van ${mand.van} tot en met ${mand.tot || mand.van}` : ''}:\n${lijst}\n\nLeveradres: `,
      },
    })
  }

  if (regels.length === 0) {
    return (
      <section className="vh__wrap vh__pagina vh__leeg-mand">
        <h1 className="je-sect__title vh__h1">Je mand is leeg</h1>
        <p>Zoek iets uit in het aanbod, dan reken je hier af.</p>
        <Link to="/aanbod" className="je-btn je-btn--primary je-btn--md">
          Naar het aanbod
        </Link>
      </section>
    )
  }

  return (
    <section className="vh__wrap vh__pagina vh__mand" aria-labelledby="mand-kop">
      <h1 id="mand-kop" className="je-sect__title vh__h1">
        Je <em>mand</em>
      </h1>

      <div className="vh__mand-raster">
        <div className="vh__mand-stappen">
          <div className="vh__stap">
            <h2 className="vh__stap-titel">
              <span className="vh__stap-n">1</span>Wanneer en wat
            </h2>
            <Periode van={mand.van} tot={mand.tot} onWijzig={zetPeriode} titel="Je periode" />
            <ul className="vh__mandlijst">
              {regels.map(({ artikel, aantal, prijs }) => (
                <li key={artikel.id} className="vh__mandregel">
                  <Foto artikel={artikel} />
                  <span className="vh__mandregel-naam">
                    <Link to={`/artikel/${artikel.id}`}>{artikel.naam}</Link>
                    {artikel.waarborg ? (
                      <span className="vh__klein">waarborg {euro(artikel.waarborg)} per stuk</span>
                    ) : null}
                  </span>
                  <Aantal waarde={aantal} min={1} klein naam={`Aantal ${artikel.naam}`} onWijzig={(n) => zetAantal(artikel.id, n)} />
                  <span className="vh__mandregel-bedrag">
                    {dagen.length > 0 ? euro(metBtw(prijs.netto)) : <span className="vh__klein">kies een datum</span>}
                  </span>
                  <button type="button" className="je-btn je-btn--ghost je-btn--sm" onClick={() => weg(artikel.id)}>
                    Weg
                  </button>
                </li>
              ))}
            </ul>
            {teKort.length > 0 ? (
              <p className="je-notice je-notice--danger">
                {teKort.map(({ artikel }) => artikel.naam).join(', ')} huur je minstens{' '}
                {Math.max(...teKort.map(({ artikel }) => artikel.minDagen))} dagen. Verleng je periode of haal het uit je
                mand.
              </p>
            ) : null}
          </div>

          <fieldset className="vh__stap">
            <legend className="vh__stap-titel">
              <span className="vh__stap-n">2</span>Hoe krijg je het?
            </legend>
            <label className={`vh__keuze${levering === 'afhalen' ? ' vh__keuze--aan' : ''}`}>
              <input
                type="radio"
                name="levering"
                className="je-choice__native"
                checked={levering === 'afhalen'}
                onChange={() => setLevering('afhalen')}
              />
              <span className={`je-radio${levering === 'afhalen' ? ' je-radio--on' : ''}`} aria-hidden="true">
                {levering === 'afhalen' ? <span className="je-radio__dot" /> : null}
              </span>
              <span className="vh__keuze-tekst">
                <span className="vh__keuze-kop">
                  <span>Afhalen in {CONTACT.plaats}</span>
                  <span className="vh__gratis">Gratis</span>
                </span>
                <span className="vh__klein">
                  {CONTACT.afhaaluren[0].toUpperCase() + CONTACT.afhaaluren.slice(1)}
                  {mand.van ? `; ophalen vanaf ${korteDag(mand.van)}` : ''}. Je krijgt het adres bij je bevestiging.
                </span>
              </span>
            </label>
            <label className={`vh__keuze${levering === 'leveren' ? ' vh__keuze--aan' : ''}`}>
              <input
                type="radio"
                name="levering"
                className="je-choice__native"
                checked={levering === 'leveren'}
                onChange={() => setLevering('leveren')}
              />
              <span className={`je-radio${levering === 'leveren' ? ' je-radio--on' : ''}`} aria-hidden="true">
                {levering === 'leveren' ? <span className="je-radio__dot" /> : null}
              </span>
              <span className="vh__keuze-tekst">
                <span className="vh__keuze-kop">
                  <span>Geleverd en opgehaald</span>
                  <span>op offerte</span>
                </span>
                <span className="vh__klein">We leveren overal; de prijs hangt af van de afstand.</span>
              </span>
            </label>
            {levering === 'leveren' ? (
              <div className="je-notice vh__leveren">
                <span className="je-notice__title">Levering via een offerte</span>
                Online rekenen we de leverprijs nog niet uit. Stuur je mand als offerteaanvraag met je adres erbij, dan
                krijg je binnen één werkdag de prijs met levering, en ook opbouw ter plaatse als je dat wil.
                <button type="button" className="je-btn je-btn--secondary je-btn--sm" onClick={naarOfferte}>
                  Offerte vragen met deze mand
                </button>
              </div>
            ) : null}
          </fieldset>

          <form className="vh__stap vh__klantvorm" onSubmit={(e) => e.preventDefault()}>
            <h2 className="vh__stap-titel">
              <span className="vh__stap-n">3</span>Jouw gegevens
            </h2>
            <label className="je-choice">
              <input type="checkbox" className="je-choice__native" checked={voorBedrijf} onChange={(e) => setVoorBedrijf(e.target.checked)} />
              <span className={`je-switch${voorBedrijf ? ' je-switch--on' : ''}`} aria-hidden="true">
                <span className="je-switch__knob" />
              </span>
              <span>
                Ik huur voor een bedrijf
                <span className="je-choice__desc">De factuur komt op naam van je bedrijf, met je btw-nummer.</span>
              </span>
            </label>
            <div className="vh__velden">
              {voorBedrijf ? (
                <>
                  <label className="je-field">
                    <span className="je-field__label">
                      Bedrijfsnaam <span className="je-field__req">*</span>
                    </span>
                    <input
                      className="je-input je-input--boxed"
                      value={klant.bedrijf}
                      onChange={(e) => setKlant({ ...klant, bedrijf: e.target.value })}
                      autoComplete="organization"
                    />
                  </label>
                  <label className="je-field">
                    <span className="je-field__label">Btw-nummer</span>
                    <input
                      className="je-input je-input--boxed"
                      value={klant.ondernemingsnummer}
                      placeholder="BE 0123.456.789"
                      onChange={(e) => setKlant({ ...klant, ondernemingsnummer: e.target.value })}
                    />
                  </label>
                </>
              ) : null}
              <label className="je-field">
                <span className="je-field__label">Naam</span>
                <input
                  className="je-input je-input--boxed"
                  value={klant.naam}
                  onChange={(e) => setKlant({ ...klant, naam: e.target.value })}
                  autoComplete="name"
                />
              </label>
              <label className="je-field">
                <span className="je-field__label">
                  E-mail <span className="je-field__req">*</span>
                </span>
                <input
                  id="email"
                  className="je-input je-input--boxed"
                  type="email"
                  required
                  value={klant.email}
                  onChange={(e) => setKlant({ ...klant, email: e.target.value })}
                  autoComplete="email"
                  readOnly={Boolean(account)}
                  title={account ? 'Je bent ingelogd met dit adres.' : undefined}
                />
              </label>
              <label className="je-field">
                <span className="je-field__label">Telefoon</span>
                <input
                  className="je-input je-input--boxed"
                  type="tel"
                  value={klant.telefoon}
                  onChange={(e) => setKlant({ ...klant, telefoon: e.target.value })}
                  autoComplete="tel"
                />
              </label>
              <label className="je-field vh__veld-breed">
                <span className="je-field__label">Iets wat we moeten weten</span>
                <textarea
                  className="je-input je-input--boxed"
                  rows={2}
                  value={klant.opmerking}
                  onChange={(e) => setKlant({ ...klant, opmerking: e.target.value })}
                />
              </label>
            </div>
            {!account ? (
              <p className="vh__klein">
                Klant bij ons met een korting?{' '}
                <Link to="/login" className="vh__inlink">
                  Log in
                </Link>
                , dan rekenen we ze mee.
              </p>
            ) : null}
          </form>
        </div>

        <aside className="vh__overzicht" aria-label="Overzicht">
          <div className="je-card vh__overzicht-kaart">
            <h2 className="je-card__title">Overzicht</h2>
            {dagen.length > 0 ? (
              <span className="vh__klein">
                {korteDag(mand.van)} tot en met {korteDag(mand.tot || mand.van)} · {dagen.length}{' '}
                {dagen.length === 1 ? 'dag' : 'dagen'}
              </span>
            ) : null}

            {dagen.length > 0 ? (
              <dl className="je-sum vh__som">
                <div className="je-sum__row">
                  <dt>
                    Huur, {dagen.length} {dagen.length === 1 ? 'dag' : 'dagen'}
                  </dt>
                  <dd>{euro(huurMetBtw)}</dd>
                </div>
                {totaal.korting > 0 ? (
                  <div className="je-sum__row je-sum__row--discount">
                    <dt>Je klantenkorting ({account?.kortingPercent}%)</dt>
                    <dd>− {euro(kortingMetBtw)}</dd>
                  </div>
                ) : null}
                <div className="je-sum__row">
                  <dt>{levering === 'afhalen' ? 'Afhalen' : 'Levering'}</dt>
                  <dd>{levering === 'afhalen' ? 'gratis' : 'op offerte'}</dd>
                </div>
                {totaal.waarborg > 0 ? (
                  <div className="je-sum__deposit">
                    <div className="je-sum__row">
                      <dt>
                        Waarborg <span className="je-sum__back">krijg je terug</span>
                      </dt>
                      <dd>{euro(totaal.waarborg)}</dd>
                    </div>
                    <div className="je-sum__deposit-note">Buiten de btw; teruggestort na een onbeschadigde teruggave.</div>
                  </div>
                ) : null}
                <div className="je-sum__total">
                  <dt>Te betalen</dt>
                  <dd>{euro(totaal.teBetalen)}</dd>
                </div>
                <div className="je-sum__row">
                  <dt>Waarvan btw {BTW_VERHUUR}%</dt>
                  <dd>{euro(totaal.btw)}</dd>
                </div>
                <p className="je-sum__foot">Huur excl. btw {euro(totaal.exclBtw)}.</p>
              </dl>
            ) : (
              <p className="je-notice je-notice--warning">Kies eerst een periode, dan rekenen we het voor je uit.</p>
            )}

            {fout ? <p className="je-notice je-notice--danger">{fout}</p> : null}

            {/*
              Wie betaalt, moet vooraf kunnen lezen waarmee hij akkoord gaat: wat de
              waarborg is, wanneer hij terugkomt, wat annuleren kost. Vlak boven de
              knop, en niet ergens in de voet waar niemand vóór het betalen kijkt.
            */}
            <p className="vh__klein vh__akkoord">
              Met betalen ga je akkoord met onze{' '}
              <a href={CENTRAAL.voorwaarden} className="vh__inlink" target="_blank" rel="noopener">
                algemene voorwaarden
              </a>
              . Hoe we met je gegevens omgaan, staat in ons{' '}
              <a href={CENTRAAL.privacy} className="vh__inlink" target="_blank" rel="noopener">
                privacybeleid
              </a>
              .
            </p>

            {levering === 'afhalen' ? (
              <button type="button" className="je-btn je-btn--primary je-btn--lg vh__breed" onClick={betalen} disabled={!kanBetalen || bezig}>
                {bezig ? 'Een ogenblik…' : `Betalen${dagen.length ? ` — ${euro(totaal.teBetalen)}` : ''}`}
              </button>
            ) : (
              <button type="button" className="je-btn je-btn--primary je-btn--lg vh__breed" onClick={naarOfferte}>
                Offerte vragen met deze mand
              </button>
            )}
            {levering === 'afhalen' && !bedrijfOk ? <p className="vh__klein">Vul de naam van je bedrijf in.</p> : null}
            <button type="button" className="je-btn je-btn--ghost je-btn--sm" onClick={leegmaken}>
              Mand leegmaken
            </button>
            <p className="vh__klein">
              Je betaalt bij Stripe. Wij zien je kaartgegevens niet. Zodra de betaling rond is, staat het materiaal op
              jouw naam.
            </p>
          </div>
          <p className="vh__klein">
            Vragen over je huur? Mail naar <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>; we antwoorden binnen
            één werkdag.
          </p>
        </aside>
      </div>
    </section>
  )
}

/**
 * Van een foutcode naar iets wat een mens begrijpt.
 *
 * Een server die "niet_beschikbaar" zegt, heeft gelijk maar helpt niemand. De
 * bezoeker wil weten wát er niet kan en wat hij dan wel kan doen — en bij een
 * tekort is dat meestal gewoon bellen, want bijhuren kan vaak.
 */
function melding(err, opId) {
  const naam = err.uit?.artikel ? (opId.get(err.uit.artikel)?.naam ?? err.uit.artikel) : 'Een artikel'
  switch (err.code) {
    case 'niet_beschikbaar':
      return `${naam} is er niet genoeg op deze datum — nog ${err.uit.vrij} vrij. Pas het aantal aan, kies een andere datum, of mail ons: vaak kunnen we bijhuren.`
    case 'te_kort':
      return `${naam} huur je minstens ${err.uit.minDagen} dagen.`
    case 'niet_los_te_huren':
      return `${naam} regelen we liever even samen. Vraag een offerte, dan bellen we je.`
    case 'geen_email':
      return 'Vul een geldig e-mailadres in — daar sturen we je bevestiging naartoe.'
    case 'geen_datum':
    case 'omgekeerde_datum':
    case 'rare_periode':
      return 'De gekozen periode klopt niet. Kies een begin- en einddatum.'
    case 'te_vroeg':
      return `Online boeken kan vanaf ${err.uit.minDagenVooraf} dagen vooraf. Heb je het eerder nodig? Mail ons op ${CONTACT.email} — last minute regelen we per mail, en vaak kan het.`
    case 'te_ver_vooruit':
      return `Zo ver vooruit boeken we liever even samen. Vraag een offerte, dan leggen we het vast.`
    case 'betaling_niet_gestart':
      return 'De betaalpagina ging niet open. Probeer het opnieuw; er is nog niets afgerekend.'
    default:
      return `Er ging iets mis. Probeer het opnieuw, of mail ons op ${CONTACT.email}.`
  }
}
