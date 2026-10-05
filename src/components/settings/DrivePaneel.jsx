import { useEffect, useState } from 'react'
import { driveIdUit, useDriveConfig, zetDrive } from '@data/documents'
import { Button, Input, Spinner } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'

/**
 * Waar de documenten staan: één gedeelde Drive.
 *
 * Bestanden bij een event of een klant gaan niet naar Storage maar naar een
 * gedeelde Drive van JE Concept, in een map per event en een map per klant.
 * Daar kan iedereen van het team ook zonder JE Plan bij, en een grondplan dat
 * iemand vanop zijn telefoon in Drive zet, staat na "Vernieuwen" gewoon op de
 * fiche. Hier staat alleen welke Drive dat is. De toegang zelf — de
 * service-account van de functies als beheerder van die Drive — zet je in
 * Google Workspace, niet hier; wat hier staat is geen geheim.
 */
export default function DrivePaneel() {
  const { t } = useTaal()
  const toast = useToast()
  const config = useDriveConfig()
  const [waarde, setWaarde] = useState('')
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    if (config) setWaarde(config.driveId ?? '')
  }, [config])

  if (!config) {
    return (
      <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Spinner /> {t('alg.laden')}
      </div>
    )
  }

  const bewaar = async (e) => {
    e.preventDefault()
    setBezig(true)
    try {
      await zetDrive(waarde)
      toast.success(t('drive.bewaard'))
    } catch {
      toast.error(t('drive.mislukt'))
    } finally {
      setBezig(false)
    }
  }

  const id = driveIdUit(waarde)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{t('drive.titel')}</span>
          <span className="je-panel__sub">{config.driveId ? t('drive.sub_gezet') : t('drive.sub_leeg')}</span>
        </div>

        <form
          onSubmit={bewaar}
          style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <label htmlFor="drive-id" style={{ font: 'var(--type-body-sm)' }}>
            {t('drive.veld')}
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Input
              id="drive-id"
              value={waarde}
              onChange={(e) => setWaarde(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              style={{ flex: '1 1 320px', minWidth: 0 }}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" variant="primary" size="md" loading={bezig} disabled={bezig || id === (config.driveId ?? '')}>
              {t('alg.opslaan')}
            </Button>
          </div>
          {id && id !== waarde.trim() ? (
            <p className="je-muted-caption" style={{ margin: 0 }}>
              {t('drive.herkend', { id })}
            </p>
          ) : null}
        </form>

        <div
          className="je-muted-caption"
          style={{ padding: '0 var(--space-6) var(--space-5)', margin: 0, maxWidth: '68ch', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <p style={{ margin: 0 }}>{t('drive.uitleg')}</p>
          <ol style={{ margin: 0, paddingLeft: '1.2em', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>{t('drive.stap1')}</li>
            <li>{t('drive.stap2')}</li>
            <li>{t('drive.stap3')}</li>
          </ol>
        </div>
      </section>
    </div>
  )
}
