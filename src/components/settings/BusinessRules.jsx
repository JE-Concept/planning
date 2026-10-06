import { useMemo, useState } from 'react'
import {
  ENTITIES,
  describeRule,
  emptyRule,
  emptyTable,
  entiteitLabel,
  entityOf,
  fieldOf,
  fieldsFor,
  ruleWarnings,
  toEditable,
  triggersFor,
  veldLabel,
} from '@lib/automations'
import { Acties, Badge, Button, Field, GevaarKnop, Input, Select, Spinner } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  createAutomation,
  deleteAutomation,
  updateAutomation,
  useAutomationRuns,
  useAutomations,
} from '@data/automations'
import ActionList from './rules/ActionList'
import ConditionTree from './rules/ConditionTree'
import DecisionTable from './rules/DecisionTable'
import RuleRuns from './rules/RuleRuns'

/**
 * Business rules beheren.
 *
 * De regel die dit vroeg: alles wat op "ready to invoice" komt, is werk voor
 * Elke en voor niemand anders. Wat je hier zet draait op de server, dus ook
 * wanneer een collega de kaart versleept of wanneer de overlegfunctie een taak
 * aanmaakt.
 *
 * Er zijn nu twee vormen. Een losse regel — als dit, dan dat — en een
 * beslissingstabel: de voorwaarden als kolommen, één rij per geval, van boven
 * naar beneden gelezen tot er een rij past. Die tweede is er gekomen omdat tien
 * losse regels die elkaar overschrijven niet meer na te lezen zijn door wie de
 * zaak runt, en dat is precies het publiek van dit scherm.
 *
 * Elke wijziging wordt meteen bewaard — er is geen bewaarknop, net zoals bij de
 * lijsten en de teamleden. Onder elke regel staat in gewone taal wat ze doet,
 * want een regel die ongevraagd andermans werk aanpast moet je kunnen nalezen
 * zonder de velden te hoeven ontleden.
 */
