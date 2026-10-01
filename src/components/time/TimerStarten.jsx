import { useState } from 'react'
import { Button, Dialog, Field, Input } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { startTimer } from '@data/time'
import WerkKiezer, { useWerk } from './WerkKiezer'

/**
 * De timer starten vanaf waar je ook staat.
 *
 * Eén vraag: waaraan werk je. Die vraag is verplicht — de knop blijft uit tot
 * er iets gekozen is, en de start weigert ook zonder. Tijd zonder event of taak
 * komt op geen enkele kostenplaats terecht, en dan staat er aan het eind van de
 * maand een hoop gewerkte tijd die bij geen enkel dossier hoort.
 *
 * De omschrijving is wél optioneel: die vul je meestal pas in als je stopt en
 * weet wat je gedaan hebt.
 */
export default function TimerStarten({ uid, onClose }) {
  const { t } = useTaal()
  const toast = useToast()
  const [keuze, setKeuze] = useState('')
  const [omschrijving, setOmschrijving] = useState('')
  const [bezig, setBezig] = useState(false)
  const werk = useWerk(keuze)

  const start = async () => {
    if (!werk) {
      toast.error(t('uren.kies_taak'))
      return
    }
    setBezig(true)
    try {
      await startTimer({ uid, task: werk, description: omschrijving.trim() })
      toast.success(t('timer.loopt'))
      onClose()
    } catch (err) {
      toast.error(err.message)
      setBezig(false)
    }
  }

  return (
    <Dialog
      open
      title={t('timer.starten')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('alg.annuleren')}
          </Button>
          <Button variant="primary" iconLeft="play" onClick={start} loading={bezig} disabled={!keuze}>
            {t('timer.start')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <WerkKiezer value={keuze} onChange={setKeuze} label={t('timer.waaraan')} />
        <Field label={t('uren.omschrijving')}>
          <Input
            value={omschrijving}
            onChange={(e) => setOmschrijving(e.target.value)}
            placeholder={t('uren.omschrijving_hint')}
          />
        </Field>
      </div>
    </Dialog>
  )
}
