import { useEffect, useMemo, useState } from 'react'
import { dayKey, fromDateInput } from '@lib/dates'
import { missingForOffer } from '@lib/pipeline'
import { Button, Checkbox, Dialog, Field, Input, Select } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { updateEvent } from '@data/events'
import CustomerPicker from './CustomerPicker'

const num = (v) => (v === '' || v == null ? null : Number(v))

/**
 * De fiche bewerken: alles wat een aanvraag een rapporteerbaar event maakt.
 * Klant, datum, gasten en offerte staan bovenaan — die zijn verplicht vanaf
 * de offertestap.
 */
export default function EventEditDialog({ open, onClose, ev }) {
  const { brands, profiles } = useWorkspace()
  const { t } = useTaal()
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
    <Dialog open={open} onClose={onClose} title={t('events.fiche.bewerken')} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <Field label={t('events.velden.naam')} required>
          <Input value={f.title} onChange={set('title')} />
        </Field>

        <CustomerPicker
          required
          customerId={f.customerId}
          customerName={f.customerName}
          onChange={(klant) => setF((x) => ({ ...x, ...klant }))}
        />

        <div style={grid}>
          <Field label={t('events.velden.datum')} required>
            <Input type="date" value={f.eventDate} onChange={set('eventDate')} />
          </Field>
          <Field label={t('events.fiche.gasten')} required>
            <Input type="number" min="0" value={f.pax} onChange={set('pax')} />
          </Field>
          <Field label={t('events.velden.kinderen')}>
            <Input type="number" min="0" value={f.kids} onChange={set('kids')} />
          </Field>
          <Field label={t('events.velden.offerte')} required>
            <Input type="number" min="0" step="1" value={f.quoteAmount} onChange={set('quoteAmount')} />
          </Field>
        </div>

        <div style={grid}>
          <Field label={t('events.fiche.locatie')}>
            <Input value={f.location} onChange={set('location')} />
          </Field>
          <Field label={t('events.fiche.formule')}>
            <Input value={f.formule} onChange={set('formule')} placeholder={t('events.velden.formule_hint')} />
          </Field>
        </div>

        <div style={grid}>
          <Field label={t('events.velden.concept')}>
            <Select
              value={f.brandId}
              onChange={set('brandId')}
              options={[
                { value: '', label: t('events.los_event') },
                ...brands.filter((b) => !b.archived || b.id === f.brandId).map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          </Field>
          <Field label={t('events.velden.type')}>
            <Input value={f.eventType} onChange={set('eventType')} placeholder={t('events.velden.type_hint')} />
          </Field>
        </div>

        <div>
          <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
            {t('events.fiche.team')}
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
            {t('events.velden.ontbreekt', { wat: missing.map((m) => t(`events.ontbreekt.${m}`)).join(', ') })}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('alg.annuleren')}
          </Button>
          <Button size="sm" loading={busy} disabled={!f.title.trim()} onClick={save}>
            {t('alg.opslaan')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