export default function BusinessRules({ isAdmin }) {
  const { lists, profiles, brands, tags } = useWorkspace()
  const { rules, loading } = useAutomations()
  const { runs } = useAutomationRuns()
  const { t } = useTaal()
  const toast = useToast()
  const [draft, setDraft] = useState(null)

  const taakLijsten = useMemo(() => lists.filter((l) => l.kind !== 'social'), [lists])
  const team = useMemo(
    () => profiles.filter((p) => p.active !== false && p.role !== 'staff'),
    [profiles]
  )

  // `t` hoort in de context: de zin onder een regel wordt in @lib/automations
  // opgebouwd, en die kent de taal alleen als ze meekomt.
  const context = useMemo(
    () => ({ profiles: team, lists: taakLijsten, tags, brands, t }),
    [team, taakLijsten, tags, brands, t]
  )

  const bewaar = async (e) => {
    e.preventDefault()
    try {
      await createAutomation(draft)
      setDraft(null)
      toast.success(t('regels.staat_aan'))
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* De statusnaam staat schuin in de zin en komt uit de database, dus
          wordt de zin er omheen gelegd in plaats van erin geplakt. */}
      <p className="max-w-2xl text-sm text-ink-600">
        {t('regels.kop.uitleg').split('{status}').map((deel, i) => (
          <span key={i}>
            {i > 0 ? <em>ready to invoice</em> : null}
            {deel}
          </span>
        ))}
      </p>

      {rules.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-ink-500">
          {t('regels.leeg')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li key={rule.id} className="card p-4">
              <RuleEditor
                rule={toEditable(rule)}
                readOnly={!isAdmin}
                context={context}
                lists={taakLijsten}
                onChange={(patch) => updateAutomation(rule.id, patch).catch((e) => toast.error(e.message))}
                header={
                  isAdmin ? (
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateAutomation(rule.id, { enabled: rule.enabled === false })}
                      >
                        {rule.enabled === false ? t('regels.aanzetten') : t('regels.uitzetten')}
                      </Button>
                      <GevaarKnop
                        label={t('alg.verwijderen')}
                        size="sm"
                        vraag={t('regels.verwijder_vraag')}
                        onConfirm={() => deleteAutomation(rule.id)}
                      />
                    </div>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}

      {!isAdmin ? null : draft ? (
        <form onSubmit={bewaar} className="card space-y-3 border-accent-200 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">
            {draft.kind === 'table' ? t('regels.nieuwe_tabel') : t('regels.nieuwe_regel')}
          </h2>
          <RuleEditor
            rule={draft}
            nieuw
            context={context}
            lists={taakLijsten}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
          <Acties
            plaats="rij"
            terug={{ label: t('regels.weg_ermee'), onClick: () => setDraft(null) }}
            hoofd={{
              label: t('regels.regel_aanzetten'),
              type: 'submit',
              uit: !draft.name.trim() || ruleWarnings(draft, { lists: taakLijsten, t }).length > 0,
            }}
          />
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDraft(emptyRule('task'))}>
            {t('regels.nieuwe_regel')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDraft(emptyTable('task'))}>
            {t('regels.nieuwe_tabel')}
          </Button>
        </div>
      )}

      <section className="card space-y-2 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">
          {t('regels.wat_deden')}
        </h2>
        <RuleRuns runs={runs} />
      </section>
    </div>
  )
}

// ─── Eén regel of tabel ─────────────────────────────────────────────────────

function RuleEditor({ rule, onChange, header, readOnly = false, nieuw = false, context, lists }) {
  const { t } = useTaal()
  const entity = entityOf(rule.entity)
  const waarschuwingen = ruleWarnings(rule, { lists, t })
  const uit = rule.enabled === false
  const opLijst = Boolean(fieldOf(entity, 'listId'))

  return (
    <div className={uit ? 'opacity-60' : undefined}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={rule.name ?? ''}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={(e) => onChange({ name: e.target.value.trim() })}
          placeholder={t('regels.naam')}
          aria-label={t('regels.naam')}
          className="h-8 max-w-xs text-sm font-semibold"
          disabled={readOnly}
          required
        />
        {rule.kind === 'table' ? (
          <Badge tone="accent">
            {t('regels.badge_tabel')}
          </Badge>
        ) : null}
        {uit ? (
          <Badge>
            {t('regels.badge_uit')}
          </Badge>
        ) : null}
        {header}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field label={t('regels.waarover')}>
          {/* De entiteit ligt vast zodra de regel bestaat: haar velden, haar
              acties en haar voorwaarden hangen er allemaal aan, en die stil
              omzetten naar een andere collectie levert een regel op die niets
              meer doet zonder dat iemand het ziet. */}
          <Select
            aria-label={t('regels.waarover_label')}
            value={rule.entity ?? 'task'}
            disabled={readOnly || !nieuw}
            onChange={(e) =>
              onChange(
                rule.kind === 'table'
                  ? { ...emptyTable(e.target.value), name: rule.name }
                  : { ...emptyRule(e.target.value), name: rule.name }
              )
            }
          >
            {ENTITIES.map((e) => (
              <option key={e.key} value={e.key}>
                {entiteitLabel(t, e)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('regels.als')}>
          <Select
            aria-label={t('regels.aanleiding')}
            value={rule.trigger?.kind ?? 'changed'}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                trigger:
                  e.target.value === 'created'
                    ? { kind: 'created', field: null }
                    : { kind: 'changed', field: rule.trigger?.field ?? fieldsFor(entity)[0]?.key },
              })
            }
          >
            {triggersFor(entity, context).map((aanleiding) => (
              <option key={aanleiding.kind} value={aanleiding.kind}>
                {aanleiding.label}
              </option>
            ))}
          </Select>
        </Field>

        {rule.trigger?.kind === 'changed' ? (
          <Field label={t('regels.welk_veld')}>
            <Select
              aria-label={t('regels.veld_wijzigt')}
              value={rule.trigger?.field ?? ''}
              disabled={readOnly}
              onChange={(e) => onChange({ trigger: { kind: 'changed', field: e.target.value } })}
            >
              {fieldsFor(entity).map((f) => (
                <option key={f.key} value={f.key}>
                  {veldLabel(t, entity, f)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {opLijst ? (
          <Field label={t('regels.op_lijst_label')}>
            <Select
              aria-label={t('regels.op_lijst_label')}
              value={rule.listId ?? ''}
              disabled={readOnly}
              onChange={(e) => onChange({ listId: e.target.value || null })}
            >
              <option value="">{t('regels.elke_lijst')}</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <span className="label">{t('regels.alleen_als')}</span>
        <ConditionTree
          node={rule.when}
          entity={entity}
          context={context}
          readOnly={readOnly}
          onChange={(when) => onChange({ when })}
        />
      </div>

      <div className="mt-3 space-y-2">
        <span className="label">{t('regels.dan')}</span>
        {rule.kind === 'table' ? (
          <DecisionTable
            rule={rule}
            entity={entity}
            context={context}
            readOnly={readOnly}
            onChange={onChange}
          />
        ) : (
          <ActionList
            entity={entity}
            context={context}
            readOnly={readOnly}
            actions={rule.actions ?? []}
            onChange={(actions) => onChange({ actions })}
          />
        )}
      </div>

      {/* Eigen klasse, zodat de browsertest de zin kan aanwijzen: de tekst van
          een keuzelijst telt mee in `innerText` en dan is niet te zien of de
          uitleg klopt of dat er toevallig een optie zo heet. */}
      <p className="je-regel-uitleg mt-3 text-sm text-ink-600">{describeRule(rule, context)}</p>
      {waarschuwingen.map((w) => (
        <p key={w} className="mt-1 text-xs font-semibold text-amber-700">
          {w}
        </p>
      ))}
    </div>
  )
}
