import { useMemo, useState } from 'react'
import { dagenVan } from '@lib/eventdagen'
import { kanErbij } from '@lib/voorraad'
import { Acties, Button, EmptyState, Icon, Select } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import {
  markeerTerug,
  markeerUit,
  reserveer,
  useEventReservaties,
  useMateriaal,
  useReservaties,
  verwijderReservatie,
} from '@data/materiaal'

/**
 * Het materiaal dat voor dit event vastligt.
 *
 * ── Waarom dit een echte reservatie is en geen lijstje op de fiche ────────
 * Omdat dezelfde voorraad van twee kanten aangesproken wordt: hier, en
 * straks door een aanvraag van de verhuursite. Een lijstje op het event zou
 * nergens samenkomen met die andere kant, en dan ziet niemand een dubbele
 * boeking tot de camion half geladen is. Wat je hier vastlegt, staat meteen
 * in de kalender van het magazijn.
 *
 * ── Waarom een tekort niet tegengehouden wordt ────────────────────────────
 * Je kunt hier meer vastleggen dan er staat. Dat is met opzet: wie het nodig
 * heeft, huurt bij of belt de andere klant, en een slot dat niet opengaat
 * levert een reservatie op een papiertje op. Wat je wél krijgt is de
 * waarschuwing vóór je het doet, en daarna het conflict op het
 * materiaalscherm tot het opgelost is.
 */
export default function EventMateriaal({ event }) {
  const { t } = useTaal()
  const toast = useToast()

  const dagen = useMemo(() => dagenVan(event), [event])
  const van = dagen[0] ?? null
  const tot = dagen[dagen.length - 1] ?? van

  const { materiaal, opId } = useMateriaal()
  const mijn = useEventReservaties(event?.id)
  const { perMateriaal } = useReservaties({ van, tot })

  const [kiezen, setKiezen] = useState('')
  const [aantal, setAantal] = useState(1)
  const [bezig, setBezig] = useState(false)

  const gekozen = opId[kiezen] ?? null

  /*
    Of het past, gerekend zonder wat dit event zelf al vastlegde — anders
    telt een stuk dat hier al staat tegen zichzelf wanneer je er een
    bijzet.
  */
  const past = useMemo(() => {
    if (!gekozen || !van) return null
    const andere = (perMateriaal.get(gekozen.id) ?? []).filter((r) => r.eventId !== event?.id)
    return kanErbij({ materiaal: gekozen, van, tot, aantal, reservaties: andere })
  }, [gekozen, van, tot, aantal, perMateriaal, event?.id])

  if (!van) {
    return <EmptyState title={t('eventmat.geen_datum')} description={t('eventmat.geen_datum_uitleg')} />
  }

  const leggVast = async () => {
    if (!gekozen) return
    setBezig(true)
    try {
      await reserveer({
        materiaal: gekozen,
        van,
        tot,
        aantal,
        eventId: event.id,
        eventNaam: event.name ?? event.title ?? null,
      })
      setKiezen('')
      setAantal(1)
    } catch {
      toast.error(t('eventmat.mislukt'))
    } finally {
      setBezig(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{t('eventmat.titel')}</span>
          <span className="je-panel__sub">{t('eventmat.periode', { aantal: dagen.length, dagen: dagen.length })}</span>
          <span className="je-panel__right">{t('eventmat.stuks', { aantal: mijn.reduce((s, r) => s + (r.aantal ?? 0), 0) })}</span>
        </div>

        {mijn.length === 0 ? (
          <p className="je-muted-caption" style={{ padding: 'var(--space-5) var(--space-6)', margin: 0 }}>
            {t('eventmat.nog_niets')}
          </p>
        ) : (
          mijn.map((r) => (
            <div key={r.id} className="je-resvrij">
              <span className="je-resvrij__aantal">{r.aantal}×</span>
              <span className="je-resvrij__wie">
                <span className="je-resvrij__naam">{r.materiaalNaam}</span>
                <span className="je-resvrij__onder">
                  {t('eventmat.van_tot', { van: r.van, tot: r.tot })}
                  {r.teruggebrachtOp ? ` · ${t('eventmat.terug_op', { dag: r.teruggebrachtOp })}` : ''}
                </span>
              </span>
              <Stand stand={r.status} />
              <span className="je-resvrij__acties">
                {r.status === 'vast' ? (
                  <Button size="sm" variant="secondary" onClick={() => markeerUit(r.id)}>
                    {t('eventmat.uit')}
                  </Button>
                ) : null}
                {r.status === 'uit' ? (
                  <Button size="sm" variant="secondary" onClick={() => markeerTerug(r.id, new Date().toISOString().slice(0, 10))}>
                    {t('eventmat.terug')}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => verwijderReservatie(r.id)}>
                  {t('alg.verwijderen')}
                </Button>
              </span>
            </div>
          ))
        )}
      </section>

      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{t('eventmat.erbij')}</span>
        </div>
        <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label className="je-caps" htmlFor="stuk">{t('eventmat.welk_stuk')}</label>
            <Select
              id="stuk"
              value={kiezen}
              onChange={(e) => setKiezen(e.target.value)}
              options={[
                { value: '', label: t('eventmat.kies') },
                ...materiaal.map((m) => ({ value: m.id, label: `${m.naam} (${m.aantal}×)` })),
              ]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label className="je-caps" htmlFor="hoeveel">{t('eventmat.hoeveel')}</label>
            <input
              id="hoeveel"
              className="je-input"
              type="number"
              min="1"
              value={aantal}
              onChange={(e) => setAantal(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 90 }}
            />
          </div>
          <Acties plaats="rij" hoofd={{ label: t('eventmat.vastleggen'), uit: !gekozen || bezig, onClick: leggVast }} />
        </div>

        {past && !past.kan ? (
          <p className="je-materiaal__alarm" style={{ margin: '0 var(--space-6) var(--space-5)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Icon name="alert-triangle" size={15} />
              {t('eventmat.te_weinig', { vrij: past.vrij, gevraagd: past.gevraagd })}
            </span>
          </p>
        ) : past ? (
          <p className="je-muted-caption" style={{ padding: '0 var(--space-6) var(--space-5)', margin: 0 }}>
            {t('eventmat.past', { vrij: past.vrij })}
          </p>
        ) : null}
      </section>
    </div>
  )
}

/** Dezelfde standenreeks als in het design system — zie Reservatiestand. */
function Stand({ stand }) {
  const { t } = useTaal()
  const klasse =
    stand === 'optie' ? 'optie' : stand === 'uit' ? 'bezig' : stand === 'terug' ? 'klaar' : stand === 'geannuleerd' ? 'weg' : 'vast'
  return (
    <span className={`je-resv je-resv--${klasse}`}>
      <span className="je-resv__dot" />
      {t(`eventmat.stand.${stand ?? 'vast'}`)}
    </span>
  )
}
