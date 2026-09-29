import { Badge } from '@ui/index'
import { entityOf, fieldOf } from '@lib/automations'
import { formatDateTime } from '@lib/dates'

/**
 * Het logboek: welke regel deed wat, en bij een tabel op welke rij.
 *
 * Dit is de tegenhanger van het activiteitenlog bij een taak. Daar staat wie
 * een deadline verzette; hier staat wat er verzet werd zonder dat iemand het
 * deed. Een regel draait met beheerdersrechten en verandert werk van collega's
 * — dan hoort achteraf na te lezen te zijn welke regel dat was. Zonder de rij
 * erbij is een tabel van twaalf rijen daarvoor niet genoeg.
 */
export default function RuleRuns({ runs = [] }) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        Nog niets gevuurd. Zodra een regel iets wijzigt, staat hier wat en waarom.
      </p>
    )
  }

  return (
    <ul className="je-regel-log">
      {runs.map((run) => {
        const ent = entityOf(run.entity)
        return (
          <li key={run.id}>
            <div className="je-regel-log__kop">
              <Badge color="#3377ff" subtle>
                {ent.label}
              </Badge>
              <span className="font-semibold">{run.docTitle || run.docId}</span>
              <span className="ml-auto text-xs text-ink-500">{formatDateTime(run.firedAt)}</span>
            </div>
            <p className="text-sm text-ink-600">
              {(run.rules ?? [])
                .map((r) => (r.rowId ? `${r.name || 'een regel'} (${r.rowLabel || r.rowId})` : r.name || 'een regel'))
                .join(', ') || 'een regel'}{' '}
              wijzigde{' '}
              {(run.fields ?? [])
                .map((veld) => fieldOf(ent, veld)?.label?.toLowerCase() ?? veld)
                .join(', ')}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
