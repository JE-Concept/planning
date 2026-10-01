import { formatTime } from '@lib/dates'
import { Icon } from '@components/ds'
import { KOPPELING_TEKST, STATUUT_TEKST, kleurVan, teltMee, vraagtAandacht } from '@lib/aapi-weergave'
import { useTaal } from '@context/TaalProvider'

/**
 * Eén shift in de kalender.
 *
 * Wat erin past is beperkt, dus staat er wat je in één oogopslag wil weten:
 * wie, wanneer, welke afdeling (als kleurstreep links), welk statuut. Bij
 * Evenementen ook het event — of een waarschuwing dat het er niet is.
 *
 * Geannuleerd en verdwenen worden gedempt en doorgestreept in plaats van
 * weggelaten. "Er stond iemand en die is afgezegd" is informatie; een lege plek
 * is dat niet.
 */
export default function ShiftBlok({ shift, naam, eventNaam, onClick, compact = false }) {
  const { t } = useTaal()
  const gedempt = !teltMee(shift)
  const aandacht = vraagtAandacht(shift)
  const uren = `${formatTime(shift.start)}–${formatTime(shift.end)}`

  return (
    <button
      type="button"
      onClick={onClick}
      className="je-shiftblok"
      data-gedempt={gedempt ? '' : undefined}
      style={{ '--afdeling': kleurVan(shift.locationName) }}
      title={`${naam} · ${uren} · ${t(KOPPELING_TEKST[shift.linkStatus] ?? 'aapi.koppeling.nvt')}`}
    >
      {/*
        De naam bovenaan en de uren eronder. Andersom stond het eerst, en dat
        leest verkeerd: je zoekt in deze kalender iemand, niet een uur. Pas als
        je de naam gevonden hebt, wil je weten wanneer hij staat.
      */}
      <span className="je-shiftblok__naam">{naam}</span>
      <span className="je-shiftblok__uren">{uren}</span>
      {compact ? null : (
        <span className="je-shiftblok__onder">
          <span>{t(STATUUT_TEKST[shift.statuut] ?? 'aapi.statuut.onbekend')}</span>
          {eventNaam ? <span className="je-shiftblok__event">{eventNaam}</span> : null}
          {aandacht ? <Icon name="alert-triangle" size={12} /> : null}
        </span>
      )}
    </button>
  )
}
