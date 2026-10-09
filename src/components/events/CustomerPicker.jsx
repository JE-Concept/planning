import { useState } from 'react'
import { formatVat, vatHint } from '@lib/klanten'
import { Acties, Field, Input, Select } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { createCustomer, useCustomers } from '@data/customers'

/** De waarde in de keuzelijst die geen klant is maar een opdracht. */
export const NIEUWE_KLANT = '__nieuw'

/**
 * De klant van een event kiezen — of hem hier meteen aanmaken.
 *
 * Een aanvraag komt binnen per telefoon en de klant staat nog nergens. Wie dan
 * eerst naar Klanten moet, een fiche moet maken en terug moet komen, typt in de
 * praktijk gewoon een naam in het vrije veld. Dat is hoe de klantenlijst leeg
 * bleef terwijl er honderd events in stonden: het event kende wel een naam,
 * maar geen klant, en dus was er geen historiek en geen btw-nummer.
 *
 * Daarom staat het aanmaken hier, in twee velden. Het vrije veld blijft
 * bestaan — "Familie Peeters" is geen bedrijf en hoeft geen fiche — maar het
 * is niet langer de weg van de minste weerstand.
 *
 * Wat naar buiten gaat is altijd het paar: `customerId` voor de koppeling en
 * `customerName` als kopie, want Firestore kan niet joinen en een lijst die per
 * rij de klant moet opzoeken, leest zich scheef. Een hernoeming werkt die kopie
 * server-side bij (`spreadCustomerRename`).
 */
export default function CustomerPicker({ customerId, customerName, onChange, required = false, voorstel = null }) {
  const { customers } = useCustomers()
  const { t } = useTaal()
  const toast = useToast()
  const [nieuw, setNieuw] = useState(null)
  const [busy, setBusy] = useState(false)

  const gekozen = customers.find((c) => c.id === customerId) ?? null
  const zichtbaar = customers.filter((c) => !c.archived || c.id === customerId)

  const kies = (waarde) => {
    if (waarde === NIEUWE_KLANT) {
      // De naam die er al staat is bijna altijd de naam van de klant; die
      // meenemen scheelt hem opnieuw typen. Kwam het event uit een mail, dan
      // staan het adres en het nummer van de afzender er ook al klaar.
      setNieuw({ name: customerName ?? '', vatNumber: '', email: voorstel?.email ?? '', phone: voorstel?.phone ?? '' })
      return
    }
    setNieuw(null)
    const klant = customers.find((c) => c.id === waarde)
    onChange({ customerId: waarde, customerName: klant?.name ?? customerName })
  }

  const maak = async () => {
    const naam = nieuw.name.trim()
    if (!naam) return
    setBusy(true)
    try {
      const id = await createCustomer({
        name: naam,
        vatNumber: formatVat(nieuw.vatNumber),
        email: nieuw.email.trim(),
        phone: nieuw.phone.trim(),
      })
      onChange({ customerId: id, customerName: naam })
      setNieuw(null)
      toast.success(t('klant.kiezen.toegevoegd', { naam }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Field
        label={t('events.fiche.klant')}
        required={required}
        hint={
          gekozen
            ? t('klant.kiezen.gekoppeld', { naam: gekozen.name })
            : t('klant.kiezen.hint')
        }
      >
        <Select
          // Eigen naam voor het veld, net als bij het zijpaneel van een taak:
          // het zichtbare label is "Klant" en dat staat ook op het vrije veld
          // eronder, dus met alleen dat label weet een voorleesprogramma — en
          // een browsertest — niet welk van de twee het is.
          aria-label={t('klant.kiezen.veld')}
          value={nieuw ? NIEUWE_KLANT : (customerId ?? '')}
          onChange={(e) => kies(e.target.value)}
          options={[
            { value: '', label: t('klant.kiezen.geen') },
            ...zichtbaar.map((c) => ({ value: c.id, label: c.name })),
            { value: NIEUWE_KLANT, label: t('klant.kiezen.nieuw') },
          ]}
        />
      </Field>

      {nieuw ? (
        <div className="je-klantnieuw">
          <Field label={t('klant.kiezen.naam')} required>
            <Input
              value={nieuw.name}
              onChange={(e) => setNieuw((x) => ({ ...x, name: e.target.value }))}
              placeholder={t('klant.kiezen.naam_hint')}
              autoFocus
            />
          </Field>
          <Field label={t('klant.btw')} hint={vatHint(nieuw.vatNumber)}>
            <Input
              value={nieuw.vatNumber}
              onChange={(e) => setNieuw((x) => ({ ...x, vatNumber: e.target.value }))}
              onBlur={(e) => setNieuw((x) => ({ ...x, vatNumber: formatVat(e.target.value) }))}
              placeholder="BE 0123.456.789"
            />
          </Field>
          <Field label={t('klant.email')} hint={t('klant.kiezen.email_hint')}>
            <Input
              type="email"
              value={nieuw.email}
              onChange={(e) => setNieuw((x) => ({ ...x, email: e.target.value }))}
            />
          </Field>
          <Field label={t('klant.telefoon')}>
            <Input
              type="tel"
              value={nieuw.phone}
              onChange={(e) => setNieuw((x) => ({ ...x, phone: e.target.value }))}
            />
          </Field>
          <Acties
            plaats="rij"
            terug={{ onClick: () => setNieuw(null) }}
            hoofd={{ label: t('klant.kiezen.aanmaken'), bezig: busy, uit: !nieuw.name.trim(), onClick: maak }}
          />
        </div>
      ) : null}

      {!customerId && !nieuw ? (
        <Field label={t('klant.kiezen.vrije_naam')} hint={t('klant.kiezen.vrije_hint')}>
          <Input
            value={customerName ?? ''}
            onChange={(e) => onChange({ customerId: '', customerName: e.target.value })}
            placeholder={t('klant.kiezen.vrije_plaats')}
          />
        </Field>
      ) : null}
    </div>
  )
}
