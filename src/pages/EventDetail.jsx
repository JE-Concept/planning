import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { startOfDay } from '@lib/dates'
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
import EventEditDialog from '@components/events/EventEditDialog'
import TaskRow from '@components/events/TaskRow'
import { StatusBadge, dayLabel, euro, hours, longDate, shortDate } from '@components/events/parts'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { addComment, deleteComment, useComments } from '@data/comments'
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

  const taskIds = useMemo(() => [id, ...tasks.map((t) => t.id)], [id, tasks])
  const time = useEventTime(taskIds)
  const { uid } = useAuth()
  const { timer } = useRunningTimer(uid)

  if (!ev) {
    return (
      <div className="je-pagebody">
        {loading ? (
          <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spinner /> Event laden…
          </div>
        ) : (
          <div className="je-panel" style={{ padding: 'var(--space-7)', maxWidth: 560 }}>
            <div style={{ font: 'var(--type-body)', fontWeight: 600 }}>Dit event bestaat niet (meer).</div>
            <Button variant="secondary" size="sm" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
              Naar alle events
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
  const openCount = tasks.filter((t) => !isDone(t)).length

  const fiche = [
    ['Klant', ev.customerName],
    ['Datum', longDate(ev.eventDate)],
    ['Gasten', ev.pax ? `${ev.pax} pax${ev.kids ? ` + ${ev.kids} kinderen` : ''}` : null],
    ['Locatie', ev.location],
    ['Formule', ev.formule],
    ['Offerte', euro(ev.quoteAmount)],
    ['Voorschot 40%', ev.quoteAmount ? euro(Math.round(ev.quoteAmount * 0.4)) : null],
    ['Team', ev.team.map((p) => (profileById[p]?.fullName ?? '').split(' ')[0]).filter(Boolean).join(', ') || null],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        back={{ to: '/', label: 'Alle events' }}
        eyebrow={[
          ev.concept?.split(' — ')[0] ?? 'Los event',
          dayLabel(ev.eventDate),
          days != null && days >= 0 ? `over ${days} ${days === 1 ? 'dag' : 'dagen'}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        title={ev.name}
        actions={
          <>
            <StatusBadge statusName={ev.statusName} statuses={eventStatuses} />
            <IconButton icon="pencil" label="Fiche bewerken" variant="outline" size="sm" onClick={() => setEditing(true)} />
            {next ? (
              <Button size="sm" iconRight="arrow-right" disabled={blocked} onClick={() => move(next)}>
                Naar {labelOf(next, eventStatuses).toLowerCase()}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="je-pagebody">
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
              <span style={{ flex: 1 }}>
                Vul klant, datum, aantal gasten en offertebedrag in voor je een offerte start. Zo blijft elk event
                rapporteerbaar.
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Invullen
              </Button>
            </div>
          ) : null}

          <div className="je-fiche">
            {fiche.map(([label, value]) => (
              <button key={label} type="button" className="je-plainbtn" onClick={() => setEditing(true)} title="Fiche bewerken">
                <div className="je-caps">{label}</div>
                <div style={{ font: 'var(--type-body-sm)', fontWeight: 600, color: value ? 'var(--text-1)' : 'var(--text-3)', marginTop: 2 }}>
                  {value ?? '—'}
                </div>
              </button>
            ))}
          </div>

          <Tabs
            items={[
              { value: 'taken', label: `Taken · ${openCount}` },
              { value: 'draaiboek', label: 'Draaiboek' },
              { value: 'notities', label: 'Notities & bijlagen' },
              { value: 'tijd', label: `Tijd · ${hours(totalS)}` },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'taken' ? (
            <TasksTab ev={ev} tasks={tasks} focus={params.get('taak')} onOpen={setDrawer} runningId={timer?.taskId} />
          ) : tab === 'draaiboek' ? (
            <RunsheetTab ev={ev} />
          ) : tab === 'notities' ? (
            <NotesTab ev={ev} onOpenDetails={() => setDrawer(ev.id)} />
          ) : (
            <TimeTab entries={time} totalS={totalS} billS={billS} days={days} profileById={profileById} eventTasks={tasks} ev={ev} />
          )}
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
        <div className="je-muted-caption" style={{ padding: 'var(--space-5)' }}>
          Nog geen taken. Typ er hieronder een en druk Enter.
        </div>
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
          placeholder="Taak toevoegen en Enter"
          aria-label="Taak toevoegen"
          style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: 'var(--type-body-sm)', color: 'var(--text-1)', boxShadow: 'none' }}
        />
      </div>
    </div>
  )
}

// ─── Draaiboek ─────────────────────────────────────────────────────────────

function RunsheetTab({ ev }) {
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
            label="Regel verwijderen"
            size="sm"
            onClick={() => save((ev.draaiboek ?? []).filter((x) => x !== d))}
          />
        </div>
      ))}
      {rows.length === 0 ? (
        <div style={{ padding: 'var(--space-6) 0 var(--space-3)', font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
          Nog geen draaiboek. Het wordt opgebouwd zodra de planning loopt.
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
        <Input type="time" value={tijd} onChange={(e) => setTijd(e.target.value)} aria-label="Tijd" />
        <Input
          value={wat}
          onChange={(e) => setWat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder="Wat gebeurt er"
          aria-label="Wat"
        />
        <Input
          value={wie}
          onChange={(e) => setWie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder="Wie"
          aria-label="Wie"
        />
        <Button variant="secondary" size="sm" iconLeft="plus" disabled={!wat.trim()} onClick={add}>
          Regel
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
            <span className="je-eyebrow">Dossier</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <IconButton icon="pencil" label="Dossier bewerken" size="sm" onClick={() => setDossierOpen((o) => !o)} />
              <IconButton icon="settings" label="Alle details (social, klant, labels)" size="sm" onClick={onOpenDetails} />
            </span>
          </div>
          {dossierOpen ? (
            <>
              <Textarea boxed rows={10} value={dossier} onChange={(e) => setDossier(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button variant="ghost" size="sm" onClick={() => setDossierOpen(false)}>
                  Annuleren
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    updateEvent(ev.id, { description: dossier })
                      .then(() => setDossierOpen(false))
                      .catch((err) => toast.error(err.message))
                  }
                >
                  Bewaren
                </Button>
              </div>
            </>
          ) : (
            <div style={{ font: 'var(--type-body-sm)', whiteSpace: 'pre-wrap', color: ev.description ? 'var(--text-1)' : 'var(--text-3)' }}>
              {ev.description ? ev.description.replace(/\*\*/g, '') : 'Nog geen dossier.'}
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
                    label="Notitie verwijderen"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Deze notitie verwijderen?')) deleteComment(c).catch((err) => toast.error(err.message))
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
            placeholder={'Notitie toevoegen…\nTip: "- [ ] iets" wordt een vinkje.'}
            rows={draft ? 4 : 1}
            style={{ border: 0, padding: 0 }}
            aria-label="Notitie toevoegen"
          />
          {draft.trim() ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button size="sm" onClick={add}>
                Notitie bewaren
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
  const toast = useToast()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const upload = async (files) => {
    if (!files.length) return
    setBusy(true)
    try {
      for (const file of files) await uploadDocument({ file, taskId })
      toast.success(files.length === 1 ? 'Bestand toegevoegd.' : `${files.length} bestanden toegevoegd.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="je-panel">
      <div className="je-eyebrow" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-2)' }}>
        Bijlagen
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
            label="Verwijderen"
            size="sm"
            onClick={() => {
              if (window.confirm(`"${d.name}" verwijderen?`)) deleteDocument(d).catch((err) => toast.error(err.message))
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
        {busy ? 'Bezig met opladen…' : 'Sleep een bestand hierheen'}
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
        aria-label="Bestand kiezen"
      />
    </div>
  )
}

// ─── Tijd ──────────────────────────────────────────────────────────────────

function TimeTab({ entries, totalS, billS, days, profileById, eventTasks, ev }) {
  const titleOf = (id) => (id === ev.id ? ev.name : eventTasks.find((t) => t.id === id)?.title)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
        {[
          ['Totaal geboekt', hours(totalS)],
          ['Billable', hours(billS)],
          ['Tot het event', days == null ? '—' : days >= 0 ? `${days} dagen` : 'Voorbij'],
        ].map(([label, value]) => (
          <div key={label} className="je-stat">
            <div className="je-caps">{label}</div>
            <div className="je-stat__value">{value}</div>
          </div>
        ))}
      </div>
      <div className="je-panel">
        {entries.length === 0 ? (
          <div className="je-muted-caption" style={{ padding: 'var(--space-5)' }}>
            Nog geen tijd geboekt op dit event. Start een timer vanaf een taak.
          </div>
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
                {r.description || titleOf(r.taskId) || r.taskTitle || 'Tijd'}
              </span>
              <span>
                <Badge tone={r.billable === false ? 'neutral' : 'accent'}>{r.billable === false ? 'Intern' : 'Billable'}</Badge>
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

