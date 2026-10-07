import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { addMonths, dayKey, startOfDay, startOfMonth } from '@lib/dates'
import { PHASES, PIPELINE, indexOf, labelOf } from '@lib/pipeline'
import { PLANNING, planningKleur, planningVan } from '@lib/planning'
import { useNarrow } from '@lib/useNarrow'
import { ARCHIEF_NA_DAGEN } from '@lib/archief'
import { Badge, IconButton, Select, Spinner, Stat, Tabs, Tag } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import NewEventDialog from '@components/events/NewEventDialog'
import EventRow from '@components/events/EventRow'
import EventBoardCard from '@components/events/EventBoardCard'
import {
  dayLabel,
  euro,
  maandNaam,
  progressOf,
  weekdagKort,
} from '@components/events/parts'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { byEventDate, moveEvent, useArchiefJaar, useArchiefStand, useEvents } from '@data/events'
import { useLosseMails } from '@data/mails'
import { dagenVan, raaktPeriode } from '@lib/eventdagen'
import PlanningBol from '@components/events/PlanningBol'
import { usePlanningStanden } from '@data/aapi'

const VIEWS = [
  { value: 'lijst', sleutel: 'events.weergave.lijst' },
  { value: 'bord', sleutel: 'events.weergave.bord' },
  { value: 'kalender', sleutel: 'events.weergave.kalender' },
  { value: 'archief', sleutel: 'events.weergave.archief' },
]
const LOS = '__los'

/*
  De drie fasen komen uit @lib/pipeline en heten daar nog zoals ze in de code
  heten. Hoe ze op het scherm staan hangt aan de taal, dus staat hier per fase
  welke sleutel erbij hoort — herkend aan de eerste status van de fase, want
  die verandert niet mee met de tekst.
*/
const FASE_TEKST = {
  request: { label: 'events.fase.verkoop', sub: 'events.fase.verkoop_sub' },
  'offer accepted': { label: 'events.fase.voorbereiding', sub: 'events.fase.voorbereiding_sub' },
  'ready to invoice': { label: 'events.fase.facturatie', sub: 'events.fase.facturatie_sub' },
}

function rememberedView() {
  try {
    return localStorage.getItem('je-events-weergave') || 'bord'
  } catch {
    return 'bord'
  }
}

/**
 * Events: de pijplijn van aanvraag tot betaling, als lijst per fase, als bord
 * per status, of als maandkalender. Het bord is de standaard.
 */
