import { useState } from 'react'
import { Button, Dialog } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { agendaAdres, useAgendaSleutel, wisAgendaSleutel, zetAgendaSleutel } from '@data/kalenderfeed'

/**
 * De eventdatums in je eigen agenda.
 *
 * Eén adres om te plakken, en verder niets: geen account koppelen, geen
 * toestemmingsscherm. Waarom het zo en niet via de Google Calendar API gaat,
 * staat bovenaan `src/lib/ical.js`.
 *
 * Twee dingen staan er met opzet bij, en die zijn allebei onaangenaam:
 *
 *   Het adres is de sleutel. Een agenda-abonnement kan geen aanmeldscherm
 *   tonen, dus wie het adres heeft, ziet de events. Dat moet iemand wéten voor
 *   hij het in een groepschat plakt — vandaar de waarschuwing en de knop om er
 *   een streep door te halen.
 *
 *   Google haalt op wanneer het Google uitkomt, en dat kan uren duren. Wie
 *   denkt dat zijn agenda actueel is terwijl ze dat niet is, is slechter af dan
 *   wie geen agenda heeft. Dus staat het er.
 */
export default function AgendaAbonnement({ open, onClose }) {
  const { uid } = useAuth()
  const { t } = useTaal()
  const toast = useToast()
  const { laadt, sleutel } = useAgendaSleutel(uid)
  const [bezig, setBezig] = useState(false)

  const adres = agendaAdres(sleutel)

  const maak = async () => {
    setBezig(true)
    try {
      await zetAgendaSleutel(uid)
      toast.success(sleutel ? t('kalender.vernieuwd') : t('kalender.gemaakt'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const stop = async () => {
    setBezig(true)
    try {
      await wisAgendaSleutel(uid)
      toast.success(t('kalender.gestopt'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(adres)
      toast.success(t('kalender.gekopieerd'))
    } catch {
      // Zonder klembord (oudere browser, geen https) blijft het adres staan om
      // met de hand te selecteren; een foutmelding helpt daar niet bij.
      toast.error(t('kalender.kopieren_lukt_niet'))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('kalender.titel')}
      width={560}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('alg.sluiten')}
        </Button>
      }
    >
      <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>{t('kalender.uitleg')}</p>

      {laadt ? null : adres ? (
        <>
          <div
            style={{
              marginTop: 'var(--space-5)',
              padding: 'var(--space-4)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 2,
              font: 'var(--type-caption)',
              fontFamily: 'var(--font-mono, monospace)',
              wordBreak: 'break-all',
              background: 'var(--surface-2, transparent)',
            }}
          >
            {adres}
          </div>

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button size="sm" iconLeft="copy" onClick={kopieer}>
              {t('kalender.kopieer')}
            </Button>
            <Button size="sm" variant="secondary" onClick={maak} loading={bezig}>
              {t('kalender.vernieuw')}
            </Button>
            <Button size="sm" variant="ghost" onClick={stop} loading={bezig}>
              {t('kalender.stop')}
            </Button>
          </div>

          <ol style={{ marginTop: 'var(--space-5)', paddingLeft: '1.2em', font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
            <li>{t('kalender.stap1')}</li>
            <li>{t('kalender.stap2')}</li>
            <li>{t('kalender.stap3')}</li>
          </ol>

          <p style={{ marginTop: 'var(--space-4)', font: 'var(--type-caption)', fontWeight: 400, color: 'var(--text-3)' }}>
            {t('kalender.waarschuwing')}
          </p>
          <p style={{ marginTop: 'var(--space-2)', font: 'var(--type-caption)', fontWeight: 400, color: 'var(--text-3)' }}>
            {t('kalender.traag')}
          </p>
        </>
      ) : (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <Button onClick={maak} loading={bezig} iconLeft="calendar-days">
            {t('kalender.maak')}
          </Button>
        </div>
      )}
    </Dialog>
  )
}
