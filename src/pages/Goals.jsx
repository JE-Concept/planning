import { useEffect, useMemo, useState } from 'react'
import { cn } from '@lib/cn'
import { daysUntil, formatDate, fromDateInput, toDateInput } from '@lib/dates'
import { formatCurrency, formatNumber } from '@lib/format'
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  Select,
  Spinner,
  Textarea,
} from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  KEY_RESULT_KINDS,
  checkIn,
  createGoal,
  deleteGoal,
  goalProgress,
  keyResultProgress,
  newKeyResult,
  refreshTaskKeyResults,
  setKeyResults,
  updateGoal,
  useGoals,
  useKeyResultHistory,
} from '@data/goals'

// De stand van een goal staat als woord in de database; de naam hoort bij de taal.
const STATUS_SLEUTELS = {
  draft: 'goals.status.draft',
  active: 'goals.status.active',
  achieved: 'goals.status.achieved',
  missed: 'goals.status.missed',
  archived: 'goals.status.archived',
}

// Hetzelfde voor het soort resultaat; de sleutels ervan staan in `@data/goals`.
const SOORT_SLEUTELS = {
  number: 'goals.soort.number',
  currency: 'goals.soort.currency',
  percent: 'goals.soort.percent',
  boolean: 'goals.soort.boolean',
  tasks: 'goals.soort.tasks',
}

/** Formats a key result value the way its own kind should read. */
function valueLabel(t, kr, value) {
  const n = Number(value ?? 0)
  if (kr.kind === 'currency') return formatCurrency(n)
  if (kr.kind === 'percent') return `${formatNumber(n)}%`
  if (kr.kind === 'boolean') return t(n >= 1 ? 'goals.ja' : 'goals.nee')
  return `${formatNumber(n)}${kr.unit ? ` ${kr.unit}` : ''}`
}

