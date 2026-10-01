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
// De teksten van dit scherm komen met dit scherm mee en niet met de app;
// zie `@lib/instellingen-teksten`.
import '@lib/instellingen-teksten'
import BusinessRules from '@components/settings/BusinessRules'
import HerhalingenPaneel from '@components/settings/HerhalingenPaneel'
import SysteemPaneel from '@components/settings/SysteemPaneel'
import ChecklistEditor from '@components/settings/ChecklistEditor'
import FormuleSettings from '@components/settings/FormuleSettings'
import { BrandSettings, StructureSettings } from '@components/settings/LegacySettings'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
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
  { value: 'team', sleutel: 'inst.tab.team' },
  { value: 'pijplijn', sleutel: 'inst.tab.pijplijn' },
  { value: 'templates', sleutel: 'inst.tab.templates' },
  { value: 'formules', sleutel: 'inst.tab.formules' },
  { value: 'lijsten', sleutel: 'inst.tab.lijsten' },
  { value: 'structuur', sleutel: 'inst.tab.structuur' },
  { value: 'merken', sleutel: 'inst.tab.merken' },
  { value: 'dagelijks', sleutel: 'inst.tab.dagelijks' },
  { value: 'regels', sleutel: 'inst.tab.regels' },
  { value: 'herhalingen', sleutel: 'inst.tab.herhalingen' },
  { value: 'systeem', sleutel: 'inst.tab.systeem' },
]

/** De afdeling zoals ze op het scherm staat; de sleutel van @lib/checklist-templates blijft. */
const AFDELING_SLEUTEL = {
  iedereen: 'inst.afdeling.iedereen',
  verantwoordelijke: 'inst.afdeling.verantwoordelijke',
  keuken: 'inst.afdeling.keuken',
  zaal: 'inst.afdeling.zaal',
}

/** De regel bij een stap van de pijplijn; de naam van de stap staat in de database. */
const STAP_SLEUTEL = {
  request: 'inst.pijplijn.regel.request',
  'ready to invoice': 'inst.pijplijn.regel.facturatie',
  complete: 'inst.pijplijn.regel.archief',
}

/** De iconen, prioriteiten en herhalingen van een template, per opgeslagen waarde. */
const ICOON_SLEUTEL = {
  sparkles: 'inst.icoon.feest',
  users: 'inst.icoon.team',
  utensils: 'inst.icoon.eten',
  'music-4': 'inst.icoon.muziek',
  lightbulb: 'inst.icoon.techniek',
  'calendar-days': 'inst.icoon.kalender',
  'file-text': 'inst.icoon.document',
}

const PRIO_SLEUTEL = { '': 'inst.prio.normaal', Hoog: 'inst.prio.hoog', Urgent: 'inst.prio.urgent' }

const HERHALING_SLEUTEL = {
  '': 'inst.herhaling.eenmalig',
  Wekelijks: 'inst.herhaling.wekelijks',
  'Na 3 dagen': 'inst.herhaling.na3',
}

