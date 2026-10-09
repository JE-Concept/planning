import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, dayKey } from '@lib/dates'
import { bestelTekst, bestellijstVan, prijsVan, standaardKeuzes } from '@lib/formules'
import { leegLocatie } from '@lib/kaart'
import { Acties, Dialog, Field, Icon, Input, Select, Tabs } from '@components/ds'
import KlantKiezer from '@components/common/KlantKiezer'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createEventFromTemplate } from '@data/events'
import { resolveTemplate, templateSummary } from '@data/templates'
import { formuleSamenvatting } from '@data/formules'
import LocatieVeld from './LocatieVeld'
import AanvraagInlezen from './AanvraagInlezen'

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
  const { t } = useTaal()
  const toast = useToast()
  const navigate = useNavigate()

  const concepts = useMemo(() => brands.filter((b) => !b.archived), [brands])
  const [modus, setModus] = useState('custom')
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => dayKey(addDays(new Date(), 45)))
  const [brandId, setBrandId] = useState('')
  // De zaal is bijna altijd bekend op het moment dat de telefoon opgelegd
  // wordt. Hier vragen scheelt een tweede keer de fiche opendoen — en een
  // event zonder locatie is een event waar niemand naartoe kan rijden.
  const [plek, setPlek] = useState(() => leegLocatie())
  // Een event zonder klant is een event zonder historiek; daarom staat de keuze
  // hier al en niet pas op de fiche.
  const [klant, setKlant] = useState({ customerId: '', customerName: '' })
  const [tplId, setTplId] = useState(templates[0]?.id ?? 'leeg')
  const [formuleId, setFormuleId] = useState(formules[0]?.id ?? null)
  const [keuzes, setKeuzes] = useState({})
  const [personen, setPersonen] = useState('50')
  const [busy, setBusy] = useState(false)
  // De mail van de klant, zoals ze binnenkwam. Ze wordt de omschrijving van
  // het event: dan blijft de vraag bij het antwoord staan.
  const [mail, setMail] = useState('')
  const [soort, setSoort] = useState('')

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

  const klaar = Boolean(
    name.trim() && eventsList && (modus === 'custom' || modus === 'aanvraag' || (formule && pax > 0))
  )

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
        plek,
        formule: modus === 'custom' ? null : formule,
        keuzes: modus === 'custom' ? null : keuzes,
        pax: modus === 'custom' ? null : pax,
        // De mail van de klant wordt de omschrijving van het event, en het
        // soort dat eruit gelezen is het eventtype. Zo staat de vraag bij het
        // antwoord in plaats van in iemands mailbox.
        omschrijving: modus === 'aanvraag' ? mail.trim() : '',
        soort: modus === 'aanvraag' ? soort : null,
      })
      toast.success(t('events.nieuw.gemaakt', { naam: name.trim() }))
      setName('')
      setKlant({ customerId: '', customerName: '' })
      setPlek(leegLocatie())
      setMail('')
      setSoort('')
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
      vastHouden={Boolean(mail.trim() || name.trim())}
      title={t('events.nieuw')}
      width={modus === 'custom' ? 560 : 640}
      className="je-formule-dialog"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {!eventsList ? (
          <p className="je-muted-caption">{t('events.nieuw.geen_lijst')}</p>
        ) : null}

        <Tabs
          items={[
            { value: 'custom', label: t('events.nieuw.custom') },
            { value: 'formule', label: t('events.nieuw.uit_formule') },
            { value: 'aanvraag', label: t('aanvraag.tab') },
          ]}
          value={modus}
          onChange={setModus}
        />

        {modus === 'aanvraag' ? (
          <AanvraagInlezen
            tekst={mail}
            onTekst={setMail}
            formules={formules}
            plekken={concepts}
            onGelezen={(uit) => {
              // Alleen invullen wat leeg is: wie zelf iets aanpaste, mag dat
              // niet bij de volgende aanslag weer kwijtspelen.
              if (uit.datum) setDate(dayKey(uit.datum))
              if (uit.personen) setPersonen(String(uit.personen))
              if (uit.soort) setSoort(uit.soort)
              if (uit.formule) setFormuleId(uit.formule.id)
              if (uit.plek) setBrandId(uit.plek.id)
              if (uit.afzender) setKlant((k) => (k.customerId || k.customerName ? k : { customerId: '', customerName: uit.afzender }))
              setName((n) => n || [uit.soort, uit.afzender].filter(Boolean).join(' — '))
            }}
          />
        ) : null}

        <Field label={t('events.velden.naam')} required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
            }}
            placeholder={t('events.nieuw.naam_hint')}
            autoFocus
          />
        </Field>
        <KlantKiezer
          id={klant.customerId || null}
          naam={klant.customerName}
          onChange={(k) => setKlant({ customerId: k.id ?? '', customerName: k.naam ?? '' })}
        />
        <Field label={t('events.velden.datum')} hint={t('events.nieuw.datum_hint')}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <LocatieVeld value={plek} onChange={setPlek} />
        <Field label={t('events.velden.concept')}>
          <Select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            options={[
              { value: '', label: t('events.los_event') },
              ...concepts.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Field>

        {modus === 'custom' || (modus === 'aanvraag' && !formule) ? (
          <div>
            <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
              {t('events.nieuw.template')}
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
          {modus === 'formule' ? t('events.nieuw.uitleg_formule') : t('events.nieuw.uitleg_custom')}
        </div>
        <Acties
          terug={{ onClick: onClose }}
          hoofd={{ label: t('events.nieuw.aanmaken'), bezig: busy, uit: !klaar, onClick: create }}
        />
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
  const { t } = useTaal()

  if (formules.length === 0) {
    return <p className="je-muted-caption">{t('events.nieuw.geen_formules')}</p>
  }

  return (
    <>
      <div>
        <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
          {t('events.fiche.formule')}
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
          <Field label={t('events.nieuw.personen')} required hint={t('events.nieuw.personen_hint')}>
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
                {prijs.vast ? t('events.nieuw.vast', { bedrag: euro(prijs.vast) }) : ''}
              </span>
              <strong>{euro(prijs.exclBtw)}</strong>
            </div>
            {prijs.btwRegels.map((r) => (
              <div key={r.percent} className="je-formule-rekening__rij je-muted-caption">
                <span>{t('events.nieuw.btw', { percent: r.percent, basis: euro(r.basis) })}</span>
                <span>{euro(r.btw)}</span>
              </div>
            ))}
            <div className="je-formule-rekening__rij je-formule-rekening__totaal">
              <span>{t('events.nieuw.totaal')}</span>
              <strong>{euro(prijs.inclBtw)}</strong>
            </div>
          </div>

          <div>
            <div className="je-caps" style={{ marginBottom: 'var(--space-3)' }}>
              {t('events.nieuw.bestellijst', { aantal: bestellijst.length })}
            </div>
            <div className="je-muted-caption">
              {bestellijst.length === 0
                ? t('events.nieuw.niets_bestellen')
                : `${bestellijst
                    .slice(0, 4)
                    .map((r) => `${bestelTekst(r)} ${r.item.toLowerCase()}`)
                    .join(', ')}${
                    bestellijst.length > 4 ? t('events.nieuw.en_meer', { aantal: bestellijst.length - 4 }) : ''
                  }.`}
            </div>
            <div className="je-muted-caption" style={{ marginTop: 'var(--space-2)' }}>
              {t('events.nieuw.taken', {
                template: template?.name ?? t('events.nieuw.geen_template'),
                samenvatting: templateSummary(template ?? {}),
              })}
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
