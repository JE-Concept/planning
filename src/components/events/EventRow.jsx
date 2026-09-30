import { memo } from 'react'
import { Bar, Icon } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { PlanningBadge, StatusBadge, TeamHexes, monthShort, paxLabel } from './parts'

/**
 * Eén event in de lijst.
 *
 * Staat apart en is gememoriseerd omdat dit de rij is die het vaakst in aantal
 * voorkomt: een filter aantikken, een zoekterm typen of een kolom verslepen
 * hertekent anders elke rij van het scherm opnieuw. Nu hertekent alleen wat
 * echt verandert — en met honderden events is dat het verschil tussen soepel
 * en schokkerig.
 *
 * De prijs is dat de eigenschappen stabiel moeten blijven: `onOpen` komt uit
 * een useCallback, en de afgeleide waarden (voortgang, regels tekst) worden
 * hier berekend in plaats van in de pagina.
 */
function EventRow({ event, progress, statuses, profileById, columns, narrow, first, onOpen }) {
  const { t } = useTaal()
  const meta = [
    event.customerName || t('events.klant_onbekend'),
    event.concept?.split(' — ')[0] ?? t('events.los_event'),
    event.eventType,
  ]
    .filter(Boolean)
    .join(' · ')

  const datum = event.eventDate ? new Date(event.eventDate) : null

  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      className="je-plainbtn je-hover-quiet"
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: columns,
        alignItems: 'center',
        gap: 'var(--space-5)',
        padding: 'var(--space-4) var(--space-6)',
        borderTop: first ? 'none' : '1px solid var(--border-hairline)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ font: 'var(--fw-medium) 24px/1 var(--font-display)', color: 'var(--text-1)' }}>
          {datum ? datum.getDate() : '—'}
        </span>
        <span className="je-eyebrow" style={{ letterSpacing: '.14em', color: 'var(--text-2)', marginTop: 3 }}>
          {datum ? monthShort(datum) : ''}
        </span>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
            color: 'var(--text-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.name}
        </div>
        <div
          className="je-muted-caption"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {meta}
        </div>
        {narrow ? (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <StatusBadge statusName={event.statusName} statuses={statuses} />
            <PlanningBadge event={event} compact />
          </div>
        ) : null}
      </div>

      {narrow ? null : (
        <>
          <span
            style={{
              font: 'var(--type-body-sm)',
              color: 'var(--text-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {paxLabel(event)}
          </span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <StatusBadge statusName={event.statusName} statuses={statuses} />
            <PlanningBadge event={event} compact />
          </span>
          <TeamHexes ids={event.team} profileById={profileById} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="je-muted-caption">
              {progress.total
                ? t('events.voortgang', { gedaan: progress.done, totaal: progress.total })
                : t('events.geen_taken')}
            </span>
            <Bar pct={progress.pct} />
          </span>
        </>
      )}

      <span style={{ color: 'var(--text-3)', display: 'flex', justifyContent: 'flex-end' }}>
        <Icon name="chevron-right" size={16} />
      </span>
    </button>
  )
}

export default memo(EventRow)
