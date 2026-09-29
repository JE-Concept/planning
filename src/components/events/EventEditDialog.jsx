import { useEffect, useMemo, useState } from 'react'
import { dayKey, fromDateInput } from '@lib/dates'
import { missingForOffer } from '@lib/pipeline'
import { Button, Checkbox, Dialog, Field, Input, Select } from '@components/ds'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useCustomers } from '@data/customers'
import { updateEvent } from '@data/events'

const num = (v) => (v === '' || v == null ? null : Number(v))

/**
 * De fiche bewerken: alles wat een aanvraag een rapporteerbaar event maakt.
 * Klant, datum, gasten en offerte staan bovenaan — die zijn verplicht vanaf
 * de offertestap.
 */
export default function EventEditDialog({ open, onClose, ev }) {
  const { brands, profiles } = useWorkspace()
  const { customers } = useCustomers()
  const toast = useToast()
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setF({
      title: ev.title ?? '',
      customerId: ev.customerId ?? '',
      customerName: ev.customerName ?? '',
      eventDate: ev.eventDate ? dayKey(ev.eventDate) : '',
      pax: ev.pax ?? '',
      kids: ev.kids ?? '',
      location: ev.location ?? '',
      formule: ev.formule ?? '',
      quoteAmount: ev.quoteAmount ?? '',
      brandId: ev.brandId ?? '',
      eventType: ev.eventType ?? '',
      assignees: ev.assignees ?? [],
    })
  }, [open, ev])

  const team = useMemo(
    () => profiles.filter((p) => p.active !== false && p.role !== 'staff' && p.role !== 'guest'),
    [profiles]
  )

  if (!open || !f) return null
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const missing = ev.statusName === 'request' ? [] : missingForOffer({ ...f, customerName: f.customerName, eventDate: f.eventDate, pax: num(f.pax), quoteAmount: num(f.quoteAmount) })

  const save = async () => {
    if (!f.title.trim()) return
    setBusy(true)
    try {
      const date = fromDateInput(f.eventDate)
      await updateEvent(ev.id, {
        title: f.title.trim(),
        customerId: f.customerId || null,
        customerName: f.customerName.trim() || null,
        eventDate: date,
        // Oude schermen (Vandaag, het klassieke bord) lezen de deadline.
        ...(ev.dueDate || date ? { dueDate: date ?? ev.dueDate } : {}),
        pax: num(f.pax),
        kids: num(f.kids),
        location: f.location.trim() || null,
        formule: f.formule.trim() || null,
        quoteAmount: num(f.quoteAmount),
        budget: num(f.quoteAmount),
        brandId: f.brandId || null,
        eventType: f.eventType.trim() || null,
        assignees: f.assignees,
      })
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-5)' }

  return (
    <Dialog open={open} onClose={onClose} title="Fiche bewerken" width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <Field label="Naam" required>
          <Input value={f.title} onChange={set('title')} />
        </Field>

        <div style={grid}>
          <Field label="Klant" required hint={f.customerId ? 'Gekoppeld aan de klantenlijst' : 'Kies een klant of typ een naam'}>
            <Select
              value={f.customerId}
              onChange={(e) => {
                const k = customers.find((c) => c.id === e.target.value)
                setF((x) => ({ ...x, customerId: e.target.value, customerName: k?.name ?? x.customerName }))
              }}
              options={[{ value: '', label: 'Geen klant uit de lijst' }, ...customers.filter((c) => !c.archived || c.id === f.customerId).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>
          {!f.customerId ? (
            <Field label="Klantnaam">
              <Input value={f.customerName} onChange={set('customerName')} placeholder="bv. Familie Peeters" />
            </Field>
          ) : null}
          <Field label="Datum event" required>
            <Input type="date" value={f.eventDate} onChange={set('eventDate')} />
          </Field>
        </div>

        <div style={grid}>
          <Field label="Gasten" required>
            <Input type="number" min="0" value={f.pax} onChange={set('pax')} />
          </Field>
          <Field label="Waarvan kinderen">
            <Input type="number" min="0" value={f.kids} onChange={set('kids')} />
          </Field>
          <Field label="Offerte (€)" required>
            <Input type="number" min="0" step="1" value={f.quoteAmount} onChange={set('quoteAmount')} />
          </Field>
        </div>

        <div style={grid}>
          <Field label="Locatie">
            <Input value={f.location} onChange={set('location')} />
          </Field>
          <Field label="Formule">
            <Input value={f.formule} onChange={set('formule')} placeholder="bv. Walking dinner" />
          </Field>
        </div>

        <div style={grid}>
          <Field label="Concept">
            <Select
              value={f.brandId}
              onChange={set('brandId')}
              options={[{ value: '', label: 'Los event' }, ...brands.filter((b) => !b.archived || b.id === f.brandId).map((b) => ({ value: b.id, label: b.name }))]}
            />
          </Field>
          <Field label="Type">
            <Input value={f.eventType} onChange={set('eventType')} placeholder="bv. Huwelijk" />
          </Field>
        </div>

        <div>
          <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
            Team
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3) var(--space-6)' }}>
            {team.map((p) => (
              <Checkbox
                key={p.id}
                label={p.fullName || p.email}
                checked={f.assignees.includes(p.id)}
                onChange={() =>
                  setF((x) => ({
                    ...x,
                    assignees: x.assignees.includes(p.id) ? x.assignees.filter((a) => a !== p.id) : [...x.assignees, p.id],
                  }))
                }
              />
            ))}
          </div>
        </div>

        {missing.length ? (
          <div className="je-muted-caption" style={{ color: 'var(--warning)' }}>
            Dit event staat voorbij de aanvraag; {missing.join(', ')} ontbreekt nog.
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuleren
          </Button>
          <Button size="sm" loading={busy} disabled={!f.title.trim()} onClick={save}>
            Bewaren
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
