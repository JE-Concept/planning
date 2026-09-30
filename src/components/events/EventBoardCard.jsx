import { memo } from 'react'
import { Bar, Icon } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { PlanningBadge, TeamHexes, paxLabel, shortDate } from './parts'

/**
 * Eén event als kaart op het bord.
 *
 * Gememoriseerd om dezelfde reden als de rij in de lijst, en hier weegt het
 * zwaarder: tijdens het slepen verandert er per muisbeweging iets aan de
 * kolom, en zonder dit tekent elke kaart van elke kolom zich dan opnieuw.
 */
function EventBoardCard({ event, progress, profileById, dragging, onOpen, onDragStart, onDragEnd }) {
  const { t } = useTaal()

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, event.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(event.id)}
      className="je-plainbtn je-boardcard"
      style={{ opacity: dragging ? 0.4 : 1 }}
    >
      <span className="je-eyebrow" style={{ letterSpacing: '.14em' }}>
        {[event.concept?.split(' — ')[0] ?? t('events.los_event'), shortDate(event.eventDate)]
          .filter(Boolean)
          .join(' · ')}
      </span>
      <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{event.name}</span>
      {/* Alleen wanneer er een stand gekozen is; anders staat op elke kaart
          dezelfde badge en zegt ze niets meer. */}
      <PlanningBadge event={event} compact />
      <span
        className="je-muted-caption"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
      >
        <Icon name="users" size={14} />
        {paxLabel(event)}
        <span style={{ marginLeft: 'auto' }}>
          <TeamHexes ids={event.team} profileById={profileById} size={22} />
        </span>
      </span>
      <Bar pct={progress.pct} />
    </button>
  )
}

export default memo(EventBoardCard)
