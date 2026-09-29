import { Button, Select } from '@ui/index'
import {
  GROUP_KINDS,
  MAX_DEPTH,
  emptyCondition,
  emptyGroup,
  fieldOf,
  fieldsFor,
  operatorMeta,
  operatorsFor,
} from '@lib/automations'
import { ValueInput } from './ValueInput'

/**
 * De voorwaarden van een regel, als boom.
 *
 * Tot nu was het één voorwaarde: één status, en klaar. Dat hield op zodra er
 * gevraagd werd om "een aanvraag boven de 10 000 euro óf met meer dan 150
 * gasten". Vandaar EN, OF en GEEN, met groepen die in elkaar mogen zitten.
 *
 * Niet dieper dan `MAX_DEPTH`. Niet omdat het rekenwerk duur is — de motor
 * stopt daar ook — maar omdat een voorwaarde die vier niveaus diep staat door
 * niemand meer nagelezen wordt, en dit is code die ongevraagd andermans werk
 * aanpast.
 */
export default function ConditionTree({
  node,
  entity,
  context,
  onChange,
  readOnly = false,
  depth = 0,
  onRemove,
}) {
  const groep = node ?? emptyGroup('all')
  const nodes = groep.nodes ?? []

  const zet = (i, patch) =>
    onChange({ ...groep, nodes: nodes.map((n, j) => (j === i ? patch : n)) })

  const weg = (i) => onChange({ ...groep, nodes: nodes.filter((_, j) => j !== i) })

  return (
    <div className="je-regel-groep">
      <div className="je-regel-groep__kop">
        <Select
          aria-label="Voorwaarden combineren"
          className="max-w-[14rem]"
          value={groep.kind}
          disabled={readOnly}
          onChange={(e) => onChange({ ...groep, kind: e.target.value })}
        >
          {GROUP_KINDS.map((g) => (
            <option key={g.kind} value={g.kind}>
              {g.label}
            </option>
          ))}
        </Select>

        {readOnly ? null : (
          <>
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...groep, nodes: [...nodes, emptyCondition(entity)] })}>
              Voorwaarde erbij
            </Button>
            {depth < MAX_DEPTH - 1 ? (
              <Button size="sm" variant="ghost" onClick={() => onChange({ ...groep, nodes: [...nodes, emptyGroup('any')] })}>
                Groep erbij
              </Button>
            ) : null}
            {onRemove ? (
              <Button size="sm" variant="ghost" className="ml-auto text-ink-400" onClick={onRemove}>
                Groep weg
              </Button>
            ) : null}
          </>
        )}
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-ink-500">Geen voorwaarden — de regel vuurt op haar aanleiding alleen.</p>
      ) : null}

      {nodes.map((kind, i) =>
        kind?.nodes ? (
          <ConditionTree
            key={i}
            node={kind}
            entity={entity}
            context={context}
            readOnly={readOnly}
            depth={depth + 1}
            onChange={(patch) => zet(i, patch)}
            onRemove={() => weg(i)}
          />
        ) : (
          <ConditionRow
            key={i}
            condition={kind}
            entity={entity}
            context={context}
            readOnly={readOnly}
            onChange={(patch) => zet(i, { ...kind, ...patch })}
            onRemove={() => weg(i)}
          />
        )
      )}
    </div>
  )
}

/** Eén regel: veld, vergelijking, waarde. */
export function ConditionRow({ condition, entity, context, onChange, onRemove, readOnly }) {
  const velden = fieldsFor(entity)
  const veld = fieldOf(entity, condition?.field)
  const operatoren = operatorsFor(veld?.type ?? 'text')
  const meta = operatorMeta(condition?.op)

  const kiesVeld = (key) => {
    const nieuw = fieldOf(entity, key)
    const mag = operatorsFor(nieuw?.type ?? 'text')
    // Van "bevat" naar een getal springen laat een vergelijking staan die niet
    // bestaat; dan liever de eerste die wel past.
    const op = mag.some((o) => o.op === condition?.op) ? condition.op : mag[0]?.op
    onChange({ field: key, op, value: '' })
  }

  return (
    <div className="je-regel-voorwaarde">
      <Select
        aria-label="Veld"
        value={condition?.field ?? ''}
        disabled={readOnly}
        onChange={(e) => kiesVeld(e.target.value)}
      >
        {velden.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Vergelijking"
        value={condition?.op ?? ''}
        disabled={readOnly}
        onChange={(e) => onChange({ op: e.target.value })}
      >
        {operatoren.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </Select>

      {meta?.value ? (
        <ValueInput
          field={veld}
          context={context}
          value={condition?.value}
          disabled={readOnly}
          onChange={(value) => onChange({ value })}
        />
      ) : null}

      {readOnly ? null : (
        <Button size="sm" variant="ghost" className="ml-auto text-ink-400" onClick={onRemove}>
          Weg
        </Button>
      )}
    </div>
  )
}