export default function Events() {
  const location = useLocation()
  const navigate = useNavigate()
  const narrow = useNarrow()
  const [params, setParams] = useSearchParams()
  const { t } = useTaal()
  const { brands, brandById, eventStatuses, profileById } = useWorkspace()
  const { events, tasksByEvent, loading } = useEvents()
  // Wat er in het postvak ligt en nergens bij hoort: het getal naast het
  // envelopje hierboven. Dezelfde bron als de aanvragenpagina zelf.
  const { mails: losse } = useLosseMails()
  const [dialog, setDialog] = useState(false)

  const onCalendarRoute = location.pathname === '/kalender'
  const view = onCalendarRoute ? 'kalender' : params.get('weergave') || rememberedView()
  const concept = params.get('concept') || 'Alle'

  const setView = (v) => {
    try {
      // Het archief wordt niet onthouden: je gaat er iets opzoeken en daarna
      // weer verder werken. Morgen op het archief openen zou als een fout lezen.
      if (v !== 'archief') localStorage.setItem('je-events-weergave', v)
    } catch {
      /* niet erg */
    }
    if (v === 'kalender') navigate('/kalender')
    else navigate(`/?weergave=${v}${concept !== 'Alle' ? `&concept=${encodeURIComponent(concept)}` : ''}`)
  }
  const setConcept = (c) => {
    const next = new URLSearchParams(params)
    if (c === 'Alle') next.delete('concept')
    else next.set('concept', c)
    setParams(next, { replace: true })
  }

  const planningFilter = params.get('planning') || 'alle'
  const setPlanningFilter = (k) => {
    const next = new URLSearchParams(params)
    if (k === 'alle') next.delete('planning')
    else next.set('planning', k)
    setParams(next, { replace: true })
  }

  // Concepten: de actieve merken, plus "Los event" voor wat aan geen merk hangt.
  const conceptTags = useMemo(() => {
    const active = brands.filter((b) => !b.archived)
    const tags = [
      { key: 'Alle', label: t('alg.alles') },
      ...active.map((b) => ({ key: b.id, label: b.name.split(' — ')[0] })),
    ]
    if (events.some((e) => !e.brandId || !brandById[e.brandId])) tags.push({ key: LOS, label: t('events.los_event') })
    return tags
  }, [brands, brandById, events, t])

  /*
    Afgesloten events gaan naar het archief en niet naar de prullenmand.

    `events` is hier alleen nog het actieve deel: de server zet `afgesloten` op
    het document en het abonnement slaat die over (zie `functions/archiveren.js`
    en `EventsProvider`). Het archief is dus geen andere helft van dezelfde
    lijst meer maar een eigen scherm met een eigen vraag, per jaar. Wat er in
    zit, staat in `config/archief` — zodat de link hieronder een aantal kan
    tonen zonder het archief op te halen.
  */
  const archiefStand = useArchiefStand()

  const filtered = useMemo(
    () =>
      events
        .filter((e) => concept === 'Alle' || (concept === LOS ? !e.brandId || !brandById[e.brandId] : e.brandId === concept))
        .filter((e) => planningFilter === 'alle' || (e.planning ?? '') === planningFilter)
        .sort(byEventDate),
    [events, concept, brandById, planningFilter]
  )

  const lopend = events.filter((e) => indexOf(e.statusName) >= 0 && indexOf(e.statusName) < indexOf('ready to invoice'))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={view === 'kalender' ? null : `JE Concept · ${t('events.lopend', { aantal: lopend.length })}`}
        title={view === 'kalender' ? t('nav.kalender') : t('nav.events')}
        bediening={
          /*
            Het postvak hing als menu-ingang onder Events, en stond er elke dag
            voor niets: wat binnenkomt hangt meestal al aan een event. Hier is
            het een envelopje met het aantal erbij — zie je niets, dan is er
            niets, en hoef je er niet te gaan kijken.
          */
          <>
            <IconButton
              icon="mail"
              label={losse.length ? t('events.postvak_aantal', { aantal: losse.length }) : t('nav.aanvragen')}
              onClick={() => navigate('/aanvragen')}
            />
            {losse.length ? <Badge tone="accent">{losse.length}</Badge> : null}
          </>
        }
        acties={{ hoofd: { label: t('events.nieuw'), icon: 'plus', onClick: () => setDialog(true) } }}
      />

      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
          <Tabs items={VIEWS.map((v) => ({ ...v, label: t(v.sleutel) }))} value={view} onChange={setView} />
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {conceptTags.map((c) => (
              <Tag key={c.key} selectable selected={concept === c.key} onClick={() => setConcept(c.key)}>
                {c.label}
              </Tag>
            ))}
            {/*
              Filteren op de planningstand. Geen tags erbij — die rij is al
              lang genoeg — maar één lijstje, en alleen wanneer er ergens een
              stand gezet is: een filter op een veld dat niemand gebruikt, is
              een knop die altijd alles toont.
            */}
            {events.some((e) => e.planning) ? (
              <Select
                aria-label={t('planning.filter')}
                value={planningFilter}
                onChange={(e) => setPlanningFilter(e.target.value)}
                options={[{ value: 'alle', label: t('planning.alle') }, ...PLANNING.map((p) => ({ value: p.key, label: p.label }))]}
              />
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spinner /> {t('events.laden')}
          </div>
        ) : view === 'archief' ? (
          <ArchiefView
            jaren={archiefStand.jaren}
            concept={concept}
            planningFilter={planningFilter}
            profileById={profileById}
            statuses={eventStatuses}
            narrow={narrow}
          />
        ) : view === 'lijst' ? (
          <ListView
            events={filtered}
            all={events}
            archief={archiefStand.aantal}
            tasksByEvent={tasksByEvent}
            profileById={profileById}
            statuses={eventStatuses}
            narrow={narrow}
            onArchief={() => setView('archief')}
          />
        ) : view === 'kalender' ? (
          <CalendarView events={filtered} narrow={narrow} />
        ) : (
          <BoardView events={filtered} tasksByEvent={tasksByEvent} profileById={profileById} statuses={eventStatuses} />
        )}
      </div>

      <NewEventDialog open={dialog} onClose={() => setDialog(false)} />
    </div>
  )
}