export default function Goals() {
  const { goals, loading } = useGoals()
  const { profileById, profiles } = useWorkspace()
  const { uid } = useAuth()
  const { t } = useTaal()
  const toast = useToast()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('active')

  // Task-count key results are derived, not entered. Refreshing them when the
  // page opens keeps a goal honest without a background job.
  useEffect(() => {
    goals
      .filter((g) => (g.keyResults ?? []).some((kr) => kr.kind === 'tasks' && kr.listId))
      .forEach((g) => refreshTaskKeyResults(g).catch(() => {}))
  }, [goals])

  const shown = useMemo(
    () => (filter === 'all' ? goals : goals.filter((g) => g.status === filter)),
    [goals, filter]
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Goals"
        subtitle={t('goals.lopend', { aantal: goals.filter((g) => g.status === 'active').length })}
        actions={
          <>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-auto"
              aria-label={t('goals.filter')}
            >
              <option value="active">{t('goals.status.active')}</option>
              <option value="achieved">{t('goals.status.achieved')}</option>
              <option value="draft">{t('goals.status.draft')}</option>
              <option value="all">{t('alg.alles')}</option>
            </Select>
            <Button variant="primary" onClick={() => setCreating(true)}>
              {t('goals.nieuw')}
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            title={t('goals.leeg.titel')}
            description={t('goals.leeg.tekst')}
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                {t('goals.leeg.knop')}
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {shown.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                owner={profileById[goal.ownerId]}
                profileById={profileById}
                onEdit={() => setEditing(goal)}
                onCheckIn={(keyResultId, value, note) =>
                  checkIn({ goal, keyResultId, value, note, profileId: uid }).catch((e) =>
                    toast.error(e.message)
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {creating ? (
        <GoalModal
          profiles={profiles}
          uid={uid}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <GoalModal
          goal={editing}
          profiles={profiles}
          uid={uid}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

// ─── Card ───────────────────────────────────────────────────────────────────

function GoalCard({ goal, owner, onEdit, onCheckIn, profileById }) {
  const { t } = useTaal()
  const progress = goalProgress(goal)
  const left = daysUntil(goal.dueDate)
  const late = left < 0 && goal.status === 'active'

  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge color={goal.status === 'achieved' ? '#008844' : '#8593a9'} subtle>
              {t(STATUS_SLEUTELS[goal.status])}
            </Badge>
          </div>
          <h2 className="mt-1.5 text-sm font-semibold text-ink-900">{goal.name}</h2>
          {goal.description ? (
            <p className="mt-0.5 text-xs text-ink-500">{goal.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* De uitvoerders staan naast de eigenaar: wie eraan trekt, en wie
              erover rapporteert. */}
          <AvatarStack
            profiles={(goal.assignees ?? []).map((id) => profileById?.[id]).filter(Boolean)}
            max={3}
          />
          {owner ? <Avatar profile={owner} size="sm" /> : null}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-medium tabular-nums text-ink-900">
            {Math.round(progress * 100)}%
          </span>
          <span className={cn('text-ink-500', late && 'font-medium text-red-600')}>
            {t(late ? 'goals.over_tijd' : 'goals.nog_dagen', { aantal: late ? Math.abs(left) : left })} ·{' '}
            {formatDate(goal.dueDate)}
          </span>
        </div>
        <ProgressBar value={progress} color={goal.color} />
      </div>

      <ul className="space-y-2">
        {(goal.keyResults ?? []).map((kr) => (
          <KeyResultRow key={kr.id} kr={kr} onCheckIn={onCheckIn} />
        ))}
        {(goal.keyResults ?? []).length === 0 ? (
          <li className="text-xs text-ink-400">{t('goals.geen_resultaten')}</li>
        ) : null}
      </ul>

      <div className="mt-auto flex gap-2 pt-1">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          {t('goals.bewerken')}
        </Button>
      </div>
    </article>
  )
}

function KeyResultRow({ kr, onCheckIn }) {
  const { t } = useTaal()
  const [open, setOpen] = useState(false)
  const [historie, setHistorie] = useState(false)
  const [value, setValue] = useState(kr.currentValue ?? 0)
  const [note, setNote] = useState('')
  const progress = keyResultProgress(kr)
  const derived = kr.kind === 'tasks'

  /*
    Een leeg veld is geen nul.

    `checkIn` doet `Number(value)`, en `Number('')` is 0. Wie het veld leegmaakte
    en toch op Opslaan drukte, zette zijn key result daarmee stilletjes op nul —
    én schreef die nul als ijkpunt in het verloop. Er was niets dat dat
    tegenhield en niets dat het meldde. Nu kan de knop niet.
  */
  const bruikbaar = String(value).trim() !== '' && Number.isFinite(Number(value))

  return (
    <li className="rounded-md bg-ink-50 px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-ink-700">{kr.name || t('goals.naamloos')}</span>
        <span className="shrink-0 tabular-nums text-ink-900">
          {valueLabel(t, kr, kr.currentValue)} / {valueLabel(t, kr, kr.targetValue)}
        </span>
      </div>
      <ProgressBar value={progress} className="mt-1 h-1.5" />

      {derived ? (
        <p className="mt-1 text-[11px] text-ink-400">{t('goals.telt_automatisch')}</p>
      ) : open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!bruikbaar) return
            onCheckIn(kr.id, value, note)
            setNote('')
            setOpen(false)
          }}
          className="mt-2 flex gap-1.5"
        >
          <Input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 w-24 text-xs"
            aria-label={t('goals.nieuwe_waarde')}
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('goals.notitie')}
            className="h-8 flex-1 text-xs"
            aria-label={t('goals.notitie')}
          />
          <Button type="submit" variant="primary" size="sm" disabled={!bruikbaar}>
            {t('bord.opslaan')}
          </Button>
        </form>
      ) : (
        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[11px] font-medium text-accent-700 hover:underline"
          >
            {t('goals.bijwerken')}
          </button>
          <button
            type="button"
            onClick={() => setHistorie((h) => !h)}
            className="text-[11px] font-medium text-ink-500 hover:underline"
          >
            {t(historie ? 'goals.verloop_verbergen' : 'goals.verloop')}
          </button>
        </div>
      )}

      {historie && !derived ? <Verloop kr={kr} /> : null}
    </li>
  )
}

/**
 * Hoe dit resultaat bewoog.
 *
 * De check-ins werden al bewaard maar waren nergens te zien — en een doel
 * zonder verloop zegt alleen waar je nu staat, niet of het de goede kant op
 * gaat. Het abonnement start pas bij het openklappen; anders loopt er per
 * resultaat een abonnement mee voor een lijstje dat niemand openslaat.
 */
function Verloop({ kr }) {
  const { t } = useTaal()
  const { profileById } = useWorkspace()
  const updates = useKeyResultHistory(kr.id)

  if (updates.length === 0) {
    return <p className="mt-2 text-[11px] text-ink-400">{t('goals.geen_bijwerkingen')}</p>
  }

  return (
    <ol className="mt-2 space-y-1 border-l border-ink-200 pl-2.5">
      {updates.slice(0, 6).map((u) => (
        <li key={u.id} className="text-[11px] text-ink-500">
          <span className="font-semibold tabular-nums text-ink-800">{valueLabel(t, kr, u.value)}</span>
          {' · '}
          {formatDate(u.createdAt)}
          {u.profileId && profileById[u.profileId]
            ? ` · ${profileById[u.profileId].fullName ?? profileById[u.profileId].email}`
            : ''}
          {u.note ? <span className="block text-ink-400">{u.note}</span> : null}
        </li>
      ))}
    </ol>
  )
}

// ─── Create / edit ──────────────────────────────────────────────────────────

function GoalModal({ goal, profiles, uid, onClose }) {
  const { t } = useTaal()
  const toast = useToast()
  const { boards } = useWorkspace()
  const [name, setName] = useState(goal?.name ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [assignees, setAssignees] = useState(goal?.assignees ?? [])
  const [ownerId, setOwnerId] = useState(goal?.ownerId ?? uid ?? '')
  const [dueDate, setDueDate] = useState(toDateInput(goal?.dueDate ?? endOfYear()))
  const [status, setStatus] = useState(goal?.status ?? 'active')
  const [keyResults, setLocalKeyResults] = useState(goal?.keyResults ?? [newKeyResult()])
  const [saving, setSaving] = useState(false)

  const patch = (id, changes) =>
    setLocalKeyResults((all) => all.map((kr) => (kr.id === id ? { ...kr, ...changes } : kr)))

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const cleaned = keyResults
      .filter((kr) => kr.name.trim())
      .map((kr) => ({
        ...kr,
        name: kr.name.trim(),
        startValue: Number(kr.startValue ?? 0),
        targetValue: Number(kr.targetValue ?? 0),
        currentValue: Number(kr.currentValue ?? 0),
        listId: kr.kind === 'tasks' ? kr.listId || null : null,
      }))

    try {
      if (goal) {
        await updateGoal(goal.id, {
          name: name.trim(),
          description,
          assignees,
          ownerId: ownerId || null,
          dueDate: fromDateInput(dueDate),
          status,
        })
        await setKeyResults(goal.id, cleaned)
      } else {
        const id = await createGoal({
          name,
          description,
          assignees,
          ownerId: ownerId || null,
          dueDate: fromDateInput(dueDate),
          status,
        })
        await setKeyResults(id, cleaned)
      }
      toast.success(t('goals.opgeslagen'))
      onClose()
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={t(goal ? 'goals.bewerk_titel' : 'goals.nieuw_titel')}
      footer={
        <>
          {goal ? (
            <ConfirmButton
              variant="danger"
              size="sm"
              className="mr-auto"
              question={t('goals.verwijder_vraag')}
              onConfirm={() => deleteGoal(goal.id).then(onClose)}
            >
              {t('alg.verwijderen')}
            </ConfirmButton>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {t('alg.annuleren')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || saving}>
            {saving ? <Spinner className="h-3 w-3" /> : null} {t('bord.opslaan')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('goals.veld.naam')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('goals.veld.naam_hint')} />
        </Field>

        <Field label={t('goals.veld.toelichting')}>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <Field label={t('goals.veld.uitvoerders')} hint={t('goals.veld.uitvoerders_hint')}>
          <div className="flex flex-wrap gap-1.5">
            {profiles
              .filter((p) => p.active !== false && p.role !== 'staff')
              .map((p) => {
                const aan = assignees.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setAssignees((all) =>
                        aan ? all.filter((id) => id !== p.id) : [...all, p.id]
                      )
                    }
                    title={p.fullName ?? p.email}
                    aria-pressed={aan}
                    className={`rounded-full ring-2 ${aan ? 'ring-accent-500' : 'ring-transparent opacity-50'}`}
                  >
                    <Avatar profile={p} size="sm" />
                  </button>
                )
              })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('goals.veld.eigenaar')}>
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">{t('alg.niemand')}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName || p.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('goals.veld.deadline')}>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label={t('goals.veld.status')}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_SLEUTELS).map(([key, sleutel]) => (
                <option key={key} value={key}>
                  {t(sleutel)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <section>
          <h3 className="label">{t('goals.resultaten')}</h3>
          <ul className="space-y-2">
            {keyResults.map((kr) => (
              <li key={kr.id} className="grid gap-2 rounded-md bg-ink-50 p-2 sm:grid-cols-12">
                <Input
                  className="sm:col-span-5"
                  value={kr.name}
                  onChange={(e) => patch(kr.id, { name: e.target.value })}
                  placeholder={t('goals.wat_meten')}
                  aria-label={t('goals.resultaat_naam')}
                />
                <Select
                  className="sm:col-span-3"
                  value={kr.kind}
                  onChange={(e) => patch(kr.id, { kind: e.target.value })}
                  aria-label={t('goals.soort_label')}
                >
                  {KEY_RESULT_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {t(SOORT_SLEUTELS[k.key])}
                    </option>
                  ))}
                </Select>

                {kr.kind === 'tasks' ? (
                  <Select
                    className="sm:col-span-3"
                    value={kr.listId ?? ''}
                    onChange={(e) => patch(kr.id, { listId: e.target.value })}
                    aria-label={t('goals.lijst')}
                  >
                    <option value="">{t('goals.kies_lijst')}</option>
                    {boards.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    className="sm:col-span-3"
                    type="number"
                    step="any"
                    value={kr.startValue}
                    onChange={(e) => patch(kr.id, { startValue: e.target.value })}
                    placeholder={t('goals.start')}
                    aria-label={t('goals.startwaarde')}
                  />
                )}

                <Input
                  className="sm:col-span-2"
                  type="number"
                  step="any"
                  value={kr.targetValue}
                  onChange={(e) => patch(kr.id, { targetValue: e.target.value })}
                  placeholder={t('goals.doel')}
                  aria-label={t('goals.doelwaarde')}
                />

                <div className="sm:col-span-12 sm:text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-ink-400"
                    onClick={() => setLocalKeyResults((all) => all.filter((k) => k.id !== kr.id))}
                  >
                    {t('alg.verwijderen')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => setLocalKeyResults((all) => [...all, newKeyResult()])}
          >
            {t('goals.resultaat_toevoegen')}
          </Button>
        </section>
      </form>
    </Modal>
  )
}

function endOfYear() {
  const d = new Date()
  return new Date(d.getFullYear(), 11, 31)
}
