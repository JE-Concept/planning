import { useMemo, useState } from 'react'
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
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { addManualEntry, deleteEntry, updateEntry, useTimeEntries } from '@data/time'
import WerkKiezer, { useWerk } from '@components/time/WerkKiezer'

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
  const { t, locale } = useTaal()
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

  const months = useMemo(() => lastMonths(12, locale), [locale])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('nav.uren')}
        subtitle={t('uren.samenvatting', { totaal: formatDuration(total) })}
        actions={
          <>
            <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" aria-label={t('uren.maand')}>
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-auto" aria-label={t('uren.persoon')}>
              <option value={uid}>{t('uren.mijn_uren')}</option>
              {isAdmin ? <option value="">{t('uren.hele_team')}</option> : null}
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
            <Button
              variant="secondary"
              onClick={() => exportCsv(entries, profileById, month, t)}
              disabled={entries.length === 0}
            >
              CSV
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              {t('uren.tijd_kort')}
            </Button>
          </>
        }
        tabs={
          <>
            <Tab active={view === 'entries'} onClick={() => setView('entries')}>
              {t('uren.registraties')}
            </Tab>
            <Tab active={view === 'kalender'} onClick={() => setView('kalender')}>
              {t('uren.kalender')}
            </Tab>
            <Tab active={view === 'report'} onClick={() => setView('report')}>
              {t('uren.rapport')}
            </Tab>
          </>
        }
      />

      {view === 'kalender' ? (
        <MonthCalendar
          month={startOfMonth(new Date(`${month}-01T12:00:00`))}
          onMonthChange={(m) => setMonth(monthKey(m))}
          itemsByDay={entriesPerDag}
          legenda={
            <span className="text-xs text-ink-500">
              {t('uren.deze_maand', { tijd: formatDuration(total) })}
            </span>
          }
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
                {entry.taskTitle || entry.description || t('uren.tijd')}
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
            title={t('uren.leeg')}
            description={t('uren.leeg_uitleg')}
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                {t('uren.tijd_toevoegen')}
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
                            {entry.taskTitle || entry.description || t('timer.losse_tijd')}
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
                        <span className="w-16 text-right text-sm font-medium tabular-nums text-ink-900">
                          {formatDuration(entry.durationSeconds)}
                        </span>
                        {(entry.profileId === uid || isAdmin) ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(entry)}
                              aria-label={t('alg.aanpassen')}
                            >
                              ✎
                            </Button>
                            <ConfirmButton
                              variant="ghost"
                              size="sm"
                              className="text-ink-400"
                              question={t('uren.registratie_verwijderen')}
                              onConfirm={() => deleteEntry(entry).catch((e) => toast.error(e.message))}
                              aria-label={t('alg.verwijderen')}
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
              title={t('uren.per_persoon')}
              rows={byPerson}
              label={(id) => profileById[id]?.fullName || profileById[id]?.email || t('uren.onbekend')}
              rate={(id) => profileById[id]?.hourlyRate}
            />
            <ReportTable
              title={t('uren.per_lijst')}
              rows={byList}
              label={(id) => listById[id]?.name ?? t('uren.zonder_lijst')}
            />
            <ReportTable
              title={t('uren.per_merk')}
              rows={byBrand}
              label={(id) => brandById[id]?.name ?? t('uren.zonder_merk')}
            />
            <ReportTable
              title={t('uren.per_dag')}
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
    const current = map.get(key) ?? { seconds: 0, count: 0 }
    current.seconds += entry.durationSeconds ?? 0
    current.count += 1
    map.set(key, current)
  }
  return [...map.entries()].sort((a, b) => b[1].seconds - a[1].seconds)
}

function ReportTable({ title, rows, label, rate }) {
  const { t } = useTaal()
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
                  {rate(key) ? formatCurrency(toDecimalHours(value.seconds) * rate(key)) : '—'}
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
              {t('uren.totaal')}
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

function lastMonths(count, locale) {
  const maand = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const out = []
  const now = startOfMonth()
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    out.push({ key: monthKey(d), label: maand.format(d) })
  }
  return out
}

