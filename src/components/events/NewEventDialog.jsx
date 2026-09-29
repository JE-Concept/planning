import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, dayKey } from '@lib/dates'
import { Button, Dialog, Field, Icon, Input, Select } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createEventFromTemplate } from '@data/events'
import { resolveTemplate, templateSummary } from '@data/templates'
import CustomerPicker from './CustomerPicker'

/** Nieuw event: naam, datum, concept en het template waarmee het start. */
export default function NewEventDialog({ open, onClose }) {
  const { eventsList, brands, templates, profiles } = useWorkspace()
  const { uid } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const concepts = useMemo(() => brands.filter((b) => !b.archived), [brands])
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => dayKey(addDays(new Date(), 45)))
  const [brandId, setBrandId] = useState('')
  // Een event zonder klant is een event zonder historiek; daarom staat de keuze
  // hier al en niet pas op de fiche.
  const [klant, setKlant] = useState({ customerId: '', customerName: '' })
  const [tplId, setTplId] = useState(templates[0]?.id ?? 'leeg')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!name.trim() || !eventsList) return
    setBusy(true)
    try {
      const template = resolveTemplate(templates.find((t) => t.id === tplId), profiles)
      const id = await createEventFromTemplate({
        list: eventsList,
        name,
        eventDate: date,
        brandId: brandId || null,
        template,
        createdBy: uid,
        customerId: klant.customerId,
        customerName: klant.customerName,
      })
      toast.success(`${name.trim()} staat in de planning.`)
      setName('')
      setKlant({ customerId: '', customerName: '' })
      onClose()
      navigate(`/events/${id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nieuw event" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {!eventsList ? (
          <p className="je-muted-caption">
            Er is nog geen eventlijst met de statuspijplijn. Maak ze aan in Instellingen → Lijsten.
          </p>
        ) : null}
        <Field label="Naam" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
            }}
            placeholder="bv. Trouw Tom en Sara"
            autoFocus
          />
        </Field>
        <CustomerPicker
          customerId={klant.customerId}
          customerName={klant.customerName}
          onChange={setKlant}
        />
        <Field label="Datum event" hint="Deadlines van het template tellen hiervan terug">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Concept">
          <Select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            options={[{ value: '', label: 'Los event' }, ...concepts.map((b) => ({ value: b.id, label: b.name }))]}
          />
        </Field>
        <div>
          <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
            Start van template
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-hairline)', borderRadius: 2 }}>
            {templates.map((tp, i) => {
              const on = tplId === tp.id
              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => setTplId(tp.id)}
                  aria-pressed={on}
                  className="je-plainbtn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4) var(--space-5)',
                    background: on ? 'var(--accent-quiet)' : 'transparent',
                    borderTop: i ? '1px solid var(--border-hairline)' : 'none',
                  }}
                >
                  <span style={{ color: on ? 'var(--text-accent)' : 'var(--text-2)', display: 'flex' }}>
                    <Icon name={tp.icon} size={18} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', font: 'var(--type-body-sm)', fontWeight: 600 }}>{tp.name}</span>
                    <span className="je-muted-caption" style={{ display: 'block' }}>
                      {templateSummary(tp)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="je-muted-caption">
          Gasten en offerte vul je aan op de fiche. Samen met klant en datum zijn ze verplicht vanaf de offertestap.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuleren
          </Button>
          <Button size="sm" disabled={!name.trim() || !eventsList} loading={busy} onClick={create}>
            Event aanmaken
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
