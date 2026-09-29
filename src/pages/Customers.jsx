import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { relativeDay } from '@lib/dates'
import { Badge, Button, ConfirmButton, Drawer, Field, Input, Select, Spinner, Textarea } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import Documents from '@components/common/Documents'
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
  const { brands } = useWorkspace()
  const klant = customers.find((c) => c.id === id)
  const { tasks } = useCustomerTasks(id)

  if (!klant) return null

  const zet = (patch) => updateCustomer(id, patch).catch((err) => toast.error(err.message))

  const zetContact = (contactId, patch) =>
    zet({
      contacts: (klant.contacts ?? []).map((c) => (c.id === contactId ? { ...c, ...patch } : c)),
    })

  return (
    <Drawer
      open
      onClose={onClose}
      title={klant.name}
      subtitle={[klant.address?.city, klant.vatNumber].filter(Boolean).join(' · ')}
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
          <Field label="Btw-nummer">
            <Input defaultValue={klant.vatNumber} onBlur={(e) => zet({ vatNumber: e.target.value.trim() })} />
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

        <section>
          <div className="flex items-center gap-2">
            <h3 className="label mb-0">Contactpersonen ({klant.contacts?.length ?? 0})</h3>
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
                <div className="sm:col-span-2">
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    className="text-ink-400"
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

        <section>
          <h3 className="label">Events en taken ({tasks.length})</h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-ink-500">
              Nog niets. Koppel een event aan deze klant vanuit het eventbord.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-ink-100">
              {tasks.map((taak) => (
                <li key={taak.id} className="flex items-center gap-2 py-2">
                  <Link
                    to={`/bord/${taak.listId}`}
                    onClick={onClose}
                    className="min-w-0 flex-1 truncate text-sm text-ink-800 hover:underline"
                  >
                    {taak.title}
                  </Link>
                  {taak.statusName ? (
                    <Badge color={taak.statusColor ?? '#8593a9'} subtle>
                      {taak.statusName}
                    </Badge>
                  ) : null}
                  {taak.dueDate ? (
                    <span className="shrink-0 text-[11px] text-ink-400">{relativeDay(taak.dueDate)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

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
