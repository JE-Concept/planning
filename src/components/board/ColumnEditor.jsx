import { useState } from 'react'
import { Button, ConfirmButton, Input, Modal, Select, Spinner } from '@ui/index'
import { useToast } from '@context/ToastProvider'
import { saveStatuses } from '@data/workspace'

const KINDS = [
  { key: 'open', label: 'Nieuw' },
  { key: 'active', label: 'Bezig' },
  { key: 'done', label: 'Afgerond' },
  { key: 'closed', label: 'Gesloten' },
]

const PALETTE = ['#8593a9', '#3377ff', '#7c3aed', '#b660e0', '#1090e0', '#f59e0b', '#3db88b', '#008844', '#dc2626']

/**
 * Board columns, edited as one list.
 *
 * `kind` is the part that matters beyond colour: it tells the rest of the app
 * which columns count as finished, which drives the open/closed filters, the
 * completion date, and the task-count key results.
 */
export default function ColumnEditor({ list, statuses, onClose }) {
  const toast = useToast()
  const [rows, setRows] = useState(statuses.map((s) => ({ ...s })))
  const [saving, setSaving] = useState(false)

  const update = (id, patch) =>
    setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const move = (index, delta) =>
    setRows((all) => {
      const next = [...all]
      const to = index + delta
      if (to < 0 || to >= next.length) return all
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })

  const add = () =>
    setRows((all) => [
      ...all,
      { id: crypto.randomUUID(), name: '', color: PALETTE[all.length % PALETTE.length], kind: 'active' },
    ])

  const save = async () => {
    const named = rows.filter((r) => r.name.trim())
    if (named.length === 0) {
      toast.error('Een bord heeft minstens één kolom nodig.')
      return
    }

    setSaving(true)
    try {
      await saveStatuses(list.id, named.map((r) => ({ ...r, name: r.name.trim() })))
      toast.success('Kolommen bijgewerkt.')
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
      title={`Kolommen van ${list.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? <Spinner className="h-3 w-3" /> : null} Opslaan
          </Button>
        </>
      }
    >
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Omhoog"
                className="px-1 text-xs text-ink-400 hover:text-ink-700 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label="Omlaag"
                className="px-1 text-xs text-ink-400 hover:text-ink-700 disabled:opacity-30"
              >
                ▼
              </button>
            </div>

            <input
              type="color"
              value={row.color}
              onChange={(e) => update(row.id, { color: e.target.value })}
              aria-label={`Kleur van ${row.name || 'kolom'}`}
              className="h-8 w-8 cursor-pointer rounded border border-ink-200 bg-white p-0.5"
            />

            <Input
              value={row.name}
              onChange={(e) => update(row.id, { name: e.target.value })}
              placeholder="Kolomnaam"
              aria-label="Kolomnaam"
            />

            <Select
              value={row.kind}
              onChange={(e) => update(row.id, { kind: e.target.value })}
              className="w-32"
              aria-label="Soort"
            >
              {KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </Select>

            <ConfirmButton
              variant="ghost"
              size="sm"
              className="text-ink-400"
              question="Kolom verwijderen? Taken erin verliezen hun status."
              onConfirm={() => setRows((all) => all.filter((r) => r.id !== row.id))}
              aria-label="Kolom verwijderen"
            >
              ✕
            </ConfirmButton>
          </li>
        ))}
      </ul>

      <Button variant="secondary" size="sm" className="mt-3" onClick={add}>
        + Kolom toevoegen
      </Button>

      <p className="mt-4 text-xs text-ink-500">
        <strong>Afgerond</strong> en <strong>Gesloten</strong> tellen als klaar: taken in zo’n
        kolom krijgen een afwerkdatum, vallen weg uit “enkel open” en tellen mee voor goals.
      </p>
    </Modal>
  )
}
