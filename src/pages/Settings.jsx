import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@lib/firebase'
import { fromQuery } from '@lib/collections'
import { AFDELINGEN } from '@lib/checklist-templates'
import { PIPELINE, STEP_RULES, labelOf, toneOf } from '@lib/pipeline'
import { useNarrow } from '@lib/useNarrow'
import {
  Badge,
  Button,
  Field,
  Hex,
  Icon,
  IconButton,
  Input,
  Select,
  Switch,
  Tabs,
  Tag,
  initialsOf,
} from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import BusinessRules from '@components/settings/BusinessRules'
import ChecklistEditor from '@components/settings/ChecklistEditor'
import FormuleSettings from '@components/settings/FormuleSettings'
import { BrandSettings, StructureSettings } from '@components/settings/LegacySettings'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useEvents } from '@data/events'
import {
  DEFAULT_TEMPLATES,
  PRIO_OPTIONS,
  REPEAT_OPTIONS,
  TEMPLATE_ICONS,
  createTemplate,
  deleteTemplate,
  newTaskRow,
  resolveTemplate,
  saveTemplate,
  templateSummary,
} from '@data/templates'
import {
  inviteMember,
  revokeInvite,
  setHourlyRate,
  setMemberActive,
  setMemberDepartment,
  setMemberRole,
  updateBrand,
  updateList,
} from '@data/workspace'

const TABS = [
  { value: 'team', label: 'Team & toegang' },
  { value: 'pijplijn', label: 'Pijplijn' },
  { value: 'templates', label: 'Templates' },
  { value: 'formules', label: 'Formules' },
  { value: 'lijsten', label: 'Concepten & kostenplaatsen' },
  { value: 'structuur', label: 'Ruimtes & lijsten' },
  { value: 'merken', label: 'Merken & labels' },
  { value: 'dagelijks', label: 'Dagelijkse lijsten' },
  { value: 'regels', label: 'Business rules' },
]

