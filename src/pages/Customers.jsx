import { useMemo, useState } from 'react'
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
} from '@lib/klanten'
import { Badge, Button, ConfirmButton, Drawer, Field, Input, Select, Spinner, Textarea } from '@ui/index'
import { Checkbox } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import Documents from '@components/common/Documents'
import TaskDrawer from '@components/board/TaskDrawer'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  archiveCustomer,
  createCustomer,
  deleteCustomer,
  leegAdres,
  nieuwContact,
  restoreCustomer,
  updateCustomer,
  useCustomerTasks,
  useCustomers,
} from '@data/customers'

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
  const toast = useToast()
  const [zoek, setZoek] = useState('')
  const [open, setOpen] = useState(null)
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

  const maak = async () => {
    try {
      const id = await createCustomer({ name: 'Nieuwe klant', address: leegAdres() })
      setNieuw(false)
      setOpen(id)
      toast.success('Klant aangemaakt.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Klanten"
        subtitle={`${customers.filter((c) => !c.archived).length} actief`}
        actions={
          <>
            <Input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek op naam, btw, stad of contactpersoon"
              className="h-8 w-64 text-sm"
              aria-label="Zoeken"
            />
            <Button variant="primary" size="sm" onClick={maak} disabled={nieuw}>
              + Klant
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : zichtbaar.length === 0 ? (
          <p className="card px-4 py-8 text-center text-sm text-ink-500">
            {zoek ? 'Geen klant gevonden.' : 'Nog geen klanten. Maak er een aan met “+ Klant”.'}
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
                      <Badge color="#8593a9" subtle>
                        uit
                      </Badge>
                    ) : klant.brandId && brandById[klant.brandId] ? (
                      <Badge color={brandById[klant.brandId].color} subtle>
                        {brandById[klant.brandId].name}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-500">
                    {[klant.address?.city, klant.vatNumber].filter(Boolean).join(' · ') || 'Geen gegevens'}
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

function KlantPaneel({ id, onClose, toast }) {
  const { customers } = useCustomers({ includeArchived: true })
  const { brands, eventsList } = useWorkspace()
  const klant = customers.find((c) => c.id === id)
  const { tasks } = useCustomerTasks(id)
  const [openEvent, setOpenEvent] = useState(null)

  // Het rekenwerk staat in @lib/klanten en niet hier: zo is te testen dat "te
  // factureren" echt telt wat op die stap staat, zonder een browser te openen.
  const historiek = useMemo(() => customerHistory(tasks), [tasks])

  if (!klant) return null

  const zet = (patch) => updateCustomer(id, patch).catch((err) => toast.error(err.message))

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
          ? `${historiek.aantal} event${historiek.aantal === 1 ? '' : 's'} · ${formatCurrency(historiek.totaal)}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      footer={
        <>
          {klant.archived ? (
            <Button variant="ghost" size="sm" onClick={() => restoreCustomer(id)}>
              Terughalen
            </Button>
          ) : (
            <ConfirmButton
              variant="ghost"
              size="sm"
              className="text-ink-400"
              question="Klant uit gebruik nemen? De events blijven bewaard."
              onConfirm={() => archiveCustomer(id)}
            >
              Uit gebruik nemen
            </ConfirmButton>
          )}
          {tasks.length === 0 ? (
            <ConfirmButton
              variant="ghost"
              size="sm"
              className="text-red-700"
              question="Deze klant definitief verwijderen?"
              onConfirm={() => deleteCustomer(id).then(onClose)}
            >
              Verwijderen
            </ConfirmButton>
          ) : (
            <span className="text-xs text-ink-400">
              {tasks.length} event{tasks.length === 1 ? '' : 's'} — daarom niet te verwijderen
            </span>
          )}
        </>
      }
    >
      <div className="space-y-5 px-5 py-4">
        <section className="grid gap-2 sm:grid-cols-2">
          <Field label="Bedrijfsnaam" className="sm:col-span-2">
            <Input
              defaultValue={klant.name}
              onBlur={(e) => e.target.value.trim() && zet({ name: e.target.value.trim() })}
            />
          </Field>
          {/* Wat je typt wordt netjes gezet, niet geweigerd: een half nummer
              is beter dan een leeg veld, en de opmerking eronder zegt waarom
              het nagekeken moet worden. */}
          <Field label="Btw-nummer" hint={vatHint(klant.vatNumber)}>
            <Input
              key={klant.vatNumber}
              defaultValue={klant.vatNumber}
              placeholder="BE 0123.456.789"
              onBlur={(e) => zet({ vatNumber: formatVat(e.target.value) })}
            />
          </Field>
          <Field label="Merk" hint="Onder welk merk valt deze klant meestal?">
            <Select value={klant.brandId ?? ''} onChange={(e) => zet({ brandId: e.target.value || null })}>
              <option value="">Geen</option>
              {brands.map((merk) => (
                <option key={merk.id} value={merk.id}>
                  {merk.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="E-mail">
            <Input type="email" defaultValue={klant.email} onBlur={(e) => zet({ email: e.target.value.trim() })} />
          </Field>
          <Field label="Telefoon">
            <Input defaultValue={klant.phone} onBlur={(e) => zet({ phone: e.target.value.trim() })} />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <Input defaultValue={klant.website} onBlur={(e) => zet({ website: e.target.value.trim() })} />
          </Field>
        </section>

        <section className="grid gap-2 sm:grid-cols-4">
          <Field label="Straat en nummer" className="sm:col-span-4">
            <Input
              defaultValue={klant.address?.street ?? ''}
              onBlur={(e) => zet({ address: { ...leegAdres(), ...klant.address, street: e.target.value } })}
            />
          </Field>
          <Field label="Postcode">
            <Input
              defaultValue={klant.address?.postalCode ?? ''}
              onBlur={(e) => zet({ address: { ...leegAdres(), ...klant.address, postalCode: e.target.value } })}
            />
          </Field>
          <Field label="Gemeente" className="sm:col-span-2">
            <Input
              defaultValue={klant.address?.city ?? ''}
              onBlur={(e) => zet({ address: { ...leegAdres(), ...klant.address, city: e.target.value } })}
            />
          </Field>
          <Field label="Land">
            <Input
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
            Facturatie
            <span className="ml-2 font-normal normal-case text-ink-400">
              {factuur.eigen || factuurMail.eigen
                ? 'Wijkt af van de gegevens hierboven'
                : 'Leeg = dezelfde gegevens als hierboven'}
            </span>
          </h3>
          <Field label="Factuur-e-mail" className="sm:col-span-2" hint={factuurMail.email ? `Facturen naar ${factuurMail.email}` : null}>
            <Input
              type="email"
              defaultValue={klant.billingEmail ?? ''}
              placeholder={klant.email || 'boekhouding@…'}
              onBlur={(e) => zet({ billingEmail: e.target.value.trim() })}
            />
          </Field>
          <Field label="Straat en nummer" className="sm:col-span-2">
            <Input
              defaultValue={klant.billingAddress?.street ?? ''}
              placeholder={klant.address?.street ?? ''}
              onBlur={zetFactuuradres('street')}
            />
          </Field>
          <Field label="Postcode">
            <Input
              defaultValue={klant.billingAddress?.postalCode ?? ''}
              placeholder={klant.address?.postalCode ?? ''}
              onBlur={zetFactuuradres('postalCode')}
            />
          </Field>
          <Field label="Gemeente" className="sm:col-span-2">
            <Input
              defaultValue={klant.billingAddress?.city ?? ''}
              placeholder={klant.address?.city ?? ''}
              onBlur={zetFactuuradres('city')}
            />
          </Field>
          <Field label="Land">
            <Input
              defaultValue={klant.billingAddress?.country ?? ''}
              placeholder={klant.address?.country ?? 'België'}
              onBlur={zetFactuuradres('country')}
            />
          </Field>
          <p className="sm:col-span-4 text-xs text-ink-500">
            Factuur naar {addressLine(factuur.adres) || 'nog geen adres'}
            {factuurMail.email ? ` · ${factuurMail.email}` : ''}
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <h3 className="label mb-0">
              Contactpersonen ({klant.contacts?.length ?? 0})
              {hoofd?.name ? <span className="ml-2 font-normal normal-case text-ink-400">bel {hoofd.name}</span> : null}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => zet({ contacts: [...(klant.contacts ?? []), nieuwContact()] })}
            >
              + Contact
            </Button>
          </div>

          <ul className="mt-2 space-y-2">
            {(klant.contacts ?? []).map((contact) => (
              <li key={contact.id} className="grid gap-2 rounded-lg bg-ink-50 p-2.5 sm:grid-cols-2">
                <Field label="Naam">
                  <Input
                    defaultValue={contact.name}
                    onBlur={(e) => zetContact(contact.id, { name: e.target.value })}
                  />
                </Field>
                <Field label="Rol" hint="Zaakvoerder, eventmanager, boekhouding…">
                  <Input
                    defaultValue={contact.role}
                    onBlur={(e) => zetContact(contact.id, { role: e.target.value })}
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    defaultValue={contact.email}
                    onBlur={(e) => zetContact(contact.id, { email: e.target.value })}
                  />
                </Field>
                <Field label="Telefoon">
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
                    label="Hoofdcontactpersoon"
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
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-ink-400"
                    question="Deze contactpersoon verwijderen?"
                    onConfirm={() =>
                      zet({ contacts: (klant.contacts ?? []).filter((c) => c.id !== contact.id) })
                    }
                  >
                    Contact weg
                  </ConfirmButton>
                </div>
              </li>
            ))}
            {(klant.contacts ?? []).length === 0 ? (
              <li className="text-sm text-ink-500">Nog geen contactpersonen.</li>
            ) : null}
          </ul>
        </section>

        <Documents customerId={id} titel="Logo's en documenten" />

        {/* Waar de module om bestaat: wat deden we voor hen, en wat staat er
            nog open richting facturatie. Het stond tot nu alleen op het bord,
            per event, en dus nergens bij elkaar. */}
        {historiek.teFactureren.aantal > 0 ? (
          <section className="je-klant-factureren">
            <h3 className="label mb-0">
              Nog te factureren ({historiek.teFactureren.aantal})
            </h3>
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
              <span>Openstaand</span>
              <strong>{formatCurrency(historiek.teFactureren.totaal)}</strong>
            </p>
          </section>
        ) : null}

        <section>
          <h3 className="label">Historiek ({historiek.aantal} event{historiek.aantal === 1 ? '' : 's'})</h3>
          {historiek.aantal === 0 ? (
            <p className="text-sm text-ink-500">
              Nog niets. Koppel een event aan deze klant op de fiche van dat event.
            </p>
          ) : (
            <>
              <ul className="mt-1 divide-y divide-ink-100">
                {historiek.events.map((ev) => (
                  <li key={ev.id} className="je-klant-rij py-2">
                    <span className="je-klant-rij__datum">{ev.date ? formatDate(ev.date) : 'geen datum'}</span>
                    {/* Het event zelf open, niet het bord eromheen: wie hier
                        klikt wil de fiche, niet de kolommen. */}
                    <button type="button" onClick={() => setOpenEvent(ev.id)} className="je-klant-rij__naam">
                      {ev.title}
                    </button>
                    {ev.statusName ? (
                      <Badge color={ev.statusColor ?? '#8593a9'} subtle>
                        {labelOf(ev.statusName, eventsList?.statuses ?? [])}
                      </Badge>
                    ) : null}
                    <span className="je-klant-rij__bedrag">{formatCurrency(ev.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="je-klant-totaal">
                <span>Samen aan offertes</span>
                <strong>{formatCurrency(historiek.totaal)}</strong>
              </p>
            </>
          )}
        </section>

        {losseTaken.length > 0 ? (
          <section>
            <h3 className="label">Losse taken ({losseTaken.length})</h3>
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

        <Field label="Notities">
          <Textarea
            defaultValue={klant.notes}
            rows={4}
            onBlur={(e) => zet({ notes: e.target.value })}
            placeholder="Afspraken, voorkeuren, gevoeligheden…"
          />
        </Field>
      </div>
    </Drawer>
  )
}
