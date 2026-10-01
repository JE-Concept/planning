import { formatDate } from '@lib/dates'
import { Badge, Icon } from '@components/ds'
import { EmptyState, Spinner } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useMijnEvents } from '@data/social-events'
import { eindeVan } from '@lib/eventdagen'
import { eventDagCijfer } from '@components/events/parts'

/**
 * Wat een medewerker van de planning ziet: de events waarop hij staat.
 *
 * ── Waarom dit niet dezelfde eventpagina is ───────────────────────────────
 * Omdat het niet dezelfde gegevens zijn. Op een event staan het offertebedrag,
 * het budget en de kostprijs per persoon, en Firestore kan geen velden
 * verbergen: wie een document mag lezen, leest het hele document — ook wat het
 * scherm niet toont. "Hij ziet geen prijzen" is dus alleen waar als hij het
 * event helemaal niet mag lezen.
 *
 * Daarom leest dit scherm de kale kopie uit `socialEvents`, waar geen enkel
 * bedrag in staat, en laten de regels hem daar alleen de rijen uit zien waar
 * hij zelf in `medewerkers` staat. Zie `functions/social-projectie.js`.
 *
 * ── Wat er dan wél op staat ───────────────────────────────────────────────
 * Wanneer, waar, voor wie en met hoeveel. Dat is wat je moet weten om te
 * komen werken, en verder niets.
 */
export default function MijnEvents() {
  const { t } = useTaal()
  const { uid } = useAuth()
  const { events, loading } = useMijnEvents(uid)

  // Wat geweest is zakt naar onderen; wie zaterdag werkt wil zaterdag zien.
  const vandaag = new Date().setHours(0, 0, 0, 0)
  // Op de laatste dag: een event dat nog loopt, is niet geweest.
  const loopt = (e) => new Date(eindeVan(e)).getTime() >= vandaag
  const komt = events.filter((e) => !e.eventDate || loopt(e))
  const geweest = events.filter((e) => e.eventDate && !loopt(e)).reverse()

  const kaart = (e) => (
    <article key={e.id} className="je-mijnevent">
      <div className="je-mijnevent__datum">
        {e.eventDate ? (
          <>
            <span className="je-mijnevent__dag">{eventDagCijfer(e)}</span>
            <span className="je-caps">{formatDate(e.eventDate, { month: 'short' })}</span>
          </>
        ) : (
          <span className="je-caps">{t('mijnevents.geen_datum')}</span>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: 'var(--type-h4)' }}>{e.title}</div>
        <div className="je-mijnevent__regels">
          {e.location ? (
            <span>
              <Icon name="map-pin" size={13} /> {e.location}
            </span>
          ) : null}
          {e.customerName ? (
            <span>
              <Icon name="building" size={13} /> {e.customerName}
            </span>
          ) : null}
          {e.pax ? (
            <span>
              <Icon name="users" size={13} /> {t('mijnevents.gasten', { aantal: e.pax })}
            </span>
          ) : null}
        </div>
      </div>
      {e.statusName ? <Badge tone="neutral">{e.statusName}</Badge> : null}
    </article>
  )

  return (
    <div>
      <PageHeader eyebrow={t('mijnevents.eyebrow')} title={t('mijnevents.titel')} subtitle={t('mijnevents.uitleg')} />

      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <Spinner />
          </div>
        ) : events.length === 0 ? (
          <EmptyState title={t('mijnevents.leeg')} description={t('mijnevents.leeg_uitleg')} />
        ) : (
          <>
            <section className="je-panel">
              <div className="je-panel__head">
                <span className="je-eyebrow">{t('mijnevents.komt')}</span>
                <span className="je-panel__right">{komt.length}</span>
              </div>
              {komt.length === 0 ? (
                <p style={{ padding: 'var(--space-6)' }} className="je-muted-caption">
                  {t('mijnevents.niets_komt')}
                </p>
              ) : (
                komt.map(kaart)
              )}
            </section>

            {geweest.length > 0 ? (
              <section className="je-panel">
                <div className="je-panel__head">
                  <span className="je-eyebrow">{t('mijnevents.geweest')}</span>
                  <span className="je-panel__right">{geweest.length}</span>
                </div>
                {geweest.slice(0, 10).map(kaart)}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
