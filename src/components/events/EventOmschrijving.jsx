import { useEffect, useRef, useState } from 'react'
import { Textarea } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { updateEvent } from '@data/events'

/**
 * De omschrijving van een event: waar het over gaat, in gewone zinnen.
 *
 * Dit is het dossier uit ClickUp — draaiboeken zijn nu eenmaal proza, en wat
 * niet in een veld past ("boomgaard ligt schuin, vloer nodig onder de
 * ceremonie") staat hier. Het stond achter een tabblad én achter een potlood,
 * en dus las niemand het. Nu staat het midden op de fiche, meteen leesbaar en
 * meteen aan te vullen.
 *
 * Bewaren gebeurt zodra je eruit klikt, net als bij de velden erboven. Er is
 * geen bewaarknop: een knop die je toch altijd indrukt, vraagt alleen om
 * vergeten te worden. Wie ondertussen van buitenaf iets ziet binnenkomen —
 * iemand anders schrijft in hetzelfde dossier — krijgt dat te zien zolang hij
 * er zelf niet in staat te typen.
 */
export default function EventOmschrijving({ ev }) {
  const { t } = useTaal()
  const toast = useToast()
  const veld = useRef(null)
  const [tekst, setTekst] = useState(ev.description ?? '')

  useEffect(() => {
    if (document.activeElement !== veld.current) setTekst(ev.description ?? '')
  }, [ev.description])

  const klaar = () => {
    if (tekst === (ev.description ?? '')) return
    updateEvent(ev.id, { description: tekst }).catch((err) => toast.error(err.message))
  }

  return (
    <section className="je-panel je-omschrijving">
      <span className="je-caps">{t('events.omschrijving.titel')}</span>
      <Textarea
        ref={veld}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        onBlur={klaar}
        onKeyDown={(e) => {
          // Escape gooit weg wat er sinds het openen getypt is; dat is het
          // enige "annuleren" dat er nog is.
          if (e.key === 'Escape') {
            setTekst(ev.description ?? '')
            e.currentTarget.blur()
          }
        }}
        rows={Math.min(16, Math.max(4, tekst.split('\n').length + 1))}
        aria-label={t('events.omschrijving.titel')}
        placeholder={t('events.omschrijving.plaatshouder')}
      />
    </section>
  )
}
