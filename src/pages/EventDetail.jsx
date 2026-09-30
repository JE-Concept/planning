import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { startOfDay } from '@lib/dates'
import { kaartLink } from '@lib/kaart'
import { PIPELINE, indexOf, labelOf, missingForOffer } from '@lib/pipeline'
import { useNarrow } from '@lib/useNarrow'
import {
  Badge,
  Button,
  Checkbox,
  Hex,
  Icon,
  IconButton,
  Input,
  Tabs,
  Textarea,
  initialsOf,
} from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import TaskDrawer from '@components/board/TaskDrawer'
import Bestellijst from '@components/events/Bestellijst'
import EventEditDialog from '@components/events/EventEditDialog'
import TaskRow from '@components/events/TaskRow'
import { StatusBadge, dayLabel, euro, hours, longDate, shortDate } from '@components/events/parts'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { addComment, deleteComment, useComments } from '@data/comments'
import EventNotities from '@components/events/EventNotities'
import { deleteDocument, leesbareGrootte, uploadDocument, useDocuments } from '@data/documents'
import { BlockedError, addEventTask, isDone, moveEvent, updateEvent, useEventTime, useEvents } from '@data/events'
import { durationOf } from '@lib/time-math'
import { useRunningTimer } from '@data/time'
import { Spinner } from '@ui/index'

