import { useMemo, useState } from 'react'
import { formatDate } from '@lib/dates'
import { Avatar, Badge, Button, EmptyState, Modal, Spinner, Textarea } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { summariseMeeting, useMeetingTasks, useMeetings } from '@data/meetings'

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
        subtitle={`${meetings.length} ${meetings.length === 1 ? 'verslag' : 'verslagen'}`}
        actions={
          isAdmin ? (
            <Button variant="primary" onClick={() => setPasting(true)}>
              Transcript samenvatten
            </Button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
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
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10))
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
