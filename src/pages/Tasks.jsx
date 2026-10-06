import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { daysUntil, isToday, startOfMonth } from '@lib/dates'
import { isTeLaat } from '@lib/laat'
import { formatDuration, priorityOf } from '@lib/format'
import { filter as filterTaken, groepeer, perDag, prioSleutel } from '@lib/task-view'
import { Badge, Button, EmptyState, Spinner } from '@components/ds'
import MonthCalendar from '@components/common/MonthCalendar'
import KanbanBoard from '@components/board/KanbanBoard'
import ColumnEditor from '@components/board/ColumnEditor'
import NewTaskDialog from '@components/board/NewTaskDialog'
import TaskDrawer from '@components/board/TaskDrawer'
import PageHeader from '@components/layout/PageHeader'
import DisplayOptions from '@components/tasks/DisplayOptions'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { isDone } from '@data/events'
import { moveTaskTo, useTaskBoard, useTasks } from '@data/tasks'
import { STANDAARD_KLEUR } from '@lib/kleur'

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
 *
 * Het bord van een lijst hoort daar ook bij. Dat stond apart, met dezelfde taken
 * erin — kies je één lijst en groepeer je op status, dan is dit dat bord: met de
 * kolommen van die lijst, met slepen, met een nieuwe taak en met de kolomeditor.
 * Buiten die keuze blijven de kolommen een manier van kijken en wordt er niet
 * gesleept: een kaart van "vandaag" naar "later" trekken zou een deadline
 * verzetten zonder dat je daarom vraagt.
 *
 * De keuzes staan ook in het adres, zodat een bord te delen en te bewaren is.
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

/** Welke keuzes in het adres mogen staan — genoeg om een bord te delen. */
const IN_ADRES = ['weergave', 'lijst', 'groep', 'wie']

