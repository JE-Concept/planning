import { useCallback, useEffect, useState } from 'react'
import { cn } from '@lib/cn'
import { fromLocalInput, toLocalInput } from '@lib/dates'
import { Button, Field, Input, Modal, Select, Spinner } from '@ui/index'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { browseDesigns, connectCanva, importDesigns, listCanvaFolders, useCanvaStatus } from '@data/canva'

/**
 * Canva as the source of the calendar.
 *
 * The designs are made in Canva — that is where the team already works — so the
 * calendar is filled by picking them up rather than by typing them in again. A
 * design that is already on the calendar is shown as such instead of being
 * offered a second time, which is what the deterministic post id buys us.
 */
export default function CanvaImportModal({ open, onClose, defaultBrandId, defaultDate, onImported }) {
  const canva = useCanvaStatus()
  const { brands } = useWorkspace()
  const toast = useToast()

  const [folders, setFolders] = useState([])
  const [folderId, setFolderId] = useState('')
  const [term, setTerm] = useState('')
  const [items, setItems] = useState([])
  const [continuation, setContinuation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState([])
  const [brandId, setBrandId] = useState(defaultBrandId ?? '')
  const [when, setWhen] = useState(() => toLocalInput(defaultDate ?? null))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setBrandId((current) => current || defaultBrandId || brands[0]?.id || '')
  }, [defaultBrandId, brands])

  const load = useCallback(
    async ({ append = false, cursor = '' } = {}) => {
      setLoading(true)
      try {
        const data = await browseDesigns({ query: term, folderId, continuation: cursor })
        setItems((previous) => (append ? [...previous, ...(data.items ?? [])] : (data.items ?? [])))
        setContinuation(data.continuation ?? null)
      } catch (err) {
        toast.error(err.message)
      } finally {
        setLoading(false)
      }
    },
    [term, folderId, toast]
  )

  useEffect(() => {
    if (!open || !canva.connected) return
    load()
    listCanvaFolders()
      .then((data) => setFolders(data.items ?? []))
      .catch(() => setFolders([]))
    // Searching is explicit; this only runs when the modal opens or the folder
    // changes, so typing does not fire a Canva call per keystroke.
  }, [open, canva.connected, folderId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submit = async () => {
    if (picked.length === 0 || !brandId) return
    setBusy(true)
    try {
      const result = await importDesigns({
        designIds: picked,
        brandId,
        scheduledAt: when ? fromLocalInput(when) : null,
      })
      toast.success(
        result.created === 0
          ? 'Alles stond er al; de voorbeelden zijn bijgewerkt.'
          : `${result.created} ontwerp${result.created === 1 ? '' : 'en'} op de kalender gezet.`
      )
      setPicked([])
      onImported?.(result)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Uit Canva ophalen"
      width="max-w-3xl"
      footer={
        <>
          <span className="mr-auto text-xs text-ink-500">
            {picked.length > 0 ? `${picked.length} geselecteerd` : 'Kies één of meer ontwerpen'}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            variant="primary"
            disabled={busy || picked.length === 0 || !brandId}
            onClick={submit}
          >
            {busy ? 'Bezig…' : 'Op de kalender zetten'}
          </Button>
        </>
      }
    >
      {!canva.connected ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-ink-700">
            Koppel eerst je Canva-account; daarna staan alle ontwerpen hier.
          </p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => connectCanva('/social')}>
            Canva koppelen
          </Button>
        </div>
      ) : (
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Map in Canva">
              <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                <option value="">Alle ontwerpen</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Merk">
              <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">Kies een merk…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Inplannen op" hint="Leeg = naar 'nog in te plannen'">
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              load()
            }}
          >
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Zoeken op titel…"
              aria-label="Zoeken in Canva"
            />
            <Button type="submit" variant="secondary" disabled={loading}>
              Zoeken
            </Button>
          </form>

          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-500">
              Geen ontwerpen gevonden in Canva.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {items.map((design) => {
                const already = Boolean(design.postId)
                const on = picked.includes(design.id)

                return (
                  <li key={design.id}>
                    <button
                      type="button"
                      disabled={already}
                      aria-pressed={on}
                      onClick={() => toggle(design.id)}
                      title={already ? 'Staat al op de kalender' : design.title}
                      className={cn(
                        'w-full overflow-hidden rounded-xl border text-left transition',
                        already
                          ? 'cursor-not-allowed border-ink-200 opacity-50'
                          : on
                            ? 'border-accent-500 ring-2 ring-accent-300'
                            : 'border-ink-200 hover:border-accent-300'
                      )}
                    >
                      {design.thumbnailUrl ? (
                        <img
                          src={design.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="h-28 w-full bg-ink-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-28 items-center justify-center bg-ink-100 text-xs text-ink-400">
                          geen voorbeeld
                        </div>
                      )}
                      <span className="block truncate px-2 py-1.5 text-[11px] font-medium text-ink-800">
                        {design.title}
                      </span>
                      {already ? (
                        <span className="block px-2 pb-1.5 text-[10px] text-ink-500">
                          staat al op de kalender
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {continuation ? (
            <div className="text-center">
              <Button
                variant="secondary"
                size="sm"
                disabled={loading}
                onClick={() => load({ append: true, cursor: continuation })}
              >
                Meer laden
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
