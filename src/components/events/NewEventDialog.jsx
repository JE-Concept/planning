import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, dayKey } from '@lib/dates'
import { bestelTekst, bestellijstVan, prijsVan, standaardKeuzes } from '@lib/formules'
import { Button, Dialog, Field, Icon, Input, Select, Tabs } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createEventFromTemplate } from '@data/events'
import { resolveTemplate, templateSummary } from '@data/templates'
import { formuleSamenvatting } from '@data/formules'
import CustomerPicker from './CustomerPicker'

const euro = (bedrag) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(Number(bedrag) || 0)

/**
 * Nieuw event: eerst de keuze tussen een custom event en een vaste formule.
 *
 * Bij custom kies je zelf het takentemplate. Bij een formule loop je haar
 * vragen af (hapjes, drank, dessert) en wordt het event aangemaakt mét prijs en
 * bestellijst, uitgerekend op het aantal personen. Wat daarna volgt is een
 * gewoon event: alles is nog aan te passen op de fiche.
 */
export default function NewEventDialog({ open, onClose }) {
  const { eventsList, brands, templates, formules, profiles } = useWorkspace()
  const { uid } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const concepts = useMemo(() => brands.filter((b) => !b.archived), [brands])
  const [modus, setModus] = useState('custom')
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => dayKey(addDays(new Date(), 45)))
  const [brandId, setBrandId] = useState('')
  // Een event zonder klant is een event zonder historiek; daarom staat de keuze
  // hier al en niet pas op de fiche.
  const [klant, setKlant] = useState({ customerId: '', customerName: '' })
  const [tplId, setTplId] = useState(templates[0]?.id ?? 'leeg')
  const [formuleId, setFormuleId] = useState(formules[0]?.id ?? null)
  const [keuzes, setKeuzes] = useState({})
  const [personen, setPersonen] = useState('50')
  const [busy, setBusy] = useState(false)

  const formule = formules.find((f) => f.id === formuleId) ?? null
  const pax = Math.max(0, parseInt(personen || '0', 10) || 0)

  // Een andere formule betekent andere vragen; de antwoorden van de vorige
  // slaan nergens op. Elke vraag begint op haar goedkoopste antwoord.
  useEffect(() => {
    setKeuzes(standaardKeuzes(formule))
  }, [formule])

  const prijs = useMemo(() => (formule ? prijsVan(formule, keuzes, pax) : null), [formule, keuzes, pax])
  const bestellijst = useMemo(() => (formule ? bestellijstVan(formule, keuzes, pax) : []), [formule, keuzes, pax])

  // Het takentemplate hoort bij de formule; staat er geen, dan het standaard
  // template — zo begint geen enkel event zonder offerte- en facturatietaak.
  const templateVoorFormule =
    templates.find((t) => t.id === formule?.templateId) ?? templates.find((t) => t.id === 'nieuw-event') ?? templates[0]
  const gekozenTemplate = modus === 'formule' ? templateVoorFormule : templates.find((t) => t.id === tplId)

  const klaar = Boolean(name.trim() && eventsList && (modus === 'custom' || (formule && pax > 0)))

  const create = async () => {
    if (!klaar) return
    setBusy(true)
    try {
      const template = resolveTemplate(gekozenTemplate, profiles)
      const id = await createEventFromTemplate({
        list: eventsList,
        name,
        eventDate: date,
        brandId: brandId || null,
        template,
        createdBy: uid,
        customerId: klant.customerId,
        customerName: klant.customerName,
        formule: modus === 'formule' ? formule : null,
        keuzes: modus === 'formule' ? keuzes : null,
        pax: modus === 'formule' ? pax : null,
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Nieuw event"
      width={modus === 'formule' ? 640 : 560}
      className="je-formule-dialog"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {!eventsList ? (
          <p className="je-muted-caption">
            Er is nog geen eventlijst met de statuspijplijn. Maak ze aan in Instellingen → Lijsten.
          </p>
        ) : null}

        <Tabs
          items={[
            { value: 'custom', label: 'Custom event' },
            { value: 'formule', label: 'Bestaande formule' },
          ]}
          value={modus}
          onChange={setModus}
        />

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

        {modus === 'custom' ? (
          <div>
            <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
              Start van template
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-hairline)', borderRadius: 2 }}>
              {templates.map((tp, i) => (
                <KeuzeRij
                  key={tp.id}
                  icon={tp.icon}
                  titel={tp.name}
                  onder={templateSummary(tp)}
                  aan={tplId === tp.id}
                  eerste={i === 0}
                  onClick={() => setTplId(tp.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <FormuleKeuze
            formules={formules}
            formule={formule}
            onFormule={setFormuleId}
            keuzes={keuzes}
            onKeuze={(optieId, keuzeId) => setKeuzes((k) => ({ ...k, [optieId]: keuzeId }))}
            personen={personen}
            onPersonen={setPersonen}
            prijs={prijs}
            bestellijst={bestellijst}
            template={templateVoorFormule}
          />
        )}

        <div className="je-muted-caption">
          {modus === 'formule'
            ? 'De prijs en de bestellijst staan meteen op het event. Alles blijft daarna aanpasbaar.'
            : 'Gasten en offerte vul je aan op de fiche. Samen met klant en datum zijn ze verplicht vanaf de offertestap.'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuleren
          </Button>
          <Button size="sm" disabled={!klaar} loading={busy} onClick={create}>
            Event aanmaken
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/** Eén regel in een lijst waaruit je er precies één kiest. */
function KeuzeRij({ icon, titel, onder, aan, eerste, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aan}
      className="je-plainbtn"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-5)',
        background: aan ? 'var(--accent-quiet)' : 'transparent',
        borderTop: eerste ? 'none' : '1px solid var(--border-hairline)',
      }}
    >
      <span style={{ color: aan ? 'var(--text-accent)' : 'var(--text-2)', display: 'flex' }}>
        <Icon name={icon} size={18} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', font: 'var(--type-body-sm)', fontWeight: 600 }}>{titel}</span>
        <span className="je-muted-caption" style={{ display: 'block' }}>
          {onder}
        </span>
      </span>
    </button>
  )
}

/** De formule kiezen en haar vragen beantwoorden, met de rekening ernaast. */
function FormuleKeuze({
  formules,
  formule,
  onFormule,
  keuzes,
  onKeuze,
  personen,
  onPersonen,
  prijs,
  bestellijst,
  template,
}) {
  if (formules.length === 0) {
    return (
      <p className="je-muted-caption">
        Er zijn nog geen formules. Een beheerder maakt ze aan in Instellingen → Formules.
      </p>
    )
  }

  return (
    <>
      <div>
        <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
          Formule
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-hairline)', borderRadius: 2 }}>
          {formules.map((f, i) => (
            <KeuzeRij
              key={f.id}
              icon={f.icon || 'utensils'}
              titel={f.name}
              onder={formuleSamenvatting(f)}
              aan={formule?.id === f.id}
              eerste={i === 0}
              onClick={() => onFormule(f.id)}
            />
          ))}
        </div>
      </div>

      {formule ? (
        <>
          <Field label="Aantal personen" required hint="Hierop wordt de bestellijst berekend">
            <Input type="number" min="1" step="1" value={personen} onChange={(e) => onPersonen(e.target.value)} />
          </Field>

          {(formule.opties ?? []).map((optie) => (
            <Field key={optie.id} label={optie.label}>
              <Select
                value={keuzes[optie.id] ?? ''}
                onChange={(e) => onKeuze(optie.id, e.target.value)}
                options={(optie.keuzes ?? []).map((k) => ({
                  value: k.id,
                  label: meerprijs(k) ? `${k.label} (${meerprijs(k)})` : k.label,
                }))}
              />
            </Field>
          ))}

          <div className="je-formule-rekening">
            <div className="je-formule-rekening__rij">
              <span>
                {prijs.personen} × {euro(prijs.perPersoon)}
                {prijs.vast ? ` + ${euro(prijs.vast)} vast` : ''}
              </span>
              <strong>{euro(prijs.exclBtw)}</strong>
            </div>
            {prijs.btwRegels.map((r) => (
              <div key={r.percent} className="je-formule-rekening__rij je-muted-caption">
                <span>
                  btw {r.percent}% op {euro(r.basis)}
                </span>
                <span>{euro(r.btw)}</span>
              </div>
            ))}
            <div className="je-formule-rekening__rij je-formule-rekening__totaal">
              <span>Totaal incl. btw</span>
              <strong>{euro(prijs.inclBtw)}</strong>
            </div>
          </div>

          <div>
            <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
              Bestellijst · {bestellijst.length} regels
            </div>
            <div className="je-muted-caption">
              {bestellijst.length === 0
                ? 'Nog niets te bestellen — vul een aantal personen in.'
                : `${bestellijst
                    .slice(0, 4)
                    .map((r) => `${bestelTekst(r)} ${r.item.toLowerCase()}`)
                    .join(', ')}${bestellijst.length > 4 ? `, en ${bestellijst.length - 4} meer` : ''}.`}
            </div>
            <div className="je-muted-caption" style={{ marginTop: 'var(--space-2)' }}>
              Taken: {template?.name ?? 'geen'} · {templateSummary(template ?? {})}
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}

function meerprijs(keuze) {
  const pp = Number(keuze.prijsPerPersoon) || 0
  const vast = Number(keuze.prijsVast) || 0
  if (!pp && !vast) return ''
  return [pp ? `+ ${euro(pp)} p.p.` : null, vast ? `+ ${euro(vast)}` : null].filter(Boolean).join(' · ')
}
