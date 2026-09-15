import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@lib/firebase'
import { fromQuery } from '@lib/collections'
import {
  Avatar,
  Badge,
  Button,
  ConfirmButton,
  Field,
  Input,
  Select,
  Spinner,
} from '@ui/index'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  archiveList,
  createBrand,
  createList,
  createSpace,
  deleteTag,
  inviteMember,
  revokeInvite,
  setHourlyRate,
  setMemberActive,
  setMemberRole,
  updateBrand,
  updateList,
  upsertTag,
} from '@data/workspace'
import { connectCanva, disconnectCanva, useCanvaStatus } from '@data/canva'

const TABS = [
  { key: 'team', label: 'Team' },
  { key: 'structure', label: 'Ruimtes & lijsten' },
  { key: 'brands', label: 'Merken & labels' },
  { key: 'canva', label: 'Canva' },
]

export default function Settings() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('team')

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Instellingen"
        subtitle={isAdmin ? 'Je bent beheerder' : 'Alleen beheerders kunnen het team aanpassen'}
        tabs={TABS.map((t) => (
          <Tab key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </Tab>
        ))}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {tab === 'team' ? <TeamSettings isAdmin={isAdmin} /> : null}
        {tab === 'structure' ? <StructureSettings /> : null}
        {tab === 'brands' ? <BrandSettings /> : null}
        {tab === 'canva' ? <CanvaSettings /> : null}
      </div>
    </div>
  )
}

// ─── Team ───────────────────────────────────────────────────────────────────

const ROLES = [
  { key: 'owner', label: 'Eigenaar' },
  { key: 'admin', label: 'Beheerder' },
  { key: 'member', label: 'Lid' },
  { key: 'guest', label: 'Gast' },
]

