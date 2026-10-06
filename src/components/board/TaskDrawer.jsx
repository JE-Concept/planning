import { useEffect, useMemo, useState } from 'react'
import { formatDate, formatDateTime, toLocalInput, fromLocalInput } from '@lib/dates'
import { isTeLaat } from '@lib/laat'
import { formatCurrency, formatDuration, PRIORITIES } from '@lib/format'
import { prioSleutel, vervaldag } from '@lib/task-view'
import { Acties, Avatar, Badge, Button, Drawer, Field, GevaarKnop, Input, Schakelknop, Select, Textarea } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import Documents from '@components/common/Documents'
import { useDocuments } from '@data/documents'
import { herkomstVanTaak } from '@lib/taak-herkomst'
import { verwijderVraag } from '@lib/verwijdervraag'
import { useCustomers } from '@data/customers'
import { upsertTag } from '@data/workspace'
import { SOCIAL_STAGES, heeftSocial, isSocialEligible, stageOf } from '@lib/social-stage'
import {
  archiveTask,
  createTask,
  deleteTask,
  setTaskStatus,
  toggleAssignee,
  toggleTag,
  updateTask,
  useTask,
} from '@data/tasks'
import { addComment, deleteComment, useComments } from '@data/comments'
import { useActivity } from '@data/activity'
import { LOGGEN_SINDS, beschrijf, verloopVan } from '@lib/activiteit'
import { channelMeta, reviewMeta, statusMeta, usePostsForTask } from '@data/social'
import { addManualEntry, startTimer, stopTimer, useRunningTimer, useTaskTimeEntries, deleteEntry } from '@data/time'
import { STANDAARD_KLEUR } from '@lib/kleur'

/** Saves on blur rather than on every keystroke: one write per edit, not per letter. */
function useDraft(value, save) {
  const [draft, setDraft] = useState(value ?? '')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(value ?? '')
  }, [value, dirty])

  return {
    value: draft,
    onChange: (e) => {
      setDraft(e.target.value)
      setDirty(true)
    },
    onBlur: () => {
      if (!dirty) return
      setDirty(false)
      if ((value ?? '') !== draft) save(draft)
    },
  }
}

