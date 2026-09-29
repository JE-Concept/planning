import { useCallback, useEffect, useMemo, useState } from 'react'
import { daysUntil, isToday, startOfMonth } from '@lib/dates'
import { formatDuration, priorityOf } from '@lib/format'
import { filter as filterTaken, groepeer, perDag } from '@lib/task-view'
import { Badge, Button, EmptyState, Spinner } from '@components/ds'
import MonthCalendar from '@components/common/MonthCalendar'
import TaskDrawer from '@components/board/TaskDrawer'
import PageHeader from '@components/layout/PageHeader'
import DisplayOptions from '@components/tasks/DisplayOptions'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { isDone } from '@data/events'
import { useTaskBoard } from '@data/tasks'

/**
 * Tasks: alles wat er te doen is, in de vorm die je op dat moment nodig hebt.
 *
 * Hier stonden twee pagina's die dezelfde vraag stelden. "Mijn taken" gaf jouw
 * lijst gegroepeerd op wanneer het moest; "Taken per persoon" gaf dezelfde
 * gegevens met een keuzelijstje voor wie, en een kalender erbij. Wie iets zocht
 * moest weten in welke van de twee het stond — en de tweede had bovendien een
 * andere naam in het menu dan in de kop.
 *
 * Nu is het één pagina waarin de verschillen keuzes zijn geworden: van wie,
 * hoe gegroepeerd, hoe gesorteerd, in welke vorm. Die keuzes worden onthouden,
 * want iemand die altijd op status groepeert wil dat niet elke ochtend opnieuw
 * instellen.
 */

const BEWAARD = 'je-plan:tasks-weergave'

const STANDAARD = {
  weergave: 'lijst',
  wie: 'ik',
  groep: 'deadline',
  sortering: 'deadline',
  lijstId: '',
  label: '',
  prioriteit: '',
  open: true,
  zoek: '',
}

/** De keuzes van vorige keer. Onleesbaar of oud? Dan de standaard, zonder drama. */
function lees() {
  try {
    const bewaard = JSON.parse(localStorage.getItem(BEWAARD) ?? '{}')
    // De zoekterm komt bewust niet terug: die hoort bij één keer zoeken.
    return { ...STANDAARD, ...bewaard, zoek: '' }
  } catch {
    return STANDAARD
  }
}

export default function Tasks() {
  const { uid } = useAuth()
  const { profiles, listById, lists, tags } = useWorkspace()
  const [opties, setOpties] = useState(lees)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [maand, setMaand] = useState(() => startOfMonth())

  const zet = useCallback((patch) => setOpties((huidig) => ({ ...huidig, ...patch })), [])

  useEffect(() => {
    try {
      const { zoek, ...rest } = opties
      localStorage.setItem(BEWAARD, JSON.stringify(rest))
    } catch {
      /* Zonder opslag werkt alles, het wordt alleen niet onthouden. */
    }
  }, [opties])

  const wie = opties.wie === 'ik' ? uid : opties.wie
  const { tasks, loading } = useTaskBoard({ who: wie, open: opties.open })

  const profileById = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles])
  const actieven = useMemo(() => profiles.filter((p) => p.active !== false && p.id !== uid), [profiles, uid])

  const zichtbaar = useMemo(
    () =>
      filterTaken(tasks, {
        zoek: opties.zoek,
        lijstId: opties.lijstId,
        label: opties.label,
        prioriteit: opties.prioriteit,
      }),
    [tasks, opties.zoek, opties.lijstId, opties.label, opties.prioriteit]
  )

  const groepen = useMemo(
    () => groepeer(zichtbaar, { groep: opties.groep, sortering: opties.sortering, profileById, listById }),
    [zichtbaar, opties.groep, opties.sortering, profileById, listById]
  )

  const dagen = useMemo(() => perDag(zichtbaar), [zichtbaar])
  const zonderDatum = useMemo(() => zichtbaar.filter((t) => !t.dueDate), [zichtbaar])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader title="Tasks" />

      <DisplayOptions
        opties={opties}
        zet={zet}
        profiles={actieven}
        lijsten={lists}
        labels={tags}
        aantal={zichtbaar.length}
      />

      {loading ? (
        <div style={{ display: 'flex', flex: 1, justifyContent: 'center', padding: 'var(--space-8)' }}>
          <Spinner />
        </div>
      ) : zichtbaar.length === 0 ? (
        <div style={{ padding: 'var(--space-7)' }}>
          <EmptyState
            title="Niets te doen"
            description={
              opties.zoek || opties.lijstId || opties.label || opties.prioriteit
                ? 'Geen taak past bij wat je gefilterd hebt.'
                : 'Er staat hier niets open.'
            }
          />
        </div>
      ) : opties.weergave === 'kalender' ? (
        <Kalender
          maand={maand}
          onMaand={setMaand}
          dagen={dagen}
          zonderDatum={zonderDatum}
          onOpen={setOpenTaskId}
        />
      ) : opties.weergave === 'bord' ? (
        <Bord groepen={groepen} onOpen={setOpenTaskId} profileById={profileById} listById={listById} />
      ) : (
        <Lijst groepen={groepen} onOpen={setOpenTaskId} profileById={profileById} listById={listById} tags={tags} />
      )}

      {openTaskId ? <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} /> : null}
    </div>
  )
}

