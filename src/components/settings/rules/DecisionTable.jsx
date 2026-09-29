import { Button, Input, Select } from '@ui/index'
import {
  emptyRow,
  fieldOf,
  fieldsFor,
  operatorLabel,
  operatorMeta,
  operatorsFor,
  veldLabel,
} from '@lib/automations'
import { useTaal } from '@context/TaalProvider'
import ActionList from './ActionList'
import { ValueInput } from './ValueInput'

/**
 * Een beslissingstabel, in de geest van GoRules.
 *
 * Het idee is niet nieuw en dat is precies de waarde ervan: de voorwaarden als
 * kolommen, één rij per geval, van boven naar beneden gelezen tot er een rij
 * past. Tien losse als-dan-regels die elkaar overschrijven kan niemand die de
 * zaak runt nog nalezen — "welke wint er nu?" is dan een vraag voor de
 * programmeur. Een tabel niet: die leest als een tabel op papier.
 *
 * Een lege cel betekent "maakt niet uit". Dat staat er ook letterlijk, want
 * iedereen die zo'n tabel voor het eerst ziet, vraagt het.
 */
export default function DecisionTable({ rule, entity, context, onChange, readOnly = false }) {
  const { t } = useTaal()
  const inputs = rule.inputs ?? []
  const rows = rule.rows ?? []

  const zetKolom = (i, patch) =>
    onChange({ inputs: inputs.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  const kolomWeg = (i) =>
    onChange({
      inputs: inputs.filter((_, j) => j !== i),
      rows: rows.map((r) => ({ ...r, cells: r.cells.filter((_, j) => j !== i) })),
    })

  const kolomErbij = () => {
    const veld = fieldsFor(entity)[0]
    onChange({
      inputs: [...inputs, { field: veld?.key ?? '', op: operatorsFor(veld?.type ?? 'text')[0]?.op ?? 'is' }],
    })
  }

  const zetRij = (i, patch) => onChange({ rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

  const zetCel = (rij, kolom, value) => {
    const cells = [...(rows[rij].cells ?? [])]
    while (cells.length < inputs.length) cells.push('')
    cells[kolom] = value
    zetRij(rij, { cells })
  }

  return (
    <div className="je-regel-tabelblok">
      <div className="je-regel-kolommen">
        <span className="label">{t('regels.kolommen')}</span>
        {inputs.map((input, i) => {
          const veld = fieldOf(entity, input.field)
          return (
            <div key={i} className="je-regel-kolom">
              <Select
                aria-label={t('regels.kolom_veld', { nummer: i + 1 })}
                value={input.field ?? ''}
                disabled={readOnly}
                onChange={(e) => {
                  const nieuw = fieldOf(entity, e.target.value)
                  const mag = operatorsFor(nieuw?.type ?? 'text')
                  const op = mag.some((o) => o.op === input.op) ? input.op : mag[0]?.op
                  zetKolom(i, { field: e.target.value, op })
                }}
              >
                {fieldsFor(entity).map((f) => (
                  <option key={f.key} value={f.key}>
                    {veldLabel(t, entity, f)}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={t('regels.kolom_vergelijking', { nummer: i + 1 })}
                value={input.op ?? 'is'}
                disabled={readOnly}
                onChange={(e) => zetKolom(i, { op: e.target.value })}
              >
                {operatorsFor(veld?.type ?? 'text').map((o) => (
                  <option key={o.op} value={o.op}>
                    {operatorLabel(t, o)}
                  </option>
                ))}
              </Select>
              {readOnly ? null : (
                <Button variant="ghost" size="sm" className="text-ink-400" onClick={() => kolomWeg(i)}>
                  {t('regels.kolom_weg')}
                </Button>
              )}
            </div>
          )
        })}
        {readOnly ? null : (
          <Button variant="ghost" size="sm" onClick={kolomErbij}>
            {t('regels.kolom_erbij')}
          </Button>
        )}
      </div>

      <div className="je-regel-tabelrol">
        <table className="je-regel-tabel">
          <thead>
            <tr>
              <th scope="col">{t('regels.rij')}</th>
              {inputs.map((input, i) => (
                <th scope="col" key={i}>
                  {veldLabel(t, entity, fieldOf(entity, input.field)) || '—'}{' '}
                  <span className="je-regel-tabel__op">{operatorLabel(t, input.op)}</span>
                </th>
              ))}
              <th scope="col">{t('regels.dan')}</th>
              {readOnly ? null : (
                <th scope="col">
                  <span className="sr-only">{t('regels.weg')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.id ?? r}>
                <th scope="row">
                  <span className="je-regel-tabel__nummer">{r + 1}</span>
                  <Input
                    aria-label={t('regels.rij_naam', { nummer: r + 1 })}
                    placeholder={t('regels.rij_naam_plaatshouder')}
                    className="h-8 max-w-[9rem] text-sm"
                    value={row.label ?? ''}
                    disabled={readOnly}
                    onChange={(e) => zetRij(r, { label: e.target.value })}
                  />
                </th>

                {inputs.map((input, k) => {
                  const veld = fieldOf(entity, input.field)
                  const vraagtWaarde = operatorMeta(input.op)?.value !== false
                  return (
                    <td key={k}>
                      {vraagtWaarde ? (
                        <ValueInput
                          field={veld}
                          context={context}
                          value={row.cells?.[k] ?? ''}
                          disabled={readOnly}
                          label={t('regels.rij_cel', {
                            nummer: r + 1,
                            kolom: veldLabel(t, entity, veld) || t('regels.kolom_woord'),
                          })}
                          onChange={(value) => zetCel(r, k, value)}
                        />
                      ) : (
                        <span className="text-sm text-ink-500">{operatorLabel(t, input.op)}</span>
                      )}
                    </td>
                  )
                })}

                <td>
                  <ActionList
                    entity={entity}
                    context={context}
                    readOnly={readOnly}
                    actions={row.actions ?? []}
                    onChange={(actions) => zetRij(r, { actions })}
                  />
                </td>

                {readOnly ? null : (
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-ink-400"
                      onClick={() => onChange({ rows: rows.filter((_, j) => j !== r) })}
                    >
                      {t('regels.weg')}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-500">{t('regels.tabel_uitleg')}</p>

      {readOnly ? null : (
        <Button variant="ghost" size="sm" onClick={() => onChange({ rows: [...rows, emptyRow(rows.length + 1)] })}>
          {t('regels.rij_erbij')}
        </Button>
      )}
    </div>
  )
}
