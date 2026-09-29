import { Avatar, Button, Field, Select } from '@ui/index'
import {
  ASSIGNEE_MODES,
  actieLabel,
  actionOf,
  actionsFor,
  emptyAction,
  entityOf,
  relativeDate,
} from '@lib/automations'
import { useTaal } from '@context/TaalProvider'
import { DateValueInput, ValueInput } from './ValueInput'

/**
 * Wat een regel doet — opgebouwd uit de beschrijving, niet per entiteit
 * geschreven.
 *
 * Elke actie zegt zelf hoe ze uitgevoerd wordt (`apply`), en dat is precies wat
 * hier bepaalt welk invulveld je krijgt. Een nieuwe actie in
 * `functions/rule-schema.js` staat daardoor vanzelf in dit scherm, en kan niet
 * per ongeluk wél te kiezen zijn en níét uitgevoerd worden.
 */
export default function ActionList({ entity, actions = [], onChange, context, readOnly = false }) {
  const { t } = useTaal()
  const ent = entityOf(entity?.key ?? entity)

  const zet = (i, patch) => onChange(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)))

  return (
    <div className="space-y-2">
      {actions.map((action, i) => (
        <div key={i} className="je-regel-actie">
          <ActionEditor
            action={action}
            entity={ent}
            context={context}
            readOnly={readOnly}
            onChange={(patch) => zet(i, patch)}
          />
          {readOnly ? null : (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-ink-400"
              onClick={() => onChange(actions.filter((_, j) => j !== i))}
            >
              {t('regels.weg')}
            </Button>
          )}
        </div>
      ))}

      {readOnly ? null : (
        <Select
          value=""
          aria-label={t('regels.actie_toevoegen')}
          className="max-w-[16rem]"
          onChange={(e) =>
            e.target.value && onChange([...actions, emptyAction(ent, e.target.value)])
          }
        >
          <option value="">{t('regels.actie_toevoegen_leeg')}</option>
          {actionsFor(ent).map((a) => (
            <option key={a.kind} value={a.kind}>
              {actieLabel(t, ent, a)}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}

function ActionEditor({ action, entity, context, onChange, readOnly }) {
  const { t } = useTaal()
  const desc = actionOf(entity, action?.kind)
  if (!desc) return <span className="text-sm text-ink-500">{t('regels.actie_onbekend')}</span>

  const naam = actieLabel(t, entity, desc)

  if (desc.apply === 'people') {
    const team = context?.profiles ?? []
    return (
      <>
        <Field label={naam} className="min-w-[10rem]">
          <div className="flex flex-wrap gap-1">
            {team.map((p) => {
              const aan = (action.profileIds ?? []).includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() =>
                    onChange({
                      profileIds: aan
                        ? action.profileIds.filter((id) => id !== p.id)
                        : [...(action.profileIds ?? []), p.id],
                    })
                  }
                  title={p.fullName ?? p.email}
                  aria-label={p.fullName ?? p.email}
                  className={`rounded-full ring-2 ${aan ? 'ring-accent-500' : 'ring-transparent opacity-50'}`}
                >
                  <Avatar profile={p} size="sm" />
                </button>
              )
            })}
          </div>
        </Field>
        <Field label={t('regels.en')}>
          <Select
            aria-label={t('regels.manier_toewijzen')}
            value={action.mode ?? 'set'}
            onChange={(e) => onChange({ mode: e.target.value })}
            disabled={readOnly}
          >
            {ASSIGNEE_MODES.map((m) => (
              <option key={m.mode} value={m.mode}>
                {t(m.sleutel)}
              </option>
            ))}
          </Select>
        </Field>
      </>
    )
  }

  if (desc.apply === 'listAdd') {
    return (
      <>
        <Field label={naam}>
          <ValueInput
            field={{ type: 'text', options: desc.options }}
            context={context}
            value={action.value}
            disabled={readOnly}
            label={naam}
            onChange={(value) => onChange({ value })}
          />
        </Field>
        {/* Een label dat zegt wanneer er iets moet gebeuren ("opvolgen 02-10")
            is waar Jasper om vroeg: niet alleen een vast woord. */}
        <Field label={t('regels.datum_erbij')}>
          <Select
            aria-label={t('regels.datum_bij_label')}
            value={action.date ? 'ja' : 'nee'}
            disabled={readOnly}
            onChange={(e) => onChange({ date: e.target.value === 'ja' ? relativeDate(3) : null })}
          >
            <option value="nee">{t('regels.nee')}</option>
            <option value="ja">{t('regels.ja')}</option>
          </Select>
        </Field>
        {action.date ? (
          <Field label={t('regels.welke_dag')}>
            <DateValueInput
              value={action.date}
              disabled={readOnly}
              label={t('regels.label_woord')}
              onChange={(date) => onChange({ date })}
            />
          </Field>
        ) : null}
      </>
    )
  }

  if (desc.apply === 'date') {
    return (
      <Field label={naam} hint={t('regels.om_vijf')}>
        <DateValueInput
          value={action.date ?? (typeof action.value === 'number' ? relativeDate(action.value) : null)}
          disabled={readOnly}
          label={naam}
          onChange={(date) => onChange({ date, value: undefined })}
        />
      </Field>
    )
  }

  return (
    <Field label={naam}>
      <ValueInput
        field={{ type: desc.type ?? 'text', options: desc.options }}
        context={context}
        value={action.value}
        disabled={readOnly}
        label={naam}
        onChange={(value) => onChange({ value })}
      />
    </Field>
  )
}
