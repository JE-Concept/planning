import { useMemo, useState } from 'react'
import { cn } from '@lib/cn'
import { dayKey, formatDate, formatDateTime, formatTime, startOfMonth, toLocalInput } from '@lib/dates'
import { formatCurrency, formatDuration, toDecimalHours } from '@lib/format'
import {
  Avatar,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
} from '@ui/index'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import MonthCalendar from '@components/common/MonthCalendar'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { addManualEntry, deleteEntry, setEntryBillable, updateEntry, useTimeEntries } from '@data/time'

const monthKey = (date) => dayKey(date).slice(0, 7)

/**
 * Timesheet and report in one screen.
 *
 * Entries already carry their month, so a month is one query. The grouping
 * below happens in memory over that month — a few hundred rows at most, and it
 * lets the same data answer three questions (per day, per person, per klant)
 * without three round trips.
 */
export default function TimeTracking() {
  const { uid, isAdmin } = useAuth()
  const { profileById, profiles, brandById, listById } = useWorkspace()
  const toast = useToast()

  const [month, setMonth] = useState(() => monthKey(startOfMonth()))
  const [who, setWho] = useState(uid)
  const [view, setView] = useState('entries')
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)

  const { entries, loading } = useTimeEntries({ month, profileId: who || undefined })

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0),
    [entries]
  )
  const billable = useMemo(
    () => entries.filter((e) => e.billable).reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0),
    [entries]
  )

  const byDay = useMemo(() => {
    const map = new Map()
    for (const entry of entries) {
      const key = entry.day ?? dayKey(entry.startedAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(entry)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])

  // Dezelfde registraties, gesleuteld op dag — zoals de kalender ze vraagt.
  const entriesPerDag = useMemo(() => Object.fromEntries(byDay), [byDay])

  const byPerson = useMemo(() => groupBy(entries, (e) => e.profileId), [entries])
  const byList = useMemo(() => groupBy(entries, (e) => e.listId ?? 'zonder'), [entries])
  const byBrand = useMemo(() => groupBy(entries, (e) => e.brandId ?? 'zonder'), [entries])

  const months = useMemo(() => lastMonths(12), [])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Uren"
        subtitle={`${formatDuration(total)} geboekt · ${formatDuration(billable)} factureerbaar`}
        actions={
          <>
            <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" aria-label="Maand">
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-auto" aria-label="Persoon">
              <option value={uid}>Mijn uren</option>
              {isAdmin ? <option value="">Het hele team</option> : null}
              {isAdmin
                ? profiles
                    .filter((p) => p.id !== uid)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName || p.email}
                      </option>
                    ))
                : null}
            </Select>
            <Button variant="secondary" onClick={() => exportCsv(entries, profileById, month)} disabled={entries.length === 0}>
              CSV
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              + Tijd
            </Button>
          </>
        }
        tabs={
          <>
            <Tab active={view === 'entries'} onClick={() => setView('entries')}>
              Registraties
            </Tab>
            <Tab active={view === 'kalender'} onClick={() => setView('kalender')}>
              Kalender
            </Tab>
            <Tab active={view === 'report'} onClick={() => setView('report')}>
              Rapport
            </Tab>
          </>
        }
      />

      {view === 'kalender' ? (
        <MonthCalendar
          month={startOfMonth(new Date(`${month}-01T12:00:00`))}
          onMonthChange={(m) => setMonth(monthKey(m))}
          itemsByDay={entriesPerDag}
          legenda={<span className="text-xs text-ink-500">{formatDuration(total)} deze maand</span>}
          renderDay={(dag, items) => {
            const seconden = items.reduce((s, e) => s + (e.durationSeconds ?? 0), 0)
            return seconden ? (
              <span className="text-[11px] font-semibold tabular-nums text-ink-700">
                {formatDuration(seconden)}
              </span>
            ) : null
          }}
          renderItem={(entry) => (
            <button
              type="button"
              onClick={() => setEditing(entry)}
              className="flex w-full items-center gap-1 rounded bg-white px-1 py-0.5 text-left text-[11px] shadow-card hover:bg-ink-50"
            >
              <span className="min-w-0 flex-1 truncate text-ink-800">
                {entry.taskTitle || entry.description || 'Tijd'}
              </span>
              <span className="shrink-0 tabular-nums text-ink-400">
                {formatDuration(entry.durationSeconds)}
              </span>
            </button>
          )}
        />
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            title="Nog geen uren deze maand"
            description="Start de timer in de bovenbalk of voeg tijd handmatig toe."
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                Tijd toevoegen
              </Button>
            }
          />
        ) : view === 'entries' ? (
          <div className="space-y-5">
            {byDay.map(([day, dayEntries]) => {
              const dayTotal = dayEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0)
              return (
                <section key={day}>
                  <h2 className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                    {formatDate(dayEntries[0].startedAt)}
                    <span className="font-normal tabular-nums text-ink-400">
                      {formatDuration(dayTotal)}
                    </span>
                  </h2>

                  <ul className="divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-200 bg-white">
                    {dayEntries.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <Avatar profile={profileById[entry.profileId]} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-ink-900">
                            {entry.taskTitle || entry.description || 'Losse tijd'}
                          </p>
                          <p className="truncate text-xs text-ink-500">
                            {[entry.listName, entry.taskTitle ? entry.description : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <span className="hidden text-xs tabular-nums text-ink-500 sm:block">
                          {formatTime(entry.startedAt)}–{formatTime(entry.endedAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEntryBillable(entry, !entry.billable)}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-medium',
                            entry.billable ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'
                          )}
                        >
                          {entry.billable ? 'factureerbaar' : 'intern'}
                        </button>
                        <span className="w-16 text-right text-sm font-medium tabular-nums text-ink-900">
                          {formatDuration(entry.durationSeconds)}
                        </span>
                        {(entry.profileId === uid || isAdmin) ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(entry)} aria-label="Bewerken">
                              ✎
                            </Button>
                            <ConfirmButton
                              variant="ghost"
                              size="sm"
                              className="text-ink-400"
                              question="Registratie verwijderen?"
                              onConfirm={() => deleteEntry(entry).catch((e) => toast.error(e.message))}
                              aria-label="Verwijderen"
                            >
                              ✕
                            </ConfirmButton>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <ReportTable
              title="Per persoon"
              rows={byPerson}
              label={(id) => profileById[id]?.fullName || profileById[id]?.email || 'Onbekend'}
              rate={(id) => profileById[id]?.hourlyRate}
            />
            <ReportTable
              title="Per lijst"
              rows={byList}
              label={(id) => listById[id]?.name ?? 'Zonder lijst'}
            />
            <ReportTable
              title="Per merk"
              rows={byBrand}
              label={(id) => brandById[id]?.name ?? 'Zonder merk'}
            />
            <ReportTable
              title="Per dag"
              rows={groupBy(entries, (e) => e.day ?? dayKey(e.startedAt))}
              label={(key) => key}
            />
          </div>
        )}
      </div>
      )}

      {adding ? <EntryModal uid={uid} onClose={() => setAdding(false)} /> : null}
      {editing ? <EntryModal entry={editing} uid={uid} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupBy(entries, keyOf) {
  const map = new Map()
  for (const entry of entries) {
    const key = keyOf(entry)
    const current = map.get(key) ?? { seconds: 0, billable: 0, count: 0 }
    current.seconds += entry.durationSeconds ?? 0
    if (entry.billable) current.billable += entry.durationSeconds ?? 0
    current.count += 1
    map.set(key, current)
  }
  return [...map.entries()].sort((a, b) => b[1].seconds - a[1].seconds)
}

function ReportTable({ title, rows, label, rate }) {
  const total = rows.reduce((s, [, v]) => s + v.seconds, 0)

  return (
    <section className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <h2 className="border-b border-ink-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
        {title}
      </h2>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-ink-100">
          {rows.map(([key, value]) => (
            <tr key={key}>
              <td className="px-3 py-1.5 text-ink-800">{label(key)}</td>
              <td className="px-2 py-1.5 text-right text-xs tabular-nums text-ink-500">
                {toDecimalHours(value.seconds).toFixed(2)} u
              </td>
              {rate ? (
                <td className="px-2 py-1.5 text-right text-xs tabular-nums text-ink-500">
                  {rate(key) ? formatCurrency(toDecimalHours(value.billable) * rate(key)) : '—'}
                </td>
              ) : null}
              <td className="px-3 py-1.5 text-right font-medium tabular-nums text-ink-900">
                {formatDuration(value.seconds)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink-200 bg-ink-50">
            <td className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
              Totaal
            </td>
            <td colSpan={rate ? 2 : 1} />
            <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink-900">
              {formatDuration(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}

function lastMonths(count) {
  const out = []
  const now = startOfMonth()
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    out.push({
      key: monthKey(d),
      label: new Intl.DateTimeFormat('nl-BE', { month: 'long', year: 'numeric' }).format(d),
    })
  }
  return out
}

/** A timesheet that leaves the tool ends up in a spreadsheet, so give it one. */
function exportCsv(entries, profileById, month) {
  const rows = [
    ['Datum', 'Persoon', 'Lijst', 'Taak', 'Omschrijving', 'Van', 'Tot', 'Uren', 'Factureerbaar'],
    ...entries.map((e) => [
      e.day ?? dayKey(e.startedAt),
      profileById[e.profileId]?.fullName || profileById[e.profileId]?.email || '',
      e.listName ?? '',
      e.taskTitle ?? '',
      e.description ?? '',
      formatDateTime(e.startedAt),
      formatDateTime(e.endedAt),
      String(toDecimalHours(e.durationSeconds)).replace('.', ','),
      e.billable ? 'ja' : 'nee',
    ]),
  ]

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')

  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `uren-${month}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Add / edit ─────────────────────────────────────────────────────────────

function EntryModal({ entry, uid, onClose }) {
  const toast = useToast()
  const { activeLists } = useWorkspace()
  const [startedAt, setStartedAt] = useState(
    toLocalInput(entry?.startedAt ?? new Date(Date.now() - 3600000))
  )
  const [endedAt, setEndedAt] = useState(toLocalInput(entry?.endedAt ?? new Date()))
  const [description, setDescription] = useState(entry?.description ?? '')
  const [listId, setListId] = useState(entry?.listId ?? '')
  const [billable, setBillable] = useState(entry?.billable ?? true)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const list = activeLists.find((l) => l.id === listId) ?? null
      if (entry) {
        await updateEntry(entry, {
          description,
          billable,
          listId: list?.id ?? null,
          listName: list?.name ?? null,
          brandId: list?.brandId ?? null,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
        })
      } else {
        await addManualEntry({
          uid,
          list,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
          description,
          billable,
        })
      }
      toast.success('Opgeslagen.')
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
      title={entry ? 'Tijd aanpassen' : 'Tijd toevoegen'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner className="h-3 w-3" /> : null} Opslaan
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Van">
          <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </Field>
        <Field label="Tot">
          <Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
        </Field>
        <Field label="Lijst" className="sm:col-span-2">
          <Select value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">Geen lijst</option>
            {activeLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Omschrijving" className="sm:col-span-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Waaraan gewerkt?" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-accent-600"
          />
          Factureerbaar
        </label>
      </form>
    </Modal>
  )
}