/** Eén event: pijplijn, fiche, en de vier tabbladen uit het design. */
export default function EventDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const narrow = useNarrow()
  const toast = useToast()
  const { t } = useTaal()
  const { eventStatuses, profileById } = useWorkspace()
  const { eventById, tasksByEvent, loading } = useEvents()
  const [editing, setEditing] = useState(false)
  const [drawer, setDrawer] = useState(null)

  const ev = eventById[id]
  const tasks = useMemo(() => tasksByEvent[id] ?? [], [tasksByEvent, id])
  const tab = params.get('tab') || 'taken'
  const setTab = (v) => {
    const next = new URLSearchParams(params)
    next.set('tab', v)
    next.delete('taak')
    setParams(next, { replace: true })
  }

  const taskIds = useMemo(() => [id, ...tasks.map((taak) => taak.id)], [id, tasks])
  const time = useEventTime(taskIds)
  const { uid } = useAuth()
  const { timer } = useRunningTimer(uid)

  if (!ev) {
    return (
      <div className="je-pagebody">
        {loading ? (
          <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spinner /> {t('events.detail.laden')}
          </div>
        ) : (
          <div className="je-panel" style={{ padding: 'var(--space-7)', maxWidth: 560 }}>
            <div style={{ font: 'var(--type-body)', fontWeight: 600 }}>{t('events.detail.bestaat_niet')}</div>
            <Button variant="secondary" size="sm" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
              {t('events.detail.naar_alle')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  const si = indexOf(ev.statusName)
  const next = si >= 0 && si < PIPELINE.length - 1 ? PIPELINE[si + 1].key : null
  const blocked = ev.statusName === 'request' && missingForOffer(ev).length > 0
  const days = ev.eventDate ? Math.round((startOfDay(ev.eventDate) - startOfDay()) / 864e5) : null

  const move = async (key) => {
    try {
      await moveEvent(ev, key, eventStatuses)
    } catch (err) {
      if (err instanceof BlockedError) setEditing(true)
      toast.error(err.message)
    }
  }

  const liveSeconds =
    timer && taskIds.includes(timer.taskId) ? durationOf(timer) : 0
  const totalS = time.reduce((a, e) => a + (e.durationSeconds ?? 0), 0) + liveSeconds
  const billS = time.filter((e) => e.billable !== false).reduce((a, e) => a + (e.durationSeconds ?? 0), 0)
  const openCount = tasks.filter((taak) => !isDone(taak)).length
  const bestelRegels = ev.bestellijst ?? []

  // "pax" blijft staan: zo staat het op de offerte en zo zegt het team het,
  // in allebei de talen.
  const fiche = [
    ['events.fiche.klant', ev.customerName],
    ['events.fiche.datum', longDate(ev.eventDate)],
    [
      'events.fiche.gasten',
      ev.pax ? `${ev.pax} pax${ev.kids ? ` + ${t('events.fiche.kinderen', { aantal: ev.kids })}` : ''}` : null,
    ],
    ['events.fiche.locatie', ev.location, kaartLink(ev)],
    [
      'events.fiche.formule',
      ev.formule
        ? [
            ev.formule,
            ev.formulePrijsPerPersoon ? t('events.fiche.pp', { bedrag: euro(ev.formulePrijsPerPersoon) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    ],
    ['events.fiche.offerte', euro(ev.quoteAmount)],
    ['events.fiche.voorschot', ev.quoteAmount ? euro(Math.round(ev.quoteAmount * 0.4)) : null],
    ['events.fiche.team', ev.team.map((p) => (profileById[p]?.fullName ?? '').split(' ')[0]).filter(Boolean).join(', ') || null],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        back={{ to: '/', label: t('events.detail.alle_events') }}
        eyebrow={[
          ev.concept?.split(' — ')[0] ?? t('events.los_event'),
          dayLabel(ev.eventDate),
          days != null && days >= 0 ? t('events.over_dagen', { aantal: days }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        title={ev.name}
        actions={
          <>
            <StatusBadge statusName={ev.statusName} statuses={eventStatuses} />
            <IconButton
              icon="pencil"
              label={t('events.fiche.bewerken')}
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            />
            {next ? (
              <Button size="sm" iconRight="arrow-right" disabled={blocked} onClick={() => move(next)}>
                {t('events.detail.naar_stap', { stap: labelOf(next, eventStatuses).toLowerCase() })}
              </Button>
            ) : null}
          </>
        }
      />

      {/*
        Het werk links, het gesprek rechts.

        De notities stonden achter een tabblad, en dat is voor communicatie de
        verkeerde plek: een tabblad open je pas wanneer je al weet dat er iets
        staat. Nu staan ze ernaast, meescrollend, met het schrijfvak onderaan.
        Onder 1100px past die kolom niet meer en valt ze terug op een tabblad.
      */}
      <div className="je-pagebody">
        <div className={narrow ? undefined : 'je-event-met-notities'} style={{ maxWidth: 1480 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 1120 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: 3 }}>
            {PIPELINE.map((step, i) => (
              <button
                key={step.key}
                type="button"
                title={labelOf(step.key, eventStatuses)}
                onClick={() => move(step.key)}
                className="je-plainbtn"
                style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}
              >
                <span style={{ display: 'block', height: 3, background: i <= si ? 'var(--navy-700)' : 'var(--navy-100)' }} />
                {narrow ? null : (
                  <span
                    style={{
                      font: 'var(--type-caption)',
                      fontWeight: i === si ? 700 : 400,
                      color: i === si ? 'var(--text-1)' : i < si ? 'var(--text-2)' : 'var(--text-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {labelOf(step.key, eventStatuses)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {blocked ? (
            <div
              className="je-panel"
              style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-4) var(--space-5)', borderColor: 'var(--border-subtle)', font: 'var(--type-body-sm)' }}
            >
              <span style={{ color: 'var(--warning)', display: 'flex', marginTop: 2 }}>
                <Icon name="info" size={16} />
              </span>
              <span style={{ flex: 1 }}>{t('events.detail.blokkade')}</span>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                {t('events.detail.invullen')}
              </Button>
            </div>
          ) : null}

          <div className="je-fiche">
            {fiche.map(([sleutel, value, link]) => {
              const cel = (
                <button
                  type="button"
                  className="je-plainbtn"
                  onClick={() => setEditing(true)}
                  title={t('events.fiche.bewerken')}
                >
                  <div className="je-caps">{t(sleutel)}</div>
                  <div style={{ font: 'var(--type-body-sm)', fontWeight: 600, color: value ? 'var(--text-1)' : 'var(--text-3)', marginTop: 2 }}>
                    {value ?? '—'}
                  </div>
                </button>
              )
              // Een link mag niet in een knop staan, dus krijgt de cel met de
              // kaart een omhulsel in plaats van er een tweede knop bij te
              // verzinnen die stiekem een link is.
              if (!link) return <Fragment key={sleutel}>{cel}</Fragment>
              return (
                <div key={sleutel} className="je-fichecel">
                  {cel}
                  <a className="je-fichecel__kaart je-link-quiet" href={link} target="_blank" rel="noreferrer">
                    <Icon name="map-pin" size={14} />
                    {t('events.locatie.openen')}
                  </a>
                </div>
              )
            })}
          </div>

          <Tabs
            items={[
              { value: 'taken', label: t('events.tab.taken', { aantal: openCount }) },
              // Alleen events die uit een formule komen (of waar iemand zelf een
              // lijst begon) hebben hier iets te tonen; bij de rest zou het een
              // leeg tabblad zijn dat je elke keer opnieuw moet negeren.
              ...(bestelRegels.length || ev.formuleId
                ? [{ value: 'bestellijst', label: t('events.tab.bestellijst', { aantal: bestelRegels.length }) }]
                : []),
              { value: 'draaiboek', label: t('events.tab.draaiboek') },
              { value: 'dossier', label: t('events.tab.dossier') },
              // Op een smal scherm past de notitiekolom niet naast het werk;
              // daar blijft ze een tabblad. Zonder dat zou communicatie op een
              // telefoon onvindbaar worden, en dat is net het toestel waarop
              // iemand onderweg iets doorgeeft.
              ...(narrow ? [{ value: 'notities', label: t('events.notities.titel') }] : []),
              { value: 'tijd', label: t('events.tab.tijd', { tijd: hours(totalS) }) },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'taken' ? (
            <TasksTab ev={ev} tasks={tasks} focus={params.get('taak')} onOpen={setDrawer} runningId={timer?.taskId} />
          ) : tab === 'bestellijst' ? (
            <Bestellijst ev={ev} />
          ) : tab === 'draaiboek' ? (
            <RunsheetTab ev={ev} />
          ) : tab === 'dossier' ? (
            <NotesTab ev={ev} onOpenDetails={() => setDrawer(ev.id)} />
          ) : tab === 'notities' ? (
            <EventNotities ev={ev} compact />
          ) : (
            <TimeTab entries={time} totalS={totalS} billS={billS} days={days} profileById={profileById} eventTasks={tasks} ev={ev} />
          )}
        </div>

        {narrow ? null : <EventNotities ev={ev} />}
        </div>
      </div>

      <EventEditDialog open={editing} onClose={() => setEditing(false)} ev={ev} />
      {drawer ? (
        <TaskDrawer
          taskId={drawer}
          subtasks={drawer === ev.id ? tasks : []}
          onClose={() => setDrawer(null)}
        />
      ) : null}
    </div>
  )
}

// ─── Taken ─────────────────────────────────────────────────────────────────

function TasksTab({ ev, tasks, focus, onOpen, runningId }) {
  const { t } = useTaal()
  const { eventsList } = useWorkspace()
  const { uid } = useAuth()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState(() => (focus ? { [focus]: true } : {}))

  const add = async () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    try {
      await addEventTask({ event: ev, list: eventsList, title, assignee: uid })
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="je-panel">
      {tasks.length === 0 ? (
        <div className="je-muted-caption" style={{ padding: 'var(--space-5)' }}>{t('events.taken.leeg')}</div>
      ) : null}
      {tasks.map((t, i) => (
        <TaskRow
          key={t.id}
          task={t}
          event={ev}
          first={i === 0}
          open={!!expanded[t.id]}
          onExpand={() => setExpanded((x) => ({ ...x, [t.id]: !x[t.id] }))}
          onDetails={() => onOpen(t.id)}
          running={runningId === t.id}
        />
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-5)',
          borderTop: '1px solid var(--border-hairline)',
          color: 'var(--text-2)',
        }}
      >
        <Icon name="plus" size={16} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder={t('events.taken.toevoegen_hint')}
          aria-label={t('events.taken.toevoegen')}
          style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: 'var(--type-body-sm)', color: 'var(--text-1)', boxShadow: 'none' }}
        />
      </div>
    </div>
  )
}

// ─── Draaiboek ─────────────────────────────────────────────────────────────

function RunsheetTab({ ev }) {
  const { t } = useTaal()
  const toast = useToast()
  const rows = useMemo(() => [...(ev.draaiboek ?? [])].sort((a, b) => (a.tijd ?? '').localeCompare(b.tijd ?? '')), [ev.draaiboek])
  const [tijd, setTijd] = useState('')
  const [wat, setWat] = useState('')
  const [wie, setWie] = useState('')

  const save = (next) => updateEvent(ev.id, { draaiboek: next }).catch((err) => toast.error(err.message))

  const add = () => {
    if (!wat.trim()) return
    save([...(ev.draaiboek ?? []), { tijd: tijd.trim(), wat: wat.trim(), wie: wie.trim() }])
    setTijd('')
    setWat('')
    setWie('')
  }

  return (
    <div className="je-panel" style={{ padding: 'var(--space-3) var(--space-6)' }}>
      {rows.map((d, i) => (
        <div
          key={`${d.tijd}-${d.wat}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '64px minmax(0, 1fr) auto 32px',
            gap: 'var(--space-5)',
            alignItems: 'baseline',
            padding: 'var(--space-4) 0',
            borderTop: i ? '1px solid var(--border-hairline)' : 'none',
          }}
        >
          <span style={{ font: 'var(--fw-medium) 17px/1 var(--font-display)', color: 'var(--text-accent)', fontVariantNumeric: 'tabular-nums' }}>
            {d.tijd}
          </span>
          <span style={{ font: 'var(--type-body-sm)' }}>{d.wat}</span>
          <span style={{ font: 'var(--type-caption)', color: 'var(--text-2)' }}>{d.wie}</span>
          <IconButton
            icon="x"
            label={t('events.draaiboek.regel_weg')}
            size="sm"
            onClick={() => save((ev.draaiboek ?? []).filter((x) => x !== d))}
          />
        </div>
      ))}
      {rows.length === 0 ? (
        <div style={{ padding: 'var(--space-6) 0 var(--space-3)', font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
          {t('events.draaiboek.leeg')}
        </div>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '64px minmax(0, 1fr) 140px auto',
          gap: 'var(--space-4)',
          alignItems: 'end',
          padding: 'var(--space-4) 0 var(--space-3)',
          borderTop: rows.length ? '1px solid var(--border-hairline)' : 'none',
        }}
      >
        <Input type="time" value={tijd} onChange={(e) => setTijd(e.target.value)} aria-label={t('events.draaiboek.tijd')} />
        <Input
          value={wat}
          onChange={(e) => setWat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder={t('events.draaiboek.wat_hint')}
          aria-label={t('events.draaiboek.wat')}
        />
        <Input
          value={wie}
          onChange={(e) => setWie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder={t('events.draaiboek.wie')}
          aria-label={t('events.draaiboek.wie')}
        />
        <Button variant="secondary" size="sm" iconLeft="plus" disabled={!wat.trim()} onClick={add}>
          {t('events.draaiboek.regel')}
        </Button>
      </div>
    </div>
  )
}

// ─── Notities & bijlagen ───────────────────────────────────────────────────

/** "- [ ] iets" en "- [x] iets" worden vinkjes, de rest is tekst. */
function parseNote(body = '') {
  const lines = body.split('\n')
  const text = []
  const checks = []
  lines.forEach((line, i) => {
    const m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/)
    if (m) checks.push({ i, done: m[1] !== ' ', t: m[2] })
    else text.push(line)
  })
  return { text: text.join('\n').trim(), checks }
}

function NotesTab({ ev, onOpenDetails }) {
  const { t } = useTaal()
  const { profile, profileById } = { ...useAuth(), ...useWorkspace() }
  const comments = useComments({ taskId: ev.id })
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [dossier, setDossier] = useState(ev.description ?? '')
  const [dossierOpen, setDossierOpen] = useState(false)

  useEffect(() => setDossier(ev.description ?? ''), [ev.description])

  const add = async () => {
    try {
      await addComment({ taskId: ev.id, body: draft, author: profile })
      setDraft('')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Het vrije dossier uit ClickUp: draaiboeken zijn nu eenmaal proza. */}
        <div className="je-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <span className="je-eyebrow">{t('events.notities.dossier')}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <IconButton
                icon="pencil"
                label={t('events.notities.dossier_bewerken')}
                size="sm"
                onClick={() => setDossierOpen((o) => !o)}
              />
              <IconButton
                icon="settings"
                label={t('events.notities.alle_details')}
                size="sm"
                onClick={onOpenDetails}
              />
            </span>
          </div>
          {dossierOpen ? (
            <>
              <Textarea boxed rows={10} value={dossier} onChange={(e) => setDossier(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button variant="ghost" size="sm" onClick={() => setDossierOpen(false)}>
                  {t('alg.annuleren')}
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    updateEvent(ev.id, { description: dossier })
                      .then(() => setDossierOpen(false))
                      .catch((err) => toast.error(err.message))
                  }
                >
                  {t('alg.opslaan')}
                </Button>
              </div>
            </>
          ) : (
            <div style={{ font: 'var(--type-body-sm)', whiteSpace: 'pre-wrap', color: ev.description ? 'var(--text-1)' : 'var(--text-3)' }}>
              {ev.description ? ev.description.replace(/\*\*/g, '') : t('events.notities.geen_dossier')}
            </div>
          )}
        </div>

        {comments.map((c) => {
          const note = parseNote(c.body)
          const author = profileById[c.authorId]
          return (
            <div key={c.id} className="je-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <Hex size={24}>{initialsOf(author ?? { fullName: c.authorName })}</Hex>
                <span style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{author?.fullName ?? c.authorName}</span>
                <span className="je-muted-caption" style={{ marginLeft: 'auto' }}>
                  {c.createdAt ? shortDate(c.createdAt) : ''}
                </span>
                {c.authorId === profile?.id ? (
                  <IconButton
                    icon="trash-2"
                    label={t('events.notities.notitie_weg')}
                    size="sm"
                    onClick={() => {
                      if (window.confirm(t('events.notities.notitie_weg_vraag')))
                        deleteComment(c).catch((err) => toast.error(err.message))
                    }}
                  />
                ) : null}
              </div>
              {note.text ? <div style={{ font: 'var(--type-body-sm)', whiteSpace: 'pre-wrap', marginBottom: note.checks.length ? 'var(--space-3)' : 0 }}>{note.text}</div> : null}
              {note.checks.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {note.checks.map((ch) => (
                    <Checkbox key={ch.i} defaultChecked={ch.done} label={ch.t} />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}

        <div className="je-panel" style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('events.notities.plaatshouder')}
            rows={draft ? 4 : 1}
            style={{ border: 0, padding: 0 }}
            aria-label={t('events.notities.toevoegen')}
          />
          {draft.trim() ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button size="sm" onClick={add}>
                {t('events.notities.bewaren')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Attachments taskId={ev.id} />
    </div>
  )
}

function Attachments({ taskId }) {
  const { documents } = useDocuments({ taskId })
  const { t } = useTaal()
  const toast = useToast()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const upload = async (files) => {
    if (!files.length) return
    setBusy(true)
    try {
      for (const file of files) await uploadDocument({ file, taskId })
      toast.success(t('events.doc.toegevoegd', { aantal: files.length }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="je-panel">
      <div className="je-eyebrow" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-2)' }}>
        {t('events.bijlagen.titel')}
      </div>
      {documents.map((d, i) => (
        <div
          key={d.id}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-5)', borderTop: i ? '1px solid var(--border-hairline)' : 'none' }}
        >
          <span style={{ color: 'var(--accent)', display: 'flex' }}>
            <Icon name="file-text" size={16} />
          </span>
          <a href={d.url} target="_blank" rel="noreferrer" style={{ font: 'var(--type-body-sm)', color: 'var(--text-1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.name}
          </a>
          <span className="je-muted-caption">{leesbareGrootte(d.size)}</span>
          <IconButton
            icon="x"
            label={t('alg.verwijderen')}
            size="sm"
            onClick={() => {
              if (window.confirm(t('events.doc.weg_vraag', { naam: d.name })))
                deleteDocument(d).catch((err) => toast.error(err.message))
            }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          upload([...(e.dataTransfer.files ?? [])])
        }}
        className="je-plainbtn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          margin: 'var(--space-4)',
          width: 'calc(100% - 2 * var(--space-4))',
          padding: 'var(--space-5)',
          border: `1px dashed ${over ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
          borderRadius: 2,
          font: 'var(--type-caption)',
          color: 'var(--text-2)',
        }}
      >
        {busy ? <Spinner /> : <Icon name="download" size={14} />}
        {busy ? t('events.bijlagen.bezig') : t('events.bijlagen.sleep')}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          upload(files)
        }}
        aria-label={t('events.doc.kiezen')}
      />
    </div>
  )
}

// ─── Tijd ──────────────────────────────────────────────────────────────────

function TimeTab({ entries, totalS, billS, days, profileById, eventTasks, ev }) {
  const { t } = useTaal()
  const titleOf = (id) => (id === ev.id ? ev.name : eventTasks.find((taak) => taak.id === id)?.title)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
        {[
          // "Billable" staat er niet per ongeluk in het Engels: zo heet het op
          // de urenstaat en zo zegt het team het.
          [t('events.tijd.totaal'), hours(totalS)],
          ['Billable', hours(billS)],
          [
            t('events.tijd.tot_event'),
            days == null ? '—' : days >= 0 ? t('alg.dag', { aantal: days }) : t('events.tijd.voorbij'),
          ],
        ].map(([label, value]) => (
          <div key={label} className="je-stat">
            <div className="je-caps">{label}</div>
            <div className="je-stat__value">{value}</div>
          </div>
        ))}
      </div>
      <div className="je-panel">
        {entries.length === 0 ? (
          <div className="je-muted-caption" style={{ padding: 'var(--space-5)' }}>{t('events.tijd.leeg')}</div>
        ) : null}
        {entries.map((r, i) => {
          const p = profileById[r.profileId]
          return (
            <div
              key={r.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '88px 30px minmax(0, 1fr) auto 64px',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-5)',
                borderTop: i ? '1px solid var(--border-hairline)' : 'none',
              }}
            >
              <span className="je-muted-caption">{dayLabel(r.startedAt)}</span>
              <Hex size={24} title={p?.fullName}>
                {initialsOf(p)}
              </Hex>
              <span style={{ font: 'var(--type-body-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.description || titleOf(r.taskId) || r.taskTitle || t('events.tijd.losse')}
              </span>
              <span>
                <Badge tone={r.billable === false ? 'neutral' : 'accent'}>
                  {r.billable === false ? t('events.tijd.intern') : 'Billable'}
                </Badge>
              </span>
              <span style={{ font: 'var(--fw-medium) 16px/1 var(--font-display)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {hours(r.durationSeconds)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