/** Instellingen — alleen voor beheerders, zoals in het design. */
export default function Settings() {
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'team'
  const setTab = (v) => setParams({ tab: v }, { replace: true })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={isAdmin ? 'Beheer · alleen zichtbaar voor beheerders' : 'Geen toegang'}
        title="Instellingen"
      />
      <div className="je-pagebody">
        {!isAdmin ? (
          <div className="je-panel" style={{ maxWidth: 560, display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-6)' }}>
            <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
              <Icon name="lock" size={20} />
            </span>
            <div>
              <div style={{ font: 'var(--type-body)', fontWeight: 600 }}>Alleen voor beheerders</div>
              <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
                Team, toegang, pijplijn en templates worden beheerd door de eigenaars en beheerders.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 1040 }}>
            <Tabs items={TABS} value={tab} onChange={setTab} />
            {tab === 'team' ? <TeamTab /> : null}
            {tab === 'pijplijn' ? <PipelineTab /> : null}
            {tab === 'templates' ? <TemplatesTab initial={params.get('template')} /> : null}
            {tab === 'formules' ? <FormuleSettings /> : null}
            {tab === 'lijsten' ? <ConceptsTab /> : null}
            {tab === 'structuur' ? <StructureSettings /> : null}
            {tab === 'merken' ? <BrandSettings /> : null}
            {tab === 'dagelijks' ? <ChecklistEditor isAdmin /> : null}
            {tab === 'regels' ? <BusinessRules isAdmin /> : null}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Team & toegang ────────────────────────────────────────────────────────

const ROLES = [
  { value: 'owner', label: 'Eigenaar' },
  { value: 'admin', label: 'Beheerder' },
  { value: 'member', label: 'Lid' },
  { value: 'staff', label: 'Personeel' },
  { value: 'guest', label: 'Gast' },
]

function TeamTab() {
  const { profiles, allowedDomains } = useWorkspace()
  const { uid } = useAuth()
  const toast = useToast()
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [domainDraft, setDomainDraft] = useState('')

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'invites'),
        (snap) => setInvites(fromQuery(snap)),
        () => setInvites([])
      ),
    []
  )

  const active = profiles.filter((p) => p.active !== false)
  const archived = profiles.filter((p) => p.active === false)
  const inviteOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(inviteEmail.trim())

  const saveDomains = (list) =>
    setDoc(doc(db, 'config', 'access'), { allowedDomains: list }, { merge: true }).catch((err) => toast.error(err.message))

  const invite = async () => {
    if (!inviteOk) return
    try {
      await inviteMember({ email: inviteEmail, role: 'member', invitedBy: uid })
      toast.success(`${inviteEmail.trim()} kan nu aanmelden met Google.`)
      setInviteEmail('')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <>
      <section className="je-panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-5)', padding: 'var(--space-6)', flexWrap: 'wrap' }}>
          <Hex size={44} tone="quiet">
            <Icon name="shield-check" size={22} />
          </Hex>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="je-eyebrow">Aanmelden</div>
            <div style={{ font: 'var(--type-h3)', textTransform: 'uppercase', marginTop: 6 }}>Google SSO</div>
            <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)', marginTop: 4, maxWidth: '60ch' }}>
              Iedereen meldt aan met een Google-account. JE Plan bewaart geen wachtwoorden; wie uit Google verdwijnt,
              verliest meteen toegang.
            </div>
          </div>
          <Badge tone="success" dot>
            Enige methode
          </Badge>
        </div>
        <div style={{ padding: 'var(--space-5) var(--space-6)', borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="je-caps">Automatisch toegang voor</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
            {allowedDomains.map((d) => (
              <Tag key={d} onRemove={() => saveDomains(allowedDomains.filter((x) => x !== d))}>
                @{d}
              </Tag>
            ))}
            <input
              value={domainDraft}
              onChange={(e) => setDomainDraft(e.target.value)}
              onKeyDown={(e) => {
                const v = domainDraft.trim().replace(/^@/, '').toLowerCase()
                if (e.key === 'Enter' && v.includes('.') && !allowedDomains.includes(v)) {
                  saveDomains([...allowedDomains, v])
                  setDomainDraft('')
                }
              }}
              placeholder="+ domein toevoegen"
              aria-label="Domein toevoegen"
              className="je-underline-input"
              style={{ width: 170 }}
            />
          </div>
          <div className="je-muted-caption">Andere Google-accounts (bv. gmail.com) komen enkel binnen met een uitnodiging.</div>
        </div>
      </section>

      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">Team</span>
          <span className="je-panel__right">{active.length} actief</span>
        </div>
        {active.map((m, i) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-5)',
              padding: 'var(--space-4) var(--space-6)',
              borderTop: i ? '1px solid var(--border-hairline)' : 'none',
            }}
          >
            <Hex size={34} tone="ink">
              {initialsOf(m)}
            </Hex>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{m.fullName || m.email}</div>
              <div className="je-muted-caption">{[m.email, ...(m.aliases ?? [])].join(' · ')}</div>
            </div>
            {/*
              Je eigen rol staat vast. Wie zichzelf op "personeel" zet is zijn
              beheer kwijt en heeft niemand meer om het terug te draaien. De
              regels weigeren het ook; dit zorgt dat je er niet tegenaan loopt.
            */}
            <div style={{ width: 150 }}>
              <Select
                boxed
                options={ROLES}
                value={m.role}
                onChange={(e) => setMemberRole(m.id, e.target.value)}
                aria-label={`Rol van ${m.email}`}
                disabled={m.id === uid}
                title={m.id === uid ? 'Je eigen rol kun je niet wijzigen.' : undefined}
              />
            </div>
            {m.role === 'staff' ? (
              <div style={{ width: 150 }}>
                <Select
                  boxed
                  value={m.department ?? ''}
                  onChange={(e) => setMemberDepartment(m.id, e.target.value)}
                  aria-label={`Afdeling van ${m.email}`}
                  options={[
                    { value: '', label: 'Geen afdeling' },
                    ...AFDELINGEN.filter((a) => a.key !== 'iedereen').map((a) => ({ value: a.key, label: a.label })),
                  ]}
                />
              </div>
            ) : null}
            <div style={{ width: 110 }}>
              <Input
                type="number"
                min="0"
                step="0.5"
                defaultValue={m.hourlyRate ?? ''}
                onBlur={(e) => setHourlyRate(m.id, e.target.value)}
                placeholder="€ per uur"
                aria-label="Intern uurtarief"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={m.id === uid}
              title={m.id === uid ? 'Jezelf archiveren kan niet.' : undefined}
              onClick={() => setMemberActive(m.id, false)}
            >
              Archiveren
            </Button>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        <section className="je-panel" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <span className="je-eyebrow">Iemand uitnodigen</span>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Field label="Google-account">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') invite()
                  }}
                  placeholder="naam@gmail.com"
                />
              </Field>
            </div>
            <Button size="sm" disabled={!inviteOk} onClick={invite}>
              Uitnodigen
            </Button>
          </div>
          {invites.map((iv) => (
            <div
              key={iv.id}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-hairline)' }}
            >
              <span style={{ color: 'var(--text-2)', display: 'flex' }}>
                <Icon name="mail" size={16} />
              </span>
              <span style={{ flex: 1, font: 'var(--type-body-sm)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{iv.email ?? iv.id}</span>
              <Badge>Wacht</Badge>
              <IconButton icon="x" label="Uitnodiging intrekken" size="sm" onClick={() => revokeInvite(iv.email ?? iv.id)} />
            </div>
          ))}
        </section>
        <section className="je-panel">
          <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-hairline)' }}>
            <div className="je-eyebrow">Gearchiveerd</div>
            <div className="je-muted-caption" style={{ marginTop: 4 }}>
              Kunnen niet aanmelden. Hun uren en taken blijven bewaard.
            </div>
          </div>
          {archived.length === 0 ? (
            <div className="je-muted-caption" style={{ padding: 'var(--space-4) var(--space-6)' }}>
              Niemand gearchiveerd.
            </div>
          ) : null}
          {archived.map((m, i) => (
            <div
              key={m.id}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-6)', borderTop: i ? '1px solid var(--border-hairline)' : 'none' }}
            >
              <Hex size={28} tone="muted">
                {initialsOf(m)}
              </Hex>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>{m.fullName || m.email}</div>
                <div className="je-muted-caption" style={{ color: 'var(--text-3)' }}>
                  Uren en taken bewaard
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setMemberActive(m.id, true)}>
                Heractiveren
              </Button>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

// ─── Pijplijn ──────────────────────────────────────────────────────────────

function PipelineTab() {
  const { eventsList, eventStatuses } = useWorkspace()
  const toast = useToast()

  if (!eventsList) {
    return (
      <div className="je-panel" style={{ padding: 'var(--space-6)' }}>
        <div className="je-muted-caption">Er is nog geen eventlijst met de statuspijplijn.</div>
      </div>
    )
  }

  // Het label wordt hernoemd, de naam blijft: automatisaties en het
  // socialbord rekenen op de naam.
  const rename = (name, label) => {
    const statuses = eventStatuses.map((s) => (s.name === name ? { ...s, label: label.trim() || null } : s))
    updateList(eventsList.id, { statuses }).catch((err) => toast.error(err.message))
  }

  const rows = PIPELINE.filter((p) => eventStatuses.some((s) => s.name === p.key))

  return (
    <section className="je-panel">
      <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-hairline)' }}>
        <div className="je-eyebrow">Statuspijplijn events</div>
        <div className="je-muted-caption" style={{ marginTop: 4 }}>
          Namen aanpassen mag; de volgorde volgt het verloop van aanvraag tot betaling.
        </div>
      </div>
      {rows.map((p, i) => (
        <div
          key={p.key}
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-5)', padding: 'var(--space-3) var(--space-6)', borderTop: i ? '1px solid var(--border-hairline)' : 'none' }}
        >
          <span style={{ width: 24, font: 'var(--fw-medium) 15px/1 var(--font-display)', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div style={{ flex: 1, minWidth: 180, maxWidth: 280 }}>
            <Input
              key={labelOf(p.key, eventStatuses)}
              defaultValue={labelOf(p.key, eventStatuses)}
              onBlur={(e) => e.target.value !== labelOf(p.key, eventStatuses) && rename(p.key, e.target.value)}
              aria-label="Statusnaam"
            />
          </div>
          <Badge tone={toneOf(p.key)} dot>
            {labelOf(p.key, eventStatuses)}
          </Badge>
          <span className="je-muted-caption" style={{ marginLeft: 'auto' }}>
            {STEP_RULES[p.key] ?? ''}
          </span>
        </div>
      ))}
    </section>
  )
}

// ─── Templates ─────────────────────────────────────────────────────────────

function TemplatesTab({ initial }) {
  const { templates, templatesStored, profiles } = useWorkspace()
  const toast = useToast()
  const narrow = useNarrow()
  const [sel, setSel] = useState(initial || templates[0]?.id)
  const cur = templates.find((t) => t.id === sel) ?? templates[0]
  const [draft, setDraft] = useState(cur)
  const [subDrafts, setSubDrafts] = useState({})
  const dirty = useRef(false)

  const team = useMemo(() => profiles.filter((p) => p.active !== false && p.role !== 'staff' && p.role !== 'guest'), [profiles])
  const whoOptions = [{ value: '', label: 'Niemand' }, ...team.map((p) => ({ value: p.id, label: (p.fullName || p.email).split(' ')[0] }))]

  // Bij het wisselen van template (of wanneer iemand anders iets bewaart) de
  // kopie verversen — tenzij er hier nog iets onderweg is.
  useEffect(() => {
    if (!dirty.current) setDraft(resolveTemplate(cur, profiles))
  }, [cur, profiles])

  // Zolang er nog niets bewaard is, gelden de standaardtemplates. De eerste
  // aanpassing schrijft ze allemaal weg, zodat ze vanaf dan echt bestaan.
  const ensureStored = async () => {
    if (templatesStored) return
    await Promise.all(DEFAULT_TEMPLATES.map((t) => saveTemplate(resolveTemplate(t, profiles))))
  }

  // Bewaren met een korte pauze, niet bij elke toets.
  useEffect(() => {
    if (!dirty.current || !draft) return undefined
    const t = setTimeout(async () => {
      try {
        await ensureStored()
        await saveTemplate(draft)
      } catch (err) {
        toast.error(err.message)
      } finally {
        dirty.current = false
      }
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  if (!draft) return null

  const upd = (fn) => {
    dirty.current = true
    setDraft((d) => fn(d))
  }
  const updTask = (id, patch) => upd((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))

  const pick = (id) => {
    dirty.current = false
    setSel(id)
  }

  const create = async () => {
    try {
      await ensureStored()
      const id = await createTemplate({ icon: 'file-text', name: 'Nieuw template', position: templates.length, tasks: [newTaskRow(null, 14)] })
      pick(id)
    } catch (err) {
      toast.error(err.message)
    }
  }
  const duplicate = async () => {
    try {
      await ensureStored()
      const { id: _id, ...rest } = draft
      const id = await createTemplate({
        ...rest,
        name: `${draft.name} (kopie)`,
        position: templates.length,
        tasks: draft.tasks.map((t) => ({ ...t, id: Math.random().toString(36).slice(2, 10), subs: [...(t.subs ?? [])] })),
      })
      pick(id)
    } catch (err) {
      toast.error(err.message)
    }
  }
  const remove = async () => {
    if (!window.confirm(`Template "${draft.name}" verwijderen?`)) return
    try {
      await ensureStored()
      await deleteTemplate(draft.id)
      pick(templates.find((t) => t.id !== draft.id)?.id)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const subCount = draft.tasks.reduce((a, t) => a + (t.subs?.length ?? 0), 0)
  const people = [...new Set(draft.tasks.map((t) => t.who).filter(Boolean))]
    .map((id) => (profiles.find((p) => p.id === id)?.fullName ?? '').split(' ')[0])
    .filter(Boolean)
    .join(', ')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr)' : '260px minmax(0,1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
      <section className="je-panel">
        {templates.map((tp, i) => {
          const on = tp.id === draft.id
          return (
            <button
              key={tp.id}
              type="button"
              onClick={() => pick(tp.id)}
              className="je-plainbtn je-hover-quiet"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-5)',
                background: on ? 'var(--accent-quiet)' : 'transparent',
                borderTop: i ? '1px solid var(--border-hairline)' : 'none',
                borderLeft: `2px solid ${on ? 'var(--navy-700)' : 'transparent'}`,
              }}
            >
              <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
                <Icon name={tp.icon} size={18} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: 'var(--type-body-sm)', fontWeight: 600 }}>{on ? draft.name : tp.name}</span>
                <span className="je-muted-caption" style={{ display: 'block' }}>
                  {templateSummary(on ? draft : tp)}
                </span>
              </span>
            </button>
          )
        })}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-hairline)' }}>
          <Button variant="secondary" size="sm" iconLeft="plus" block onClick={create}>
            Nieuw template
          </Button>
        </div>
      </section>

      <section className="je-panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-4)', padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--border-hairline)' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Naam template">
              <Input value={draft.name} onChange={(e) => upd((d) => ({ ...d, name: e.target.value }))} />
            </Field>
          </div>
          <div style={{ width: 150 }}>
            <Field label="Icoon">
              <Select
                options={TEMPLATE_ICONS.map(([value, label]) => ({ value, label }))}
                value={draft.icon}
                onChange={(e) => upd((d) => ({ ...d, icon: e.target.value }))}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <IconButton icon="copy" label="Dupliceren" variant="outline" onClick={duplicate} />
            <IconButton icon="trash-2" label="Verwijderen" variant="outline" disabled={templates.length <= 1} onClick={remove} />
          </div>
        </div>

        <div className="je-panel__head">
          <span className="je-eyebrow">Taken</span>
          <span className="je-panel__sub">
            Deadlines tellen terug vanaf de eventdatum; een negatief aantal valt erná.
          </span>
        </div>

        {draft.tasks.map((t, i) => (
          <div
            key={t.id}
            style={{ padding: 'var(--space-4) var(--space-6)', borderTop: i ? '1px solid var(--border-hairline)' : 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-4)' }}>
              <span style={{ width: 22, paddingBottom: 12, font: 'var(--fw-medium) 15px/1 var(--font-display)', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Field label="Taak">
                  <Input value={t.title} onChange={(e) => updTask(t.id, { title: e.target.value })} />
                </Field>
              </div>
              <div style={{ width: 130 }}>
                <Field label="Standaard voor">
                  <Select options={whoOptions} value={t.who ?? ''} onChange={(e) => updTask(t.id, { who: e.target.value || null, whoName: null })} />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label="Dagen vooraf">
                  <Input
                    type="number"
                    value={String(t.offset ?? 0)}
                    onChange={(e) => updTask(t.id, { offset: parseInt(e.target.value || '0', 10) || 0 })}
                  />
                </Field>
              </div>
              <div style={{ width: 110 }}>
                <Field label="Prioriteit">
                  <Select options={PRIO_OPTIONS} value={t.prio ?? ''} onChange={(e) => updTask(t.id, { prio: e.target.value })} />
                </Field>
              </div>
              <div style={{ width: 120 }}>
                <Field label="Herhaling">
                  <Select options={REPEAT_OPTIONS} value={t.repeat ?? ''} onChange={(e) => updTask(t.id, { repeat: e.target.value })} />
                </Field>
              </div>
              <div style={{ paddingBottom: 4 }}>
                <IconButton icon="x" label="Taak verwijderen" size="sm" onClick={() => upd((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))} />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', paddingLeft: 38 }}>
              <span className="je-muted-caption" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <Icon name="list-checks" size={14} />
                Subtaken
              </span>
              {(t.subs ?? []).map((sub, j) => (
                <Tag key={`${sub}-${j}`} onRemove={() => updTask(t.id, { subs: t.subs.filter((_, k) => k !== j) })}>
                  {sub}
                </Tag>
              ))}
              <input
                value={subDrafts[t.id] ?? ''}
                onChange={(e) => setSubDrafts((s) => ({ ...s, [t.id]: e.target.value }))}
                onKeyDown={(e) => {
                  const v = (subDrafts[t.id] ?? '').trim()
                  if (e.key === 'Enter' && v) {
                    updTask(t.id, { subs: [...(t.subs ?? []), v] })
                    setSubDrafts((s) => ({ ...s, [t.id]: '' }))
                  }
                }}
                placeholder="+ subtaak en Enter"
                aria-label="Subtaak toevoegen"
                className="je-underline-input"
                style={{ width: 160 }}
              />
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-hairline)' }}>
          <Button variant="ghost" size="sm" iconLeft="plus" onClick={() => upd((d) => ({ ...d, tasks: [...d.tasks, newTaskRow(null, 7)] }))}>
            Taak toevoegen
          </Button>
          <span className="je-muted-caption" style={{ marginLeft: 'auto' }}>
            {draft.tasks.length} taken · {subCount} subtaken{people ? ` · ${people}` : ''}
          </span>
        </div>
      </section>
    </div>
  )
}

// ─── Concepten & kostenplaatsen ────────────────────────────────────────────

function ConceptsTab() {
  const { brands, costCenters } = useWorkspace()
  const { events } = useEvents()
  const toast = useToast()
  const [name, setName] = useState('')

  const saveCenters = (list) =>
    setDoc(doc(db, 'config', 'workspace'), { costCenters: list }, { merge: true }).catch((err) => toast.error(err.message))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">Concepten</span>
          <span className="je-panel__sub">Uit staat niet meer bij nieuwe events en in de filters.</span>
        </div>
        {brands.map((b, i) => {
          const n = events.filter((e) => e.brandId === b.id).length
          return (
            <div
              key={b.id}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-6)', borderTop: i ? '1px solid var(--border-hairline)' : 'none' }}
            >
              <span style={{ width: 8, height: 8, background: b.color, flex: '0 0 8px' }} />
              <span style={{ flex: 1, font: 'var(--type-body-sm)' }}>{b.name}</span>
              <span className="je-muted-caption">
                {n} {n === 1 ? 'event' : 'events'}
              </span>
              <Switch checked={!b.archived} onChange={() => updateBrand(b.id, { archived: !b.archived })} aria-label={`${b.name} actief`} />
            </div>
          )
        })}
      </section>

      <section className="je-panel">
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-hairline)' }}>
          <div className="je-eyebrow">Kostenplaatsen</div>
          <div className="je-muted-caption" style={{ marginTop: 4 }}>
            Tijd boeken zonder event.
          </div>
        </div>
        {costCenters.map((k, i) => (
          <div
            key={`${k.name}-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-6)', borderTop: i ? '1px solid var(--border-hairline)' : 'none' }}
          >
            <span style={{ flex: 1, font: 'var(--type-body-sm)' }}>{k.name}</span>
            <button
              type="button"
              className="je-plainbtn"
              title="Wisselen tussen billable en intern"
              onClick={() => saveCenters(costCenters.map((x, j) => (j === i ? { ...x, billable: !x.billable } : x)))}
            >
              <Badge tone={k.billable ? 'accent' : 'neutral'}>{k.billable ? 'Billable' : 'Intern'}</Badge>
            </button>
            <IconButton icon="x" label="Verwijderen" size="sm" onClick={() => saveCenters(costCenters.filter((_, j) => j !== i))} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-hairline)' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                saveCenters([...costCenters, { name: name.trim(), billable: false }])
                setName('')
              }
            }}
            placeholder="+ kostenplaats en Enter"
            aria-label="Kostenplaats toevoegen"
            className="je-underline-input"
            style={{ flex: 1 }}
          />
        </div>
      </section>
    </div>
  )
}
