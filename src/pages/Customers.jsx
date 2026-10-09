import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDate, relativeDay } from '@lib/dates'
import { formatCurrency } from '@lib/format'
import { labelOf } from '@lib/pipeline'
import {
  addressLine,
  billingAddressOf,
  billingEmailOf,
  customerHistory,
  formatVat,
  primaryContact,
  setPrimaryContact,
  vatHint,
  viesVoorstel,
} from '@lib/klanten'
import { Acties, Badge, Button, Checkbox, Dialog, Drawer, Field, GevaarKnop, Input, Select, Spinner, bevestig } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import Documents from '@components/common/Documents'
import TaskDrawer from '@components/board/TaskDrawer'
import { klantAdres } from '@lib/klantadres'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  archiveCustomer,
  createCustomer,
  deleteCustomer,
  klantLink,
  leegAdres,
  nieuwContact,
  restoreCustomer,
  updateCustomer,
  useCustomers,
  useCustomerTasks,
} from '@data/customers'
import { zoekBtwOp } from '@data/btw'
import { STANDAARD_KLEUR } from '@lib/kleur'
import GekoppeldeNotities from '@components/notities/GekoppeldeNotities'

/**
 * Klanten.
 *
 * Eén scherm met de lijst links en de klant in een paneel ernaast: wat er van
 * hen bekend is, wie je belt, wat er aan events en taken loopt, en de
 * documenten die bij hén horen en niet bij één opdracht.
 */
