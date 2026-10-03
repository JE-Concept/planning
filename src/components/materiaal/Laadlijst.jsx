import { useMemo, useState } from 'react'
import { addDays, dayKey, formatDate, startOfDay } from '@lib/dates'
import { Button, Icon } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useReservaties } from '@data/materiaal'

/**
 * De laadlijst: wat er op één dag buiten gaat, en wat er terugkomt.
 *
 * ── Waarom één dag en geen week ───────────────────────────────────────────
 * Omdat een camion per dag geladen wordt. Wie 's ochtends het magazijn
 * binnenstapt, wil één blad: dit gaat vandaag mee, dit komt vandaag terug,
 * en voor wie. Een weekoverzicht is een planning; dit is een werklijst.
 *
 * ── Waarom het per klant gegroepeerd is en niet per artikel ───────────────
 * Omdat je per adres laadt. Zes statafels voor Peeters en vier voor Blum zijn
 * niet "tien statafels": het zijn twee stapels, op twee plekken in de camion,
 * en de tweede stapel mag niet mee naar het eerste adres.
 *
 * ── Waarom het printbaar is ───────────────────────────────────────────────
 * Een telefoon in een nat magazijn is een telefoon die valt. Een A4 op een
 * klembord met een potlood erbij is wat er werkelijk gebruikt wordt, en wat
 * aangevinkt is, blijft aangevinkt.
 */
export default function Laadlijst() {
  const { t } = useTaal()
  const [dag, setDag] = useState(() => dayKey(startOfDay()))

  // Eén dag ervoor en erna meevragen: een reservatie die vandaag eindigt,
  // komt vandaag terug — en die vraag is "tot >= vandaag", niet "van".
  const { reservaties } = useReservaties({ van: dag, tot: dag })

  const { uit, terug } = useMemo(() => {
    const telt = (r) => r.status === 'vast' || r.status === 'uit'
    const uit = reservaties.filter((r) => telt(r) && r.van === dag)
    const terug = reservaties.filter((r) => telt(r) && (r.tot ?? r.van) === dag)
    return { uit: perKlant(uit), terug: perKlant(terug) }
  }, [reservaties, dag])

  const schuif = (n) => setDag(dayKey(addDays(new Date(`${dag}T12:00:00`), n)))

  return (
    <section className="je-panel je-laadlijst">
      <div className="je-panel__head je-laadlijst__kop">
        <span className="je-eyebrow">{t('laadlijst.titel')}</span>
        <span className="je-laadlijst__dag">
          <Button size="sm" variant="ghost" onClick={() => schuif(-1)} aria-label={t('laadlijst.vorige')}>
            <Icon name="chevron-left" size={14} />
          </Button>
          <input
            type="date"
            className="je-input"
            value={dag}
            onChange={(e) => setDag(e.target.value || dayKey(startOfDay()))}
            aria-label={t('laadlijst.datum')}
          />
          <Button size="sm" variant="ghost" onClick={() => schuif(1)} aria-label={t('laadlijst.volgende')}>
            <Icon name="chevron-right" size={14} />
          </Button>
        </span>
        <span className="je-panel__right">
          <Button size="sm" variant="secondary" iconLeft="printer" onClick={() => window.print()}>
            {t('laadlijst.afdrukken')}
          </Button>
        </span>
      </div>

      {/* Alleen bij het afdrukken zichtbaar: het blad moet zeggen van welke dag het is. */}
      <h2 className="je-laadlijst__printkop">
        {t('laadlijst.printkop', { dag: formatDate(`${dag}T12:00:00`) })}
      </h2>

      <div className="je-laadlijst__kolommen">
        <Kolom titel={t('laadlijst.gaat_uit')} groepen={uit} leeg={t('laadlijst.niets_uit')} />
        <Kolom titel={t('laadlijst.komt_terug')} groepen={terug} leeg={t('laadlijst.niets_terug')} />
      </div>
    </section>
  )
}

/** Gegroepeerd op wie het is, met de artikelen eronder op naam. */
function perKlant(rijen) {
  const kaart = new Map()
  for (const r of rijen) {
    const wie = r.eventNaam || r.klantNaam || (r.orderId ? `Online · ${r.orderId.slice(0, 6)}` : '—')
    const groep = kaart.get(wie) ?? []
    groep.push(r)
    kaart.set(wie, groep)
  }
  return [...kaart.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wie, regels]) => ({
      wie,
      regels: regels.sort((a, b) => (a.materiaalNaam ?? '').localeCompare(b.materiaalNaam ?? '')),
    }))
}

function Kolom({ titel, groepen, leeg }) {
  return (
    <div className="je-laadlijst__kolom">
      <h3 className="je-caps">{titel}</h3>
      {groepen.length === 0 ? (
        <p className="je-muted-caption">{leeg}</p>
      ) : (
        groepen.map(({ wie, regels }) => (
          <div key={wie} className="je-laadlijst__groep">
            <div className="je-laadlijst__wie">{wie}</div>
            <ul>
              {regels.map((r) => (
                <li key={r.id}>
                  {/* Een leeg vakje om af te vinken; op papier is dat de hele interface. */}
                  <span className="je-laadlijst__vakje" aria-hidden="true" />
                  <span className="je-laadlijst__aantal">{r.aantal}×</span>
                  <span>{r.materiaalNaam}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
