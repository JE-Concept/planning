import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VERWERKERS, herspelen, standVan, useMessaging } from '@data/messaging'
import { Badge, Button, Spinner } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { formatDateTime } from '@lib/dates'

/**
 * Wat er van buiten binnenkwam, en wat ermee gebeurde.
 *
 * Eén rij per bericht, met per verwerker een stand. Dit is het antwoord op
 * "is die aanvraag van Wintermoods wel aangekomen": ze staat hier, met de
 * kaart die ervan gemaakt is — of met de fout en het aantal pogingen. Een
 * bericht dat drie keer mislukte, heeft een mens nodig: de knop Herspelen
 * laat de verwerker opnieuw lopen zodra de oorzaak weg is.
 *
 * Herspelen gaat niet door de browser maar door een functie: de log is
 * onveranderlijk voor wie hier kijkt, en dat hoort zo te blijven.
 */
const TOON = { klaar: 'success', fout: 'danger', overgeslagen: 'neutral', wacht: 'warning' }

export default function MessagingPaneel() {
  const { t } = useTaal()
  const toast = useToast()
  const { berichten, laadt, fout } = useMessaging()
  const [bezig, setBezig] = useState(null)

  if (laadt) {
    return (
      <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Spinner /> {t('alg.laden')}
      </div>
    )
  }

  const herspeel = async (id, verwerker) => {
    setBezig(`${id}:${verwerker}`)
    try {
      const uit = await herspelen(id, verwerker)
      toast.success(t(uit?.stand === 'klaar' ? 'messaging.herspeeld' : 'messaging.herspeeld_fout'))
    } catch {
      toast.error(t('messaging.herspelen_mislukt'))
    } finally {
      setBezig(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{t('messaging.titel')}</span>
          <span className="je-panel__sub">{t('messaging.sub', { aantal: berichten.length })}</span>
        </div>

        {fout ? (
          <p className="je-muted-caption" style={{ padding: 'var(--space-5) var(--space-6)', margin: 0 }}>
            {t('messaging.geen_toegang')}
          </p>
        ) : berichten.length === 0 ? (
          <p className="je-muted-caption" style={{ padding: 'var(--space-5) var(--space-6)', margin: 0 }}>
            {t('messaging.leeg')}
          </p>
        ) : (
          <ul className="je-messaging" aria-label={t('messaging.titel')}>
            {berichten.map((b) => (
              <li key={b.id} className="je-messaging__rij">
                <div className="je-messaging__kop">
                  <span className="je-messaging__bron">{b.bron}</span>
                  <span className="je-messaging__soort">{b.soort}</span>
                  <span className="je-muted-caption je-messaging__tijd">
                    {b.ontvangen ? formatDateTime(b.ontvangen) : '—'}
                  </span>
                </div>
                <div className="je-messaging__detail">
                  <span className="je-muted-caption">{t('messaging.sleutel')}: {b.sleutel}</span>
                  {b.inhoud?.naam || b.inhoud?.email ? (
                    <span className="je-muted-caption">{b.inhoud?.naam || b.inhoud?.email}</span>
                  ) : null}
                </div>
                <div className="je-messaging__standen">
                  {VERWERKERS.map((v) => {
                    const s = standVan(b, v)
                    const sleutel = `${b.id}:${v}`
                    return (
                      <div key={v} className="je-messaging__stand">
                        <span className="je-muted-caption">{t(`messaging.verwerker.${v}`)}</span>
                        <Badge tone={TOON[s.stand] ?? 'neutral'} dot>
                          {t(`messaging.stand.${s.stand}`)}
                          {s.stand === 'fout' && s.pogingen ? ` · ${t('messaging.pogingen', { aantal: s.pogingen })}` : ''}
                        </Badge>
                        {s.stand === 'fout' && s.fout ? <span className="je-muted-caption je-messaging__fout">{s.fout}</span> : null}
                        {s.stand === 'klaar' && s.taskId ? (
                          <Link to={`/events/${s.taskId}`} className="je-messaging__link">
                            {t('messaging.naar_kaart')}
                          </Link>
                        ) : null}
                        {s.stand === 'fout' || s.stand === 'klaar' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={bezig === sleutel}
                            disabled={bezig !== null}
                            onClick={() => herspeel(b.id, v)}
                          >
                            {t('messaging.herspelen')}
                          </Button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="je-muted-caption" style={{ padding: '0 var(--space-6) var(--space-5)', margin: 0, maxWidth: '68ch' }}>
          {t('messaging.uitleg')}
        </p>
      </section>
    </div>
  )
}
