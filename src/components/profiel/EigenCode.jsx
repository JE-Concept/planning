import { useState } from 'react'
import { Button, Field, Input } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { wijzigEigenCode } from '@data/ploeg'

/**
 * Je eigen cijfercode wijzigen.
 *
 * Staat alleen op het profiel van wie mét een code binnengekomen is; wie met
 * Google aanmeldt heeft er geen. De huidige code staat er niet bij — die
 * weten we hier niet, en moeten we hier ook niet weten: wijzigen is iets
 * anders dan nalezen.
 *
 * De waarschuwing over de bankkaart staat er een tweede keer. Dat is geen
 * vergissing: dit is het andere moment waarop iemand een code kiest, en wie
 * hem hier wijzigt heeft de eerste waarschuwing maanden geleden gelezen.
 */
export default function EigenCode() {
  const { t } = useTaal()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [bezig, setBezig] = useState(false)

  const bewaar = async () => {
    setBezig(true)
    try {
      await wijzigEigenCode(code)
      setCode('')
      toast.success(t('ploeg.code_gewijzigd'))
    } catch (err) {
      const sleutel = String(err?.message ?? '')
      toast.error(sleutel.startsWith('ploeg.') ? t(sleutel) : sleutel)
    } finally {
      setBezig(false)
    }
  }

  return (
    <section className="je-card je-voorkeuren">
      <h2 style={{ font: 'var(--type-h4)', margin: 0 }}>{t('ploeg.mijn_code')}</h2>
      <p className="je-muted-caption" style={{ margin: 0 }}>{t('ploeg.mijn_code_uitleg')}</p>
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Field label={t('ploeg.nieuwe_code')} className="je-medewerker__adres">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-label={t('ploeg.nieuwe_code')}
            className="je-codeveld"
          />
        </Field>
        <Button size="sm" onClick={bewaar} loading={bezig} disabled={code.length !== 4}>
          {t('ploeg.code_bewaren')}
        </Button>
      </div>
    </section>
  )
}
