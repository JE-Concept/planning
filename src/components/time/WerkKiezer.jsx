import { useMemo, useState } from 'react'
import { Field, Input, Select } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useEvents } from '@data/events'
import { werkKeuzes, werkVan } from '@lib/werkkeuze'

/**
 * Kies het event of de taak waar tijd op gaat.
 *
 * Eén component voor het urenscherm en voor de timer in de zijbalk, want het is
 * dezelfde vraag en het hoort dezelfde lijst te zijn. De lijst komt uit
 * `useEvents()`: dat abonnement staat al rond de hele schil, dus dit kost geen
 * extra vraag aan de databank.
 *
 * Een zoekveld erboven en niet alleen een keuzelijst: met tachtig lopende
 * dossiers is scrollen door een <select> geen kiezen meer.
 */
export default function WerkKiezer({ value, onChange, behoud = null, label, hint }) {
  const { t } = useTaal()
  const { events, tasks } = useEvents()
  const [zoek, setZoek] = useState('')

  const keuzes = useMemo(
    () => werkKeuzes({ events, tasks, zoek, behoud }),
    [events, tasks, zoek, behoud]
  )

  return (
    <>
      <Field label={t('uren.zoek_taak')}>
        <Input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder={t('uren.zoek_taak_hint')} />
      </Field>
      <Field label={label ?? t('uren.waarop')} hint={hint ?? t('uren.waarop_hint')}>
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('uren.kies_taak')}</option>
          {keuzes.map((k) => (
            <option key={k.id} value={k.id}>
              {k.sub ? `${k.sub} · ${k.titel}` : k.titel}
            </option>
          ))}
        </Select>
      </Field>
    </>
  )
}

/** Het echte event of de echte taak achter de keuze, voor wie hem wil opslaan. */
export function useWerk(id) {
  const { events, tasks } = useEvents()
  return useMemo(() => werkVan(id, { events, tasks }), [id, events, tasks])
}