function TeamSettings({ isAdmin }) {
  const { profiles } = useWorkspace()
  const toast = useToast()
  const { uid } = useAuth()
  const [invites, setInvites] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')

  useEffect(() => {
    if (!isAdmin) return undefined
    return onSnapshot(
      collection(db, 'invites'),
      (snap) => setInvites(fromQuery(snap)),
      () => setInvites([])
    )
  }, [isAdmin])

  const invite = async (e) => {
    e.preventDefault()
    try {
      await inviteMember({ email, role, invitedBy: uid })
      toast.success(`${email} kan nu aanmelden met Google.`)
      setEmail('')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <h2 className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
          Leden ({profiles.length})
        </h2>
        <ul className="divide-y divide-ink-100">
          {profiles.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Avatar profile={p} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-900">{p.fullName || p.email}</p>
                <p className="truncate text-xs text-ink-500">{p.email}</p>
              </div>

              {isAdmin ? (
                <>
                  <Field label="Uurtarief" className="w-28">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      defaultValue={p.hourlyRate ?? ''}
                      onBlur={(e) => setHourlyRate(p.id, e.target.value)}
                      className="h-8 text-xs"
                    />
                  </Field>
                  <Select
                    value={p.role}
                    onChange={(e) => setMemberRole(p.id, e.target.value)}
                    className="h-8 w-32 text-xs"
                    aria-label={`Rol van ${p.email}`}
                  >
                    {ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant={p.active === false ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMemberActive(p.id, p.active === false)}
                  >
                    {p.active === false ? 'Heractiveren' : 'Deactiveren'}
                  </Button>
                </>
              ) : (
                <Badge color="#8593a9" subtle>
                  {ROLES.find((r) => r.key === p.role)?.label ?? p.role}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin ? (
        <section className="card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-600">
            Iemand uitnodigen
          </h2>

          <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
            <Field label="E-mailadres" className="min-w-[14rem] flex-1">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@jeconcept.be"
              />
            </Field>
            <Field label="Rol" className="w-40">
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="primary">
              Uitnodigen
            </Button>
          </form>

          <p className="mt-2 text-xs text-ink-500">
            Adressen op <strong>@jeconcept.be</strong> en <strong>@kenjeklanten.be</strong> hebben
            geen uitnodiging nodig — die krijgen bij hun eerste aanmelding automatisch toegang.
          </p>

          {invites.length > 0 ? (
            <ul className="mt-3 divide-y divide-ink-100 rounded-md border border-ink-200">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="flex-1 truncate text-ink-800">{i.email ?? i.id}</span>
                  <Badge color="#8593a9" subtle>
                    {ROLES.find((r) => r.key === i.role)?.label ?? i.role}
                  </Badge>
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    question="Uitnodiging intrekken?"
                    onConfirm={() => revokeInvite(i.email ?? i.id)}
                    aria-label="Intrekken"
                  >
                    ✕
                  </ConfirmButton>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

// ─── Spaces and lists ───────────────────────────────────────────────────────

function StructureSettings() {
  const { spaces, lists } = useWorkspace()
  const toast = useToast()
  const [spaceName, setSpaceName] = useState('')
  const [listDraft, setListDraft] = useState({ spaceId: '', name: '', kind: 'tasks' })

  const addSpace = async (e) => {
    e.preventDefault()
    try {
      await createSpace(spaceName)
      setSpaceName('')
      toast.success('Ruimte aangemaakt.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addList = async (e) => {
    e.preventDefault()
    try {
      await createList(listDraft)
      setListDraft((d) => ({ ...d, name: '' }))
      toast.success('Lijst aangemaakt, met vier standaardkolommen.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {spaces.map((space) => (
        <section key={space.id} className="card overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-ink-100 px-4 py-2.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: space.color }}
            />
            <span className="text-sm font-semibold text-ink-900">{space.name}</span>
          </h2>

          <ul className="divide-y divide-ink-100">
            {lists
              .filter((l) => l.spaceId === space.id)
              .map((list) => (
                <li key={list.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <Input
                    defaultValue={list.name}
                    onBlur={(e) =>
                      e.target.value.trim() && updateList(list.id, { name: e.target.value.trim() })
                    }
                    className="h-8 max-w-xs text-sm"
                    aria-label="Lijstnaam"
                  />
                  <Badge color={list.kind === 'social' ? '#d62976' : '#3377ff'} subtle>
                    {list.kind === 'social' ? 'social' : 'taken'}
                  </Badge>
                  {list.archived ? (
                    <Button variant="ghost" size="sm" onClick={() => updateList(list.id, { archived: false })}>
                      Terughalen
                    </Button>
                  ) : (
                    <ConfirmButton
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-ink-400"
                      question="Lijst archiveren? De taken blijven bewaard."
                      onConfirm={() => archiveList(list.id)}
                    >
                      Archiveren
                    </ConfirmButton>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={addSpace} className="card space-y-2 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">Nieuwe ruimte</h2>
          <Input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="Naam" required />
          <Button type="submit" variant="primary" size="sm" disabled={!spaceName.trim()}>
            Aanmaken
          </Button>
        </form>

        <form onSubmit={addList} className="card space-y-2 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">Nieuwe lijst</h2>
          <Select
            value={listDraft.spaceId}
            onChange={(e) => setListDraft((d) => ({ ...d, spaceId: e.target.value }))}
            required
            aria-label="Ruimte"
          >
            <option value="">Kies een ruimte…</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            value={listDraft.name}
            onChange={(e) => setListDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Naam"
            required
          />
          <Select
            value={listDraft.kind}
            onChange={(e) => setListDraft((d) => ({ ...d, kind: e.target.value }))}
            aria-label="Soort"
          >
            <option value="tasks">Takenbord</option>
            <option value="social">Socialcontent</option>
          </Select>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!listDraft.name.trim() || !listDraft.spaceId}
          >
            Aanmaken
          </Button>
        </form>
      </div>
    </div>
  )
}

// ─── Brands and tags ────────────────────────────────────────────────────────

function BrandSettings() {
  const { brands, tags } = useWorkspace()
  const toast = useToast()
  const [brand, setBrand] = useState({ name: '', key: '', color: '#3377ff' })
  const [tag, setTag] = useState({ name: '', color: '#8593a9' })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card overflow-hidden">
        <h2 className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
          Merken
        </h2>
        <ul className="divide-y divide-ink-100">
          {brands.map((b) => (
            <li key={b.id} className="flex items-center gap-2 px-4 py-2">
              <input
                type="color"
                value={b.color}
                onChange={(e) => updateBrand(b.id, { color: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded border border-ink-200 p-0.5"
                aria-label={`Kleur van ${b.name}`}
              />
              <Input
                defaultValue={b.name}
                onBlur={(e) => e.target.value.trim() && updateBrand(b.id, { name: e.target.value.trim() })}
                className="h-8 text-sm"
                aria-label="Merknaam"
              />
            </li>
          ))}
        </ul>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await createBrand({
                ...brand,
                key: brand.key || brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              })
              setBrand({ name: '', key: '', color: '#3377ff' })
              toast.success('Merk toegevoegd.')
            } catch (err) {
              toast.error(err.message)
            }
          }}
          className="flex items-center gap-2 border-t border-ink-100 px-4 py-3"
        >
          <input
            type="color"
            value={brand.color}
            onChange={(e) => setBrand((b) => ({ ...b, color: e.target.value }))}
            className="h-8 w-8 cursor-pointer rounded border border-ink-200 p-0.5"
            aria-label="Kleur"
          />
          <Input
            value={brand.name}
            onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
            placeholder="Nieuw merk"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!brand.name.trim()}>
            Toevoegen
          </Button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
          Labels
        </h2>
        <ul className="flex flex-wrap gap-1.5 p-4">
          {tags.map((t) => (
            <li key={t.id}>
              <span className="inline-flex items-center gap-1">
                <Badge color={t.color}>{t.name}</Badge>
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-ink-400"
                  question={`Label "${t.name}" verwijderen?`}
                  onConfirm={() => deleteTag(t.id)}
                  aria-label="Label verwijderen"
                >
                  ✕
                </ConfirmButton>
              </span>
            </li>
          ))}
          {tags.length === 0 ? <li className="text-sm text-ink-500">Nog geen labels.</li> : null}
        </ul>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await upsertTag(tag)
              setTag({ name: '', color: '#8593a9' })
            } catch (err) {
              toast.error(err.message)
            }
          }}
          className="flex items-center gap-2 border-t border-ink-100 px-4 py-3"
        >
          <input
            type="color"
            value={tag.color}
            onChange={(e) => setTag((t) => ({ ...t, color: e.target.value }))}
            className="h-8 w-8 cursor-pointer rounded border border-ink-200 p-0.5"
            aria-label="Kleur"
          />
          <Input
            value={tag.name}
            onChange={(e) => setTag((t) => ({ ...t, name: e.target.value }))}
            placeholder="Nieuw label"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!tag.name.trim()}>
            Toevoegen
          </Button>
        </form>
      </section>
    </div>
  )
}

// ─── Canva ──────────────────────────────────────────────────────────────────

function CanvaSettings() {
  const canva = useCanvaStatus()
  const toast = useToast()

  if (canva.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Spinner /> Canva controleren…
      </div>
    )
  }

  return (
    <section className="card max-w-xl p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">Canva-koppeling</h2>

      {canva.connected ? (
        <>
          <p className="mt-2 text-sm text-ink-700">
            Gekoppeld{canva.canvaUserId ? ` als ${canva.canvaUserId}` : ''}. Je kan ontwerpen maken
            en openen vanuit de social kalender.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() =>
              disconnectCanva()
                .then(() => {
                  toast.success('Canva losgekoppeld.')
                  canva.refresh()
                })
                .catch((e) => toast.error(e.message))
            }
          >
            Loskoppelen
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-700">
            Koppel je Canva-account om ontwerpen rechtstreeks vanuit een post te maken, te openen
            en te exporteren. De koppeling geldt per persoon.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => connectCanva('/instellingen').catch((e) => toast.error(e.message))}
          >
            Canva koppelen
          </Button>
          {canva.error ? <p className="mt-2 text-xs text-red-600">{canva.error}</p> : null}
        </>
      )}
    </section>
  )
}
