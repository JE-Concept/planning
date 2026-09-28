import { useMemo, useState } from 'react'
import {
  ACTIONS,
  ASSIGNEE_MODES,
  TRIGGERS,
  describeRule,
  emptyAction,
  emptyRule,
  ruleWarnings,
} from '@lib/automations'
import { PRIORITIES } from '@lib/format'
import { Avatar, Badge, Button, ConfirmButton, Field, Input, Select, Spinner } from '@ui/index'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createAutomation, deleteAutomation, updateAutomation, useAutomations } from '@data/automations'

/**
 * Business rules beheren.
 *
 * De regel die dit vroeg: alles wat op "ready to invoice" komt, is werk voor
 * Elke en voor niemand anders. Wat je hier zet draait op de server, dus ook
 * wanneer een collega de kaart versleept of wanneer de overlegfunctie een taak
 * aanmaakt.
 *
 * Elke wijziging wordt meteen bewaard — er is geen bewaarknop, net zoals bij de
 * lijsten en de teamleden. Onder elke regel staat in gewone taal wat ze doet,
 * want een regel die ongevraagd andermans taken aanpast moet je kunnen nalezen
 * zonder de velden te hoeven ontleden.
 */
export default function BusinessRules({ isAdmin }) {
  const { lists, profiles, profileById, listById, tags } = useWorkspace()
  const { rules, loading } = useAutomations()
  const toast = useToast()
  const [draft, setDraft] = useState(null)

  const taakLijsten = useMemo(() => lists.filter((l) => l.kind !== 'social'), [lists])
  const team = useMemo(
    () => profiles.filter((p) => p.active !== false && p.role !== 'staff'),
    [profiles]
  )

  const bewaar = async (e) => {
    e.preventDefault()
    try {
      await createAutomation(draft)
      setDraft(null)
      toast.success('Regel staat aan.')
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

  const context = { lists: taakLijsten, team, profileById, listById, tags }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-ink-600">
        Een regel doet iets met een taak op het moment dat die in een status komt — bijvoorbeeld:
        alles wat op <em>ready to invoice</em> komt, wordt van Elke en van niemand anders. De regels
        draaien op de server, dus ook wanneer iemand anders de kaart versleept.
      </p>

      {rules.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-ink-500">
          Er staat nog geen enkele regel. Niets gebeurt automatisch.
        </p>
      ) : (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li key={rule.id} className="card p-4">
              <RuleEditor
                rule={rule}
                readOnly={!isAdmin}
                {...context}
                onChange={(patch) => updateAutomation(rule.id, patch).catch((e) => toast.error(e.message))}
                header={
                  isAdmin ? (
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateAutomation(rule.id, { enabled: rule.enabled === false })}
                      >
                        {rule.enabled === false ? 'Aanzetten' : 'Uitzetten'}
                      </Button>
                      <ConfirmButton
                        variant="ghost"
                        size="sm"
                        className="text-ink-400"
                        question="Regel verwijderen?"
                        onConfirm={() => deleteAutomation(rule.id)}
                      >
                        Verwijderen
                      </ConfirmButton>
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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">Nieuwe regel</h2>
          <RuleEditor rule={draft} {...context} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!draft.name.trim() || ruleWarnings(draft, { lists: taakLijsten }).length > 0}
            >
              Regel aanzetten
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Weg ermee
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setDraft(emptyRule())}>
          Nieuwe regel
        </Button>
      )}
    </div>
  )
}

// ─── Eén regel ──────────────────────────────────────────────────────────────

