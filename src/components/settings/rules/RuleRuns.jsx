import { Badge } from '@ui/index'
import { entiteitLabel, entityOf, fieldOf, veldLabel } from '@lib/automations'
import { formatDateTime } from '@lib/dates'
import { useTaal } from '@context/TaalProvider'

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
  const { t } = useTaal()

  if (runs.length === 0) {
    return <p className="text-sm text-ink-500">{t('regels.log.leeg')}</p>
  }

  return (
    <ul className="je-regel-log">
      {runs.map((run) => {
        const ent = entityOf(run.entity)
        return (
          <li key={run.id}>
            <div className="je-regel-log__kop">
              <Badge color="#3377ff" subtle>
                {entiteitLabel(t, ent)}
              </Badge>
              <span className="font-semibold">{run.docTitle || run.docId}</span>
              <span className="ml-auto text-xs text-ink-500">{formatDateTime(run.firedAt)}</span>
            </div>
            <p className="text-sm text-ink-600">
              {t('regels.log.wijzigde', {
                wie:
                  (run.rules ?? [])
                    .map((r) =>
                      r.rowId
                        ? t('regels.log.rij', {
                            naam: r.name || t('regels.log.een_regel'),
                            rij: r.rowLabel || r.rowId,
                          })
                        : r.name || t('regels.log.een_regel')
                    )
                    .join(', ') || t('regels.log.een_regel'),
                velden: (run.fields ?? [])
                  .map((veld) => veldLabel(t, ent, fieldOf(ent, veld)).toLowerCase() || veld)
                  .join(', '),
              })}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
