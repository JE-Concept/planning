import { forwardRef, useEffect, useRef } from 'react'
import { cn } from '@lib/cn'
import { contrastColor, initials } from '@lib/format'

// ─── Button ─────────────────────────────────────────────────────────────────

const VARIANTS = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700 disabled:bg-accent-300',
  secondary: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
}

const SIZES = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  buttonRef
) {
  return (
    <button
      ref={buttonRef}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  )
})

// ─── Form fields ────────────────────────────────────────────────────────────

export const Input = forwardRef(function Input({ className, ...props }, inputRef) {
  return <input ref={inputRef} className={cn('field', className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, areaRef) {
  return <textarea ref={areaRef} className={cn('field resize-y', className)} {...props} />
})

export const Select = forwardRef(function Select({ className, children, ...props }, selectRef) {
  return (
    <select ref={selectRef} className={cn('field pr-8', className)} {...props}>
      {children}
    </select>
  )
})

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  )
}

// ─── Badge, avatar, dot ─────────────────────────────────────────────────────

export function Badge({ color = '#8593a9', children, className, subtle = false }) {
  const style = subtle
    ? { backgroundColor: `${color}1f`, color }
    : { backgroundColor: color, color: contrastColor(color) }

  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4',
        className
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ color = '#8593a9', className }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', className)}
    />
  )
}

const AVATAR_SIZES = { xs: 'h-5 w-5 text-[9px]', sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-xs' }

export function Avatar({ profile, size = 'sm', className }) {
  const label = profile?.fullName || profile?.email || 'Niet toegewezen'

  if (profile?.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt={label}
        title={label}
        referrerPolicy="no-referrer"
        className={cn('shrink-0 rounded-full object-cover', AVATAR_SIZES[size], className)}
      />
    )
  }

  return (
    <span
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-ink-200 font-semibold text-ink-700',
        AVATAR_SIZES[size],
        className
      )}
    >
      {initials(profile?.fullName, profile?.email)}
    </span>
  )
}

export function AvatarStack({ profiles = [], max = 3, size = 'xs' }) {
  const shown = profiles.slice(0, max)
  const rest = profiles.length - shown.length

  return (
    <span className="flex -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.id} profile={p} size={size} className="ring-2 ring-white" />
      ))}
      {rest > 0 ? (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-[9px] font-semibold text-ink-600 ring-2 ring-white">
          +{rest}
        </span>
      ) : null}
    </span>
  )
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export function Spinner({ className }) {
  return (
    <span
      role="status"
      aria-label="Bezig met laden"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-accent-600',
        className
      )}
    />
  )
}

export function EmptyState({ title, description, action, icon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-200 px-6 py-12 text-center">
      {icon ? <div className="text-ink-300">{icon}</div> : null}
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function ProgressBar({ value, color = '#3377ff', className }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Overlays ───────────────────────────────────────────────────────────────

/** Escape closes, the backdrop closes, and focus starts inside the panel. */
function useDismiss(open, onClose, panelRef) {
  useEffect(() => {
    if (!open) return undefined

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)

    const previous = document.activeElement
    panelRef.current?.focus?.()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose, panelRef])
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  const panelRef = useRef(null)
  useDismiss(open, onClose, panelRef)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-ink-950/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl',
          width
        )}
      >
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Sluiten">
            ✕
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, subtitle, children, footer }) {
  const panelRef = useRef(null)
  useDismiss(open, onClose, panelRef)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/30" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-drawer"
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink-900">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-ink-500">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Sluiten">
            ✕
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-between gap-2 border-t border-ink-100 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  )
}

export function ConfirmButton({ onConfirm, children, question = 'Zeker weten?', ...props }) {
  return (
    <Button
      {...props}
      onClick={() => {
        if (window.confirm(question)) onConfirm?.()
      }}
    >
      {children}
    </Button>
  )
}
