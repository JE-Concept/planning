import { useState } from 'react'
import { dayKey } from '@lib/dates'
import { Acties, Dialog, Field, Input, Textarea } from '@components/ds'
import ObjectKiezer from '@components/common/ObjectKiezer'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { maakNotitie, wijzigNotitie, zetNotitieKoppelingen } from '@data/notities'

/**
 * Een notitie schrijven of bijwerken.
 *
 * `koppelingen` is wat er al vast staat wanneer je hem opent vanaf een klant
 * of een event: een notitie die je bij Blum begint, gaat over Blum — dat
 * opnieuw moeten kiezen is een stap die mensen overslaan, en dan hangt de
 * notitie nergens aan.
 *
 * Een titel is niet verplicht. Een notitie is vaker één zin dan een document,
 * en een verplichte titel wordt dan die ene zin twee keer.
 */
export default function NotitieBewerken({ notitie = null, koppelingen: begin = [], onClose, onBewaard }) {
  const { t } = useTaal()
  const { profile, uid } = useAuth()
  const toast = useToast()

  const [titel, setTitel] = useState(notitie?.titel ?? '')
  const [tekst, setTekst] = useState(notitie?.tekst ?? '')
  // dayKey rekent lokaal; toISOString gaf tussen middernacht en twee uur
  // 's nachts de dag ervoor.
  const [datum, setDatum] = useState(notitie?.datum ?? dayKey(new Date()))
  const [koppelingen, setKoppelingen] = useState(notitie?.koppelingen ?? begin)
  const [bezig, setBezig] = useState(false)

  const leeg = !titel.trim() && !tekst.trim()

  const bewaar = async () => {
    if (leeg || bezig) return
    setBezig(true)
    try {
      if (notitie) {
        await wijzigNotitie(notitie.id, { titel, tekst, datum }, uid)
        await zetNotitieKoppelingen(notitie.id, koppelingen, uid)
        onBewaard?.(notitie.id)
      } else {
        const id = await maakNotitie({ titel, tekst, datum, koppelingen, auteur: profile })
        onBewaard?.(id)
      }
      toast.success(t('notities.bewaard'))
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={notitie ? t('notities.bewerken') : t('notities.nieuw')}
      width={576}
      footer={
        <Acties terug={{ onClick: onClose }} hoofd={{ label: t('notities.bewaren'), onClick: bewaar, bezig, uit: leeg }} />
      }
    >
      <div className="space-y-3 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field label={t('notities.veld.titel')}>
            <Input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={t('notities.veld.titel_hint')} />
          </Field>
          <label className="block">
            <span className="label">{t('notities.veld.datum')}</span>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="field" />
          </label>
        </div>

        <Field label={t('notities.veld.tekst')}>
          <Textarea
            rows={6}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder={t('notities.veld.tekst_hint')}
            onKeyDown={(e) => {
              // Zoals bij de eventnotities: Ctrl/Cmd+Enter bewaart.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                bewaar()
              }
            }}
          />
        </Field>

        <Field label={t('notities.veld.over')}>
          <ObjectKiezer waarde={koppelingen} onChange={setKoppelingen} />
        </Field>
      </div>
    </Dialog>
  )
}
