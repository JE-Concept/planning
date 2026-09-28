import { useMemo, useState } from 'react'
import { cn } from '@lib/cn'
import { addDays, dayKey, formatDate, formatTime, isToday } from '@lib/dates'
import { afdelingLabel, dueOn, repeatLabel, runProgress, visibleTo } from '@lib/checklist-templates'
import { Avatar, Badge, Button, EmptyState, ProgressBar, Spinner, Textarea } from '@ui/index'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useChecklists, useRunsForDay, closeRun, saveNotes, toggleItem } from '@data/checklists'

/**
 * Openen en sluiten van de bistro.
 *
 * Eén lijst per dag waar iedereen in afvinkt, in plaats van een blad per
 * persoon: wie binnenkomt ziet wat de vorige al deed en pakt de rest op. Bij
 * elk vinkje staat wie het zette en wanneer — dat is het enige wat het papier
 * niet kon, en meteen het punt van de oefening.
 */
export default function Checklists() {
  const { checklists, loading } = useChecklists()
  const { profile } = useAuth()
  const toast = useToast()

  const [offset, setOffset] = useState(0)
  const [active, setActive] = useState(null)

  const date = useMemo(() => addDays(new Date(), offset), [offset])
  const day = dayKey(date)

  // Twee filters op elk punt: valt het vandaag, en gaat het deze persoon aan.
  const scope = useMemo(() => ({ date, person: profile }), [date, profile])

  const { byChecklist, loading: runsLoading } = useRunsForDay(day)

  const current = useMemo(
    () => checklists.find((c) => c.id === active) ?? checklists[0] ?? null,
    [checklists, active]
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (checklists.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          title="Nog geen lijsten"
          description="De openings- en sluitingslijst worden bij de eerste inrichting klaargezet."
        />
      </div>
    )
  }

  const run = byChecklist[current?.id]
  const progress = runProgress(current, run, scope)

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Openen en sluiten"
        subtitle={`${formatDate(date)}${isToday(date) ? ' — vandaag' : ''}${
          profile?.department ? ` · ${afdelingLabel(profile.department)}` : ''
        }`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOffset((o) => o - 1)} aria-label="Vorige dag">
              ‹
            </Button>
            <Button variant="secondary" onClick={() => setOffset(0)} disabled={offset === 0}>
              Vandaag
            </Button>
            <Button
              variant="secondary"
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset === 0}
              aria-label="Volgende dag"
            >
              ›
            </Button>
          </>
        }
        tabs={checklists.map((list) => {
          const listRun = byChecklist[list.id]
          const p = runProgress(list, listRun, scope)
          return (
            <Tab key={list.id} active={current?.id === list.id} onClick={() => setActive(list.id)}>
              {list.name}
              <span className="ml-1.5 tabular-nums text-[11px] text-ink-400">
                {p.done}/{p.total}
              </span>
            </Tab>
          )
        })}
      />

      <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-4 py-2.5 sm:px-6">
        <ProgressBar
          value={progress.ratio}
          color={progress.ratio === 1 ? '#3db88b' : '#1A3A6B'}
          className="h-2 flex-1"
        />
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-700">
          {progress.done} van {progress.total}
        </span>
        {run?.participants?.length ? (
          <span className="hidden shrink-0 text-xs text-ink-500 sm:block">
            {run.participants.length} {run.participants.length === 1 ? 'persoon' : 'personen'}
          </span>
        ) : null}
      </div>

      {runsLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
          <div className="mx-auto max-w-2xl space-y-5 py-4">
            {current.sections.map((section) => (
              <Section
                key={section.id}
                section={section}
                run={run}
                scope={scope}
                onToggle={(item, done) =>
                  toggleItem({ checklist: current, day, item, done, profile, scope }).catch((err) =>
                    toast.error(err.message)
                  )
                }
              />
            ))}

            <section className="card p-4">
              <h2 className="label">
                {current.kind === 'close' ? 'Over te dragen aan de volgende shift' : 'Opmerkingen'}
              </h2>
              <Textarea
                rows={3}
                defaultValue={run?.notes ?? ''}
                key={`${current.id}-${day}-${run?.notesAt ?? ''}`}
                placeholder={
                  current.kind === 'close'
                    ? 'Wat moet morgen zeker geweten zijn?'
                    : 'Iets bijzonders vanmorgen?'
                }
                onBlur={(e) => {
                  if ((e.target.value ?? '') === (run?.notes ?? '')) return
                  saveNotes({ checklist: current, day, notes: e.target.value, profile }).catch((err) =>
                    toast.error(err.message)
                  )
                }}
              />
              {run?.notesByName ? (
                <p className="mt-1.5 text-[11px] text-ink-500">
                  Laatst bijgewerkt door {run.notesByName}
                  {run.notesAt ? ` om ${formatTime(run.notesAt)}` : ''}
                </p>
              ) : null}
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                disabled={progress.done < progress.total || Boolean(run?.closedAt)}
                onClick={() =>
                  closeRun({ checklist: current, day, profile })
                    .then(() => toast.success('Lijst afgerond.'))
                    .catch((err) => toast.error(err.message))
                }
              >
                {run?.closedAt ? 'Afgerond' : 'Lijst afronden'}
              </Button>
              {run?.closedAt ? (
                <span className="text-xs text-ink-500">
                  Afgerond door {run.closedByName} om {formatTime(run.closedAt)}
                </span>
              ) : progress.done < progress.total ? (
                <span className="text-xs text-ink-500">
                  Nog {progress.total - progress.done} te gaan.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ section, run, scope, onToggle }) {
  // Wat vandaag niet valt, of niet voor deze persoon is, staat er helemaal niet
  // — anders leest de lijst als een archief in plaats van als het werk van nu.
  const shown = section.items.filter(
    (item) => dueOn(item, scope.date) && visibleTo(item, scope.person)
  )

  if (shown.length === 0) return null

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-ink-100 bg-ink-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-700">
        {section.title}
      </h2>
      <ul className="divide-y divide-ink-100">
        {shown.map((item) => (
          <Item key={item.id} item={item} state={run?.items?.[item.id]} onToggle={onToggle} />
        ))}
      </ul>
    </section>
  )
}

function Item({ item, state, onToggle }) {
  const [revealed, setRevealed] = useState(false)
  const done = Boolean(state?.done)

  return (
    <li className={cn('px-4 py-2.5', done && 'bg-ink-50/50')}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => onToggle(item, e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-accent-600"
        />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm', done ? 'text-ink-500 line-through' : 'text-ink-900')}>
            {item.label}
            {item.repeat && item.repeat.kind !== 'dagelijks' ? (
              <Badge color="#8593a9" subtle className="ml-2 align-middle">
                {repeatLabel(item)}
              </Badge>
            ) : null}
          </span>

          {item.hint && !item.secret ? (
            <span className="mt-0.5 block text-xs text-ink-500">{item.hint}</span>
          ) : null}

          {/* Een code hoort niet zomaar op het scherm te staan waar iedereen
              meekijkt; hij staat er wel, maar pas na een klik. */}
          {item.secret ? (
            revealed ? (
              <span className="mt-0.5 block font-mono text-xs text-ink-700">{item.hint}</span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setRevealed(true)
                }}
                className="mt-0.5 text-xs font-medium text-accent-700 underline"
              >
                Code tonen
              </button>
            )
          ) : null}

          {done && state?.byName ? (
            <span className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-500">
              <Avatar profile={{ fullName: state.byName }} size="xs" />
              {state.byName}
              {state.at ? ` · ${formatTime(state.at)}` : ''}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  )
}
