import { formatDate } from '@lib/dates'
import { Badge, Icon } from '@components/ds'
import Koppelingen from '@components/notities/Koppelingen'
import { useTaal } from '@context/TaalProvider'

/** Hoe één treffer heet, naar waar het woord stond. */
const TREFFER = {
  tekst: 'notities.treffer_tekst',
  actiepunt: 'notities.treffer_actiepunt',
  samenvatting: 'notities.treffer_besproken',
}

/**
 * Notities als kaarten: titel, datum, het begin van wat erin staat, en waar
 * ze aan hangen.
 *
 * Gedeeld door het scherm Notities, het tabblad Verslagen op Teamoverleg en
 * de notities bij een klant of event — een notitie ziet er overal hetzelfde
 * uit, anders lijkt het alsof het drie verschillende dingen zijn.
 *
 * Komen de notities uit `zoekVerslagen`, dan dragen ze `treffers`: de regels
 * waardoor ze in de lijst staan. Die worden getoond, want een lijst zonder
 * "waarom" laat iemand alsnog elke notitie openen.
 */
export default function NotitieLijst({ notities, onOpen, zonder = null, compact = false }) {
  const { t } = useTaal()

  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {notities.map((n) => (
        <li key={n.id}>
          {/* Een div met een rol en geen <button>: de pillen erin zijn zelf
              knoppen, en een knop in een knop is geen geldige HTML. */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(n)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(n)
              }
            }}
            className={`card w-full cursor-pointer text-left transition hover:shadow-cue-md ${compact ? 'p-3' : 'p-4'}`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              {n.soort === 'overleg' ? (
                <span className="self-center text-ink-500" title={t('notities.soort_overleg')}>
                  <Icon name="messages-square" size={14} />
                </span>
              ) : null}
              <span className={`font-display font-extrabold text-ink-900 ${compact ? 'text-sm' : 'text-base'}`}>
                {n.titel || formatDate(n.datum)}
              </span>
              {n.titel ? <span className="text-xs text-ink-500">{formatDate(n.datum)}</span> : null}
              {n.auteurNaam ? <span className="text-xs text-ink-400">· {n.auteurNaam}</span> : null}
            </div>

            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-ink-600">
              {n.tekst || n.samenvatting?.[0]?.tekst || ''}
            </p>

            {n.treffers?.length ? (
              <ul className="je-verslagtreffers">
                {n.treffers.slice(0, 3).map((treffer, i) => (
                  <li key={`${treffer.soort}-${i}`}>
                    <Badge subtle>{t(TREFFER[treffer.soort] ?? 'notities.treffer_tekst')}</Badge>
                    <span>{treffer.tekst || treffer.detail}</span>
                  </li>
                ))}
                {n.treffers.length > 3 ? (
                  <li className="text-ink-500">{t('notities.nog_andere', { aantal: n.treffers.length - 3 })}</li>
                ) : null}
              </ul>
            ) : null}

            <Koppelingen koppelingen={n.koppelingen} zonder={zonder} />

            {!compact && n.deelnemers?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {n.deelnemers.slice(0, 6).map((naam) => (
                  <Badge key={naam} subtle>
                    {naam}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
