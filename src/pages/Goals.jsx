import { useEffect, useMemo, useState } from 'react'
import { cn } from '@lib/cn'
import { daysUntil, formatDate, toDateInput } from '@lib/dates'
import { formatCurrency, formatNumber } from '@lib/format'
import {
  Avatar,
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
} from '@data/goals'

const STATUS_LABELS = {
  draft: 'Concept',
  active: 'Lopend',
  achieved: 'Behaald',
  missed: 'Niet gehaald',
  archived: 'Gearchiveerd',
}

/** Formats a key result value the way its own kind should read. */
function valueLabel(kr, value) {
  const n = Number(value ?? 0)
  if (kr.kind === 'currency') return formatCurrency(n)
  if (kr.kind === 'percent') return `${formatNumber(n)}%`
  if (kr.kind === 'boolean') return n >= 1 ? 'Ja' : 'Nee'
  return `${formatNumber(n)}${kr.unit ? ` ${kr.unit}` : ''}`
}

export default function Goals() {
  const { goals, loading } = useGoals()
  const { brandById, profileById, profiles, brands } = useWorkspace()
  const { uid } = useAuth()
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
        subtitle={`${goals.filter((g) => g.status === 'active').length} lopende doelen`}
        actions={
          <>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto" aria-label="Filter">
              <option value="active">Lopend</option>
              <option value="achieved">Behaald</option>
              <option value="draft">Concept</option>
              <option value="all">Alles</option>
            </Select>
            <Button variant="primary" onClick={() => setCreating(true)}>
              + Goal
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
            title="Nog geen doelen"
            description="Een goal bundelt meetbare resultaten: omzet, aantal events, posts per maand."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Eerste goal maken
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {shown.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                brand={brandById[goal.brandId]}
                owner={profileById[goal.ownerId]}
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
          brands={brands}
          uid={uid}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <GoalModal
          goal={editing}
          profiles={profiles}
          brands={brands}
          uid={uid}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

// ─── Card ───────────────────────────────────────────────────────────────────

function GoalCard({ goal, brand, owner, onEdit, onCheckIn }) {
  const progress = goalProgress(goal)
  const left = daysUntil(goal.dueDate)
  const late = left < 0 && goal.status === 'active'

  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {brand ? <Badge color={brand.color}>{brand.name}</Badge> : null}
            <Badge color={goal.status === 'achieved' ? '#008844' : '#8593a9'} subtle>
              {STATUS_LABELS[goal.status]}
            </Badge>
          </div>
          <h2 className="mt-1.5 text-sm font-semibold text-ink-900">{goal.name}</h2>
          {goal.description ? (
            <p className="mt-0.5 text-xs text-ink-500">{goal.description}</p>
          ) : null}
        </div>
        {owner ? <Avatar profile={owner} size="sm" /> : null}
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-medium tabular-nums text-ink-900">
            {Math.round(progress * 100)}%
          </span>
          <span className={cn('text-ink-500', late && 'font-medium text-red-600')}>
            {late ? `${Math.abs(left)} dagen over tijd` : `nog ${left} dagen`} ·{' '}
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
          <li className="text-xs text-ink-400">Nog geen resultaten toegevoegd.</li>
        ) : null}
      </ul>

      <div className="mt-auto flex gap-2 pt-1">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Bewerken
        </Button>
      </div>
    </article>
  )
}

function KeyResultRow({ kr, onCheckIn }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(kr.currentValue ?? 0)
  const [note, setNote] = useState('')
  const progress = keyResultProgress(kr)
  const derived = kr.kind === 'tasks'

  return (
    <li className="rounded-md bg-ink-50 px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-ink-700">{kr.name || 'Naamloos resultaat'}</span>
        <span className="shrink-0 tabular-nums text-ink-900">
          {valueLabel(kr, kr.currentValue)} / {valueLabel(kr, kr.targetValue)}
        </span>
      </div>
      <ProgressBar value={progress} className="mt-1 h-1.5" />

      {derived ? (
        <p className="mt-1 text-[11px] text-ink-400">Telt automatisch de afgewerkte taken.</p>
      ) : open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
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
            aria-label="Nieuwe waarde"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notitie"
            className="h-8 flex-1 text-xs"
            aria-label="Notitie"
          />
          <Button type="submit" variant="primary" size="sm">
            Opslaan
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 text-[11px] font-medium text-accent-700 hover:underline"
        >
          Bijwerken
        </button>
      )}
    </li>
  )
}

// ─── Create / edit ──────────────────────────────────────────────────────────

function GoalModal({ goal, profiles, brands, uid, onClose }) {
  const toast = useToast()
  const { boards } = useWorkspace()
  const [name, setName] = useState(goal?.name ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [brandId, setBrandId] = useState(goal?.brandId ?? '')
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
          brandId: brandId || null,
          ownerId: ownerId || null,
          dueDate: new Date(dueDate),
          status,
        })
        await setKeyResults(goal.id, cleaned)
      } else {
        const id = await createGoal({
          name,
          description,
          brandId: brandId || null,
          ownerId: ownerId || null,
          dueDate: new Date(dueDate),
          status,
        })
        await setKeyResults(id, cleaned)
      }
      toast.success('Goal opgeslagen.')
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
      title={goal ? 'Goal bewerken' : 'Nieuwe goal'}
      footer={
        <>
          {goal ? (
            <ConfirmButton
              variant="danger"
              size="sm"
              className="mr-auto"
              question="Deze goal verwijderen?"
              onConfirm={() => deleteGoal(goal.id).then(onClose)}
            >
              Verwijderen
            </ConfirmButton>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || saving}>
            {saving ? <Spinner className="h-3 w-3" /> : null} Opslaan
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Naam">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Omzet Q4 verdubbelen" />
        </Field>

        <Field label="Toelichting">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Merk">
            <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">Alle merken</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Eigenaar">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Niemand</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName || p.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deadline">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <section>
          <h3 className="label">Resultaten</h3>
          <ul className="space-y-2">
            {keyResults.map((kr) => (
              <li key={kr.id} className="grid gap-2 rounded-md bg-ink-50 p-2 sm:grid-cols-12">
                <Input
                  className="sm:col-span-5"
                  value={kr.name}
                  onChange={(e) => patch(kr.id, { name: e.target.value })}
                  placeholder="Wat meten we?"
                  aria-label="Naam van het resultaat"
                />
                <Select
                  className="sm:col-span-3"
                  value={kr.kind}
                  onChange={(e) => patch(kr.id, { kind: e.target.value })}
                  aria-label="Soort"
                >
                  {KEY_RESULT_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </Select>

                {kr.kind === 'tasks' ? (
                  <Select
                    className="sm:col-span-3"
                    value={kr.listId ?? ''}
                    onChange={(e) => patch(kr.id, { listId: e.target.value })}
                    aria-label="Lijst"
                  >
                    <option value="">Kies een lijst…</option>
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
                    placeholder="Start"
                    aria-label="Startwaarde"
                  />
                )}

                <Input
                  className="sm:col-span-2"
                  type="number"
                  step="any"
                  value={kr.targetValue}
                  onChange={(e) => patch(kr.id, { targetValue: e.target.value })}
                  placeholder="Doel"
                  aria-label="Doelwaarde"
                />

                <div className="sm:col-span-12 sm:text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-ink-400"
                    onClick={() => setLocalKeyResults((all) => all.filter((k) => k.id !== kr.id))}
                  >
                    Verwijderen
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
            + Resultaat
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