export default function Tasks() {
  const { uid, isAdmin } = useAuth()
  const { boards, eventsList, profiles, listById, lists, tags, statusesOf } = useWorkspace()
  const { t } = useTaal()
  const toast = useToast()
  const [zoekArgs, setZoekArgs] = useSearchParams()
  const [opties, setOpties] = useState(lees)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [nieuweTaak, setNieuweTaak] = useState(null)
  const [kolommenOpen, setKolommenOpen] = useState(false)
  const [maand, setMaand] = useState(() => startOfMonth())

  /*
    Het adres wint van wat er onthouden is.

    Krijg je een link naar het Tasks-bord van een lijst, dan hoor je dat bord te
    zien — niet de weergave die jij gisteren instelde. Dit draait één keer bij het
    openen; daarna sturen de keuzes het adres, en niet andersom.
  */
  useEffect(() => {
    const uitAdres = {}
    if (IN_ADRES.every((sleutel) => !zoekArgs.get(sleutel))) return
    if (zoekArgs.get('weergave')) uitAdres.weergave = zoekArgs.get('weergave')
    if (zoekArgs.get('groep')) uitAdres.groep = zoekArgs.get('groep')
    if (zoekArgs.get('lijst')) uitAdres.lijstId = zoekArgs.get('lijst')
    if (zoekArgs.get('wie')) uitAdres.wie = zoekArgs.get('wie')
    setOpties((huidig) => ({ ...huidig, ...uitAdres }))
    // Alleen bij het openen: daarna is het scherm de baas over het adres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const zet = useCallback((patch) => setOpties((huidig) => ({ ...huidig, ...patch })), [])

  useEffect(() => {
    const volgende = new URLSearchParams(zoekArgs)
    volgende.set('weergave', opties.weergave)
    volgende.set('groep', opties.groep)
    volgende.set('wie', opties.wie)
    if (opties.lijstId) volgende.set('lijst', opties.lijstId)
    else volgende.delete('lijst')
    if (volgende.toString() !== zoekArgs.toString()) setZoekArgs(volgende, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opties.weergave, opties.groep, opties.lijstId, opties.wie])

  useEffect(() => {
    try {
      // De zoekterm hoort niet bij een voorkeur maar bij één keer zoeken.
      const teBewaren = { ...opties, zoek: undefined }
      delete teBewaren.zoek
      localStorage.setItem(BEWAARD, JSON.stringify(teBewaren))
    } catch {
      /* Zonder opslag werkt alles, het wordt alleen niet onthouden. */
    }
  }, [opties])

  const wie = opties.wie === 'ik' ? uid : opties.wie

  /*
    Wanneer dit scherm het bord van één lijst is.

    Dan komt er iets anders bij kijken: de kolommen zijn die van de lijst, ook de
    lege, en slepen betekent iets. Daarbuiten zijn de kolommen een manier van
    kijken en zou slepen een deadline of een naam wijzigen zonder dat je daarom
    vraagt.
  */
  const lijst = listById[opties.lijstId] ?? null
  const bordModus = opties.weergave === 'bord' && opties.groep === 'status' && Boolean(lijst)

  // In bordmodus komen de taken uit de lijst zelf; het abonnement op "wat er op
  // jouw naam staat" zou daar hetzelfde werk twee keer ophalen.
  const { tasks, loading } = useTaskBoard({ who: bordModus ? null : wie, open: opties.open })

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
    () => groepeer(zichtbaar, { groep: opties.groep, sortering: opties.sortering, profileById, listById, t }),
    [zichtbaar, opties.groep, opties.sortering, profileById, listById, t]
  )

  const dagen = useMemo(() => perDag(zichtbaar), [zichtbaar])
  const zonderDatum = useMemo(() => zichtbaar.filter((t) => !t.dueDate), [zichtbaar])

  const statuses = useMemo(
    () => (bordModus ? statusesOf(opties.lijstId) : []),
    [bordModus, opties.lijstId, statusesOf]
  )

  /*
    Waar een nieuwe taak landt.

    Op het bord van een lijst is dat die lijst. Daarbuiten — de gewone
    takenweergave — was er helemaal geen knop: je moest eerst een lijst kiezen
    en naar de bordweergave, en dat is drie handelingen voor "nog iets dat ik
    niet mag vergeten". Nu staat de knop er altijd en kiest hij zelf een bord:
    het eerste gewone takenbord, en nadrukkelijk niet de eventpijplijn — een
    los to-do hoort niet als event in de verkooptrechter te belanden.
  */
  const doelLijst = lijst ?? boards.find((l) => l.id !== eventsList?.id) ?? boards[0] ?? null
  const doelStatuses = useMemo(
    () => (doelLijst ? statusesOf(doelLijst.id) : []),
    [doelLijst, statusesOf]
  )

  // Het bord toont de lijst zelf, met posities en subtaken — dat is iets anders
  // dan "wat er op jouw naam staat", en het abonnement is dus ook een ander.
  const { top: lijstTop, subtasks: lijstSub, loading: lijstLaadt } = useTasks(
    bordModus ? opties.lijstId : null
  )

  const bordTaken = useMemo(
    () =>
      filterTaken(lijstTop, {
        zoek: opties.zoek,
        label: opties.label,
        prioriteit: opties.prioriteit,
        // "Van wie" blijft doen wat het zegt, ook hier.
        persoon: opties.wie === 'iedereen' ? '' : opties.wie === 'ik' ? uid : opties.wie,
      }).filter((t) => (opties.open ? t.open !== false : true)),
    [lijstTop, opties.zoek, opties.label, opties.prioriteit, opties.wie, opties.open, uid]
  )

  const { kolommen, takenPerKolom } = useMemo(() => {
    const cols = statuses.map((s) => ({ key: s.id, label: s.name, color: s.color }))
    const buckets = Object.fromEntries(cols.map((c) => [c.key, []]))
    const wezen = []
    for (const taak of bordTaken) {
      if (buckets[taak.statusId]) buckets[taak.statusId].push(taak)
      else wezen.push(taak)
    }
    // Taken met een status die niet meer bestaat horen zichtbaar te blijven;
    // stil weglaten is hoe werk verdwijnt.
    if (wezen.length) {
      cols.unshift({ key: '', label: t('tasks.zonder_status'), color: STANDAARD_KLEUR })
      buckets[''] = wezen
    }
    return { kolommen: cols, takenPerKolom: buckets }
  }, [statuses, bordTaken, t])

  const subtaakAantallen = useMemo(() => {
    const aantal = {}
    for (const sub of lijstSub) aantal[sub.parentId] = (aantal[sub.parentId] ?? 0) + 1
    return aantal
  }, [lijstSub])

  const statusAantallen = useMemo(() => {
    const aantal = {}
    for (const taak of [...lijstTop, ...lijstSub]) {
      if (taak.statusId) aantal[taak.statusId] = (aantal[taak.statusId] ?? 0) + 1
    }
    return aantal
  }, [lijstTop, lijstSub])

  const openTaak = useCallback((taak) => setOpenTaskId(taak.id), [])

  const verplaats = useCallback(
    async ({ task, columnKey, index }) => {
      try {
        await moveTaskTo({
          taskId: task.id,
          status: statuses.find((s) => s.id === columnKey) ?? null,
          columnTasks: (takenPerKolom[columnKey] ?? []).filter((t) => t.id !== task.id),
          index,
        })
      } catch (err) {
        toast.error(err.message)
      }
    },
    [statuses, takenPerKolom, toast]
  )

  const bezig = bordModus ? lijstLaadt : loading
  const leeg = bordModus ? bordTaken.length === 0 && kolommen.length === 0 : zichtbaar.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        title="Tasks"
        subtitle={bordModus ? lijst.name : undefined}
        acties={{
          tweede:
            bordModus && isAdmin ? { label: t('bord.kolommen'), onClick: () => setKolommenOpen(true) } : null,
          hoofd: doelLijst
            ? { label: t('bord.nieuwe_taak'), icon: 'plus', onClick: () => setNieuweTaak({ status: doelStatuses[0] }) }
            : null,
        }}
      />

      <DisplayOptions
        opties={opties}
        zet={zet}
        profiles={actieven}
        lijsten={lists}
        labels={tags}
        aantal={bordModus ? bordTaken.length : zichtbaar.length}
      />

      {bezig ? (
        <div style={{ display: 'flex', flex: 1, justifyContent: 'center', padding: 'var(--space-8)' }}>
          <Spinner />
        </div>
      ) : leeg ? (
        <div style={{ padding: 'var(--space-7)' }}>
          <EmptyState
            title={t('tasks.leeg.titel')}
            description={t(
              opties.zoek || opties.lijstId || opties.label || opties.prioriteit
                ? 'tasks.leeg.gefilterd'
                : 'tasks.leeg.niets_open'
            )}
          />
        </div>
      ) : bordModus ? (
        <KanbanBoard
          columns={kolommen}
          tasksByColumn={takenPerKolom}
          profiles={profiles}
          tags={tags}
          subtaskCounts={subtaakAantallen}
          onOpen={openTaak}
          onDrop={verplaats}
          onAdd={(kolom) => setNieuweTaak({ status: statuses.find((s) => s.id === kolom.key) ?? null })}
        />
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

      {nieuweTaak && doelLijst ? (
        <NewTaskDialog
          list={doelLijst}
          statuses={doelStatuses}
          initialStatus={nieuweTaak.status}
          uid={uid}
          onClose={() => setNieuweTaak(null)}
          onCreated={(id) => {
            setNieuweTaak(null)
            setOpenTaskId(id)
          }}
        />
      ) : null}

      {kolommenOpen && lijst ? (
        <ColumnEditor
          list={lijst}
          statuses={statuses}
          counts={statusAantallen}
          onClose={() => setKolommenOpen(false)}
        />
      ) : null}

      {openTaskId ? <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} /> : null}
    </div>
  )
}

/** De vervaldag in woorden, met de kleur die erbij hoort. */
function vervalTekst(t, task) {
  if (isDone(task)) return { tekst: t('tasks.verval.afgerond'), kleur: 'var(--text-3)' }
  if (!task.dueDate) return { tekst: '—', kleur: 'var(--text-3)' }
  const d = daysUntil(task.dueDate)
  if (d < 0 && isTeLaat(task)) return { tekst: t('tasks.verval.telaat', { aantal: -d }), kleur: 'var(--danger)' }
  if (d < 0) return { tekst: t('tasks.verval.geweest'), kleur: 'var(--text-3)' }
  if (d === 0) return { tekst: t('alg.vandaag'), kleur: 'var(--text-accent)' }
  if (d === 1) return { tekst: t('alg.morgen'), kleur: 'var(--text-2)' }
  return { tekst: t('tasks.verval.over', { aantal: d }), kleur: 'var(--text-2)' }
}

function Regel({ task, onOpen, listById, tagsByName }) {
  const { t } = useTaal()
  const prio = priorityOf(task.priority)
  const verval = vervalTekst(t, task)

  return (
    <li>
      <button type="button" onClick={() => onOpen(task.id)} className="je-plainbtn je-taskline">
        <span
          className="je-taskline__prio"
          title={t(prio ? prioSleutel(prio.value) : 'tasks.prio.geen')}
          style={{ background: prio?.color ?? 'transparent' }}
        />
        <span className="je-taskline__title">{task.title}</span>
        {/*
          Werk dat niemand opgepakt heeft.

          Zo'n taak komt in geen enkele persoonlijke lijst voor — hij hoort bij
          niemand, dus vindt hij niemand. Hij staat er nu wel tussen, maar dan
          moet ook te zien zijn dat hij niet van jou is; anders lees je hem als
          jouw werk en wacht iedereen op een ander.
        */}
        {(task.assignees ?? []).length === 0 ? (
          <Badge tone="warning">
            {t('tasks.niemand')}
          </Badge>
        ) : null}
        {/* Via Badge en niet met de hand: dan rekent die de inkt uit tegen 4,5:1. */}
        {(task.tags ?? []).map((naam) => (
          <Badge key={naam} color={tagsByName[naam]?.color ?? STANDAARD_KLEUR} subtle>
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
  const { t } = useTaal()
  const tagsByName = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.name, tag])), [tags])

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
                <span className="je-panel__right">{t('alg.taak', { aantal: groep.tasks.length })}</span>
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
  const { t } = useTaal()

  return (
    <div className="je-boardscroll">
      {groepen.map((groep) => (
        <section key={groep.key} className="je-boardcol">
          <header className="je-boardcol__head">
            <span className="je-eyebrow">{groep.label || t('alg.alles')}</span>
            <span className="je-muted-caption">{groep.tasks.length}</span>
          </header>
          <div className="je-boardcol__body">
            {groep.tasks.map((task) => {
              const verval = vervalTekst(t, task)
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
  const { t } = useTaal()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <MonthCalendar
        month={maand}
        onMonthChange={onMaand}
        itemsByDay={dagen}
        legenda={
          <span className="je-muted-caption">
            {t('tasks.kalender.telling', {
              metdatum: Object.values(dagen).flat().length,
              zonder: zonderDatum.length,
            })}
          </span>
        }
        renderItem={(task) => {
          const telaat = isTeLaat(task)
          return (
            <button
              type="button"
              onClick={() => onOpen(task.id)}
              className="je-plainbtn je-calitem"
              style={{
                borderLeftColor: telaat ? 'var(--danger)' : (task.statusColor ?? STANDAARD_KLEUR),
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
            <span className="je-eyebrow">{t('tasks.deadline.zonder')}</span>
            <span className="je-panel__right">{t('alg.taak', { aantal: zonderDatum.length })}</span>
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
