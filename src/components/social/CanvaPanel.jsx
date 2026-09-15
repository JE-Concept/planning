import { useState } from 'react'
import { Button, Field, Input, Select, Spinner } from '@ui/index'
import { useToast } from '@context/ToastProvider'
import {
  CANVA_PRESETS,
  connectCanva,
  createDesign,
  exportDesign,
  linkDesign,
  refreshDesign,
  useCanvaStatus,
} from '@data/canva'

/**
 * The Canva half of a post.
 *
 * Three ways in, because that is how the work actually arrives: start a fresh
 * design in the right format, start from one of the brand templates, or link a
 * design somebody already made. After that the panel only mirrors Canva — the
 * editing itself happens there.
 */
export default function CanvaPanel({ post }) {
  const canva = useCanvaStatus()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [preset, setPreset] = useState(CANVA_PRESETS[0].key)
  const [templateId, setTemplateId] = useState('')
  const [url, setUrl] = useState('')

  const run = async (label, fn) => {
    setBusy(true)
    try {
      await fn()
      if (label) toast.success(label)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (canva.loading) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-ink-50 px-3 py-4 text-sm text-ink-500">
        <Spinner /> Canva controleren…
      </div>
    )
  }

  if (!canva.connected) {
    return (
      <div className="rounded-md border border-dashed border-ink-300 px-3 py-4">
        <p className="text-sm text-ink-700">
          Koppel je Canva-account om ontwerpen rechtstreeks vanuit de kalender te maken en te
          openen.
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-2"
          onClick={() => run(null, () => connectCanva(window.location.pathname))}
        >
          Canva koppelen
        </Button>
        {canva.error ? <p className="mt-2 text-xs text-red-600">{canva.error}</p> : null}
      </div>
    )
  }

  if (post.canvaDesignId) {
    return (
      <div className="space-y-2">
        {post.canvaThumbnailUrl ? (
          <img
            src={post.canvaThumbnailUrl}
            alt={`Voorbeeld van ${post.title}`}
            className="max-h-56 w-full rounded-md border border-ink-200 bg-ink-50 object-contain"
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <a href={post.canvaEditUrl} target="_blank" rel="noreferrer">
            <Button variant="primary" size="sm">
              In Canva openen
            </Button>
          </a>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => run('Voorbeeld bijgewerkt.', () => refreshDesign(post.id))}
          >
            Voorbeeld verversen
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(null, async () => {
                const { urls } = await exportDesign(post.id, 'png')
                urls?.forEach((link) => window.open(link, '_blank', 'noreferrer'))
              })
            }
          >
            Exporteren (PNG)
          </Button>
        </div>

        <p className="text-xs text-ink-400">Ontwerp {post.canvaDesignId}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md bg-ink-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Nieuw ontwerp" className="flex-1">
          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {CANVA_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant="primary"
          size="md"
          disabled={busy}
          onClick={() =>
            run('Ontwerp aangemaakt.', () =>
              createDesign({ postId: post.id, preset, title: post.title })
            )
          }
        >
          Maken
        </Button>
      </div>

      {canva.brandTemplates?.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Uit merksjabloon" className="flex-1">
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Kies een sjabloon…</option>
              {canva.brandTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            variant="secondary"
            disabled={busy || !templateId}
            onClick={() =>
              run('Ontwerp aangemaakt.', () =>
                createDesign({ postId: post.id, brandTemplateId: templateId, title: post.title })
              )
            }
          >
            Maken
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Bestaand ontwerp koppelen" className="flex-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.canva.com/design/DA…/edit"
          />
        </Field>
        <Button
          variant="secondary"
          disabled={busy || !url}
          onClick={() => run('Ontwerp gekoppeld.', () => linkDesign({ postId: post.id, url }))}
        >
          Koppelen
        </Button>
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-xs text-ink-500">
          <Spinner className="h-3 w-3" /> Bezig met Canva…
        </p>
      ) : null}
    </div>
  )
}