// ─── Lijst ─────────────────────────────────────────────────────────────────

function ListView({ events, all, archief, tasksByEvent, profileById, statuses, narrow, onArchief }) {
  const { t } = useTaal()
  const planningStanden = usePlanningStanden(events)
  const navigate = useNavigate()
  // Vast, zodat de gememoriseerde rijen niet hertekenen bij elke render.
  const openEvent = useCallback((id) => navigate(`/events/${id}`), [navigate])
  const today = startOfDay()

  const open = all.filter((e) => indexOf(e.statusName) >= 0 && indexOf(e.statusName) < indexOf('ready to invoice'))
  // De maand die er nu toe doet: deze, tot de laatste tien dagen — dan de volgende.
  const focus = today.getDate() > 20 ? addMonths(startOfMonth(today), 1) : startOfMonth(today)
  const focusKey = dayKey(focus).slice(0, 7)
  // Ook een event dat in de vorige maand begon en in deze doorloopt telt mee.
  const inMonth = all.filter((e) => raaktPeriode(e, `${focusKey}-01`, `${focusKey}-31`)).sort(byEventDate)
  const toInvoice = all.filter((e) => e.statusName === 'ready to invoice')

  const stats = [
    {
      label: t('events.stat.lopend'),
      value: String(open.length),
      sub: t('events.stat.gasten', {
        aantal: open.reduce((a, e) => a + (Number(e.pax) || 0), 0).toLocaleString('nl-BE'),
      }),
    },
    {
      label: maandNaam(focus),
      value: t('events.aantal', { aantal: inMonth.length }),
      sub: inMonth[0] ? t('events.stat.eerste', { dag: dayLabel(inMonth[0].eventDate) }) : t('events.stat.niets_gepland'),
    },
    /*
      Een bedrag dat er niet is, telt niet als nul. De tegel zei live
      "€ 0 · 13 events wachten op factuur": er stond geen enkel bedrag op die
      events, en dat las als "er valt niets te factureren". Nu staat er het
      bedrag dat gekend is, en hoeveel events nog geen bedrag hebben.
    */
    (() => {
      const metBedrag = toInvoice.filter((e) => Number(e.quoteAmount) > 0)
      const zonder = toInvoice.length - metBedrag.length
      return {
        label: t('events.stat.factureren'),
        value: metBedrag.length ? euro(metBedrag.reduce((a, e) => a + Number(e.quoteAmount), 0)) : '—',
        sub: [
          t('events.stat.wacht', { aantal: toInvoice.length }),
          zonder ? t('events.stat.zonder_bedrag', { aantal: zonder }) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      }
    })(),
  ]

  const groups = PHASES.map((ph) => ({
    ...ph,
    tekst: FASE_TEKST[ph.keys[0]],
    events: events.filter((e) => ph.keys.includes(e.statusName)),
  })).filter((g) => g.events.length)

  const cols = narrow ? '44px minmax(0,1fr) 16px' : '48px minmax(120px,1fr) 64px 136px 84px 96px 16px'

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} sub={s.sub} />
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="je-panel" style={{ padding: 'var(--space-7)', textAlign: 'center' }}>
          <div className="je-muted-caption">{t('events.leeg')}</div>
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.label} className="je-panel">
          <div className="je-panel__head" style={{ padding: 'var(--space-5) var(--space-6)' }}>
            <span className="je-eyebrow">{t(g.tekst.label)}</span>
            <span className="je-panel__sub">{t(g.tekst.sub)}</span>
            <span className="je-panel__right">{t('events.aantal', { aantal: g.events.length })}</span>
          </div>
          {g.events.map((e, i) => (
            <EventRow
              key={e.id}
              event={e}
              progress={progressOf(tasksByEvent[e.id])}
              statuses={statuses}
              profileById={profileById}
              planningStand={planningStanden.get(e.id)}
              columns={cols}
              narrow={narrow}
              first={i === 0}
              onOpen={openEvent}
            />
          ))}
        </section>
      ))}

      {/* Wat er niet meer op het bord staat, hoort wel te zien te zijn — anders
          is "weg van het bord" niet te onderscheiden van "weg". */}
      <div style={{ textAlign: 'center' }}>
        <button type="button" className="je-plainbtn je-archieflink" onClick={onArchief}>
          {t('events.archief.link', { aantal: archief })}
        </button>
      </div>
    </>
  )
}