/** De vervaldag in woorden, met de kleur die erbij hoort. */
function vervalTekst(task) {
  if (isDone(task)) return { tekst: 'Afgerond', kleur: 'var(--text-3)' }
  if (!task.dueDate) return { tekst: '—', kleur: 'var(--text-3)' }
  const d = daysUntil(task.dueDate)
  if (d < 0) return { tekst: d === -1 ? '1 dag te laat' : `${-d} dagen te laat`, kleur: 'var(--danger)' }
  if (d === 0) return { tekst: 'Vandaag', kleur: 'var(--text-accent)' }
  if (d === 1) return { tekst: 'Morgen', kleur: 'var(--text-2)' }
  return { tekst: `over ${d} dagen`, kleur: 'var(--text-2)' }
}

function Regel({ task, onOpen, listById, tagsByName }) {
  const prio = priorityOf(task.priority)
  const verval = vervalTekst(task)

  return (
    <li>
      <button type="button" onClick={() => onOpen(task.id)} className="je-plainbtn je-taskline">
        <span
          className="je-taskline__prio"
          title={prio?.label ?? 'Geen prioriteit'}
          style={{ background: prio?.color ?? 'transparent' }}
        />
        <span className="je-taskline__title">{task.title}</span>
        {(task.tags ?? []).map((naam) => (
          <Badge key={naam} style={{ background: `${tagsByName[naam]?.color ?? '#8593a9'}1f`, color: tagsByName[naam]?.color ?? '#8593a9', borderColor: 'transparent' }}>
            {naam}
          </Badge>
        ))}
        <span className="je-taskline__list">{listById[task.listId]?.name ?? task.listName ?? ''}</span>
        {task.trackedSeconds ? (
          <span className="je-taskline__time">{formatDuration(task.trackedSeconds)}</span>
        ) : (
          <span className="je-taskline__time" />
        )}
        <span className="je-taskline__due" style={{ color: verval.kleur }}>
          {verval.tekst}
        </span>
      </button>
    </li>
  )
}

