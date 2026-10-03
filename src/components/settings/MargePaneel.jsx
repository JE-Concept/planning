import { STATUTEN } from '@lib/marge'
import { useKosten, zetTarief } from '@data/kosten'
import { Input, Spinner } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'

/**
 * De uurkost per statuut.
 *
 * Eén getal per statuut, en verder niets. Wat hier staat is geen loon maar een
 * kengetal: wat een uur van iemand in dat statuut de zaak kost, alles
 * inbegrepen — bijdragen, verzekering, kledij, de rit. Daarmee krijgt de
 * marge van een event een loonkant, zonder dat er ergens een bedrag aan een
 * naam hangt. Wie wat verdient, staat in AAPI en blijft daar.
 *
 * Leeg laten mag. Dan telt dat statuut niet mee in de kost en zegt de marge
 * op de eventfiche dat ze onvolledig is — beter dan een te lage kost die
 * niemand opmerkt.
 */
export default function MargePaneel() {
  const { t } = useTaal()
  const toast = useToast()
  const { tarieven, laadt } = useKosten()

  if (laadt) {
    return (
      <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Spinner /> {t('alg.laden')}
      </div>
    )
  }

  const bewaar = (statuut, waarde) =>
    zetTarief(statuut, waarde).catch(() => toast.error(t('marge.tarief_mislukt')))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{t('marge.tarieven.titel')}</span>
          <span className="je-panel__sub">{t('marge.tarieven.sub')}</span>
        </div>

        <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {STATUTEN.map((statuut) => (
            <div
              key={statuut}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}
            >
              <label
                htmlFor={`tarief-${statuut}`}
                style={{ flex: '1 1 200px', minWidth: 0, font: 'var(--type-body-sm)' }}
              >
                {t(`aapi.statuut.${statuut}`)}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span className="je-muted-caption">€</span>
                <Input
                  id={`tarief-${statuut}`}
                  type="number"
                  step="0.5"
                  min="0"
                  style={{ width: 110 }}
                  defaultValue={tarieven[statuut] ?? ''}
                  placeholder={t('marge.niet_ingesteld')}
                  onBlur={(e) => bewaar(statuut, e.target.value)}
                />
                <span className="je-muted-caption">{t('marge.per_uur')}</span>
              </div>
            </div>
          ))}
        </div>

        <p
          className="je-muted-caption"
          style={{ padding: '0 var(--space-6) var(--space-5)', margin: 0, maxWidth: '68ch' }}
        >
          {t('marge.tarieven.uitleg')}
        </p>
      </section>
    </div>
  )
}
