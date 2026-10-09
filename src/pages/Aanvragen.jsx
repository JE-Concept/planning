import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { afzenderUitKop, leesAanvraag, naamVoorEvent, ontleedTitel, zoekKlant } from '@lib/aanvraag'
import { dayKey, formatDate, formatDateTime } from '@lib/dates'
import { vrijeLocatie } from '@lib/kaart'
import { postvakAchterSinds } from '@lib/systeem'
import { Acties, Badge, EmptyState, Icon, Select, Spinner } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useCustomers } from '@data/customers'
import { createEventFromTemplate, useEvents } from '@data/events'
import { koppelMail, useLosseMails } from '@data/mails'
import { handelAf, useVerhuuraanvragen } from '@data/verhuuraanvragen'
import { useSysteem } from '@data/systeem'
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
  const { aanvragen: vanDeSite } = useVerhuuraanvragen()
  const { postvak } = useSysteem()
  const achterSinds = postvakAchterSinds(postvak)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={`JE Concept · ${t('mail.postvak.aantal', { aantal: mails.length })}`}
        title={t('nav.aanvragen')}
      />
      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/*
          De verhuursite levert hetzelfde soort werk op als losse mail: iemand
          schrijft, er is nog geen dossier, en jij beslist of het er een wordt.
          Daarom staan ze op dezelfde pagina en niet op een eigen scherm dat
          je apart moet onthouden. Bovenaan, want een formulier dat iemand
          invulde is doorgaans concreter dan een mail die ergens tussen viel.
        */}
        {/* Een leeg postvak is pas leeg als de ophaler bij is. Zie postvakAchterSinds. */}
        {achterSinds ? (
          <div role="status" className="je-panel" style={{ padding: 'var(--space-4) var(--space-5)', borderLeft: '3px solid var(--red-600)' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="alert-triangle" size={14} /> {t('mail.postvak.achter', { sinds: formatDateTime(achterSinds) })}
            </strong>
            <span className="je-muted-caption">{t('mail.postvak.achter_uitleg')}</span>
          </div>
        ) : null}

        {vanDeSite.map((a) => (
          <SiteAanvraag key={a.id} aanvraag={a} />
        ))}

        {laadt ? (
          <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spinner /> {t('mail.postvak.laden')}
          </div>
        ) : mails.length === 0 && vanDeSite.length === 0 ? (
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

/**
 * Een aanvraag van rental.jeconcept.be.
 *
 * Korter dan een mail en met de velden al uit elkaar gehaald, want het was
 * een formulier: naam, datum, aantal personen en wat ze willen. Twee
 * knoppen, dezelfde twee als bij een mail — er een dossier van maken, of
 * wegstrepen omdat het een telefoontje werd.
 */
function SiteAanvraag({ aanvraag }) {
  const { t } = useTaal()
  const { uid } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { eventsList, templates, profiles } = useWorkspace()
  const [bezig, setBezig] = useState(false)

  const maakEvent = async () => {
    if (!eventsList || bezig) return
    setBezig(true)
    try {
      const template = templates.find((tp) => tp.id === 'nieuw-event') ?? templates[0]
      const id = await createEventFromTemplate({
        list: eventsList,
        name: aanvraag.naam ? `Aanvraag — ${aanvraag.naam}` : 'Aanvraag van de verhuursite',
        eventDate: aanvraag.datum ?? null,
        template: resolveTemplate(template, profiles),
        createdBy: uid,
        customerName: aanvraag.naam ?? '',
        pax: aanvraag.gasten ?? null,
        omschrijving: aanvraag.wat ?? '',
      })
      await handelAf(aanvraag.id, { eventId: id })
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
        <Icon name="package" size={15} />
        <span className="je-aanvraag__van">{aanvraag.naam || aanvraag.email}</span>
        <span className="je-muted-caption">
          {aanvraag.createdAt ? formatDateTime(aanvraag.createdAt) : ''}
        </span>
        <Badge tone="accent">{t('verhuuraanvraag.bron')}</Badge>
      </header>

      <p className="je-aanvraag__tekst">{aanvraag.wat}</p>

      <div className="je-aanvraag__gelezen">
        {[
          aanvraag.datum ? t('verhuuraanvraag.datum', { datum: aanvraag.datum }) : null,
          aanvraag.gasten ? t('verhuuraanvraag.gasten', { aantal: aanvraag.gasten }) : null,
          aanvraag.telefoon || null,
          aanvraag.email,
        ]
          .filter(Boolean)
          .map((regel) => (
            <span key={regel} className="je-chip">
              {regel}
            </span>
          ))}
      </div>

      <Acties
        plaats="rij"
        terug={{ label: t('verhuuraanvraag.afgehandeld'), uit: bezig, onClick: () => handelAf(aanvraag.id) }}
        tweede={{ label: t('verhuuraanvraag.mailen'), as: 'a', href: `mailto:${aanvraag.email}` }}
        hoofd={{ label: t('verhuuraanvraag.event_maken'), uit: bezig, onClick: maakEvent }}
      />
    </article>
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

  // Een gearchiveerd merk is geen concept meer om een nieuw event op te
  // zetten; de dialoog Nieuw event kiest er ook niet uit.
  const plekken = useMemo(() => brands.filter((b) => !b.archived), [brands])

  const gelezen = useMemo(() => {
    const uit = leesAanvraag(`${mail.onderwerp ?? ''}\n\n${mail.tekst ?? ''}`, { formules, plekken })
    // De afzender uit de kop van de mail telt als de ondertekening niets zegt.
    const kop = afzenderUitKop(mail.van)
    return { ...uit, email: uit.email ?? kop.email, klant: uit.klant ?? kop.naam }
  }, [mail.onderwerp, mail.tekst, mail.van, formules, plekken])

  // De klant waar de server de mail al aan hing, anders die uit de mail zelf.
  const klant = customers.find((c) => c.id === mail.customerId) ?? zoekKlant(gelezen, customers)
  // Het onderwerp is de naam ("ORKA wandeldagen"); staat er een aantal of
  // een klant in, dan gaan die naar hun eigen veld.
  const titel = ontleedTitel(mail.onderwerp)
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
        name:
          naamVoorEvent(gelezen, { onderwerp: mail.onderwerp, standaard: t('aanvraag.naam_standaard') }) ||
          mail.onderwerp ||
          t('aanvraag.naam_standaard'),
        eventDate: gelezen.datum ? dayKey(gelezen.datum) : null,
        eventEndDate: gelezen.tot ? dayKey(gelezen.tot) : null,
        brandId: gelezen.plek?.id ?? null,
        template: resolveTemplate(template, profiles),
        createdBy: uid,
        customerId: klant?.id ?? null,
        customerName: klant?.name ?? titel.klant ?? gelezen.klant ?? '',
        plek: gelezen.zaal ? vrijeLocatie(gelezen.zaal.adres) : null,
        formule: gelezen.formule ?? null,
        keuzes: null,
        pax: gelezen.personen ?? titel.personen,
        /*
          Geen omschrijving: de mail hangt hieronder aan het event en staat
          dan op het tabblad Mail, waar de rest van de wisseling met de klant
          ook komt. Ze ook als omschrijving zetten, gaf dezelfde tekst twee
          keer — en een omschrijving die het team niet zelf schreef.
        */
        omschrijving: '',
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
          gelezen.datum && [
            'events.velden.datum',
            gelezen.tot
              ? t('aanvraag.reeks', { van: formatDate(gelezen.datum), tot: formatDate(gelezen.tot) })
              : formatDate(gelezen.datum),
          ],
          (gelezen.personen ?? titel.personen) && ['events.fiche.gasten', `${gelezen.personen ?? titel.personen} pax`],
          gelezen.soort && ['events.velden.type', gelezen.soort],
          gelezen.formule && ['events.fiche.formule', gelezen.formule.name],
          gelezen.zaal && ['events.fiche.locatie', gelezen.zaal.adres],
          gelezen.plek && ['events.velden.concept', gelezen.plek.name],
          (klant?.name ?? titel.klant ?? gelezen.klant) && ['events.fiche.klant', klant?.name ?? titel.klant ?? gelezen.klant],
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
        <Acties plaats="rij" hoofd={{ label: t('mail.postvak.maak_event'), bezig, uit: !eventsList, onClick: maakEvent }} />
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