function Lijst({ groepen, onOpen, listById, tags }) {
  const tagsByName = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])

  return (
    <div className="je-pagebody">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {groepen.map((groep) => (
          <section key={groep.key} className="je-panel">
            {groep.label ? (
              <div className="je-panel__head" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <span
                  className="je-eyebrow"
                  style={{
                    color:
                      groep.toon === 'danger'
                        ? 'var(--danger)'
                        : groep.toon === 'accent'
                          ? 'var(--text-accent)'
                          : 'var(--text-2)',
                  }}
                >
                  {groep.label}
                </span>
                <span className="je-panel__right">
                  {groep.tasks.length} {groep.tasks.length === 1 ? 'taak' : 'taken'}
                </span>
              </div>
            ) : null}
            <ul className="je-tasklist">
              {groep.tasks.map((task) => (
                <Regel key={task.id} task={task} onOpen={onOpen} listById={listById} tagsByName={tagsByName} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

/**
 * Dezelfde groepen als kolommen naast elkaar.
 *
 * Er wordt hier niet gesleept: de groepen zijn een manier van kijken, niet de
 * plaats waar een taak staat. Slepen tussen "vandaag" en "later" zou een
 * deadline verzetten zonder dat je dat vraagt. De borden per lijst blijven waar
 * ze waren, en daar is slepen wél wat het betekent.
 */
function Bord({ groepen, onOpen, profileById, listById }) {
  return (
    <div className="je-boardscroll">
      {groepen.map((groep) => (
        <section key={groep.key} className="je-boardcol">
          <header className="je-boardcol__head">
            <span className="je-eyebrow">{groep.label || 'Alles'}</span>
            <span className="je-muted-caption">{groep.tasks.length}</span>
          </header>
          <div className="je-boardcol__body">
            {groep.tasks.map((task) => {
              const verval = vervalTekst(task)
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpen(task.id)}
                  className="je-plainbtn je-boardcard"
                >
                  <span className="je-eyebrow" style={{ letterSpacing: '.14em' }}>
                    {listById[task.listId]?.name ?? task.listName ?? ''}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{task.title}</span>
                  <span className="je-muted-caption" style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <span style={{ color: verval.kleur }}>{verval.tekst}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      {(task.assignees ?? [])
                        .map((id) => profileById[id]?.fullName?.split(' ')[0] ?? '')
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * De maand, met de kleuren die het verhaal vertellen.
 *
 * Eerder stond hier alles in hetzelfde grijs: te laat viel niet op, vandaag
 * evenmin, en onderaan stond "16 met datum · 9 zonder" waarbij die negen nergens
 * te zien waren. Een kalender die verzwijgt wat er geen datum heeft, is precies
 * waar taken in verdwijnen. Ze staan nu onder het raster.
 */
function Kalender({ maand, onMaand, dagen, zonderDatum, onOpen }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <MonthCalendar
        month={maand}
        onMonthChange={onMaand}
        itemsByDay={dagen}
        legenda={
          <span className="je-muted-caption">
            {Object.values(dagen).flat().length} met datum · {zonderDatum.length} zonder
          </span>
        }
        renderItem={(task) => {
          const telaat = !isDone(task) && task.dueDate && daysUntil(task.dueDate) < 0
          return (
            <button
              type="button"
              onClick={() => onOpen(task.id)}
              className="je-plainbtn je-calitem"
              style={{
                borderLeftColor: telaat ? 'var(--danger)' : (task.statusColor ?? '#8593a9'),
                color: telaat ? 'var(--danger)' : 'var(--text-1)',
                fontWeight: telaat || isToday(task.dueDate) ? 600 : 400,
              }}
            >
              {task.title}
            </button>
          )
        }}
      />

      {zonderDatum.length ? (
        <section className="je-panel" style={{ margin: 'var(--space-5)' }}>
          <div className="je-panel__head" style={{ padding: 'var(--space-4) var(--space-5)' }}>
            <span className="je-eyebrow">Zonder deadline</span>
            <span className="je-panel__right">
              {zonderDatum.length} {zonderDatum.length === 1 ? 'taak' : 'taken'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', padding: 'var(--space-5)' }}>
            {zonderDatum.map((task) => (
              <Button key={task.id} variant="secondary" size="sm" onClick={() => onOpen(task.id)}>
                {task.title}
              </Button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
