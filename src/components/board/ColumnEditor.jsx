import { useMemo, useState } from 'react'
import { Acties, Badge, Button, Dialog, Input, Select } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { saveStatuses } from '@data/workspace'
import { PALET } from '@lib/kleur'

// `kind` staat in de database; de naam ervan hoort bij de taal.
const KINDS = [
  { key: 'open', sleutel: 'bord.soort.open' },
  { key: 'active', sleutel: 'bord.soort.active' },
  { key: 'done', sleutel: 'bord.soort.done' },
  { key: 'closed', sleutel: 'bord.soort.closed' },
]

/*
  Het palet staat in `@lib/kleur`, samen met de berekening die bewijst dat elke
  kleur erin leesbaar is. Wat hier stond kwam uit ClickUp, had geen enkele
  kleur uit de huisstijl, en vijf van de negen waren als kolomnaam niet te
  lezen. Kolommen die al een oude kleur dragen, houden die — de badge toont ze
  nu wel leesbaar.
*/

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
  const { t } = useTaal()
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
      { id: crypto.randomUUID(), name: '', color: PALET[all.length % PALET.length], kind: 'active' },
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
      toast.error(t('bord.kolom_nodig'))
      return
    }
    if (onbestemd.length > 0) {
      toast.error(t('bord.kies_bestemming'))
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
        verhuisd
          ? t('bord.kolommen_bijgewerkt_verhuisd', { aantal: verhuisd })
          : t('bord.kolommen_bijgewerkt')
      )
      onClose()
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width={672}
      title={t('bord.kolommen_van', { lijst: list.name })}
      footer={
        <Acties
          terug={{ onClick: onClose }}
          hoofd={{ label: t('bord.opslaan'), onClick: save, bezig: saving, uit: onbestemd.length > 0 }}
        />
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
                aria-label={t('bord.omhoog')}
                className="px-1 text-xs text-ink-400 hover:text-ink-700 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label={t('bord.omlaag')}
                className="px-1 text-xs text-ink-400 hover:text-ink-700 disabled:opacity-30"
              >
                ▼
              </button>
            </div>

            <input
              type="color"
              value={row.color}
              onChange={(e) => update(row.id, { color: e.target.value })}
              aria-label={t('bord.kleur_van', { kolom: row.name || t('bord.kolom') })}
              className="h-8 w-8 cursor-pointer rounded border border-ink-200 bg-white p-0.5"
            />

            <Input
              value={row.name}
              onChange={(e) => update(row.id, { name: e.target.value })}
              placeholder={t('bord.kolomnaam')}
              aria-label={t('bord.kolomnaam')}
            />

            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-400">
              {counts[row.id] ? t('alg.taak', { aantal: counts[row.id] }) : ''}
            </span>

            <Select
              value={row.kind}
              onChange={(e) => update(row.id, { kind: e.target.value })}
              className="w-32"
              aria-label={t('bord.soort')}
            >
              {KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {t(k.sleutel)}
                </option>
              ))}
            </Select>

            <Button
              variant="ghost"
              size="sm"
              className="text-ink-400"
              onClick={() => setRows((all) => all.filter((r) => r.id !== row.id))}
              aria-label={t('bord.kolom_verwijderen', { kolom: row.name || '' })}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="secondary" size="sm" className="mt-3" onClick={add}>
        {t('bord.kolom_toevoegen')}
      </Button>

      {weg.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            {t('bord.kolommen_verdwijnen')}
          </h3>
          <ul className="mt-2 space-y-2">
            {weg.map((status) => (
              <li key={status.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge color={status.color} subtle>
                  {status.name}
                </Badge>
                {status.aantal > 0 ? (
                  <>
                    <span className="text-ink-700">{t('bord.taken_naar', { aantal: status.aantal })}</span>
                    <Select
                      value={verhuizingen[status.id] ?? ''}
                      onChange={(e) =>
                        setVerhuizingen((v) => ({ ...v, [status.id]: e.target.value }))
                      }
                      className="h-8 max-w-[14rem] text-sm"
                      aria-label={t('bord.taken_verplaatsen_naar', { kolom: status.name })}
                    >
                      <option value="">{t('bord.kies_kolom')}</option>
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
                  <span className="text-ink-500">{t('bord.kolom_leeg')}</span>
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
                  {t('bord.toch_houden')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* De namen van de twee soorten staan in de zin zelf: ze komen uit dezelfde
          lijst als de keuzelijst erboven, en wie ze daar verandert, verandert ze hier mee. */}
      <p className="mt-4 text-xs text-ink-500">
        {t('bord.klaar_uitleg', {
          afgerond: t('bord.soort.done'),
          gesloten: t('bord.soort.closed'),
        })}
      </p>
    </Dialog>
  )
}
