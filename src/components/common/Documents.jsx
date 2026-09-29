import { useRef, useState } from 'react'
import { Button, Spinner } from '@ui/index'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import {
  deleteDocument,
  isAfbeelding,
  leesbareGrootte,
  uploadDocument,
  useDocuments,
} from '@data/documents'

/**
 * De documenten van een klant of van een event.
 *
 * Eén component voor allebei, want het is hetzelfde lijstje met een andere
 * eigenaar. Afbeeldingen krijgen een miniatuur — een logo herken je sneller
 * aan het beeld dan aan "logo-def-v3-final.png".
 */
export default function Documents({ customerId = null, taskId = null, titel = null }) {
  const { documents, loading } = useDocuments({ customerId, taskId })
  const { t } = useTaal()
  const toast = useToast()
  const invoer = useRef(null)
  const [bezig, setBezig] = useState(false)

  const kies = async (e) => {
    const bestanden = [...(e.target.files ?? [])]
    e.target.value = ''
    if (bestanden.length === 0) return

    setBezig(true)
    try {
      // Eén voor één: bij een mislukking weet je welk bestand het was, en de
      // regels van de opslag kijken sowieso per bestand.
      for (const file of bestanden) {
        await uploadDocument({ file, customerId, taskId })
      }
      toast.success(t('events.doc.toegevoegd', { aantal: bestanden.length }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <h3 className="label mb-0">
          {titel ?? t('events.doc.titel')} ({documents.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={bezig}
          onClick={() => invoer.current?.click()}
        >
          {bezig ? t('events.doc.bezig') : t('events.doc.toevoegen')}
        </Button>
        <input ref={invoer} type="file" multiple hidden onChange={kies} aria-label={t('events.doc.kiezen')} />
      </div>

      {loading ? (
        <div className="py-3">
          <Spinner />
        </div>
      ) : documents.length === 0 ? (
        <p className="mt-1 text-sm text-ink-500">{t('events.doc.leeg')}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center gap-2.5 rounded-lg border border-ink-200 px-2.5 py-2"
            >
              {isAfbeelding(document) ? (
                <img
                  src={document.url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <span aria-hidden="true" className="w-9 shrink-0 text-center text-lg text-ink-400">
                  ▤
                </span>
              )}

              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800 hover:underline"
              >
                {document.name}
              </a>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-400">
                {leesbareGrootte(document.size)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-ink-400"
                onClick={() => {
                  if (window.confirm(t('events.doc.weg_vraag', { naam: document.name }))) {
                    deleteDocument(document).catch((err) => toast.error(err.message))
                  }
                }}
              >
                {t('events.doc.weg')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
