import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { leesAanvraag } from '@lib/aanvraag'
import { formatDateTime } from '@lib/dates'
import { Badge, Button, EmptyState, Icon, Select, Spinner } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useCustomers } from '@data/customers'
import { createEventFromTemplate, useEvents } from '@data/events'
import { koppelMail, useLosseMails } from '@data/mails'
import { resolveTemplate } from '@data/templates'

/**
 * Het postvak: mail die nergens bij hoort.
 *
 * Bijna altijd is dat een aanvraag — een nieuwe klant die schrijft, en er is
 * dus nog geen event om het aan te hangen. Soms is het iets anders: een
 * leverancier, een factuur, een klant met twee lopende dossiers waarvan de
 * server niet durfde te kiezen.
 *
 * Wat hier staat is dus geen foutenlijst maar een werklijst, en de twee dingen
 * die je ermee doet staan er allebei: er een event van maken (met wat er uit de
 * mail te lezen valt al ingevuld) of het aan een bestaand event hangen.
 */
export default function Aanvragen() {
  const { t } = useTaal()
  const { mails, laadt } = useLosseMails()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={`JE Concept · ${t('mail.postvak.aantal', { aantal: mails.length })}`}
        title={t('nav.aanvragen')}
      />
      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 960 }}>
        {laadt ? (
          <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spinner /> {t('mail.postvak.laden')}
          </div>
        ) : mails.length === 0 ? (
          <EmptyState
            icon="mail"
            title={t('mail.postvak.leeg')}
            description={t('mail.postvak.leeg_uitleg')}
          />
        ) : (
          mails.map((mail) => <Aanvraag key={mail.id} mail={mail} />)
        )}
      </div>
    </div>
  )
}

function Aanvraag({ mail }) {
  const { t } = useTaal()
  const { uid } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { brands, eventsList, templates, profiles, formules } = useWorkspace()
  const { eventById } = useEvents()
  const { customers } = useCustomers()
  const [bezig, setBezig] = useState(false)
  const [koppelAan, setKoppelAan] = useState('')

  const gelezen = useMemo(
    () => leesAanvraag(`${mail.onderwerp ?? ''}\n\n${mail.tekst ?? ''}`, { formules, plekken: brands }),
    [mail.onderwerp, mail.tekst, formules, brands]
  )

  const klant = customers.find((c) => c.id === mail.customerId) ?? null
  const events = Object.values(eventById ?? {}).filter((e) => !e.archived)

  const maakEvent = async () => {
    if (!eventsList || bezig) return
    setBezig(true)
    try {
      const template =
        templates.find((tp) => tp.id === gelezen.formule?.templateId) ??
        templates.find((tp) => tp.id === 'nieuw-event') ??
        templates[0]

      const id = await createEventFromTemplate({
        list: eventsList,
        name: [gelezen.soort, gelezen.afzender ?? mail.van].filter(Boolean).join(' — ') || mail.onderwerp,
        eventDate: gelezen.datum ? gelezen.datum.toISOString().slice(0, 10) : null,
        brandId: gelezen.plek?.id ?? null,
        template: resolveTemplate(template, profiles),
        createdBy: uid,
        customerId: klant?.id ?? null,
        customerName: klant?.name ?? gelezen.afzender ?? '',
        formule: gelezen.formule ?? null,
        keuzes: null,
        pax: gelezen.personen,
        // De mail blijft bij het dossier staan, ook los van de draad: wie het
        // event opent, leest meteen waar het over ging.
        omschrijving: mail.tekst ?? '',
        soort: gelezen.soort,
      })

      await koppelMail(mail.id, { eventId: id, customerId: klant?.id ?? null })
      toast.success(t('mail.postvak.event_gemaakt'))
      navigate(`/events/${id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <article className="je-panel je-aanvraag">
      <header className="je-aanvraag__kop">
        <Icon name="mail" size={15} />
        <span className="je-aanvraag__van">{mail.van}</span>
        <span className="je-muted-caption">{mail.datum ? formatDateTime(mail.datum) : ''}</span>
        {mail.koppeling === 'klant_meerdere' && klant ? (
          <Badge tone="warning" title={t('mail.koppeling.klant_meerdere')}>
            {klant.name}
          </Badge>
        ) : null}
      </header>

      <div className="je-aanvraag__onderwerp">{mail.onderwerp || t('mail.geen_onderwerp')}</div>
      <p className="je-aanvraag__tekst">{String(mail.tekst ?? '').slice(0, 700)}</p>

      <div className="je-aanvraag__gelezen">
        {[
          gelezen.datum && ['events.velden.datum', gelezen.datum.toLocaleDateString('nl-BE')],
          gelezen.personen && ['events.fiche.gasten', `${gelezen.personen} pax`],
          gelezen.soort && ['events.velden.type', gelezen.soort],
          gelezen.formule && ['events.fiche.formule', gelezen.formule.name],
          gelezen.plek && ['events.velden.concept', gelezen.plek.name],
        ]
          .filter(Boolean)
          .map(([sleutel, waarde]) => (
            <span key={sleutel} className="je-aanvraag__veld">
              <span className="je-muted-caption">{t(sleutel)}</span>
              <strong>{waarde}</strong>
            </span>
          ))}
        {gelezen.vragen.map((v) => (
          <Badge key={v} tone="neutral">
            {t(v)}
          </Badge>
        ))}
      </div>

      <div className="je-aanvraag__acties">
        <Button size="sm" loading={bezig} disabled={!eventsList} onClick={maakEvent}>
          {t('mail.postvak.maak_event')}
        </Button>
        <Select
          aria-label={t('mail.postvak.koppel')}
          value={koppelAan}
          onChange={(e) => {
            const id = e.target.value
            setKoppelAan('')
            if (!id) return
            koppelMail(mail.id, { eventId: id, customerId: eventById[id]?.customerId ?? null })
              .then(() => toast.success(t('mail.postvak.gekoppeld')))
              .catch((err) => toast.error(err.message))
          }}
          options={[
            { value: '', label: t('mail.postvak.koppel') },
            ...events.map((e) => ({ value: e.id, label: e.name })),
          ]}
        />
      </div>
    </article>
  )
}