// ─── Archief ───────────────────────────────────────────────────────────────

/**
 * De afgesloten events, per jaar.
 *
 * Niets is verwijderd: dit zijn dezelfde documenten als op het bord, alleen
 * niet meer in de weg. Ze openen dan ook gewoon hun eventfiche, met de
 * facturatiegegevens en de documenten die eraan hangen.
 *
 * Het filter staat op jaar en niet op maand, omdat de vraag die mensen hier
 * stellen bijna altijd "wat deden we vorig jaar rond deze tijd" is — een
 * vergelijkbaar dossier terugvinden, of nakijken wat er toen aangerekend werd.
 *
 * Eén jaar tegelijk, en niet "alle jaren" zoals eerder. Dat laatste was het
 * hele archief ophalen, en precies dat gebeurde vroeger bij élke start van de
 * app, op elk scherm. Nu wordt er pas iets opgehaald wanneer je dit scherm
 * opent, en dan één jaar. Het recentste jaar staat open: dat is wat mensen
 * zoeken, en een scherm dat leeg opent omdat je nog een jaar moet aanklikken,
 * leest als een archief dat niets bevat.
 */
function ArchiefView({ jaren, concept, planningFilter, profileById, statuses, narrow }) {
  const { t } = useTaal()
  const navigate = useNavigate()
  const { brandById, eventsList } = useWorkspace()
  const openEvent = useCallback((id) => navigate(`/events/${id}`), [navigate])
  const [gekozen, setGekozen] = useState(null)

  // Zolang niemand koos: het lopende jaar, of anders het laatste voorbij jaar.
  // Niet zomaar het hoogste: één event van 2027 dat al afgesloten werd, liet
  // het archief live op 2027 openen.
  const ditJaar = new Date().getFullYear()
  const standaard = jaren.includes(ditJaar) ? ditJaar : (jaren.find((j) => j < ditJaar) ?? jaren[0] ?? null)
  const jaar = gekozen != null && jaren.includes(gekozen) ? gekozen : standaard
  const { events, tasksByEvent, loading } = useArchiefJaar(jaar, { listId: eventsList?.id, brandById })

  // Dezelfde filters als op het bord: wie op een merk filtert en dan naar het
  // archief gaat, verwacht niet dat dat filter stilletjes losgelaten wordt.
  const getoond = useMemo(
    () =>
      events
        .filter((e) => concept === 'Alle' || (concept === LOS ? !e.brandId || !brandById[e.brandId] : e.brandId === concept))
        .filter((e) => planningFilter === 'alle' || (e.planning ?? '') === planningFilter)
        .sort((a, b) => byEventDate(b, a)),
    [events, concept, brandById, planningFilter]
  )

  const cols = narrow ? '44px minmax(0,1fr) 16px' : '48px minmax(120px,1fr) 64px 136px 84px 96px 16px'

  return (
    <>
      <div className="je-panel" style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span className="je-eyebrow">{t('events.archief.jaar')}</span>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {jaren.map((j) => (
            <Tag key={j} selectable selected={jaar === j} onClick={() => setGekozen(j)}>
              {j}
            </Tag>
          ))}
        </div>
        <span className="je-muted-caption" style={{ marginLeft: 'auto' }}>
          {t('events.aantal', { aantal: getoond.length })}
        </span>
      </div>

      <p className="je-muted-caption" style={{ maxWidth: '68ch' }}>
        {t('events.archief.uitleg', { dagen: ARCHIEF_NA_DAGEN })}
      </p>

      {loading ? (
        <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Spinner /> {t('events.laden')}
        </div>
      ) : getoond.length === 0 ? (
        <div className="je-panel" style={{ padding: 'var(--space-7)', textAlign: 'center' }}>
          <div className="je-muted-caption">{t('events.archief.leeg')}</div>
        </div>
      ) : (
        <section className="je-panel">
          <div className="je-panel__head" style={{ padding: 'var(--space-5) var(--space-6)' }}>
            <span className="je-eyebrow">{t('events.archief.titel')}</span>
            <span className="je-panel__sub">{t('events.archief.nieuwste')}</span>
            <span className="je-panel__right">{jaar}</span>
          </div>
          {getoond.map((e, i) => (
            <EventRow
              key={e.id}
              event={e}
              progress={progressOf(tasksByEvent[e.id])}
              statuses={statuses}
              profileById={profileById}
              columns={cols}
              narrow={narrow}
              first={i === 0}
              onOpen={openEvent}
            />
          ))}
        </section>
      )}
    </>
  )
}

