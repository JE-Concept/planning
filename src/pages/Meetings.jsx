import { useMemo, useState } from 'react'
import { cn } from '@lib/cn'
import { dayKey, formatDate } from '@lib/dates'
import {
  Avatar,
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from '@ui/index'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { summariseMeeting, useMeetingTasks, useMeetings } from '@data/meetings'
import {
  addAgendaItem,
  deleteAgendaItem,
  markDiscussed,
  reopenAgendaItem,
  totalMinutes,
  useAgenda,
} from '@data/agenda'

/**
 * Teamoverleg.
 *
 * Wat je hier leest is de samenvatting; de actiepunten eronder zijn gewone
 * taken, dus ze staan ook in Mijn werk van wie ze kreeg. Dat is met opzet: een
 * actiepunt dat alleen in een verslag staat, gebeurt niet.
 */
export default function Meetings() {
  const { uid, isAdmin } = useAuth()
  const { meetings, loading } = useMeetings(uid)
  const { items: agenda } = useAgenda('open')
  const [tab, setTab] = useState('agenda')
  const [open, setOpen] = useState(null)
  const [pasting, setPasting] = useState(false)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Teamoverleg"
        subtitle={
          tab === 'agenda'
            ? `${agenda.length} ${agenda.length === 1 ? 'punt' : 'punten'} · ${totalMinutes(agenda)} min gepland`
            : `${meetings.length} ${meetings.length === 1 ? 'verslag' : 'verslagen'}`
        }
        actions={
          tab === 'verslagen' && isAdmin ? (
            <Button variant="primary" onClick={() => setPasting(true)}>
              Transcript samenvatten
            </Button>
          ) : null
        }
        tabs={
          <>
            <Tab active={tab === 'agenda'} onClick={() => setTab('agenda')}>
              Agenda
              {agenda.length ? (
                <span className="ml-1.5 tabular-nums text-[11px] text-ink-400">{agenda.length}</span>
              ) : null}
            </Tab>
            <Tab active={tab === 'verslagen'} onClick={() => setTab('verslagen')}>
              Verslagen
            </Tab>
          </>
        }
      />

      {tab === 'agenda' ? <Agenda items={agenda} /> : null}

      <div className={tab === 'agenda' ? 'hidden' : 'min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6'}>
        <div className="mx-auto max-w-3xl py-4">
          {meetings.length === 0 ? (
            <EmptyState
              title="Nog geen verslagen"
              description="Zodra er een overleg is samengevat, staat het hier met zijn actiepunten."
            />
          ) : (
            <ul className="space-y-2">
              {meetings.map((meeting) => (
                <li key={meeting.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(meeting)}
                    className="card w-full p-4 text-left transition hover:shadow-cue-md"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-display text-base font-extrabold text-ink-900">
                        {meeting.titel}
                      </span>
                      <span className="text-xs text-ink-500">{formatDate(meeting.datum)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-600">
                      {meeting.samenvatting?.[0]?.tekst ?? ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(meeting.deelnemers ?? []).slice(0, 6).map((naam) => (
                        <Badge key={naam} subtle>
                          {naam}
                        </Badge>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {open ? <MeetingDetail meeting={open} onClose={() => setOpen(null)} /> : null}
      {pasting ? <PasteTranscript onClose={() => setPasting(false)} /> : null}
    </div>
  )
}

/**
 * De agenda: wat er op het volgende overleg moet.
 *
 * Elk punt heeft een eigenaar en een verwachte tijd. Die tijd staat er niet om
 * streng te zijn maar om zichtbaar te maken wanneer de agenda niet meer in een
 * uur past — dat gesprek is makkelijker vooraf dan halverwege.
 */
function Agenda({ items }) {
  const { uid, isAdmin } = useAuth()
  const { profileById } = useWorkspace()
  const { items: besproken } = useAgenda('besproken')
  const toast = useToast()
  const [toonBesproken, setToonBesproken] = useState(false)

  const [titel, setTitel] = useState('')
  const [omschrijving, setOmschrijving] = useState('')
  const [minuten, setMinuten] = useState(10)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!titel.trim()) return
    setBusy(true)
    try {
      await addAgendaItem({ titel, omschrijving, minuten, uid })
      setTitel('')
      setOmschrijving('')
      setMinuten(10)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const totaal = totalMinutes(items)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4 py-4">
        <form onSubmit={submit} className="card space-y-3 p-4">
          <h2 className="label mb-0">Punt toevoegen</h2>
          <Input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Waarover gaat het?"
            aria-label="Onderwerp"
          />
          <Textarea
            rows={2}
            value={omschrijving}
            onChange={(e) => setOmschrijving(e.target.value)}
            placeholder="Wat moet het overleg hierover weten of beslissen?"
            aria-label="Omschrijving"
          />
          <div className="flex flex-wrap items-end gap-3">
            {/* Geen eigenaarskeuze: wie het punt zet, is de eigenaar. */}
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <Avatar profile={profileById[uid]} size="xs" />
              Jij bent de eigenaar
            </span>
            <Field label="Verwachte tijd" className="ml-auto w-32">
              <Select value={minuten} onChange={(e) => setMinuten(Number(e.target.value))}>
                {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="primary" disabled={busy || !titel.trim()}>
              Op de agenda
            </Button>
          </div>
        </form>

        {items.length === 0 ? (
          <EmptyState
            title="De agenda is leeg"
            description="Iedereen kan hier een punt op zetten voor het volgende overleg."
          />
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <h2 className="label mb-0">Volgende overleg</h2>
              <span className={cn('text-xs font-semibold tabular-nums', totaal > 60 ? 'text-amber-700' : 'text-ink-500')}>
                {totaal} min{totaal > 60 ? ' — past niet in een uur' : ''}
              </span>
            </div>

            <ul className="space-y-2">
              {items.map((item) => {
                const owner = item.ownerId ? profileById[item.ownerId] : null
                return (
                  <li key={item.id} className="card p-3.5">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink-900">{item.titel}</span>
                        {item.omschrijving ? (
                          <span className="mt-0.5 block whitespace-pre-wrap text-sm text-ink-600">
                            {item.omschrijving}
                          </span>
                        ) : null}
                      </span>
                      <Badge subtle>{item.minuten || 0} min</Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-ink-600">
                        {owner ? (
                          <>
                            <Avatar profile={owner} size="xs" />
                            {owner.fullName || owner.email}
                          </>
                        ) : (
                          // Punten van voor "wie zet is eigenaar" kunnen er nog
                          // zonder staan.
                          <span className="text-ink-400">Geen eigenaar</span>
                        )}
                      </span>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => markDiscussed(item.id).catch((e) => toast.error(e.message))}
                      >
                        Besproken
                      </Button>
                      {item.ownerId === uid || isAdmin ? (
                        <ConfirmButton
                          variant="ghost"
                          size="sm"
                          question="Dit punt verwijderen?"
                          onConfirm={() => deleteAgendaItem(item.id).catch((e) => toast.error(e.message))}
                        >
                          Verwijderen
                        </ConfirmButton>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {besproken.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setToonBesproken((v) => !v)}
              className="text-xs font-semibold text-ink-500 hover:text-ink-800"
            >
              {toonBesproken ? '▾' : '▸'} Al besproken ({besproken.length})
            </button>
            {toonBesproken ? (
              <ul className="mt-2 space-y-1">
                {besproken.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink-600 line-through">{item.titel}</span>
                    {item.besprokenOp ? (
                      <span className="text-[11px] text-ink-500">{formatDate(item.besprokenOp)}</span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reopenAgendaItem(item.id).catch((e) => toast.error(e.message))}
                    >
                      Terugzetten
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MeetingDetail({ meeting, onClose }) {
  const tasks = useMeetingTasks(meeting.taskId)
  const { profileById } = useWorkspace()

  const [acties, verslag] = useMemo(
    () => [tasks.filter((t) => t.parentId), tasks.find((t) => !t.parentId)],
    [tasks]
  )

  return (
    <Modal open onClose={onClose} title={meeting.titel} width="max-w-2xl">
      <div className="space-y-5 px-5 py-4">
        <p className="text-xs text-ink-500">
          {formatDate(meeting.datum)}
          {verslag ? ` · ${verslag.statusName}` : ''}
        </p>

        <section>
          <h3 className="label">Deelnemers</h3>
          <div className="flex flex-wrap gap-1.5">
            {(meeting.deelnemers ?? []).map((naam) => (
              <Badge key={naam} subtle>
                {naam}
              </Badge>
            ))}
          </div>
        </section>

        <section>
          <h3 className="label">Besproken</h3>
          <ul className="space-y-2.5">
            {(meeting.samenvatting ?? []).map((punt) => (
              <li key={punt.onderwerp}>
                <p className="text-sm font-semibold text-ink-900">{punt.onderwerp}</p>
                <p className="text-sm text-ink-700">{punt.tekst}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="label">Actiepunten ({acties.length})</h3>
          <ul className="space-y-1">
            {acties.map((taak) => {
              const wie = taak.assignees?.[0] ? profileById[taak.assignees[0]] : null
              return (
                <li
                  key={taak.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 px-3 py-2"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: taak.statusColor ?? '#8593a9' }}
                  />
                  <span className="min-w-0 flex-1 text-sm text-ink-800">{taak.title}</span>
                  {wie ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-600">
                      <Avatar profile={wie} size="xs" />
                      {wie.fullName || wie.email}
                    </span>
                  ) : (
                    <Badge color="#f59e0b" subtle>
                      {taak.voorgesteldeVerantwoordelijke
                        ? `${taak.voorgesteldeVerantwoordelijke}?`
                        : 'niemand'}
                    </Badge>
                  )}
                </li>
              )
            })}
            {acties.length === 0 ? (
              <li className="px-1 py-2 text-sm text-ink-500">Geen actiepunten uit dit overleg.</li>
            ) : null}
          </ul>
          <p className="mt-2 text-[11px] text-ink-500">
            Actiepunten zijn gewone taken: wie er een kreeg, ziet hem ook in Mijn werk.
          </p>
        </section>

        {meeting.bron ? (
          <p className="text-xs text-ink-500">
            Bron:{' '}
            <a href={meeting.bron} target="_blank" rel="noreferrer" className="underline">
              de opname
            </a>
          </p>
        ) : null}

        <p className="rounded-xl bg-ink-50 px-3 py-2 text-[11px] text-ink-600">
          Samengevat door AI. Lees na voor je erop voortgaat — wat er niet in stond, staat er ook
          niet in.
        </p>
      </div>
    </Modal>
  )
}

function PasteTranscript({ onClose }) {
  const toast = useToast()
  const [transcript, setTranscript] = useState('')
  // dayKey rekent lokaal; toISOString gaf tussen middernacht en twee uur
  // 's nachts de dag ervoor.
  const [datum, setDatum] = useState(() => dayKey(new Date()))
  const [bron, setBron] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const r = await summariseMeeting({ transcript, datum, bron: bron || null })
      toast.success(
        `Verslag toegevoegd met ${r.actiepunten} actiepunt(en), waarvan ${r.toegewezen} toegewezen.`
      )
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Transcript samenvatten"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="primary" disabled={busy || transcript.trim().length < 200} onClick={submit}>
            {busy ? 'Bezig…' : 'Samenvatten'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Datum van het overleg</span>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Link naar de opname</span>
            <input
              type="url"
              value={bron}
              onChange={(e) => setBron(e.target.value)}
              placeholder="https://…"
              className="field"
            />
          </label>
        </div>

        <label className="block">
          <span className="label">Transcript</span>
          <Textarea
            rows={12}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Plak hier het transcript van de Meet-opname…"
          />
        </label>

        {busy ? (
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Spinner className="h-3 w-3" /> Het model leest het transcript. Dit duurt een halve
            minuut tot enkele minuten.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
