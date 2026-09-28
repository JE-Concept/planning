import { cn } from '@lib/cn'

export default function PageHeader({ title, subtitle, actions, tabs, className }) {
  return (
    <div className={cn('border-b border-ink-200 bg-white px-4 pt-4 sm:px-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-extrabold text-ink-900">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs ? <div className="mt-3 flex gap-1 overflow-x-auto">{tabs}</div> : null}
      {!tabs ? <div className="h-4" /> : null}
    </div>
  )
}

export function Tab({ active, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors',
        active
          ? 'border-accent-600 font-medium text-accent-700'
          : 'border-transparent text-ink-500 hover:text-ink-800'
      )}
      {...props}
    >
      {children}
    </button>
  )
}