function RuleEditor({ rule, onChange, header, readOnly = false, lists, team, profileById, listById, tags }) {
  const statusNamen = useMemo(() => {
    const bron = rule.listId ? lists.filter((l) => l.id === rule.listId) : lists
    const alle = bron.flatMap((l) => (l.statuses ?? []).map((s) => s.name))
    return [...new Set(alle)]
  }, [lists, rule.listId])

  const waarschuwingen = ruleWarnings(rule, { lists })
  const uit = rule.enabled === false

  const zetActie = (index, patch) =>
    onChange({
      actions: (rule.actions ?? []).map((a, i) => (i === index ? { ...a, ...patch } : a)),
    })

  return (
    <div className={uit ? 'opacity-60' : undefined}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={rule.name ?? ''}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={(e) => onChange({ name: e.target.value.trim() })}
          placeholder="Naam van de regel"
          aria-label="Naam van de regel"
          className="h-8 max-w-xs text-sm font-semibold"
          disabled={readOnly}
          required
        />
        {uit ? <Badge color="#8593a9" subtle>uit</Badge> : null}
        {header}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Als">
          <Select
            value={rule.trigger?.kind ?? 'status'}
            onChange={(e) => onChange({ trigger: { ...rule.trigger, kind: e.target.value } })}
            disabled={readOnly}
          >
            {TRIGGERS.map((t) => (
              <option key={t.kind} value={t.kind}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Op lijst">
          <Select
            value={rule.listId ?? ''}
            onChange={(e) => onChange({ listId: e.target.value || null })}
            disabled={readOnly}
          >
            <option value="">Elke lijst</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>

        {rule.trigger?.kind === 'status' ? (
          <Field label="Status">
            <Select
              value={rule.trigger?.status ?? ''}
              onChange={(e) => onChange({ trigger: { ...rule.trigger, status: e.target.value } })}
              disabled={readOnly}
            >
              <option value="">Kies een status…</option>
              {statusNamen.map((naam) => (
                <option key={naam} value={naam}>
                  {naam}
                </option>
              ))}
              {rule.trigger?.status && !statusNamen.includes(rule.trigger.status) ? (
                <option value={rule.trigger.status}>{rule.trigger.status} (bestaat niet meer)</option>
              ) : null}
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <span className="label">Dan</span>
        {(rule.actions ?? []).map((action, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg bg-ink-50 px-3 py-2">
            <ActionEditor
              action={action}
              readOnly={readOnly}
              team={team}
              tags={tags}
              onChange={(patch) => zetActie(i, patch)}
            />
            {readOnly ? null : (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-ink-400"
                onClick={() => onChange({ actions: rule.actions.filter((_, j) => j !== i) })}
              >
                Weg
              </Button>
            )}
          </div>
        ))}

        {readOnly ? null : (
          <Select
            value=""
            aria-label="Actie toevoegen"
            className="max-w-[16rem]"
            onChange={(e) =>
              e.target.value &&
              onChange({ actions: [...(rule.actions ?? []), emptyAction(e.target.value)] })
            }
          >
            <option value="">Actie toevoegen…</option>
            {ACTIONS.map((a) => (
              <option key={a.kind} value={a.kind}>
                {a.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      <p className="mt-3 text-sm text-ink-600">{describeRule(rule, { profileById, listById })}</p>
      {waarschuwingen.map((w) => (
        <p key={w} className="mt-1 text-xs font-semibold text-amber-700">
          {w}
        </p>
      ))}
    </div>
  )
}

// ─── Eén actie ──────────────────────────────────────────────────────────────

function ActionEditor({ action, onChange, readOnly, team, tags }) {
  switch (action.kind) {
    case 'assignees':
      return (
        <>
          <Field label="Wie" className="min-w-[10rem]">
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
                    className={`rounded-full ring-2 ${aan ? 'ring-accent-500' : 'ring-transparent opacity-50'}`}
                  >
                    <Avatar profile={p} size="sm" />
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="En">
            <Select
              value={action.mode ?? 'set'}
              onChange={(e) => onChange({ mode: e.target.value })}
              disabled={readOnly}
            >
              {ASSIGNEE_MODES.map((m) => (
                <option key={m.mode} value={m.mode}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )

    case 'priority':
      return (
        <Field label="Prioriteit">
          <Select
            value={action.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={readOnly}
          >
            <option value="">Geen</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      )

    case 'tag':
      return (
        <Field label="Label">
          <Select
            value={action.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}
            disabled={readOnly}
          >
            <option value="">Kies een label…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      )

    case 'dueInDays':
      return (
        <Field label="Vervaldag over (dagen)" hint="0 is vandaag, om 17.00">
          <Input
            type="number"
            value={action.value ?? 0}
            onChange={(e) => onChange({ value: Number(e.target.value) })}
            disabled={readOnly}
            className="max-w-[7rem]"
          />
        </Field>
      )

    default:
      return <span className="text-sm text-ink-500">Onbekende actie.</span>
  }
}
