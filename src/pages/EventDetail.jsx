import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { startOfDay } from '@lib/dates'
import { PIPELINE, indexOf, labelOf } from '@lib/pipeline'
import { useNarrow } from '@lib/useNarrow'
import { verwijderVraag } from '@lib/verwijdervraag'
import { Avatar, Button, Checkbox, ConfirmButton, Icon, IconButton, Input, Tabs, Textarea } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import TaskDrawer from '@components/board/TaskDrawer'
import Bestellijst from '@components/events/Bestellijst'
import EventFiche from '@components/events/EventFiche'
import OfferteTab from '@components/events/OfferteTab'
import MailDraad from '@components/events/MailDraad'
import EventOmschrijving from '@components/events/EventOmschrijving'
import EventOverzicht from '@components/events/EventOverzicht'
import TaskRow from '@components/events/TaskRow'
import { PlanningBadge, StatusBadge, dayLabel, eventTijd, hours } from '@components/events/parts'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import EventNotities from '@components/events/EventNotities'
import { deleteDocument, leesbareGrootte, uploadDocument, useDocuments } from '@data/documents'
import { addEventTask, deleteEvent, isDone, moveEvent, updateEvent, useEventTime, useEvents } from '@data/events'
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
  const [drawer, setDrawer] = useState(null)

  const ev = eventById[id]
  const tasks = useMemo(() => tasksByEvent[id] ?? [], [tasksByEvent, id])
  // Alleen om de verwijdervraag te kunnen laten zeggen wát er weggaat; het
  // tabblad Bijlagen leest dezelfde lijst nog eens, en dat is één abonnement
  // waard boven een vraag die liegt over wat ze weggooit.
  const { documents: documenten } = useDocuments({ taskId: id })
  const tab = params.get('tab') || 'overzicht'
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
  // Een stap terugzetten moest tot nu via het bord of via de fiche. Dat is
  // een omweg voor iets wat even vaak gebeurt als vooruitgaan: een offerte
  // die herzien wordt, een akkoord dat toch niet rond is.
  const vorige = si > 0 ? PIPELINE[si - 1].key : null
  const days = ev.eventDate ? Math.round((startOfDay(ev.eventDate) - startOfDay()) / 864e5) : null

  const move = async (key) => {
    try {
      await moveEvent(ev, key, eventStatuses)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const liveSeconds =
    timer && taskIds.includes(timer.taskId) ? durationOf(timer) : 0
  const totalS = time.reduce((a, e) => a + (e.durationSeconds ?? 0), 0) + liveSeconds
  const openCount = tasks.filter((taak) => !isDone(taak)).length
  const bestelRegels = ev.bestellijst ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        back={{ to: '/', label: t('events.detail.alle_events') }}
        eyebrow={[
          dayLabel(ev.eventDate),
          eventTijd(ev),
          // Het concept alleen wanneer er een is; "Los event" zei niets over
          // dit dossier en stond op de helft van de pagina's.
          ev.concept?.split(' — ')[0],
          days != null && days >= 0 ? t('events.over_dagen', { aantal: days }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        title={ev.name}
        actions={
          <>
            <StatusBadge statusName={ev.statusName} statuses={eventStatuses} />
            <PlanningBadge event={ev} />
            {vorige ? (
              <Button
                variant="secondary"
                size="sm"
                iconLeft="arrow-left"
                title={t('events.detail.terug_stap', { stap: labelOf(vorige, eventStatuses).toLowerCase() })}
                onClick={() => move(vorige)}
              >
                {t('alg.vorige')}
              </Button>
            ) : null}
            {next ? (
              <Button
                size="sm"
                iconRight="arrow-right"
                title={t('events.detail.naar_stap', { stap: labelOf(next, eventStatuses).toLowerCase() })}
                onClick={() => move(next)}
              >
                {t('events.detail.naar_stap', { stap: labelOf(next, eventStatuses).toLowerCase() })}
              </Button>
            ) : null}
            {/*
              Verwijderen staat hier stil en achteraan, want archiveren is
              bijna altijd het juiste. Maar een dubbel aangemaakt dossier of
              een test hoort niet in de geschiedenis, en zolang die alleen te
              archiveren zijn, vervuilen ze elk overzicht.
            */}
            {/*
              Alleen het pictogram. Het woord "Verwijderen" naast twee
              stapknoppen trok de aandacht naar de enige knop in deze rij die
              iets onherstelbaars doet — en de vraag die erop volgt, zegt toch
              al precies wat er weggaat.
            */}
            <ConfirmButton
              variant="ghost"
              size="sm"
              iconLeft="trash-2"
              aria-label={t('alg.verwijderen')}
              title={t('alg.verwijderen')}
              question={verwijderVraag({ task: ev, subtaken: tasks.length, bijlagen: documenten.length, soort: 'event' })}
              onConfirm={() =>
                deleteEvent(ev.id)
                  .then(() => {
                    toast.success(t('events.detail.verwijderd', { naam: ev.name }))
                    navigate('/')
                  })
                  .catch((err) => toast.error(err.message))
              }
            />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/*
            De tabs staan bovenaan en de fiche eronder, in het overzicht.

            Daarvoor stond er eerst een balk met alle negen pijplijnstappen,
            dan de fiche, dan de omschrijving, en pas daaronder de tabs. Wie
            naar de offerte wilde, scrolde eerst langs drie blokken die hij
            niet kwam halen. De stappenbalk is helemaal weg: hij was een
            navigatie die er als voortgang uitzag — negen knoppen die elk een
            status verzetten, met één verkeerde klik als prijs. De voortgang
            staat nu als tijdlijn in het overzicht, en verzetten doe je met de
            twee stapknoppen in de kop.
          */}
          <Tabs
            items={[
              { value: 'overzicht', label: t('events.tab.overzicht') },
              { value: 'taken', label: t('events.tab.taken', { aantal: openCount }) },
              // Alleen events die uit een formule komen (of waar iemand zelf een
              // lijst begon) hebben hier iets te tonen; bij de rest zou het een
              // leeg tabblad zijn dat je elke keer opnieuw moet negeren.
              ...(bestelRegels.length || ev.formuleId
                ? [{ value: 'bestellijst', label: t('events.tab.bestellijst', { aantal: bestelRegels.length }) }]
                : []),
              { value: 'offerte', label: t('offerte.tab') },
              { value: 'mail', label: t('mail.tab') },
              { value: 'draaiboek', label: t('events.tab.draaiboek') },
              { value: 'bijlagen', label: t('events.tab.bijlagen') },
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

          {tab === 'overzicht' ? (
            <>
              <EventOverzicht
                ev={ev}
                tasks={tasks}
                documenten={documenten}
                totalSeconden={totalS}
                onTab={setTab}
              />
              <EventFiche ev={ev} />
              <EventOmschrijving ev={ev} />
            </>
          ) : tab === 'taken' ? (
            <TasksTab ev={ev} tasks={tasks} focus={params.get('taak')} onOpen={setDrawer} runningId={timer?.taskId} />
          ) : tab === 'bestellijst' ? (
            <Bestellijst ev={ev} />
          ) : tab === 'offerte' ? (
            <OfferteTab ev={ev} />
          ) : tab === 'mail' ? (
            <MailDraad ev={ev} />
          ) : tab === 'draaiboek' ? (
            <RunsheetTab ev={ev} />
          ) : tab === 'bijlagen' ? (
            <Attachments taskId={ev.id} />
          ) : tab === 'notities' ? (
            <EventNotities ev={ev} compact />
          ) : (
            <TimeTab entries={time} totalS={totalS} days={days} profileById={profileById} eventTasks={tasks} ev={ev} />
          )}
        </div>

        {narrow ? null : <EventNotities ev={ev} />}
        </div>
      </div>

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

// ─── Bijlagen ──────────────────────────────────────────────────────────────

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

function TimeTab({ entries, totalS, days, profileById, eventTasks, ev }) {
  const { t } = useTaal()
  const titleOf = (id) => (id === ev.id ? ev.name : eventTasks.find((taak) => taak.id === id)?.title)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
        {[
          /*
            Factureerbaar stond hier als tweede getal. Dat is weg: JE Concept
            werkt met een vaste prijs per event, dus "welk deel van deze uren
            mogen we doorrekenen" was een vraag die nooit gesteld werd. Wat
            overblijft is wat wél telt — hoeveel uur dit dossier gekost heeft.
          */
          [t('events.tijd.totaal'), hours(totalS)],
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
              <Avatar profile={p} size={24} />
              <span style={{ font: 'var(--type-body-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.description || titleOf(r.taskId) || r.taskTitle || t('events.tijd.losse')}
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