/** A timesheet that leaves the tool ends up in a spreadsheet, so give it one. */
function exportCsv(entries, profileById, month, t) {
  const rows = [
    [
      t('uren.csv_datum'),
      t('uren.csv_persoon'),
      t('uren.csv_lijst'),
      t('uren.csv_taak'),
      t('uren.csv_omschrijving'),
      t('uren.csv_van'),
      t('uren.csv_tot'),
      t('uren.csv_uren'),
    ],
    ...entries.map((e) => [
      e.day ?? dayKey(e.startedAt),
      profileById[e.profileId]?.fullName || profileById[e.profileId]?.email || '',
      e.listName ?? '',
      e.taskTitle ?? '',
      e.description ?? '',
      formatDateTime(e.startedAt),
      formatDateTime(e.endedAt),
      String(toDecimalHours(e.durationSeconds)).replace('.', ','),
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

/**
 * Tijd toevoegen of aanpassen.
 *
 * ── Waarom er een taak gekozen moet worden ────────────────────────────────
 * Hier stond een keuzelijst van bórden: je boekte een uur op "Events" en
 * daarmee was het weg. Dat leverde urenstaten op waarin de helft van de tijd
 * op een bord stond en niet op iets wat je kan terugvinden — en het hele punt
 * van uren bijhouden is dat je achteraf kan zien waar ze heen zijn.
 *
 * Nu kies je het event of de taak zelf. Het bord, het merk en de naam komen
 * daaruit mee, dus de rapportage per bord blijft werken zonder dat iemand ze
 * apart moet invullen.
 *
 * ── Waarom er geen vinkje "factureerbaar" meer staat ──────────────────────
 * JE Concept werkt met een vaste prijs per event. "Welk deel van deze uren
 * mogen we doorrekenen" was dus een vraag die nooit gesteld werd, terwijl het
 * vinkje wel bij elke boeking stond en standaard aan. Wat ze wél willen zien
 * is de loonkost in uren, en die staat in het verslag — over alle uren, want
 * ze kosten allemaal evenveel.
 */
function EntryModal({ entry, uid, onClose }) {
  const { t } = useTaal()
  const toast = useToast()
  const [startedAt, setStartedAt] = useState(
    toLocalInput(entry?.startedAt ?? new Date(Date.now() - 3600000))
  )
  const [endedAt, setEndedAt] = useState(toLocalInput(entry?.endedAt ?? new Date()))
  const [description, setDescription] = useState(entry?.description ?? '')
  const [taskId, setTaskId] = useState(entry?.taskId ?? '')
  const [saving, setSaving] = useState(false)

  /*
    De keuzelijst staat in `WerkKiezer`, samen met die van de timer in de
    zijbalk. Hier stond een eigen lijst die `useTasks()` zonder lijst-id
    aanriep: dat abonnement geeft dan niets terug, dus was de lijst altijd leeg
    en kon je een boeking nooit opslaan. Eén component voor dezelfde vraag
    betekent dat zoiets maar op één plek kan verrotten.
  */
  const taak = useWerk(taskId)

  const submit = async (e) => {
    e.preventDefault()
    if (!taak) {
      toast.error(t('uren.kies_taak'))
      return
    }
    setSaving(true)
    try {
      if (entry) {
        await updateEntry(entry, {
          description,
          taskId: taak.id,
          taskTitle: taak.title,
          listId: taak.listId ?? null,
          listName: taak.listName ?? null,
          brandId: taak.brandId ?? null,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
        })
      } else {
        await addManualEntry({
          uid,
          task: taak,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
          description,
        })
      }
      toast.success(t('uren.opgeslagen'))
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
      title={entry ? t('uren.aanpassen_titel') : t('uren.toevoegen_titel')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('alg.annuleren')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving || !taskId}>
            {saving ? <Spinner className="h-3 w-3" /> : null} {t('alg.opslaan')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('uren.van')}>
          <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </Field>
        <Field label={t('uren.tot')}>
          <Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
        </Field>

        <div className="sm:col-span-2 grid gap-4">
          <WerkKiezer value={taskId} onChange={setTaskId} behoud={entry?.taskId ?? null} />
        </div>

        <Field label={t('uren.omschrijving')} className="sm:col-span-2">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('uren.omschrijving_hint')}
          />
        </Field>
      </form>
    </Modal>
  )
}
