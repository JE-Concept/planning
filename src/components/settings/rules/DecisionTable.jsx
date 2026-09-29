import { Button, Input, Select } from '@ui/index'
import {
  emptyRow,
  fieldOf,
  fieldsFor,
  operatorMeta,
  operatorsFor,
} from '@lib/automations'
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
        <span className="label">Kolommen</span>
        {inputs.map((input, i) => {
          const veld = fieldOf(entity, input.field)
          return (
            <div key={i} className="je-regel-kolom">
              <Select
                aria-label={`Kolom ${i + 1} — veld`}
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
                    {f.label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={`Kolom ${i + 1} — vergelijking`}
                value={input.op ?? 'is'}
                disabled={readOnly}
                onChange={(e) => zetKolom(i, { op: e.target.value })}
              >
                {operatorsFor(veld?.type ?? 'text').map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {readOnly ? null : (
                <Button variant="ghost" size="sm" className="text-ink-400" onClick={() => kolomWeg(i)}>
                  Kolom weg
                </Button>
              )}
            </div>
          )
        })}
        {readOnly ? null : (
          <Button variant="ghost" size="sm" onClick={kolomErbij}>
            Kolom erbij
          </Button>
        )}
      </div>

      <div className="je-regel-tabelrol">
        <table className="je-regel-tabel">
          <thead>
            <tr>
              <th scope="col">Rij</th>
              {inputs.map((input, i) => (
                <th scope="col" key={i}>
                  {fieldOf(entity, input.field)?.label ?? '—'}{' '}
                  <span className="je-regel-tabel__op">{operatorMeta(input.op)?.label ?? ''}</span>
                </th>
              ))}
              <th scope="col">Dan</th>
              {readOnly ? null : <th scope="col"><span className="sr-only">Weg</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.id ?? r}>
                <th scope="row">
                  <span className="je-regel-tabel__nummer">{r + 1}</span>
                  <Input
                    aria-label={`Naam van rij ${r + 1}`}
                    placeholder="naam"
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
                          label={`Rij ${r + 1}, ${veld?.label ?? 'kolom'}`}
                          onChange={(value) => zetCel(r, k, value)}
                        />
                      ) : (
                        <span className="text-sm text-ink-500">{operatorMeta(input.op)?.label}</span>
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
                      Weg
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-500">
        Van boven naar beneden gelezen tot er een rij past — die rij wint, de rest wordt niet meer
        bekeken. Een lege cel betekent “maakt niet uit”.
      </p>

      {readOnly ? null : (
        <Button variant="ghost" size="sm" onClick={() => onChange({ rows: [...rows, emptyRow(rows.length + 1)] })}>
          Rij erbij
        </Button>
      )}
    </div>
  )
}
