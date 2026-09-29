import { useMemo } from 'react'
import { cn } from '@lib/cn'
import { WEEKDAYS, addMonths, dayKey, formatMonth, isToday, monthGrid, startOfMonth } from '@lib/dates'
import { Button } from '@ui/index'

/**
 * Een maand in een raster, voor alles wat een datum heeft.
 *
 * Eén component voor twee schermen die dezelfde vraag stellen met andere
 * gegevens: "wat staat er deze maand voor mij" en "waar zijn mijn uren
 * gebleven". Wat er in een dag komt te staan, bepaalt de pagina zelf — dit
 * bouwt alleen het raster, de weeknummering en het bladeren.
 */
export default function MonthCalendar({
  month,
  onMonthChange,
  itemsByDay = {},
  renderDay,
  renderItem,
  onSelectDay,
  legenda = null,
}) {
  const weeks = useMemo(() => monthGrid(month), [month])
  const huidigeMaand = startOfMonth(month).getMonth()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 py-2 sm:px-6">
        <Button variant="secondary" size="sm" onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Vorige maand">
          ‹
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onMonthChange(startOfMonth())}>
          Vandaag
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Volgende maand">
          ›
        </Button>
        <span className="ml-1 text-sm font-semibold text-ink-900">{formatMonth(month)}</span>
        {legenda ? <div className="ml-auto flex items-center gap-2">{legenda}</div> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-6">
        <div className="grid grid-cols-7 border-b border-ink-200 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weeks.flat().map((dag) => {
            const sleutel = dayKey(dag)
            const items = itemsByDay[sleutel] ?? []
            const buiten = dag.getMonth() !== huidigeMaand

            return (
              <div
                key={sleutel}
                className={cn(
                  'min-h-[7rem] border-b border-r border-ink-100 p-1.5',
                  buiten && 'bg-ink-50/60',
                  onSelectDay && 'cursor-pointer hover:bg-accent-50/50'
                )}
                onClick={onSelectDay ? () => onSelectDay(dag, items) : undefined}
              >
                <div className="flex items-baseline justify-between">
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      isToday(dag)
                        ? 'rounded bg-accent-600 px-1.5 py-0.5 font-semibold text-white'
                        : buiten
                          ? 'text-ink-400'
                          : 'text-ink-600'
                    )}
                  >
                    {dag.getDate()}
                  </span>
                  {renderDay ? renderDay(dag, items) : null}
                </div>

                <div className="mt-1 space-y-1">
                  {items.slice(0, 4).map((item, i) => (
                    <div key={item.id ?? i}>{renderItem(item, dag)}</div>
                  ))}
                  {items.length > 4 ? (
                    <p className="px-1 text-[11px] text-ink-400">+{items.length - 4} meer</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