export default function Customers() {
  const { customers, loading } = useCustomers({ includeArchived: true })
  const { brandById } = useWorkspace()
  const { t } = useTaal()
  const toast = useToast()
  const [zoek, setZoek] = useState('')
  // `?klant=<id>` opent die fiche meteen — daar landt een link vanuit een notitie.
  const [params] = useSearchParams()
  const [open, setOpen] = useState(() => params.get('klant'))
  const [nieuw, setNieuw] = useState(false)

  const zichtbaar = useMemo(() => {
    const naald = zoek.trim().toLowerCase()
    return customers.filter((klant) => {
      if (!naald) return true
      const hooi = [klant.name, klant.vatNumber, klant.email, klant.address?.city]
        .concat((klant.contacts ?? []).map((c) => c.name))
        .join(' ')
        .toLowerCase()
      return hooi.includes(naald)
    })
  }, [customers, zoek])

  /*
    Een nieuwe klant begint met een naam.

    De knop maakte meteen een fiche "Nieuwe klant" aan en opende die. Wie de
    lade daarna sloot zonder iets in te vullen, liet een lege klant achter met
    "Nieuwe klant" als echte bedrijfsnaam; zo stonden er live al twee. Nu vraagt
    een klein venster eerst de naam, en pas met een naam wordt er geschreven.

    De knop gaat op slot zolang het aanmaken loopt: twee keer klikken op een
    trage verbinding gaf vroeger twee fiches.
  */
  const [naamVraag, setNaamVraag] = useState(false)
  const [nieuweNaam, setNieuweNaam] = useState('')

  const maak = async (e) => {
    e?.preventDefault?.()
    const naam = nieuweNaam.trim()
    if (nieuw || !naam) return
    setNieuw(true)
    try {
      const id = await createCustomer({ name: naam, address: leegAdres() })
      setNaamVraag(false)
      setNieuweNaam('')
      setOpen(id)
      toast.success(t('klant.aangemaakt'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setNieuw(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('nav.klanten')}
        subtitle={t('klant.actief', { aantal: customers.filter((c) => !c.archived).length })}
        bediening={
          /* De tekst in het veld paste niet in het veld: hij liep dood op
             "contactperso…". Korter erin, volledig in het label. */
          <Input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder={t('klant.zoek_hint')}
            className="je-zoekveld h-8 text-sm"
            aria-label={t('klant.zoek_label')}
          />
        }
        acties={{ hoofd: { label: t('klant.nieuw'), icon: 'plus', onClick: () => setNaamVraag(true) } }}
      />

      <Dialog
        open={naamVraag}
        onClose={() => setNaamVraag(false)}
        width={460}
        title={t('klant.nieuw_titel')}
        footer={
          <Acties
            terug={{ onClick: () => setNaamVraag(false) }}
            hoofd={{ label: t('klant.nieuw_maak'), onClick: maak, bezig: nieuw, uit: !nieuweNaam.trim() }}
          />
        }
      >
        <form onSubmit={maak}>
          <Field label={t('klant.nieuw_naam')} hint={t('klant.nieuw_naam_hint')}>
            <Input autoFocus value={nieuweNaam} onChange={(e) => setNieuweNaam(e.target.value)} />
          </Field>
        </form>
      </Dialog>

      <div className="je-paginarand min-h-0 flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : zichtbaar.length === 0 ? (
          <p className="card px-4 py-8 text-center text-sm text-ink-500">
            {zoek ? t('klant.geen_gevonden') : t('klant.leeg')}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {zichtbaar.map((klant) => (
              <li key={klant.id}>
                <button
                  type="button"
                  onClick={() => setOpen(klant.id)}
                  className="card w-full p-3 text-left transition hover:border-ink-300"
                >
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
                      {klant.name}
                    </span>
                    {klant.archived ? (
                      <Badge>
                        {t('klant.uit')}
                      </Badge>
                    ) : klant.brandId && brandById[klant.brandId] ? (
                      <Badge color={brandById[klant.brandId].color} subtle>
                        {brandById[klant.brandId].name}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-500">
                    {[klant.address?.city, klant.vatNumber].filter(Boolean).join(' · ') || t('klant.geen_gegevens')}
                  </p>
                  {klant.contacts?.length ? (
                    <p className="mt-1 truncate text-xs text-ink-400">
                      {klant.contacts[0].name}
                      {klant.contacts.length > 1 ? ` +${klant.contacts.length - 1}` : ''}
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open ? <KlantPaneel id={open} onClose={() => setOpen(null)} toast={toast} /> : null}
    </div>
  )
}

// ─── Eén klant ──────────────────────────────────────────────────────────────

/**
 * De link naar het klantenportaal, met één knop om hem te kopiëren.
 *
 * Een klant is zelden één event, en drie losse offertelinks in drie mails
 * terugzoeken is precies het werk dat deze tool moest wegnemen. Dit adres
 * blijft staan en toont alles wat er loopt.
 */
function KlantLink({ klant, toast }) {
  const { t } = useTaal()
  const [link, setLink] = useState(klant.portalToken ? portaalAdres(klant.portalToken) : '')
  const [bezig, setBezig] = useState(false)

  const maak = async () => {
    setBezig(true)
    try {
      const adres = await klantLink(klant)
      setLink(adres)
      try {
        await navigator.clipboard.writeText(adres)
        toast.success(t('klant.portaal.gekopieerd'))
      } catch {
        // Sommige browsers weigeren het klembord; het adres staat er dan nog
        // altijd om zelf te selecteren.
        toast.success(t('klant.portaal.gemaakt'))
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <div className="je-klantlink">
      <span className="je-caps">{t('klant.portaal.titel')}</span>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="je-link-quiet">
          {link.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <span className="je-muted-caption">{t('klant.portaal.nog_niet')}</span>
      )}
      <Button variant="ghost" size="sm" iconLeft="copy" loading={bezig} onClick={maak}>
        {link ? t('klant.portaal.kopieren') : t('klant.portaal.maken')}
      </Button>
    </div>
  )
}

const portaalAdres = (token) => klantAdres(`klant/${token}`)

function KlantPaneel({ id, onClose, toast }) {
  const { t } = useTaal()
  const { customers } = useCustomers({ includeArchived: true })
  const { brands, eventsList } = useWorkspace()
  const klant = customers.find((c) => c.id === id)
  const { tasks } = useCustomerTasks(id)
  const [openEvent, setOpenEvent] = useState(null)

  // Het rekenwerk staat in @lib/klanten en niet hier: zo is te testen dat "te
  // factureren" echt telt wat op die stap staat, zonder een browser te openen.
  const historiek = useMemo(() => customerHistory(tasks), [tasks])
  const [zoektBtw, setZoektBtw] = useState(false)

  if (!klant) return null

  const zet = (patch) => updateCustomer(id, patch).catch((err) => toast.error(err.message))

  /*
    Naam en adres ophalen met het btw-nummer. Wat leeg is, wordt meteen
    ingevuld; wat al gevuld is, pas na een ja — wat er staat kan juister zijn
    dan wat VIES zegt (zie `viesVoorstel`). Het btw-nummer zelf blijft zoals
    het getypt is: dat is de vraag, niet het antwoord.
  */
  const zoekBtw = async (btw) => {
    if (!btw?.trim() || zoektBtw) return
    setZoektBtw(true)
    try {
      const gevonden = await zoekBtwOp(btw)
      if (!gevonden.geldig) {
        toast.error(t(`klant.vies.${gevonden.reden ?? 'onbekend'}`))
        return
      }
      const { patch, vragen } = viesVoorstel(klant, gevonden)
      let overnemen = {}
      if (vragen.length) {
        const lijst = vragen
          .map((v) =>
            v.veld === 'name'
              ? t('klant.vies.vraag_naam', { nu: v.nu, nieuw: v.nieuw })
              : t('klant.vies.vraag_adres', { nu: v.nu, nieuw: addressLine(v.nieuw) })
          )
          .join('\n')
        if (await bevestig(t('klant.vies.vraag', { lijst }), { knop: t('klant.vies.overnemen') })) {
          overnemen = Object.fromEntries(vragen.map((v) => [v.veld, v.nieuw]))
        }
      }
      const alles = { ...patch, ...overnemen }
      if (Object.keys(alles).length) {
        await updateCustomer(id, alles)
        toast.success(t('klant.vies.ingevuld'))
      } else if (!vragen.length) {
        toast.success(t(gevonden.reden === 'geheim' ? 'klant.vies.geheim' : 'klant.vies.klopt'))
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setZoektBtw(false)
    }
  }

  const zetContact = (contactId, patch) =>
    zet({
      contacts: (klant.contacts ?? []).map((c) => (c.id === contactId ? { ...c, ...patch } : c)),
    })

  // Wat aan de klant hangt maar geen event is: subtaken uit de tijd dat de
  // klant ook op de taken onder een event werd gezet. Ze horen niet in de
  // historiek — anders telt hetzelfde bedrag mee zo vaak als er taken zijn.
  const losseTaken = tasks.filter((t) => t.parentId)
  const hoofd = primaryContact(klant)
  const factuur = billingAddressOf(klant)
  const factuurMail = billingEmailOf(klant)
  const zetFactuuradres = (veld) => (e) =>
    zet({ billingAddress: { ...leegAdres(), ...klant.billingAddress, [veld]: e.target.value } })

  return (
    <Drawer
      open
      onClose={onClose}
      title={klant.name}
      subtitle={[
        klant.address?.city,
        klant.vatNumber,
        // Het antwoord op "wat zijn die waard voor ons" hoort in de kop te
        // staan, niet pas onderaan het paneel.
        historiek.aantal
          ? t('klant.kop', { aantal: historiek.aantal, bedrag: formatCurrency(historiek.totaal) })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      footer={
        <Acties
          gevaar={
            tasks.length === 0
              ? {
                  label: t('alg.verwijderen'),
                  // Stil, zoals op de taakfiche: "uit gebruik" ernaast is de
                  // gewone keuze, en het rode kader maakte van de uitzondering
                  // de knop die het eerst opviel. Zie "Call to action" in
                  // docs/design-je-concept.md.
                  toon: 'stil',
                  size: 'sm',
                  vraag: t('klant.weg_vraag'),
                  onConfirm: () => deleteCustomer(id).then(onClose),
                }
              : null
          }
          uitleg={tasks.length === 0 ? null : t('klant.niet_weg', { aantal: tasks.length })}
          tweede={
            klant.archived
              ? { label: t('klant.terughalen'), size: 'sm', onClick: () => restoreCustomer(id) }
              : {
                  label: t('klant.uit_gebruik'),
                  size: 'sm',
                  vraag: t('klant.uit_gebruik_vraag'),
                  onClick: () => archiveCustomer(id),
                }
          }
        />
      }
    >
      <div className="space-y-5 px-5 py-4">
        <section className="grid gap-2 sm:grid-cols-2">
          <Field label={t('klant.bedrijfsnaam')} className="sm:col-span-2">
            <Input
              // Een sleutel, zodat een naam uit VIES ook in het veld verschijnt.
              key={klant.name}
              defaultValue={klant.name}
              onBlur={(e) => e.target.value.trim() && zet({ name: e.target.value.trim() })}
            />
          </Field>

          {/*
            Het adres waarop deze klant al zijn dossiers volgt. De sleutel
            wordt pas aangemaakt bij de eerste klik: een sleutel die nooit
            gedeeld is, hoeft niet te bestaan.
          */}
          <div className="sm:col-span-2">
            <KlantLink klant={klant} toast={toast} />
          </div>
          {/* Wat je typt wordt netjes gezet, niet geweigerd: een half nummer
              is beter dan een leeg veld, en de opmerking eronder zegt waarom
              het nagekeken moet worden. */}
          {/* Een nieuw nummer zoekt meteen naam en adres op: daarvoor typ
              je het meestal in. De knop is voor later, wanneer een klant
              verhuisd is of het eerst niet lukte. */}
          <Field label={t('klant.btw')} hint={vatHint(klant.vatNumber)}>
            <div className="je-btwveld">
              <Input
                key={klant.vatNumber}
                defaultValue={klant.vatNumber}
                placeholder="BE 0123.456.789"
                aria-label={t('klant.btw')}
                onBlur={(e) => {
                  const nummer = formatVat(e.target.value)
                  if (nummer === (klant.vatNumber ?? '')) return
                  zet({ vatNumber: nummer })
                  if (nummer) zoekBtw(nummer)
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                iconLeft="search"
                loading={zoektBtw}
                disabled={!klant.vatNumber}
                title={t('klant.vies.uitleg')}
                onClick={() => zoekBtw(klant.vatNumber)}
              >
                {t('klant.vies.knop')}
              </Button>
            </div>
          </Field>
          <Field label={t('klant.merk')} hint={t('klant.merk_hint')}>
            <Select value={klant.brandId ?? ''} onChange={(e) => zet({ brandId: e.target.value || null })}>
              <option value="">{t('alg.geen')}</option>
              {brands.map((merk) => (
                <option key={merk.id} value={merk.id}>
                  {merk.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('klant.email')}>
            <Input type="email" defaultValue={klant.email} onBlur={(e) => zet({ email: e.target.value.trim() })} />
          </Field>
          <Field label={t('klant.telefoon')}>
            <Input defaultValue={klant.phone} onBlur={(e) => zet({ phone: e.target.value.trim() })} />
          </Field>
          <Field label={t('klant.website')} className="sm:col-span-2">
            <Input defaultValue={klant.website} onBlur={(e) => zet({ website: e.target.value.trim() })} />
          </Field>
          {/*
            De korting staat hier en niet op de offerte, zodat dezelfde klant
            hetzelfde bedrag ziet of hij nu belt of zelf op de verhuursite
            afrekent. Alleen op materiaal: op catering is de marge te dun om er
            een vast percentage af te halen.
          */}
          <Field label={t('klant.korting_materiaal')} hint={t('klant.korting_materiaal_hint')}>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={klant.kortingMateriaal ?? 0}
              onBlur={(e) =>
                zet({ kortingMateriaal: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })
              }
            />
          </Field>
        </section>

        <section className="grid gap-2 sm:grid-cols-4">
          <Field label={t('klant.straat')} className="sm:col-span-4">
            <Input
              key={`straat-${klant.address?.street ?? ''}`}
              defaultValue={klant.address?.street ?? ''}
              onBlur={(e) => zet({ address: { ...leegAdres(), ...klant.address, street: e.target.value } })}
            />
          </Field>
          <Field label={t('klant.postcode')}>
            <Input
              key={`postcode-${klant.address?.postalCode ?? ''}`}
              defaultValue={klant.address?.postalCode ?? ''}
              onBlur={(e) => zet({ address: { ...leegAdres(), ...klant.address, postalCode: e.target.value } })}
            />
          </Field>
          <Field label={t('klant.gemeente')} className="sm:col-span-2">
            <Input
              key={`gemeente-${klant.address?.city ?? ''}`}
              defaultValue={klant.address?.city ?? ''}
              onBlur={(e) => zet({ address: { ...leegAdres(), ...klant.address, city: e.target.value } })}
            />
          </Field>
          <Field label={t('klant.land')}>
            <Input
              key={`land-${klant.address?.country ?? ''}`}
              defaultValue={klant.address?.country ?? 'België'}
              onBlur={(e) => zet({ address: { ...leegAdres(), ...klant.address, country: e.target.value } })}
            />
          </Field>
        </section>

        {/* Facturatie gaat vaak ergens anders naartoe dan de post — een
            boekhoudkantoor, een hoofdzetel, een aparte mailbox. Leeg laten
            betekent hier "hetzelfde als hierboven"; dat scheelt twee adressen
            die stil uit elkaar lopen. */}
        <section className="grid gap-2 sm:grid-cols-4">
          <h3 className="label mb-0 sm:col-span-4">
            {t('klant.facturatie')}
            {/* Een echte spatie: de marge alleen liet live "FACTURATIEWijkt af" staan. */}{' '}
            <span className="ml-2 font-normal normal-case text-ink-400">
              {factuur.eigen || factuurMail.eigen ? t('klant.facturatie_anders') : t('klant.facturatie_leeg')}
            </span>
          </h3>
          <Field
            label={t('klant.factuur_email')}
            className="sm:col-span-2"
            hint={factuurMail.email ? t('klant.factuur_email_hint', { email: factuurMail.email }) : null}
          >
            <Input
              type="email"
              defaultValue={klant.billingEmail ?? ''}
              placeholder={klant.email || t('klant.factuur_email_plaats')}
              onBlur={(e) => zet({ billingEmail: e.target.value.trim() })}
            />
          </Field>
          <Field label={t('klant.straat')} className="sm:col-span-2">
            <Input
              defaultValue={klant.billingAddress?.street ?? ''}
              placeholder={klant.address?.street ?? ''}
              onBlur={zetFactuuradres('street')}
            />
          </Field>
          <Field label={t('klant.postcode')}>
            <Input
              defaultValue={klant.billingAddress?.postalCode ?? ''}
              placeholder={klant.address?.postalCode ?? ''}
              onBlur={zetFactuuradres('postalCode')}
            />
          </Field>
          <Field label={t('klant.gemeente')} className="sm:col-span-2">
            <Input
              defaultValue={klant.billingAddress?.city ?? ''}
              placeholder={klant.address?.city ?? ''}
              onBlur={zetFactuuradres('city')}
            />
          </Field>
          <Field label={t('klant.land')}>
            <Input
              defaultValue={klant.billingAddress?.country ?? ''}
              placeholder={klant.address?.country ?? 'België'}
              onBlur={zetFactuuradres('country')}
            />
          </Field>
          <p className="sm:col-span-4 text-xs text-ink-500">
            {t('klant.factuur_naar', { adres: addressLine(factuur.adres) || t('klant.geen_adres') })}
            {factuurMail.email ? ` · ${factuurMail.email}` : ''}
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <h3 className="label mb-0">
              {t('klant.contacten', { aantal: klant.contacts?.length ?? 0 })}
              {hoofd?.name ? (
                <span className="ml-2 font-normal normal-case text-ink-400">
                  {t('klant.bel', { naam: hoofd.name })}
                </span>
              ) : null}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => zet({ contacts: [...(klant.contacts ?? []), nieuwContact()] })}
            >
              {t('klant.contact_nieuw')}
            </Button>
          </div>

          <ul className="mt-2 space-y-2">
            {(klant.contacts ?? []).map((contact) => (
              <li key={contact.id} className="grid gap-2 rounded-lg bg-ink-50 p-2.5 sm:grid-cols-2">
                <Field label={t('klant.contact_naam')}>
                  <Input
                    defaultValue={contact.name}
                    onBlur={(e) => zetContact(contact.id, { name: e.target.value })}
                  />
                </Field>
                <Field label={t('klant.contact_rol')} hint={t('klant.contact_rol_hint')}>
                  <Input
                    defaultValue={contact.role}
                    onBlur={(e) => zetContact(contact.id, { role: e.target.value })}
                  />
                </Field>
                <Field label={t('klant.email')}>
                  <Input
                    type="email"
                    defaultValue={contact.email}
                    onBlur={(e) => zetContact(contact.id, { email: e.target.value })}
                  />
                </Field>
                <Field label={t('klant.telefoon')}>
                  <Input
                    defaultValue={contact.phone}
                    onBlur={(e) => zetContact(contact.id, { phone: e.target.value })}
                  />
                </Field>
                <div className="flex items-center gap-3 sm:col-span-2">
                  {/* Een vinkje en geen keuzerondje: die laatste hoort bij een
                      groep met één naam, en deze staan per contactpersoon in
                      een eigen kaartje. Aanvinken duidt de andere vanzelf af. */}
                  <Checkbox
                    label={t('klant.hoofdcontact')}
                    checked={hoofd?.id === contact.id}
                    onChange={() =>
                      zet({
                        contacts:
                          hoofd?.id === contact.id
                            ? setPrimaryContact(klant.contacts ?? [], null)
                            : setPrimaryContact(klant.contacts ?? [], contact.id),
                      })
                    }
                  />
                  <GevaarKnop
                    label={t('klant.contact_weg')}
                    size="sm"
                    className="ml-auto"
                    vraag={t('klant.contact_weg_vraag')}
                    onConfirm={() =>
                      zet({ contacts: (klant.contacts ?? []).filter((c) => c.id !== contact.id) })
                    }
                  />
                </div>
              </li>
            ))}
            {(klant.contacts ?? []).length === 0 ? (
              <li className="text-sm text-ink-500">{t('klant.geen_contacten')}</li>
            ) : null}
          </ul>
        </section>

        <Documents customerId={id} titel={t('klant.documenten')} />

        {/* Waar de module om bestaat: wat deden we voor hen, en wat staat er
            nog open richting facturatie. Het stond tot nu alleen op het bord,
            per event, en dus nergens bij elkaar. */}
        {historiek.teFactureren.aantal > 0 ? (
          <section className="je-klant-factureren">
            <h3 className="label mb-0">{t('klant.te_factureren', { aantal: historiek.teFactureren.aantal })}</h3>
            <ul>
              {historiek.teFactureren.events.map((ev) => (
                <li key={ev.id} className="je-klant-rij">
                  <span className="je-klant-rij__datum">{ev.date ? formatDate(ev.date) : '—'}</span>
                  <button type="button" onClick={() => setOpenEvent(ev.id)} className="je-klant-rij__naam">
                    {ev.title}
                  </button>
                  <span className="je-klant-rij__bedrag">{formatCurrency(ev.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="je-klant-totaal">
              <span>{t('klant.openstaand')}</span>
              <strong>{formatCurrency(historiek.teFactureren.totaal)}</strong>
            </p>
          </section>
        ) : null}

        <section>
          <h3 className="label">{t('klant.historiek', { aantal: historiek.aantal })}</h3>
          {historiek.aantal === 0 ? (
            <p className="text-sm text-ink-500">{t('klant.historiek_leeg')}</p>
          ) : (
            <>
              <ul className="mt-1 divide-y divide-ink-100">
                {historiek.events.map((ev) => (
                  <li key={ev.id} className="je-klant-rij py-2">
                    <span className="je-klant-rij__datum">{ev.date ? formatDate(ev.date) : t('klant.geen_datum')}</span>
                    {/* Het event zelf open, niet het bord eromheen: wie hier
                        klikt wil de fiche, niet de kolommen. */}
                    <button type="button" onClick={() => setOpenEvent(ev.id)} className="je-klant-rij__naam">
                      {ev.title}
                    </button>
                    {ev.statusName ? (
                      <Badge color={ev.statusColor ?? STANDAARD_KLEUR} subtle>
                        {labelOf(ev.statusName, eventsList?.statuses ?? [])}
                      </Badge>
                    ) : null}
                    <span className="je-klant-rij__bedrag">{formatCurrency(ev.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="je-klant-totaal">
                <span>{t('klant.samen_offertes')}</span>
                <strong>{formatCurrency(historiek.totaal)}</strong>
              </p>
            </>
          )}
        </section>

        {losseTaken.length > 0 ? (
          <section>
            <h3 className="label">{t('klant.losse_taken', { aantal: losseTaken.length })}</h3>
            <ul className="mt-1 divide-y divide-ink-100">
              {losseTaken.map((taak) => (
                <li key={taak.id} className="flex items-center gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => setOpenEvent(taak.id)}
                    className="min-w-0 flex-1 truncate text-left text-sm text-ink-800 hover:underline"
                  >
                    {taak.title}
                  </button>
                  {taak.dueDate ? (
                    <span className="shrink-0 text-[11px] text-ink-400">{relativeDay(taak.dueDate)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {openEvent ? (
          <TaskDrawer taskId={openEvent} onClose={() => setOpenEvent(null)} />
        ) : null}

        {/* Het vrije notitieveld van vroeger is weg: wat erin stond, is een
            notitie aan deze klant geworden (zie `scripts/seed.mjs`). Twee
            plekken voor "wat we over deze klant weten" betekent dat het
            altijd in de andere staat. */}
        <GekoppeldeNotities koppeling={{ soort: 'klant', id: klant.id, label: klant.name }} />
      </div>
    </Drawer>
  )
}
