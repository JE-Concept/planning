import { PRIORITIES } from '@lib/format'
import { GROEPEN, SORTERINGEN, WEERGAVEN } from '@lib/task-view'
import { Button, Icon, Input, Select } from '@components/ds'

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
            {w.label}
          </button>
        ))}
      </div>

      <div className="je-displaybar__velden">
        <Select
          value={opties.wie}
          onChange={(e) => zet({ wie: e.target.value })}
          aria-label="Van wie"
          className="je-compact"
        >
          <option value="ik">Mijn taken</option>
          <option value="iedereen">Van iedereen</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName || p.email}
            </option>
          ))}
        </Select>

        <Select
          value={opties.groep}
          onChange={(e) => zet({ groep: e.target.value })}
          aria-label="Groeperen op"
          className="je-compact"
        >
          {GROEPEN.map((g) => (
            <option key={g.key} value={g.key}>
              Groep: {g.label}
            </option>
          ))}
        </Select>

        <Select
          value={opties.sortering}
          onChange={(e) => zet({ sortering: e.target.value })}
          aria-label="Sorteren op"
          className="je-compact"
        >
          {SORTERINGEN.map((s) => (
            <option key={s.key} value={s.key}>
              Sorteer: {s.label}
            </option>
          ))}
        </Select>

        <Select
          value={opties.lijstId}
          onChange={(e) => zet({ lijstId: e.target.value })}
          aria-label="Lijst"
          className="je-compact"
        >
          <option value="">Alle lijsten</option>
          {lijsten.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>

        <Select value={opties.label} onChange={(e) => zet({ label: e.target.value })} aria-label="Label" className="je-compact">
          <option value="">Alle labels</option>
          {labels.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </Select>

        <Select
          value={opties.prioriteit}
          onChange={(e) => zet({ prioriteit: e.target.value })}
          aria-label="Prioriteit"
          className="je-compact"
        >
          <option value="">Alle prioriteiten</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>

        <Button
          variant={opties.open ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => zet({ open: !opties.open })}
          title={opties.open ? 'Afgeronde taken staan er niet bij' : 'Afgeronde taken staan er wel bij'}
        >
          {opties.open ? 'Alleen open' : 'Ook afgerond'}
        </Button>

        <label className="je-displaybar__zoek">
          <Icon name="search" size={15} />
          <Input
            value={opties.zoek}
            onChange={(e) => zet({ zoek: e.target.value })}
            placeholder="Zoek in taken"
            aria-label="Zoek in taken"
            className="je-compact"
          />
        </label>

        <span className="je-muted-caption" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {aantal} {aantal === 1 ? 'taak' : 'taken'}
        </span>
      </div>
    </div>
  )
}
