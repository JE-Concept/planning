import { useMemo, useState } from 'react'
import { Field, Input, Select } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useEvents } from '@data/events'
import { useMijnEvents } from '@data/social-events'
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
/**
 * Waar de lijst vandaan komt, en dat hangt af van wie je bent.
 *
 * Het bureau leest de events uit `tasks` — daar staat alles op. Een medewerker
 * mag die collectie niet lezen, want de bedragen staan erin en Firestore kan
 * geen velden verbergen. Hij krijgt de kale kopie van de events waarop hij
 * zelf staat, en dat is precies waarop hij uren boekt.
 *
 * Beide hooks worden altijd aangeroepen — React staat niet toe ze om de beurt
 * over te slaan — maar de hook die er niet toe doet, krijgt niets te doen.
 */
function useWerkBronnen() {
  const { uid, profile } = useAuth()
  const ploeg = profile?.role === 'staff'

  const { events: alle, tasks } = useEvents()
  const { events: eigen } = useMijnEvents(ploeg ? uid : null)

  return useMemo(
    () =>
      ploeg
        ? { events: eigen.map((e) => ({ ...e, name: e.name ?? e.title })), tasks: [] }
        : { events: alle, tasks },
    [ploeg, eigen, alle, tasks]
  )
}

export default function WerkKiezer({ value, onChange, behoud = null, label, hint }) {
  const { t } = useTaal()
  const { events, tasks } = useWerkBronnen()
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
  const { events, tasks } = useWerkBronnen()
  return useMemo(() => werkVan(id, { events, tasks }), [id, events, tasks])
}
