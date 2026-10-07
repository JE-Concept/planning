import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BTW_VERHUUR, huurTotaal, regelPrijs } from '@lib/huurprijs'
import { afrekenen, mijnHuren, sessie } from '../lib/api'
import { dagenTussen } from '../lib/mand'
import Periode from '../onderdelen/Periode'
import { CENTRAAL, CONTACT } from '../lib/instellingen'

const euro = (n) => `€ ${Number(n ?? 0).toFixed(2).replace('.', ',')}`

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
 */
export default function Mand({ opId, mand, zetAantal, weg, zetPeriode, leegmaken }) {
  const [klant, setKlant] = useState({ naam: '', email: '', telefoon: '', opmerking: '' })
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
    Een artikel met een minimum aantal dagen hoort hier al tegengehouden te
    worden en niet pas door de server. Een "nee" na het klikken op betalen
    voelt als een storing; een "nee" ernaast is een gesprek.
  */
  const teKort = regels.filter(({ artikel }) => dagen.length > 0 && dagen.length < (artikel.minDagen ?? 1))

  const kanBetalen =
    regels.length > 0 && dagen.length > 0 && teKort.length === 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(klant.email)

  const betalen = async () => {
    setBezig(true)
    setFout(null)
    try {
      const uit = await afrekenen({
        van: mand.van,
        tot: mand.tot || mand.van,
        regels: mand.regels,
        klant,
      })
      // Geen router-navigatie: Stripe staat op een ander adres.
      window.location.href = uit.url
    } catch (err) {
      setFout(melding(err, opId))
      setBezig(false)
    }
  }

  if (regels.length === 0) {
    return (
      <section className="vh__leeg-mand">
        <h1>Je mand is leeg</h1>
        <p>Zoek iets uit in het aanbod, dan reken je hier af.</p>
        <Link to="/" className="je-btn je-btn--primary je-btn--md">
          Naar het aanbod
        </Link>
      </section>
    )
  }

  return (
    <section className="vh__mand">
      <h1>Je mand</h1>

      <Periode van={mand.van} tot={mand.tot} onWijzig={zetPeriode} />

      <ul className="vh__mandlijst">
        {regels.map(({ artikel, aantal, prijs }) => (
          <li key={artikel.id} className="vh__mandregel">
            <span className="vh__mandregel-naam">
              <Link to={`/artikel/${artikel.id}`}>{artikel.naam}</Link>
              {artikel.waarborg ? (
                <span className="vh__klein">waarborg {euro(artikel.waarborg)} per stuk</span>
              ) : null}
            </span>
            <input
              className="je-input vh__mandregel-aantal"
              type="number"
              min="0"
              value={aantal}
              aria-label={`Aantal ${artikel.naam}`}
              onChange={(e) => zetAantal(artikel.id, e.target.value)}
            />
            <span className="vh__mandregel-bedrag">
              {dagen.length > 0 ? euro(prijs.netto) : <span className="vh__klein">kies een datum</span>}
            </span>
            <button type="button" className="je-btn je-btn--ghost je-btn--sm" onClick={() => weg(artikel.id)}>
              Weg
            </button>
          </li>
        ))}
      </ul>

      {teKort.length > 0 ? (
        <p className="vh__waarschuwing">
          {teKort.map(({ artikel }) => artikel.naam).join(', ')} huur je minstens{' '}
          {Math.max(...teKort.map(({ artikel }) => artikel.minDagen))} dagen. Verleng je periode of haal
          het uit je mand.
        </p>
      ) : null}

      {dagen.length > 0 ? (
        <dl className="vh__som">
          <div>
            <dt>Huur, {dagen.length} {dagen.length === 1 ? 'dag' : 'dagen'}</dt>
            <dd>{euro(totaal.exclBtw)}</dd>
          </div>
          <div>
            <dt>Btw {BTW_VERHUUR}%</dt>
            <dd>{euro(totaal.btw)}</dd>
          </div>
          {totaal.waarborg > 0 ? (
            <div>
              <dt>
                Waarborg <span className="vh__klein">krijg je terug</span>
              </dt>
              <dd>{euro(totaal.waarborg)}</dd>
            </div>
          ) : null}
          {totaal.korting > 0 ? (
            <div>
              <dt>Je klantenkorting ({account?.kortingPercent}%)</dt>
              <dd>− {euro(totaal.korting)}</dd>
            </div>
          ) : null}
          <div className="vh__som-totaal">
            <dt>Te betalen</dt>
            <dd>{euro(totaal.teBetalen)}</dd>
          </div>
        </dl>
      ) : (
        <p className="vh__waarschuwing">Kies eerst een periode, dan rekenen we het voor je uit.</p>
      )}

      <form className="vh__klantvorm" onSubmit={(e) => e.preventDefault()}>
        <h2>Jouw gegevens</h2>
        <div className="vh__velden">
          <label>
            <span className="je-caps">Naam</span>
            <input
              className="je-input"
              value={klant.naam}
              onChange={(e) => setKlant({ ...klant, naam: e.target.value })}
              autoComplete="name"
            />
          </label>
          <label>
            <span className="je-caps">E-mail</span>
            <input
              className="je-input"
              type="email"
              required
              value={klant.email}
              onChange={(e) => setKlant({ ...klant, email: e.target.value })}
              autoComplete="email"
              readOnly={Boolean(account)}
              title={account ? 'Je bent ingelogd met dit adres.' : undefined}
            />
          </label>
          <label>
            <span className="je-caps">Telefoon</span>
            <input
              className="je-input"
              type="tel"
              value={klant.telefoon}
              onChange={(e) => setKlant({ ...klant, telefoon: e.target.value })}
              autoComplete="tel"
            />
          </label>
          <label className="vh__veld-breed">
            <span className="je-caps">Iets wat we moeten weten</span>
            <textarea
              className="je-input"
              rows={2}
              value={klant.opmerking}
              onChange={(e) => setKlant({ ...klant, opmerking: e.target.value })}
            />
          </label>
        </div>
      </form>

      {fout ? <p className="vh__waarschuwing">{fout}</p> : null}

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

      <div className="vh__mandknoppen">
        <button type="button" className="je-btn je-btn--ghost je-btn--md" onClick={leegmaken}>
          Mand leegmaken
        </button>
        <button type="button" className="je-btn je-btn--primary je-btn--md" onClick={betalen} disabled={!kanBetalen || bezig}>
          {bezig ? 'Een ogenblik…' : `Betalen${dagen.length ? ` — ${euro(totaal.teBetalen)}` : ''}`}
        </button>
      </div>

      {!account ? (
        <p className="vh__klein">
          Klant bij ons met een korting? <Link to="/login" className="vh__inlink">Log in</Link>, dan rekenen we ze mee.
        </p>
      ) : null}

      <p className="vh__klein">
        Je betaalt bij Stripe. Wij zien je kaartgegevens niet. Zodra de betaling rond is, staat het
        materiaal op jouw naam.
      </p>
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