// ─── Bord ──────────────────────────────────────────────────────────────────

function BoardView({ events, tasksByEvent, profileById, statuses }) {
  const navigate = useNavigate()
  /*
    Eén abonnement voor het hele bord. Per kaart zou het er veertig zijn, elk
    met dezelfde vraag aan dezelfde collectie — zie `usePlanningStanden`.
  */
  const planningStanden = usePlanningStanden(events)

  // Vaste functies: de kaarten zijn gememoriseerd en hertekenen anders alsnog
  // bij elke muisbeweging tijdens het slepen.
  const openEvent = useCallback((id) => navigate(`/events/${id}`), [navigate])
  const toast = useToast()
  const [dragging, setDragging] = useState(null)
  const [over, setOver] = useState(null)

  const beginSleep = useCallback((e, id) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragging(id)
  }, [])

  const eindSleep = useCallback(() => {
    setDragging(null)
    setOver(null)
  }, [])

  // Afgerond staat niet op het bord: dat is het archief.
  const columns = PIPELINE.slice(0, 8).map((step, i) => ({
    ...step,
    n: String(i + 1).padStart(2, '0'),
    label: labelOf(step.key, statuses),
    events: events.filter((e) => e.statusName === step.key),
  }))

  const drop = async (key) => {
    const ev = events.find((e) => e.id === dragging)
    setDragging(null)
    setOver(null)
    if (!ev || ev.statusName === key) return
    try {
      await moveEvent(ev, key, statuses)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto', paddingBottom: 'var(--space-5)', alignItems: 'flex-start' }}>
      {columns.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => {
            if (!dragging) return
            e.preventDefault()
            setOver(col.key)
          }}
          onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            drop(col.key)
          }}
          style={{
            flex: '0 0 248px',
            background: 'var(--surface-2)',
            border: `1px solid ${over === col.key ? 'var(--border-accent)' : 'var(--border-hairline)'}`,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '1px solid var(--border-hairline)',
            }}
          >
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{col.n}</span>
            <span className="je-eyebrow" style={{ letterSpacing: '.14em', color: 'var(--text-1)' }}>
              {col.label}
            </span>
            <span style={{ marginLeft: 'auto', font: 'var(--type-caption)', color: 'var(--text-2)' }}>{col.events.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3)', minHeight: 80 }}>
            {col.events.map((e) => (
              <EventBoardCard
                key={e.id}
                event={e}
                progress={progressOf(tasksByEvent[e.id])}
                profileById={profileById}
                planningStand={planningStanden.get(e.id)}
                dragging={dragging === e.id}
                onOpen={openEvent}
                onDragStart={beginSleep}
                onDragEnd={eindSleep}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Kalender ──────────────────────────────────────────────────────────────

function CalendarView({ events, narrow }) {
  const { t } = useTaal()
  const planningStanden = usePlanningStanden(events)
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const todayKey = dayKey(new Date())

  const first = new Date(month)
  const lead = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead, 12)
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const nCells = Math.ceil((lead + daysIn) / 7) * 7

  /*
    Een meerdaags event staat op elk van zijn dagen, en niet alleen op de
    eerste. Anders is een festival van vrijdag tot zondag op zaterdag
    onzichtbaar, en net dan wil je weten wat er loopt.

    Het telt in de maandteller wel één keer: "twaalf events deze maand" gaat
    over dossiers, niet over dagen.
  */
  const byDay = {}
  for (const e of events) {
    for (const sleutel of dagenVan(e)) (byDay[sleutel] ??= []).push(e)
  }
  const monthKey = dayKey(first).slice(0, 7)
  const count = events.filter((e) => raaktPeriode(e, `${monthKey}-01`, `${monthKey}-31`)).length

  const cells = Array.from({ length: nCells }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { d, key: dayKey(d), inMonth: d.getMonth() === first.getMonth(), col: i % 7 }
  })

  return (
    <div className="je-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-hairline)' }}>
        <IconButton
          icon="chevron-left"
          label={t('events.maand.vorige')}
          size="sm"
          onClick={() => setMonth((m) => addMonths(m, -1))}
        />
        <span style={{ font: 'var(--type-h3)', textTransform: 'uppercase', minWidth: narrow ? 140 : 180, textAlign: 'center' }}>
          {maandNaam(first)} {first.getFullYear()}
        </span>
        <IconButton
          icon="chevron-right"
          label={t('events.maand.volgende')}
          size="sm"
          onClick={() => setMonth((m) => addMonths(m, 1))}
        />
        <span className="je-muted-caption" style={{ marginLeft: 'auto' }}>
          {t('events.aantal', { aantal: count })}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {cells.slice(0, 7).map((c) => (
          <div
            key={c.key}
            className="je-eyebrow"
            style={{ padding: 'var(--space-3) var(--space-4)', letterSpacing: '.14em', color: 'var(--text-2)', borderBottom: '1px solid var(--border-hairline)' }}
          >
            {weekdagKort(c.d)}
          </div>
        ))}
        {cells.map((c) => (
          <div
            key={c.key}
            style={{
              minHeight: narrow ? 64 : 112,
              padding: 'var(--space-3)',
              borderRight: c.col < 6 ? '1px solid var(--border-hairline)' : 'none',
              borderBottom: '1px solid var(--border-hairline)',
              background: c.inMonth ? 'var(--surface-1)' : 'var(--paper)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 0,
            }}
          >
            <span
              style={{
                font: 'var(--fw-medium) 15px/1 var(--font-display)',
                color: c.key === todayKey ? 'var(--text-accent)' : c.inMonth ? 'var(--text-1)' : 'var(--text-3)',
              }}
            >
              {c.d.getDate()}
            </span>
            {(byDay[c.key] ?? []).map((e) => (
              <button
                key={e.id}
                type="button"
                // In een chip van tachtig pixels past geen badge; de stand
                // staat er als tweede stipje en voluit in de tooltip.
                title={[e.name, planningVan(e)?.label].filter(Boolean).join(' · ')}
                onClick={() => navigate(`/events/${e.id}`)}
                className="je-calchip"
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    flex: '0 0 6px',
                    background: indexOf(e.statusName) >= indexOf('offer accepted') ? 'var(--navy-700)' : 'var(--navy-300)',
                  }}
                />
                {planningKleur(e) ? (
                  <span
                    aria-hidden="true"
                    style={{ width: 6, height: 6, flex: '0 0 6px', borderRadius: 3, background: planningKleur(e) }}
                  />
                ) : null}
                {/* En of er volk staat. In een chip van tachtig pixels is een
                    derde stipje het maximum; wat het betekent staat in de
                    tooltip van de chip. */}
                <PlanningBol stand={planningStanden.get(e.id)} titel={false} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {narrow ? e.name.split(' ')[0] : e.name}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

