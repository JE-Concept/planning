import { useRef, useState } from 'react'
import { bevestig, Button, Icon, Spinner } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import {
  deleteDocument,
  driveMap,
  isAfbeelding,
  leesbareGrootte,
  syncDocuments,
  uploadDocument,
  useDocuments,
  useDriveConfig,
} from '@data/documents'

/**
 * De documenten van een klant of van een event — de map in Drive, in de app.
 *
 * Eén component voor allebei, want het is hetzelfde lijstje met een andere
 * eigenaar. Elk bestand is te openen in Drive; wat Drive kan voorvertonen
 * (pdf, afbeelding, Office, Google-document), opent hier in een venster
 * zonder de tool te verlaten.
 *
 * ── Waarom er een knop "Vernieuwen" is ────────────────────────────────────
 * Omdat de map ook buiten de app om gevuld wordt: iemand sleept een grondplan
 * in Drive. De app ziet dat niet vanzelf — Drive stuurt geen berichtje — dus
 * haalt deze knop de lijst opnieuw op. Niet bij elke weergave automatisch:
 * dat is een Drive-aanroep per blik, en het blok staat op elke eventfiche.
 */
export default function Documents({ customerId = null, taskId = null, titel = null }) {
  const { documents, loading } = useDocuments({ customerId, taskId })
  const config = useDriveConfig()
  const { t } = useTaal()
  const toast = useToast()
  const invoer = useRef(null)
  const [bezig, setBezig] = useState(false)
  const [open, setOpen] = useState(null)

  const eigenaar = { customerId, taskId }
  const ingericht = config === null || Boolean(config.driveId) || import.meta.env.MODE === 'demo'

  const kies = async (e) => {
    const bestanden = [...(e.target.files ?? [])]
    e.target.value = ''
    if (bestanden.length === 0) return
    setBezig(true)
    try {
      // Eén voor één: bij een mislukking weet je welk bestand het was.
      for (const file of bestanden) await uploadDocument({ file, ...eigenaar })
      toast.success(t('events.doc.toegevoegd', { aantal: bestanden.length }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const vernieuw = async () => {
    setBezig(true)
    try {
      const uit = await syncDocuments(eigenaar)
      toast.success(t('events.doc.vernieuwd', { aantal: uit.aantal ?? documents.length }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const naarMap = async () => {
    try {
      const map = await driveMap(eigenaar)
      if (map.webViewLink) window.open(map.webViewLink, '_blank', 'noopener')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="label mb-0">
          {titel ?? t('events.doc.titel')} ({documents.length})
        </h3>
        <span className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={bezig || !ingericht} onClick={vernieuw} title={t('events.doc.vernieuwen_uitleg')}>
            {t('events.doc.vernieuwen')}
          </Button>
          <Button variant="ghost" size="sm" disabled={!ingericht} onClick={naarMap}>
            {t('events.doc.map')}
          </Button>
          <Button variant="ghost" size="sm" disabled={bezig || !ingericht} onClick={() => invoer.current?.click()}>
            {bezig ? t('events.doc.bezig') : t('events.doc.toevoegen')}
          </Button>
        </span>
        <input ref={invoer} type="file" multiple hidden onChange={kies} aria-label={t('events.doc.kiezen')} />
      </div>

      {!ingericht ? (
        <p className="mt-1 text-sm text-ink-500">{t('events.doc.geen_drive')}</p>
      ) : loading ? (
        <div className="py-3">
          <Spinner />
        </div>
      ) : documents.length === 0 ? (
        <p className="mt-1 text-sm text-ink-500">{t('events.doc.leeg')}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-2.5 rounded-lg border border-ink-200 px-2.5 py-2">
              {document.thumbnailLink || (isAfbeelding(document) && document.url !== '#') ? (
                <img src={document.thumbnailLink ?? document.url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" loading="lazy" referrerPolicy="no-referrer" />
              ) : document.iconLink ? (
                <img src={document.iconLink} alt="" className="h-9 w-9 shrink-0 rounded object-contain p-2" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <span aria-hidden="true" className="w-9 shrink-0 text-center text-lg text-ink-400">▤</span>
              )}

              {/*
                De naam opent de voorvertoning wanneer Drive er een heeft;
                anders gaat ze meteen naar Drive. Een bezoeker hoeft niet te
                weten welk van de twee het wordt.
              */}
              {document.voorvertoning ? (
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink-800 hover:underline" onClick={() => setOpen(document)}>
                  {document.name}
                </button>
              ) : (
                <a href={document.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800 hover:underline">
                  {document.name}
                </a>
              )}
              <span className="shrink-0 text-[11px] tabular-nums text-ink-400">{leesbareGrootte(document.size)}</span>
              <a href={document.url} target="_blank" rel="noreferrer" className="shrink-0 text-ink-400 hover:text-ink-800" title={t('events.doc.in_drive')} aria-label={t('events.doc.in_drive')}>
                <Icon name="external-link" size={14} />
              </a>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-ink-400"
                onClick={() => {
                  if (bevestig(t('events.doc.weg_vraag', { naam: document.name }))) {
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

      {open ? (
        <div className="je-voorvertoning" role="dialog" aria-label={open.name} onClick={() => setOpen(null)}>
          <div className="je-voorvertoning__kader" onClick={(e) => e.stopPropagation()}>
            <div className="je-voorvertoning__kop">
              <span className="je-voorvertoning__naam">{open.name}</span>
              <a href={open.url} target="_blank" rel="noreferrer" className="je-btn je-btn--ghost je-btn--sm">
                {t('events.doc.in_drive')}
              </a>
              <Button variant="ghost" size="sm" onClick={() => setOpen(null)} aria-label={t('alg.sluiten')}>
                <Icon name="x" size={16} />
              </Button>
            </div>
            <iframe title={open.name} src={open.voorvertoning} className="je-voorvertoning__venster" allow="autoplay" />
          </div>
        </div>
      ) : null}
    </section>
  )
}
