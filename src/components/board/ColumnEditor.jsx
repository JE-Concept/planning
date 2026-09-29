import { useMemo, useState } from 'react'
import { Badge, Button, Input, Modal, Select, Spinner } from '@ui/index'
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
 * De kolommen van een bord, in één lijst bewerkt.
 *
 * `kind` is het deel dat verder reikt dan een kleur: het zegt de rest van de
 * app welke kolommen als klaar tellen, en dat stuurt de open/dicht-filters, de
 * afwerkdatum en de taaktellers van goals.
 *
 * Een kolom weghalen was hier de gevaarlijke knop. De taken erin verwezen naar
 * een status die niet meer bestond en verdwenen daarmee van het bord — ze
 * stonden er nog, maar nergens zichtbaar. Nu vraagt het scherm eerst waar die
 * taken heen moeten, en verhuizen ze mee in dezelfde bewerking.
 */
export default function ColumnEditor({ list, statuses, counts = {}, onClose }) {
  const toast = useToast()
  const [rows, setRows] = useState(statuses.map((s) => ({ ...s })))
  const [verhuizingen, setVerhuizingen] = useState({})
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

  /** Kolommen die weg zouden gaan en nog taken hebben staan. */
  const weg = useMemo(
    () =>
      statuses
        .filter((s) => !rows.some((r) => r.id === s.id))
        .map((s) => ({ ...s, aantal: counts[s.id] ?? 0 })),
    [statuses, rows, counts]
  )

  const onbestemd = weg.filter((s) => s.aantal > 0 && !verhuizingen[s.id])

  const save = async () => {
    const named = rows.filter((r) => r.name.trim())
    if (named.length === 0) {
      toast.error('Een bord heeft minstens één kolom nodig.')
      return
    }
    if (onbestemd.length > 0) {
      toast.error('Kies eerst waar de taken van de verwijderde kolommen heen gaan.')
      return
    }

    setSaving(true)
    try {
      await saveStatuses(
        list.id,
        named.map((r) => ({ ...r, name: r.name.trim() })),
        { moves: verhuizingen }
      )
      const verhuisd = weg.reduce((n, s) => n + (verhuizingen[s.id] ? s.aantal : 0), 0)
      toast.success(
        verhuisd ? `Kolommen bijgewerkt, ${verhuisd} taken verhuisd.` : 'Kolommen bijgewerkt.'
      )
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
          <Button variant="primary" onClick={save} disabled={saving || onbestemd.length > 0}>
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

            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-400">
              {counts[row.id] ? `${counts[row.id]} taken` : ''}
            </span>

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

            <Button
              variant="ghost"
              size="sm"
              className="text-ink-400"
              onClick={() => setRows((all) => all.filter((r) => r.id !== row.id))}
              aria-label={`Kolom ${row.name || ''} verwijderen`}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="secondary" size="sm" className="mt-3" onClick={add}>
        + Kolom toevoegen
      </Button>

      {weg.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Kolommen die verdwijnen
          </h3>
          <ul className="mt-2 space-y-2">
            {weg.map((status) => (
              <li key={status.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge color={status.color} subtle>
                  {status.name}
                </Badge>
                {status.aantal > 0 ? (
                  <>
                    <span className="text-ink-700">
                      {status.aantal} {status.aantal === 1 ? 'taak' : 'taken'} naar
                    </span>
                    <Select
                      value={verhuizingen[status.id] ?? ''}
                      onChange={(e) =>
                        setVerhuizingen((v) => ({ ...v, [status.id]: e.target.value }))
                      }
                      className="h-8 max-w-[14rem] text-sm"
                      aria-label={`Taken van ${status.name} verplaatsen naar`}
                    >
                      <option value="">Kies een kolom…</option>
                      {rows
                        .filter((r) => r.name.trim())
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </Select>
                  </>
                ) : (
                  <span className="text-ink-500">leeg — verdwijnt zonder gevolgen</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setRows((all) => [...all, { ...status }])
                    setVerhuizingen(({ [status.id]: _, ...rest }) => rest)
                  }}
                >
                  Toch houden
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-ink-500">
        <strong>Afgerond</strong> en <strong>Gesloten</strong> tellen als klaar: taken in zo’n
        kolom krijgen een afwerkdatum, vallen weg uit “enkel open” en tellen mee voor goals.
      </p>
    </Modal>
  )
}
