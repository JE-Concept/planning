import { memo } from 'react'
import { Bar, Icon } from '@components/ds'
import PlanningBol from './PlanningBol'
import { dayKey } from '@lib/dates'
import { eindeVan } from '@lib/eventdagen'
import { voorbijNietAfgerond } from '@lib/pipeline'
import { useTaal } from '@context/TaalProvider'
import { PlanningBadge, TeamHexes, eventOndertitel } from './parts'

/**
 * Eén event als kaart op het bord.
 *
 * Gememoriseerd om dezelfde reden als de rij in de lijst, en hier weegt het
 * zwaarder: tijdens het slepen verandert er per muisbeweging iets aan de
 * kolom, en zonder dit tekent elke kaart van elke kolom zich dan opnieuw.
 */
function EventBoardCard({ event, progress, profileById, planningStand, dragging, onOpen, onDragStart, onDragEnd }) {
  const { t } = useTaal()
  const einde = eindeVan(event)
  const achter = voorbijNietAfgerond(event.statusName, einde ? dayKey(einde) : null, dayKey(new Date()))
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
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3, minWidth: 0 }}>{event.name}</span>
        {/* Of er volk staat, naast de naam: dat is wat je van een kaart wil
            weten zonder ze te openen. Zie `PlanningBol`. */}
        <PlanningBol stand={planningStand} />
      </span>
      <span className="je-muted-caption">{eventOndertitel(event, { kort: true })}</span>
      {/* Alleen wanneer er een stand gekozen is; anders staat op elke kaart
          dezelfde badge en zegt ze niets meer. */}
      <PlanningBadge event={event} compact />
      {achter ? (
        <span className="je-muted-caption" style={{ color: 'var(--red-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="alert-triangle" size={13} /> {t('events.voorbij_niet_af')}
        </span>
      ) : null}
      {/* Klant en gasten alleen als ze er zijn: "— pax" stond op bijna elke
          kaart en zei niets. */}
      <span
        className="je-muted-caption"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
      >
        {event.pax ? (
          <>
            <Icon name="users" size={14} />
            {event.pax} pax
          </>
        ) : null}
        {event.customerName ? (
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.customerName}</span>
        ) : null}
        <span style={{ marginLeft: 'auto' }}>
          <TeamHexes ids={event.team} profileById={profileById} size={22} />
        </span>
      </span>
      <Bar pct={progress.pct} />
    </button>
  )
}

export default memo(EventBoardCard)
