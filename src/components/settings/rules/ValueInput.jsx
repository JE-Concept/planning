import { Input, Select } from '@ui/index'
import { fixedDate, optionsFor, relativeDate } from '@lib/automations'

/**
 * Het invulveld dat bij een veld hoort.
 *
 * Eén component voor drie plekken: de voorwaarden, de acties en de cellen van
 * een beslissingstabel. Dat is met opzet — een label kiezen hoort er overal
 * hetzelfde uit te zien, en drie keer hetzelfde keuzelijstje bouwen is drie
 * keer een kans dat er ergens een id ingetypt moet worden.
 */

/**
 * Een datum in een regel is zelden een datum.
 *
 * Jasper vroeg het met zoveel woorden: "+3 dagen" moet kunnen, niet alleen een
 * dag op de kalender. Beide staan hier naast elkaar, met de relatieve vorm
 * vooraan omdat dat is wat een regel meestal bedoelt.
 */
export function DateValueInput({ value, onChange, disabled, label = 'Datum' }) {
  const modus = value?.mode === 'fixed' ? 'fixed' : 'relative'

  return (
    <div className="je-regel-datum">
      <Select
        aria-label={`${label} — soort`}
        value={modus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === 'fixed' ? fixedDate('') : relativeDate(7))}
      >
        <option value="relative">vanaf vandaag</option>
        <option value="fixed">een vaste dag</option>
      </Select>

      {modus === 'relative' ? (
        <>
          <Input
            type="number"
            aria-label={`${label} — aantal dagen`}
            className="max-w-[5.5rem]"
            value={value?.days ?? 0}
            disabled={disabled}
            onChange={(e) => onChange(relativeDate(Number(e.target.value)))}
          />
          <span className="text-sm text-ink-500">dagen</span>
        </>
      ) : (
        <Input
          type="date"
          aria-label={`${label} — dag`}
          value={value?.date ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(fixedDate(e.target.value))}
        />
      )}
    </div>
  )
}

export function ValueInput({ field, value, onChange, disabled, context, label = 'Waarde' }) {
  if (!field) return null

  if (field.type === 'date') {
    return <DateValueInput value={value} onChange={onChange} disabled={disabled} label={label} />
  }

  if (field.type === 'boolean') {
    return (
      <Select
        aria-label={label}
        value={value === true || value === 'true' ? 'ja' : 'nee'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === 'ja')}
      >
        <option value="ja">ja</option>
        <option value="nee">nee</option>
      </Select>
    )
  }

  const opties = optionsFor(field.options, context)
  if (opties) {
    const bestaat = opties.some((o) => `${o.value}` === `${value}`)
    return (
      <Select
        aria-label={label}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value)}
      >
        <option value="">Kies…</option>
        {opties.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {/* Een waarde die er niet meer is, blijft zichtbaar — anders staat er
            stilletjes iets anders in de regel dan wat je gekozen had. */}
        {value !== '' && value !== null && value !== undefined && !bestaat ? (
          <option value={value}>{`${value} (bestaat niet meer)`}</option>
        ) : null}
      </Select>
    )
  }

  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      aria-label={label}
      className="max-w-[14rem]"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
