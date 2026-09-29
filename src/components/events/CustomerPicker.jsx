import { useState } from 'react'
import { formatVat, vatHint } from '@lib/klanten'
import { Button, Field, Input, Select } from '@components/ds'
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
export default function CustomerPicker({ customerId, customerName, onChange, required = false }) {
  const { customers } = useCustomers()
  const toast = useToast()
  const [nieuw, setNieuw] = useState(null)
  const [busy, setBusy] = useState(false)

  const gekozen = customers.find((c) => c.id === customerId) ?? null
  const zichtbaar = customers.filter((c) => !c.archived || c.id === customerId)

  const kies = (waarde) => {
    if (waarde === NIEUWE_KLANT) {
      // De naam die er al staat is bijna altijd de naam van de klant; die
      // meenemen scheelt hem opnieuw typen.
      setNieuw({ name: customerName ?? '', vatNumber: '', email: '' })
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
      })
      onChange({ customerId: id, customerName: naam })
      setNieuw(null)
      toast.success(`${naam} staat nu bij de klanten.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Field
        label="Klant"
        required={required}
        hint={
          gekozen
            ? `Gekoppeld — historiek en facturatie staan op de fiche van ${gekozen.name}.`
            : 'Kies een klant, maak er een aan, of typ een naam voor een particulier.'
        }
      >
        <Select
          // Eigen naam voor het veld, net als bij het zijpaneel van een taak:
          // het zichtbare label is "Klant" en dat staat ook op het vrije veld
          // eronder, dus met alleen dat label weet een voorleesprogramma — en
          // een browsertest — niet welk van de twee het is.
          aria-label="Klant van dit event"
          value={nieuw ? NIEUWE_KLANT : (customerId ?? '')}
          onChange={(e) => kies(e.target.value)}
          options={[
            { value: '', label: 'Geen klant uit de lijst' },
            ...zichtbaar.map((c) => ({ value: c.id, label: c.name })),
            { value: NIEUWE_KLANT, label: '+ Nieuwe klant aanmaken…' },
          ]}
        />
      </Field>

      {nieuw ? (
        <div className="je-klantnieuw">
          <Field label="Naam van de klant" required>
            <Input
              value={nieuw.name}
              onChange={(e) => setNieuw((x) => ({ ...x, name: e.target.value }))}
              placeholder="bv. Blum België"
              autoFocus
            />
          </Field>
          <Field label="Btw-nummer" hint={vatHint(nieuw.vatNumber)}>
            <Input
              value={nieuw.vatNumber}
              onChange={(e) => setNieuw((x) => ({ ...x, vatNumber: e.target.value }))}
              onBlur={(e) => setNieuw((x) => ({ ...x, vatNumber: formatVat(e.target.value) }))}
              placeholder="BE 0123.456.789"
            />
          </Field>
          <Field label="E-mail" hint="De rest van de gegevens vul je aan op de klantfiche.">
            <Input
              type="email"
              value={nieuw.email}
              onChange={(e) => setNieuw((x) => ({ ...x, email: e.target.value }))}
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="ghost" size="sm" onClick={() => setNieuw(null)}>
              Annuleren
            </Button>
            <Button size="sm" loading={busy} disabled={!nieuw.name.trim()} onClick={maak}>
              Klant aanmaken
            </Button>
          </div>
        </div>
      ) : null}

      {!customerId && !nieuw ? (
        <Field label="Klantnaam" hint="Zonder fiche: geen historiek, geen btw-nummer.">
          <Input
            value={customerName ?? ''}
            onChange={(e) => onChange({ customerId: '', customerName: e.target.value })}
            placeholder="bv. Familie Peeters"
          />
        </Field>
      ) : null}
    </div>
  )
}
