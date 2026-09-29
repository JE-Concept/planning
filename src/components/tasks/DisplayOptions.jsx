import { PRIORITIES } from '@lib/format'
import { GROEPEN, SORTERINGEN, WEERGAVEN, prioSleutel } from '@lib/task-view'
import { Button, Icon, Input, Select } from '@components/ds'
import { useTaal } from '@context/TaalProvider'

/**
 * De balk waarmee je bepaalt wat je ziet, en hoe.
 *
 * Staat apart van de pagina omdat het er veel zijn: weergave, wie, groeperen,
 * sorteren, drie filters en een zoekveld. Alles in de pagina zetten maakt daar
 * een bestand van waarin je de taken zelf niet meer terugvindt.
 *
 * Eén regel houdt het overzichtelijk: wat je niet gekozen hebt, filtert niet.
 * Daarom staat overal "Alle …" als eerste keuze en niet een lege regel — een
 * leeg vakje laat je twijfelen of er iets weggefilterd wordt.
 */
export default function DisplayOptions({ opties, zet, profiles, lijsten, labels, aantal }) {
  const { t } = useTaal()

  return (
    <div className="je-displaybar">
      <div className="je-tabs" style={{ border: 0 }} role="tablist">
        {WEERGAVEN.map((w) => (
          <button
            key={w.key}
            type="button"
            role="tab"
            aria-selected={opties.weergave === w.key}
            className={`je-tab${opties.weergave === w.key ? ' je-tab--active' : ''}`}
            onClick={() => zet({ weergave: w.key })}
          >
            {t(w.sleutel)}
          </button>
        ))}
      </div>

      <div className="je-displaybar__velden">
        <Select
          value={opties.wie}
          onChange={(e) => zet({ wie: e.target.value })}
          aria-label={t('tasks.wie')}
          className="je-compact"
        >
          <option value="ik">{t('tasks.wie.ik')}</option>
          <option value="iedereen">{t('tasks.wie.iedereen')}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName || p.email}
            </option>
          ))}
        </Select>

        <Select
          value={opties.groep}
          onChange={(e) => zet({ groep: e.target.value })}
          aria-label={t('tasks.groeperen_op')}
          className="je-compact"
        >
          {GROEPEN.map((g) => (
            <option key={g.key} value={g.key}>
              {t('tasks.groep_optie', { naam: t(g.sleutel) })}
            </option>
          ))}
        </Select>

        <Select
          value={opties.sortering}
          onChange={(e) => zet({ sortering: e.target.value })}
          aria-label={t('tasks.sorteren_op')}
          className="je-compact"
        >
          {SORTERINGEN.map((s) => (
            <option key={s.key} value={s.key}>
              {t('tasks.sortering_optie', { naam: t(s.sleutel) })}
            </option>
          ))}
        </Select>

        <Select
          value={opties.lijstId}
          onChange={(e) => zet({ lijstId: e.target.value })}
          aria-label={t('tasks.filter.lijst')}
          className="je-compact"
        >
          <option value="">{t('tasks.filter.alle_lijsten')}</option>
          {lijsten.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>

        <Select value={opties.label} onChange={(e) => zet({ label: e.target.value })} aria-label={t('tasks.filter.label')} className="je-compact">
          <option value="">{t('tasks.filter.alle_labels')}</option>
          {labels.map((label) => (
            <option key={label.name} value={label.name}>
              {label.name}
            </option>
          ))}
        </Select>

        <Select
          value={opties.prioriteit}
          onChange={(e) => zet({ prioriteit: e.target.value })}
          aria-label={t('tasks.filter.prioriteit')}
          className="je-compact"
        >
          <option value="">{t('tasks.filter.alle_prioriteiten')}</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {t(prioSleutel(p.value))}
            </option>
          ))}
        </Select>

        <Button
          variant={opties.open ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => zet({ open: !opties.open })}
          title={t(opties.open ? 'tasks.alleen_open_hint' : 'tasks.ook_afgerond_hint')}
        >
          {t(opties.open ? 'tasks.alleen_open' : 'tasks.ook_afgerond')}
        </Button>

        <label className="je-displaybar__zoek">
          <Icon name="search" size={15} />
          <Input
            value={opties.zoek}
            onChange={(e) => zet({ zoek: e.target.value })}
            placeholder={t('tasks.zoek')}
            aria-label={t('tasks.zoek')}
            className="je-compact"
          />
        </label>

        <span className="je-muted-caption" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {t('alg.taak', { aantal })}
        </span>
      </div>
    </div>
  )
}