export default function TaskDrawer({ taskId, subtasks = [], onClose }) {
  const task = useTask(taskId)
  const { profiles, profileById, tags, listById, statusesOf } = useWorkspace()
  const { uid, profile } = useAuth()
  const { t } = useTaal()
  const toast = useToast()

  const title = useDraft(task?.title, (v) => v.trim() && updateTask(task.id, { title: v.trim() }))
  const description = useDraft(task?.description, (v) => updateTask(task.id, { description: v }))

  const list = task ? listById[task.listId] : null
  const statuses = useMemo(() => (task ? statusesOf(task.listId) : []), [task, statusesOf])
  // De bijlagen staan verderop in het paneel, maar het aantal hoort ook in de
  // vraag onder "Verwijderen": ze gaan mee.
  const { documents } = useDocuments({ taskId })

  if (!task) return null

  const tagsByName = Object.fromEntries(tags.map((tag) => [tag.name, tag]))
  const herkomst = herkomstVanTaak(task)

  return (
    <Drawer
      open
      onClose={onClose}
      /*
        De kop draagt de plaats, niet de titel.

        De titel stond er twee keer: boven in de kop én in het invoerveld
        eronder, en alleen dat tweede was te wijzigen. Eén ervan moest weg, en
        dan liever de kopie die je niet kon aanraken. Wat de kop nu geeft is wat
        het veld niet geeft: op welk bord en in welke kolom dit staat.
      */
      title={list?.name ?? t('bord.taak')}
      subtitle={task.statusName || undefined}
      footer={
        /*
          Archiveren is de rustige keuze en staat er dus als de gewone knop;
          verwijderen is de uitzondering en blijft stil, met de vraag die zegt
          wat je weggooit. Niet elke datum betekent iets; de uitleg links zegt
          erbij wat er staat.
        */
        <Acties
          uitleg={
            <span title={herkomst?.uitleg ?? undefined}>{herkomst?.tekst ?? ''}</span>
          }
          gevaar={{
            label: t('alg.verwijderen'),
            toon: 'stil',
            size: 'sm',
            vraag: verwijderVraag({ task, subtaken: subtasks.length, bijlagen: documents.length }),
            onConfirm: () =>
              deleteTask(task.id)
                .then(onClose)
                .catch((err) => toast.error(err.message)),
          }}
          tweede={{
            label: t('alg.archiveren'),
            size: 'sm',
            onClick: () =>
              archiveTask(task.id)
                .then(() => {
                  toast.success(t('bord.naar_archief'))
                  onClose()
                })
                .catch((err) => toast.error(err.message)),
          }}
        />
      }
    >
      <div className="space-y-6 px-5 py-4">
        <input
          className="w-full rounded-md border border-transparent px-2 py-1.5 text-base font-semibold text-ink-900 hover:border-ink-200 focus:border-accent-500 focus:outline-none"
          aria-label={t('bord.veld.titel')}
          {...title}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('bord.veld.status')}>
            <Select
              value={task.statusId ?? ''}
              onChange={(e) =>
                setTaskStatus(task.id, statuses.find((s) => s.id === e.target.value) ?? null)
              }
            >
              <option value="">{t('bord.geen_status')}</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('bord.veld.prioriteit')}>
            <Select
              value={task.priority ?? ''}
              onChange={(e) =>
                updateTask(task.id, {
                  priority: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t('alg.geen')}</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {t(prioSleutel(p.value))}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('bord.veld.startdatum')}>
            <Input
              type="datetime-local"
              value={toLocalInput(task.startDate?.toDate?.() ?? task.startDate)}
              onChange={(e) => updateTask(task.id, { startDate: fromLocalInput(e.target.value) })}
            />
          </Field>

          <Field label={t('bord.veld.deadline')}>
            <Input
              type="datetime-local"
              value={toLocalInput(task.dueDate?.toDate?.() ?? task.dueDate)}
              onChange={(e) => updateTask(task.id, { dueDate: fromLocalInput(e.target.value) })}
            />
          </Field>

          <Field label={t('bord.veld.raming')}>
            <Input
              type="number"
              min="0"
              step="15"
              value={task.timeEstimateMinutes ?? ''}
              onChange={(e) =>
                updateTask(task.id, {
                  timeEstimateMinutes: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </Field>

          <Field label={t('bord.veld.budget')} hint={task.budget ? formatCurrency(task.budget) : undefined}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={task.budget ?? ''}
              onChange={(e) =>
                updateTask(task.id, { budget: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>

          <Field label={t('bord.veld.locatie')} className="sm:col-span-2">
            <Input
              defaultValue={task.location ?? ''}
              onBlur={(e) => updateTask(task.id, { location: e.target.value || null })}
              placeholder={t('bord.adres_of_zaal')}
            />
          </Field>

          <KlantVeld task={task} />
        </div>

        <SocialContent task={task} />

        <section>
          <h3 className="label">{t('bord.toegewezen_aan')}</h3>
          <div className="flex flex-wrap gap-1.5">
            {profiles
              .filter((p) => p.active !== false)
              .map((p) => {
                const on = task.assignees?.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleAssignee(task, p.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition ${
                      on
                        ? 'border-accent-300 bg-accent-50 text-accent-800'
                        : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                    }`}
                  >
                    <Avatar profile={p} size="xs" />
                    {p.fullName || p.email}
                  </button>
                )
              })}
          </div>
        </section>

        <Labels task={task} tags={tags} toast={toast} />

        <Field label={t('bord.veld.omschrijving')}>
          <Textarea rows={5} placeholder={t('bord.wat_precies')} {...description} />
        </Field>

        <Subtasks task={task} subtasks={subtasks} tagsByName={tagsByName} profileById={profileById} />

        <TimeSection task={task} list={list} uid={uid} toast={toast} profileById={profileById} />

        {/* Bijlagen horen bij de taak waarover ze gaan: een grondplan bij dat
            ene event, niet in een map die je elders moet gaan zoeken. Dezelfde
            component als bij een klant, want het is hetzelfde lijstje. */}
        <Documents taskId={task.id} titel={t(task.parentId ? 'bord.bijlagen' : 'bord.bijlagen_event')} />

        <SocialSection taskId={task.id} />

        <VerloopSection taskId={task.id} listId={task.listId} profile={profile} />
      </div>
    </Drawer>
  )
}

// ─── Labels ─────────────────────────────────────────────────────────────────

/**
 * De labels van deze taak, en een nieuw label als het er nog niet is.
 *
 * Aan- en uitzetten kon al; een label dat nog niet bestond niet. Dan stond er
 * "maak ze aan bij Instellingen" en moest je het paneel verlaten, twee schermen
 * verder iets typen en terugkomen — precies op het moment dat je aan het werk
 * bent. Wie een label bedenkt, bedenkt het hier.
 *
 * Het label komt meteen in de werkruimte terecht en niet alleen op deze taak:
 * labels zijn van iedereen, en een naam die maar op één taak bestaat is geen
 * label maar een typfout. `upsertTag` sleutelt op de naam, dus twee mensen die
 * tegelijk "winterbar" bedenken krijgen hetzelfde label.
 */
function Labels({ task, tags, toast }) {
  const { t } = useTaal()
  const [nieuw, setNieuw] = useState('')

  const voegToe = async (e) => {
    e.preventDefault()
    const naam = nieuw.trim()
    if (!naam) return

    try {
      const bestaand = tags.find((tag) => tag.name.toLowerCase() === naam.toLowerCase())
      if (!bestaand) await upsertTag({ name: naam, color: STANDAARD_KLEUR })
      const opTaak = bestaand?.name ?? naam
      if (!task.tags?.includes(opTaak)) await toggleTag(task, opTaak)
      setNieuw('')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section>
      <h3 className="label">{t('bord.labels')}</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const on = task.tags?.includes(tag.name)
          return (
            <button key={tag.id} type="button" onClick={() => toggleTag(task, tag.name)} aria-pressed={on}>
              <Badge color={tag.color} subtle={!on}>
                {tag.name}
              </Badge>
            </button>
          )
        })}
        {/* Een label dat iemand weghaalde bij Instellingen staat hier nog op de
            taak. Het blijft zichtbaar en afzetbaar; stil verdwijnen zou het
            onvindbaar maken zonder dat het weg is. */}
        {(task.tags ?? [])
          .filter((naam) => !tags.some((tag) => tag.name === naam))
          .map((naam) => (
            <button key={naam} type="button" onClick={() => toggleTag(task, naam)} aria-pressed>
              <Badge>{naam}</Badge>
            </button>
          ))}
      </div>

      <form onSubmit={voegToe} className="mt-2 flex gap-2">
        <Input
          value={nieuw}
          onChange={(e) => setNieuw(e.target.value)}
          placeholder={t('bord.nieuw_label_hint')}
          aria-label={t('bord.nieuw_label')}
          className="max-w-[14rem]"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={!nieuw.trim()}>
          {t('alg.toevoegen')}
        </Button>
      </form>
    </section>
  )
}

// ─── Social ─────────────────────────────────────────────────────────────────

/**
 * De klant achter dit event.
 *
 * Tot nu stond die in de titel — "Trouw Niels en Inez", "Blum België" — en
 * daar kun je niets mee opzoeken. Dit is dezelfde informatie, maar dan zo dat
 * je van de klant naar zijn events kunt en terug. De naam gaat als kopie mee op
 * de taak, want een bord dat per kaart de klant moet ophalen leest zich scheef.
 */
function KlantVeld({ task }) {
  const { t } = useTaal()
  const { customers } = useCustomers()

  return (
    <Field label={t('bord.veld.klant')} className="sm:col-span-2">
      <Select
        aria-label={t('bord.klant_van_event')}
        value={task.customerId ?? ''}
        onChange={(e) => {
          const klant = customers.find((c) => c.id === e.target.value) ?? null
          updateTask(task.id, {
            customerId: klant?.id ?? null,
            customerName: klant?.name ?? null,
          })
        }}
      >
        <option value="">{t('bord.geen_klant')}</option>
        {customers.map((klant) => (
          <option key={klant.id} value={klant.id}>
            {klant.name}
          </option>
        ))}
        {/* Hoort de taak bij een klant die intussen uit gebruik is, dan blijft
            die hier staan in plaats van stilletjes op "geen klant" te vallen. */}
        {task.customerId && !customers.some((c) => c.id === task.customerId) ? (
          <option value={task.customerId}>{task.customerName ?? t('bord.klant_uit_gebruik')}</option>
        ) : null}
      </Select>
    </Field>
  )
}

/**
 * Social content voor dit event.
 *
 * Elk event kan content opleveren, maar niet elk event doet dat — een
 * vergaderzaal voor tien man meestal niet. Vandaar de schakelaar: aan vanaf het
 * moment dat er gefactureerd kan worden, en met één klik eraf voor wat er niet
 * bij hoort. Wat aanstaat verschijnt op het socialbord.
 */
function SocialContent({ task }) {
  const { t } = useTaal()

  if (task.parentId) return null

  const meedoen = heeftSocial(task)
  const vanzelf = isSocialEligible(task)

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="label mb-0">{t('bord.social.titel')}</h3>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={meedoen}
            onChange={(e) =>
              updateTask(task.id, {
                socialWanted: e.target.checked,
                // Aanzetten vóór de factuurfase geeft het meteen een plek op
                // het bord; uitzetten laat de stand staan voor als het terugkomt.
                socialStage: e.target.checked ? (task.socialStage ?? 'delivery') : task.socialStage ?? null,
              })
            }
            className="h-4 w-4 rounded border-ink-300"
          />
          {t('bord.social.aan')}
        </label>
      </div>

      {meedoen ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select
            value={stageOf(task)}
            onChange={(e) => updateTask(task.id, { socialStage: e.target.value })}
            aria-label={t('bord.social.stand')}
            className="max-w-[16rem]"
          >
            {SOCIAL_STAGES.map((stap) => (
              <option key={stap.key} value={stap.key}>
                {stap.label}
              </option>
            ))}
          </Select>
          <span className="text-xs text-ink-400">
            {SOCIAL_STAGES.find((s) => s.key === stageOf(task))?.hint}
          </span>
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-500">
          {t(vanzelf ? 'bord.social.uit' : 'bord.social.vanzelf')}
        </p>
      )}
    </section>
  )
}

/**
 * The posts hanging on this project.
 *
 * A wedding or an opening usually comes with a handful of posts, and the person
 * looking at the task is the person who wants to know whether they are through
 * review yet — so the calendar shows up here rather than only the other way.
 */
function SocialSection({ taskId }) {
  const { t } = useTaal()
  const posts = usePostsForTask(taskId)

  if (posts.length === 0) return null

  return (
    <section>
      <h3 className="label">{t('bord.social.posts', { aantal: posts.length })}</h3>
      <ul className="space-y-1">
        {posts.map((post) => {
          const status = statusMeta(post.status)
          const review = post.reviewState && post.reviewState !== 'none' ? reviewMeta(post.reviewState) : null

          return (
            <li
              key={post.id}
              className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink-800">{post.title}</span>
                <span className="block text-[11px] text-ink-500">
                  {post.scheduledAt ? formatDateTime(post.scheduledAt) : t('bord.social.niet_ingepland')} ·{' '}
                  {status.label}
                </span>
              </span>
              <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                {post.channels?.map((key) => (
                  <span
                    key={key}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: channelMeta(key).color }}
                  />
                ))}
              </span>
              {review ? (
                <Badge color={review.color} subtle>
                  {review.label}
                </Badge>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ─── Subtasks ───────────────────────────────────────────────────────────────

/**
 * Subtaken zijn gewone taken.
 *
 * Ze hebben dus ook hun eigen toewijzing, omschrijving en deadline — alleen was
 * daar geen weg naartoe: de lijst toonde een vinkje en een titel. Een klik op
 * de titel opent nu dezelfde fiche als voor een event, één laag erbovenop, en
 * sluiten brengt je terug bij de hoofdtaak.
 */
function Subtasks({ task, subtasks, profileById }) {
  const { t } = useTaal()
  const { listById, statusesOf } = useWorkspace()
  const [title, setTitle] = useState('')
  const [openSub, setOpenSub] = useState(null)
  const statuses = statusesOf(task.listId)
  const done = statuses.find((s) => s.kind === 'closed' || s.kind === 'done')
  const open = statuses.find((s) => s.kind === 'open') ?? statuses[0]

  const add = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await createTask({
      list: listById[task.listId],
      status: open,
      title,
      parentId: task.id,
    })
    setTitle('')
  }

  return (
    <section>
      <h3 className="label">{t('bord.subtaken', { aantal: subtasks.length })}</h3>
      <ul className="space-y-1">
        {subtasks.map((sub) => {
          const finished = sub.open === false
          return (
            <li key={sub.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-ink-50">
              <input
                type="checkbox"
                checked={finished}
                aria-label={t('bord.subtaak_afwerken', { taak: sub.title })}
                onChange={() => setTaskStatus(sub.id, finished ? open : done ?? open)}
                className="h-4 w-4 rounded border-ink-300 text-accent-600 focus:ring-accent-500"
              />
              <button
                type="button"
                onClick={() => setOpenSub(sub.id)}
                className={`flex-1 truncate text-left text-sm hover:underline ${
                  finished ? 'text-ink-400 line-through' : 'text-ink-800'
                }`}
              >
                {sub.title}
              </button>
              {sub.dueDate ? (
                <span
                  className={`shrink-0 text-[11px] ${
                    isTeLaat(sub) && !finished ? 'font-medium text-red-600' : 'text-ink-400'
                  }`}
                >
                  {vervaldag(t, sub.dueDate.toDate?.() ?? sub.dueDate)}
                </span>
              ) : null}
              {(sub.assignees ?? []).slice(0, 1).map((assignee) => (
                <Avatar key={assignee} profile={profileById[assignee]} size="xs" />
              ))}
              <GevaarKnop
                icon="x"
                size="sm"
                vraag={t('bord.subtaak_verwijderen_vraag')}
                onConfirm={() => deleteTask(sub.id)}
                aria-label={t('bord.subtaak_verwijderen')}
              />
            </li>
          )
        })}
      </ul>

      <form onSubmit={add} className="mt-2 flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('bord.subtaak_toevoegen')}
        />
        <Button type="submit" variant="secondary" disabled={!title.trim()}>
          {t('alg.toevoegen')}
        </Button>
      </form>

      {openSub ? <TaskDrawer taskId={openSub} onClose={() => setOpenSub(null)} /> : null}
    </section>
  )
}

// ─── Time ───────────────────────────────────────────────────────────────────

function TimeSection({ task, list, uid, toast, profileById }) {
  const { t } = useTaal()
  const entries = useTaskTimeEntries(task.id)
  const { timer, elapsed } = useRunningTimer(uid)
  const [manual, setManual] = useState(false)
  const runningHere = timer?.taskId === task.id

  const estimate = (task.timeEstimateMinutes ?? 0) * 60
  const tracked = task.trackedSeconds ?? 0

  const toggle = async () => {
    try {
      if (runningHere) {
        await stopTimer(uid)
        toast.success(t('bord.tijd_geboekt'))
      } else {
        await startTimer({ uid, task, list })
        toast.success(t('bord.timer_loopt'))
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="label mb-0">{t('bord.tijd')}</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setManual((m) => !m)}>
            {t('bord.handmatig')}
          </Button>
          <Schakelknop aan={runningHere} stop onClick={toggle}>
            {runningHere ? `■ ${formatDuration(elapsed, { withSeconds: true })}` : '▶ Start'}
          </Schakelknop>
        </div>
      </div>

      <p className="text-sm text-ink-600">
        <strong className="tabular-nums text-ink-900">{formatDuration(tracked)}</strong>{' '}
        {t('bord.geboekt')}
        {estimate > 0 ? (
          <>
            {' '}
            {t('bord.van_geraamd', { tijd: formatDuration(estimate) })}
            {tracked > estimate ? (
              <span className="ml-1 text-red-600">
                (+{formatDuration(tracked - estimate)})
              </span>
            ) : null}
          </>
        ) : null}
      </p>

      {manual ? <ManualEntryForm task={task} list={list} uid={uid} toast={toast} onDone={() => setManual(false)} /> : null}

      {entries.length > 0 ? (
        <ul className="mt-2 divide-y divide-ink-100 rounded-md border border-ink-200">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <Avatar profile={profileById[entry.profileId]} size="xs" />
              <span className="tabular-nums font-medium text-ink-800">
                {formatDuration(entry.durationSeconds)}
              </span>
              <span className="truncate text-ink-500">
                {formatDateTime(entry.startedAt)}
                {entry.description ? ` · ${entry.description}` : ''}
              </span>
              <GevaarKnop
                icon="x"
                size="sm"
                className="ml-auto"
                vraag={t('bord.tijd_verwijderen')}
                onConfirm={() => deleteEntry(entry)}
                aria-label={t('alg.verwijderen')}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function ManualEntryForm({ task, list, uid, toast, onDone }) {
  const { t } = useTaal()
  const now = new Date()
  const [startedAt, setStartedAt] = useState(toLocalInput(new Date(now.getTime() - 3600000)))
  const [endedAt, setEndedAt] = useState(toLocalInput(now))
  const [description, setDescription] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    try {
      await addManualEntry({
        uid,
        task,
        list,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        description,
      })
      toast.success(t('bord.tijd_toegevoegd'))
      onDone()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 grid gap-2 rounded-md bg-ink-50 p-3 sm:grid-cols-2">
      <Field label={t('bord.van')}>
        <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
      </Field>
      <Field label={t('bord.tot')}>
        <Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
      </Field>
      <Field label={t('bord.veld.omschrijving')} className="sm:col-span-2">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Acties
        plaats="rij"
        className="sm:col-span-2"
        terug={{ onClick: onDone }}
        hoofd={{ label: t('alg.toevoegen'), type: 'submit' }}
      />
    </form>
  )
}

// ─── Verloop: reacties en activiteit door elkaar ────────────────────────────

/**
 * Wat er met deze taak gebeurd is, als één verhaal.
 *
 * Dit waren twee dingen die niet bestonden naast elkaar: reacties stonden
 * onderaan, en wie wat wanneer verzette stond nergens. Sinds er met meerdere
 * mensen tegelijk gepland wordt, is dat laatste een dagelijkse vraag — "wie
 * heeft dit naar volgende week gezet?" — en het antwoord staat het best pal
 * naast de reactie waarin iemand uitlegt waarom.
 */
function VerloopSection({ taskId, listId, profile }) {
  const { t } = useTaal()
  const comments = useComments({ taskId })
  const { regels } = useActivity(taskId)
  const { profileById, statusesOf } = useWorkspace()
  const [body, setBody] = useState('')

  const statuses = useMemo(() => statusesOf(listId), [statusesOf, listId])
  const items = useMemo(
    () => verloopVan({ reacties: comments, activiteit: regels }),
    [comments, regels]
  )

  const naamVan = (uid) => profileById[uid]?.fullName || profileById[uid]?.email || null

  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    await addComment({ taskId, body, author: profile })
    setBody('')
  }

  return (
    <section>
      <h3 className="label">{t('bord.verloop', { aantal: items.length })}</h3>

      {items.length === 0 ? (
        <p className="text-xs text-ink-400">
          {t('bord.verloop_leeg', { datum: formatDate(LOGGEN_SINDS) })}
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) =>
          item.soort === 'reactie' ? (
            <li key={item.id} className="rounded-md bg-ink-50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <strong className="text-ink-800">{item.data.authorName}</strong>
                <span>{formatDateTime(item.data.createdAt)}</span>
                {item.data.authorId === profile?.id ? (
                  <GevaarKnop
                    icon="x"
                    size="sm"
                    className="ml-auto"
                    vraag={t('bord.reactie_verwijderen_vraag')}
                    onConfirm={() => deleteComment(item.data)}
                    aria-label={t('bord.reactie_verwijderen')}
                  />
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">{item.data.body}</p>
            </li>
          ) : (
            <li key={item.id} className="je-logregel">
              <Avatar profile={profileById[item.data.createdBy]} size="xs" />
              <span className="je-logregel__tekst">
                <strong className="text-ink-800">
                  {naamVan(item.data.createdBy) ?? t('bord.iemand')}
                </strong>{' '}
                {beschrijf(item.data, { naamVan: (uid) => naamVan(uid), statuses })}
              </span>
              <span className="je-logregel__tijd">{formatDateTime(item.at)}</span>
            </li>
          )
        )}
      </ul>

      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('bord.reactie_schrijven')}
        />
        <Acties plaats="rij" hoofd={{ label: t('bord.plaatsen'), type: 'submit', uit: !body.trim() }} />
      </form>
    </section>
  )
}