/** Instellingen — alleen voor beheerders, zoals in het design. */
export default function Settings() {
  const { isAdmin } = useAuth()
  const { t } = useTaal()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'team'
  const setTab = (v) => setParams({ tab: v }, { replace: true })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={isAdmin ? t('inst.kop.beheer') : t('inst.kop.geen_toegang')}
        title={t('nav.instellingen')}
      />
      <div className="je-pagebody">
        {!isAdmin ? (
          <div className="je-panel" style={{ maxWidth: 560, display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-6)' }}>
            <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
              <Icon name="lock" size={20} />
            </span>
            <div>
              <div style={{ font: 'var(--type-body)', fontWeight: 600 }}>{t('inst.geen_toegang.titel')}</div>
              <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
                {t('inst.geen_toegang.tekst')}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 1040 }}>
            <Tabs items={TABS.map((x) => ({ value: x.value, label: t(x.sleutel) }))} value={tab} onChange={setTab} />
            {tab === 'team' ? <TeamTab /> : null}
            {tab === 'pijplijn' ? <PipelineTab /> : null}
            {tab === 'templates' ? <TemplatesTab initial={params.get('template')} /> : null}
            {tab === 'formules' ? <FormuleSettings /> : null}
            {tab === 'lijsten' ? <ConceptsTab /> : null}
            {tab === 'structuur' ? <StructureSettings /> : null}
            {tab === 'merken' ? <BrandSettings /> : null}
            {tab === 'dagelijks' ? <ChecklistEditor isAdmin /> : null}
            {tab === 'regels' ? <BusinessRules isAdmin /> : null}
            {tab === 'herhalingen' ? <HerhalingenPaneel /> : null}
            {tab === 'systeem' ? <SysteemPaneel /> : null}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Team & toegang ────────────────────────────────────────────────────────

const ROLES = [
  { value: 'owner', sleutel: 'rol.owner' },
  { value: 'admin', sleutel: 'rol.admin' },
  { value: 'member', sleutel: 'rol.member' },
  { value: 'staff', sleutel: 'rol.staff' },
  // De socialrol: alleen de socials, en geen bedragen. Dat laatste zit in de
  // regels en niet in het scherm — zie `functions/social-projectie.js`.
  { value: 'social', sleutel: 'rol.social' },
]

/*
  "Gast" staat hier niet meer bij, en dat is een beveiligingskeuze.

  De rol beperkte niets: in `firestore.rules` komt het woord niet voor, dus
  `isTeam()` liet een gast overal bij — de offertes, de klantgegevens, alle
  bedragen, het logboek. Tegelijk liet de interface hem juist weg uit de kiezers
  voor uitvoerders, alsof het een buitenstaander was. Dat verschil is de
  valkuil: wie iemand op Gast zette, dacht te beperken en deed het niet.

  Er staat vandaag niemand op, dus weghalen kan zonder iemand buiten te sluiten.
  Wie de rol ooit echt wil, bouwt hem eerst in de regels — bijvoorbeeld met
  dezelfde kale kopie als bij de socialrol — en zet hem daarna pas terug.

  Mocht er tóch ergens een gast blijken te staan, dan toont de keuzelijst zijn
  huidige rol nog (zie `rollenVoor` hieronder): anders staat er een leeg vakje
  en is de rol niet meer te wijzigen.
*/
const rollenVoor = (rol) =>
  rol && !ROLES.some((r) => r.value === rol) ? [...ROLES, { value: rol, sleutel: `rol.${rol}` }] : ROLES

function TeamTab() {
  const { profiles, allowedDomains } = useWorkspace()
  const { uid } = useAuth()
  const { t } = useTaal()
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
      toast.success(t('inst.team.uitgenodigd', { wie: inviteEmail.trim() }))
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
            <div className="je-eyebrow">{t('login.aanmelden')}</div>
            <div style={{ font: 'var(--type-h3)', textTransform: 'uppercase', marginTop: 6 }}>Google SSO</div>
            <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)', marginTop: 4, maxWidth: '60ch' }}>
              {t('inst.team.sso_uitleg')}
            </div>
          </div>
          <Badge tone="success" dot>
            {t('inst.team.enige_methode')}
          </Badge>
        </div>
        <div style={{ padding: 'var(--space-5) var(--space-6)', borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="je-caps">{t('inst.team.automatisch')}</div>
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
              placeholder={t('inst.team.domein_plaatshouder')}
              aria-label={t('inst.team.domein_label')}
              className="je-underline-input"
              style={{ width: 170 }}
            />
          </div>
          <div className="je-muted-caption">{t('inst.team.andere_accounts')}</div>
        </div>
      </section>

      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{t('nav.team')}</span>
          <span className="je-panel__right">{t('inst.team.actief', { aantal: active.length })}</span>
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
                options={rollenVoor(m.role).map((r) => ({ value: r.value, label: t(r.sleutel) }))}
                value={m.role}
                onChange={(e) => setMemberRole(m.id, e.target.value)}
                aria-label={t('inst.team.rol_van', { wie: m.email })}
                disabled={m.id === uid}
                title={m.id === uid ? t('inst.team.eigen_rol') : undefined}
              />
            </div>
            {m.role === 'staff' ? (
              <div style={{ width: 150 }}>
                <Select
                  boxed
                  value={m.department ?? ''}
                  onChange={(e) => setMemberDepartment(m.id, e.target.value)}
                  aria-label={t('inst.team.afdeling_van', { wie: m.email })}
                  options={[
                    { value: '', label: t('inst.team.geen_afdeling') },
                    ...AFDELINGEN.filter((a) => a.key !== 'iedereen').map((a) => ({
                      value: a.key,
                      label: t(AFDELING_SLEUTEL[a.key] ?? a.label),
                    })),
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
                placeholder={t('inst.team.uurtarief_plaatshouder')}
                aria-label={t('inst.team.uurtarief')}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={m.id === uid}
              title={m.id === uid ? t('inst.team.zelf_archiveren') : undefined}
              onClick={() => setMemberActive(m.id, false)}
            >
              {t('alg.archiveren')}
            </Button>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        <section className="je-panel" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <span className="je-eyebrow">{t('inst.team.uitnodigen')}</span>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Field label={t('inst.team.google_account')}>
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
              {t('inst.team.uitnodigen_knop')}
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
              <Badge>{t('inst.team.wacht')}</Badge>
              <IconButton icon="x" label={t('inst.team.intrekken')} size="sm" onClick={() => revokeInvite(iv.email ?? iv.id)} />
            </div>
          ))}
        </section>
        <section className="je-panel">
          <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-hairline)' }}>
            <div className="je-eyebrow">{t('inst.team.gearchiveerd')}</div>
            <div className="je-muted-caption" style={{ marginTop: 4 }}>
              {t('inst.team.gearchiveerd_uitleg')}
            </div>
          </div>
          {archived.length === 0 ? (
            <div className="je-muted-caption" style={{ padding: 'var(--space-4) var(--space-6)' }}>
              {t('inst.team.niemand_gearchiveerd')}
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
                  {t('inst.team.uren_bewaard')}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setMemberActive(m.id, true)}>
                {t('inst.team.heractiveren')}
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
  const { t } = useTaal()
  const toast = useToast()

  if (!eventsList) {
    return (
      <div className="je-panel" style={{ padding: 'var(--space-6)' }}>
        <div className="je-muted-caption">{t('inst.pijplijn.geen_lijst')}</div>
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
        <div className="je-eyebrow">{t('inst.pijplijn.kop')}</div>
        <div className="je-muted-caption" style={{ marginTop: 4 }}>
          {t('inst.pijplijn.uitleg')}
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
              aria-label={t('inst.pijplijn.statusnaam')}
            />
          </div>
          <Badge tone={toneOf(p.key)} dot>
            {labelOf(p.key, eventStatuses)}
          </Badge>
          <span className="je-muted-caption" style={{ marginLeft: 'auto' }}>
            {STAP_SLEUTEL[p.key] ? t(STAP_SLEUTEL[p.key]) : (STEP_RULES[p.key] ?? '')}
          </span>
        </div>
      ))}
    </section>
  )
}

// ─── Templates ─────────────────────────────────────────────────────────────

function TemplatesTab({ initial }) {
  const { templates, templatesStored, profiles } = useWorkspace()
  const { t } = useTaal()
  const toast = useToast()
  const narrow = useNarrow()
  const [sel, setSel] = useState(initial || templates[0]?.id)
  const cur = templates.find((tp) => tp.id === sel) ?? templates[0]
  const [draft, setDraft] = useState(cur)
  const [subDrafts, setSubDrafts] = useState({})
  const dirty = useRef(false)

  const team = useMemo(() => profiles.filter((p) => p.active !== false && p.role !== 'staff' && p.role !== 'guest'), [profiles])
  const whoOptions = [
    { value: '', label: t('alg.niemand') },
    ...team.map((p) => ({ value: p.id, label: (p.fullName || p.email).split(' ')[0] })),
  ]

  // Bij het wisselen van template (of wanneer iemand anders iets bewaart) de
  // kopie verversen — tenzij er hier nog iets onderweg is.
  useEffect(() => {
    if (!dirty.current) setDraft(resolveTemplate(cur, profiles))
  }, [cur, profiles])

  // Zolang er nog niets bewaard is, gelden de standaardtemplates. De eerste
  // aanpassing schrijft ze allemaal weg, zodat ze vanaf dan echt bestaan.
  const ensureStored = async () => {
    if (templatesStored) return
    await Promise.all(DEFAULT_TEMPLATES.map((tp) => saveTemplate(resolveTemplate(tp, profiles))))
  }

  // Bewaren met een korte pauze, niet bij elke toets.
  useEffect(() => {
    if (!dirty.current || !draft) return undefined
    const wachten = setTimeout(async () => {
      try {
        await ensureStored()
        await saveTemplate(draft)
      } catch (err) {
        toast.error(err.message)
      } finally {
        dirty.current = false
      }
    }, 600)
    return () => clearTimeout(wachten)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  if (!draft) return null

  const upd = (fn) => {
    dirty.current = true
    setDraft((d) => fn(d))
  }
  const updTask = (id, patch) =>
    upd((d) => ({ ...d, tasks: d.tasks.map((taak) => (taak.id === id ? { ...taak, ...patch } : taak)) }))

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
        tasks: draft.tasks.map((taak) => ({
          ...taak,
          id: Math.random().toString(36).slice(2, 10),
          subs: [...(taak.subs ?? [])],
        })),
      })
      pick(id)
    } catch (err) {
      toast.error(err.message)
    }
  }
  const remove = async () => {
    if (!window.confirm(t('inst.tpl.verwijder_vraag', { naam: draft.name }))) return
    try {
      await ensureStored()
      await deleteTemplate(draft.id)
      pick(templates.find((tp) => tp.id !== draft.id)?.id)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const subCount = draft.tasks.reduce((a, taak) => a + (taak.subs?.length ?? 0), 0)
  const people = [...new Set(draft.tasks.map((taak) => taak.who).filter(Boolean))]
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
            {t('inst.tpl.nieuw')}
          </Button>
        </div>
      </section>

      <section className="je-panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-4)', padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--border-hairline)' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label={t('inst.tpl.naam')}>
              <Input value={draft.name} onChange={(e) => upd((d) => ({ ...d, name: e.target.value }))} />
            </Field>
          </div>
          <div style={{ width: 150 }}>
            <Field label={t('inst.tpl.icoon')}>
              <Select
                options={TEMPLATE_ICONS.map(([value, label]) => ({
                  value,
                  label: t(ICOON_SLEUTEL[value] ?? label),
                }))}
                value={draft.icon}
                onChange={(e) => upd((d) => ({ ...d, icon: e.target.value }))}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <IconButton icon="copy" label={t('inst.tpl.dupliceren')} variant="outline" onClick={duplicate} />
            <IconButton
              icon="trash-2"
              label={t('alg.verwijderen')}
              variant="outline"
              disabled={templates.length <= 1}
              onClick={remove}
            />
          </div>
        </div>

        <div className="je-panel__head">
          <span className="je-eyebrow">{t('inst.tpl.taken')}</span>
          <span className="je-panel__sub">{t('inst.tpl.deadlines')}</span>
        </div>

        {draft.tasks.map((taak, i) => (
          <div
            key={taak.id}
            style={{ padding: 'var(--space-4) var(--space-6)', borderTop: i ? '1px solid var(--border-hairline)' : 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-4)' }}>
              <span style={{ width: 22, paddingBottom: 12, font: 'var(--fw-medium) 15px/1 var(--font-display)', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Field label={t('inst.tpl.taak')}>
                  <Input value={taak.title} onChange={(e) => updTask(taak.id, { title: e.target.value })} />
                </Field>
              </div>
              <div style={{ width: 130 }}>
                <Field label={t('inst.tpl.standaard_voor')}>
                  <Select
                    options={whoOptions}
                    value={taak.who ?? ''}
                    onChange={(e) => updTask(taak.id, { who: e.target.value || null, whoName: null })}
                  />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label={t('inst.tpl.dagen_vooraf')}>
                  <Input
                    type="number"
                    value={String(taak.offset ?? 0)}
                    onChange={(e) => updTask(taak.id, { offset: parseInt(e.target.value || '0', 10) || 0 })}
                  />
                </Field>
              </div>
              <div style={{ width: 110 }}>
                <Field label={t('inst.tpl.prioriteit')}>
                  <Select
                    options={PRIO_OPTIONS.map((o) => ({ value: o.value, label: t(PRIO_SLEUTEL[o.value] ?? o.label) }))}
                    value={taak.prio ?? ''}
                    onChange={(e) => updTask(taak.id, { prio: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ width: 120 }}>
                <Field label={t('inst.tpl.herhaling')}>
                  <Select
                    options={REPEAT_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(HERHALING_SLEUTEL[o.value] ?? o.label),
                    }))}
                    value={taak.repeat ?? ''}
                    onChange={(e) => updTask(taak.id, { repeat: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ paddingBottom: 4 }}>
                <IconButton
                  icon="x"
                  label={t('inst.tpl.taak_verwijderen')}
                  size="sm"
                  onClick={() => upd((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== taak.id) }))}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', paddingLeft: 38 }}>
              <span className="je-muted-caption" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <Icon name="list-checks" size={14} />
                {t('inst.tpl.subtaken')}
              </span>
              {(taak.subs ?? []).map((sub, j) => (
                <Tag key={`${sub}-${j}`} onRemove={() => updTask(taak.id, { subs: taak.subs.filter((_, k) => k !== j) })}>
                  {sub}
                </Tag>
              ))}
              <input
                value={subDrafts[taak.id] ?? ''}
                onChange={(e) => setSubDrafts((s) => ({ ...s, [taak.id]: e.target.value }))}
                onKeyDown={(e) => {
                  const v = (subDrafts[taak.id] ?? '').trim()
                  if (e.key === 'Enter' && v) {
                    updTask(taak.id, { subs: [...(taak.subs ?? []), v] })
                    setSubDrafts((s) => ({ ...s, [taak.id]: '' }))
                  }
                }}
                placeholder={t('inst.tpl.subtaak_plaatshouder')}
                aria-label={t('inst.tpl.subtaak_label')}
                className="je-underline-input"
                style={{ width: 160 }}
              />
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-hairline)' }}>
          <Button variant="ghost" size="sm" iconLeft="plus" onClick={() => upd((d) => ({ ...d, tasks: [...d.tasks, newTaskRow(null, 7)] }))}>
            {t('inst.tpl.taak_toevoegen')}
          </Button>
          <span className="je-muted-caption" style={{ marginLeft: 'auto' }}>
            {people
              ? t('inst.tpl.telling_wie', { taken: draft.tasks.length, subs: subCount, wie: people })
              : t('inst.tpl.telling', { taken: draft.tasks.length, subs: subCount })}
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
  const { t } = useTaal()
  const toast = useToast()
  const [name, setName] = useState('')

  const saveCenters = (list) =>
    setDoc(doc(db, 'config', 'workspace'), { costCenters: list }, { merge: true }).catch((err) => toast.error(err.message))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{t('inst.concept.kop')}</span>
          <span className="je-panel__sub">{t('inst.concept.uitleg')}</span>
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
              <span className="je-muted-caption">{t('inst.concept.event', { aantal: n })}</span>
              <Switch
                checked={!b.archived}
                onChange={() => updateBrand(b.id, { archived: !b.archived })}
                aria-label={t('inst.concept.actief', { naam: b.name })}
              />
            </div>
          )
        })}
      </section>

      <section className="je-panel">
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-hairline)' }}>
          <div className="je-eyebrow">{t('inst.kosten.kop')}</div>
          <div className="je-muted-caption" style={{ marginTop: 4 }}>
            {t('inst.kosten.uitleg')}
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
              title={t('inst.kosten.wisselen')}
              onClick={() => saveCenters(costCenters.map((x, j) => (j === i ? { ...x, billable: !x.billable } : x)))}
            >
              <Badge tone={k.billable ? 'accent' : 'neutral'}>
                {k.billable ? t('inst.kosten.billable') : t('inst.kosten.intern')}
              </Badge>
            </button>
            <IconButton icon="x" label={t('alg.verwijderen')} size="sm" onClick={() => saveCenters(costCenters.filter((_, j) => j !== i))} />
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
            placeholder={t('inst.kosten.plaatshouder')}
            aria-label={t('inst.kosten.label')}
            className="je-underline-input"
            style={{ flex: 1 }}
          />
        </div>
      </section>
    </div>
  )
}
