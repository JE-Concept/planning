import { memo } from 'react'
import { Bar, Icon } from '@components/ds'
import { PlanningBadge, TeamHexes, eventOndertitel, paxLabel } from './parts'

/**
 * Eén event als kaart op het bord.
 *
 * Gememoriseerd om dezelfde reden als de rij in de lijst, en hier weegt het
 * zwaarder: tijdens het slepen verandert er per muisbeweging iets aan de
 * kolom, en zonder dit tekent elke kaart van elke kolom zich dan opnieuw.
 */
function EventBoardCard({ event, progress, profileById, dragging, onOpen, onDragStart, onDragEnd }) {
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
      {/*
        De naam eerst, en eronder wanneer het is.

        Hierboven stond een regel met het concept en de datum, en "Los event"
        wanneer er geen concept was — op de helft van alle kaarten dus. Dat is
        de afwezigheid van een merk en geen eigenschap van het feest, en het
        stond de naam in de weg op precies de plek waar je hem zoekt.
      */}
      <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{event.name}</span>
      <span className="je-muted-caption">{eventOndertitel(event, { kort: true })}</span>
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
