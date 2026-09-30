import { Children, cloneElement, forwardRef, isValidElement, useEffect, useId, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, ArrowUp, Briefcase, Building2, CalendarDays, Check, CheckCircle, ChevronDown,
  ChevronLeft, ChevronRight, Circle, ClipboardCheck, Clock, CloudOff, Copy, CornerDownLeft, Download, Euro,
  FileText, Info, Kanban, Keyboard, LayoutDashboard, Lightbulb, ListChecks, Loader, Lock, LogIn, LogOut,
  Mail, MapPin, Menu, MessageSquare, MessagesSquare, Music4, Paperclip, Pencil, Play, Plus, Repeat, Search, Settings, Share2,
  ShieldCheck, Sparkles, Square, Sun, Target, Timer, Trash2, Upload, Users, Utensils, X,
} from 'lucide-react'
import { cn } from '@lib/cn'

/**
 * De componenten uit het JE Concept Design System, als React.
 *
 * Ze volgen de bibliotheek uit het design één op één — dezelfde namen,
 * dezelfde props, dezelfde klassen (`je-btn`, `je-badge`, …) uit
 * src/styles/je-ds.css. Zo blijft wat in het design staat en wat in de app
 * staat hetzelfde ding, en kan een wijziging in het design hier overgenomen
 * worden zonder te vertalen.
 */

// Lucide is de iconenset van het merk (1,5px lijn, ronde uiteinden). Alleen
// wat de app gebruikt komt mee in de bundel.
const ICONS = {
  'alert-triangle': AlertTriangle,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  briefcase: Briefcase,
  building: Building2,
  'calendar-days': CalendarDays,
  check: Check,
  'check-circle': CheckCircle,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  circle: Circle,
  'clipboard-check': ClipboardCheck,
  clock: Clock,
  'cloud-off': CloudOff,
  copy: Copy,
  'corner-down-left': CornerDownLeft,
  download: Download,
  euro: Euro,
  'file-text': FileText,
  info: Info,
  kanban: Kanban,
  keyboard: Keyboard,
  'layout-dashboard': LayoutDashboard,
  lightbulb: Lightbulb,
  'list-checks': ListChecks,
  loader: Loader,
  lock: Lock,
  'log-in': LogIn,
  'log-out': LogOut,
  mail: Mail,
  'map-pin': MapPin,
  menu: Menu,
  'message-square': MessageSquare,
  'messages-square': MessagesSquare,
  'music-4': Music4,
  paperclip: Paperclip,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  repeat: Repeat,
  search: Search,
  settings: Settings,
  'share-2': Share2,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  square: Square,
  sun: Sun,
  target: Target,
  timer: Timer,
  'trash-2': Trash2,
  upload: Upload,
  users: Users,
  utensils: Utensils,
  x: X,
}

export const ICON_NAMES = Object.keys(ICONS)

export function Icon({ name, size = 20, strokeWidth = 1.5, className, style, ...rest }) {
  const Glyph = ICONS[name]
  if (!Glyph) return <span className={cn('je-icon', className)} style={{ width: size, height: size, ...style }} />
  return (
    <Glyph
      className={cn('je-icon', className)}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      style={style}
      {...rest}
    />
  )
}

/**
 * `as` maakt hiervan een link met het uiterlijk van een knop.
 *
 * Dat is geen kosmetiek: "Naar het bord" hoort een echte link te zijn, zodat je
 * hem in een nieuw tabblad kunt openen en een voorleesprogramma hem als link
 * aankondigt. Een `<button>` met een `onClick` die navigeert kan dat allebei
 * niet. `type` en `disabled` horen alleen bij een echte knop en gaan daarom niet
 * mee naar een ander element.
 */
export const Button = forwardRef(function Button(
  {
    children,
    as: Element = 'button',
    variant = 'primary',
    size = 'md',
    iconLeft,
    iconRight,
    block = false,
    loading = false,
    disabled = false,
    type = 'button',
    className,
    ...rest
  },
  ref
) {
  const gs = size === 'lg' ? 16 : size === 'sm' ? 13 : 14
  const knop = Element === 'button'

  return (
    <Element
      ref={ref}
      {...(knop ? { type, disabled: disabled || loading } : {})}
      className={cn('je-btn', `je-btn--${variant}`, `je-btn--${size}`, block && 'je-btn--block', className)}
      aria-disabled={disabled || loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? <span className="je-btn__spinner" /> : null}
      {!loading && iconLeft ? <Icon name={iconLeft} size={gs} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={gs} /> : null}
    </Element>
  )
})

export function IconButton({ icon, label, variant = 'bare', size = 'md', className, ...rest }) {
  const px = size === 'lg' ? 22 : size === 'sm' ? 16 : 18
  return (
    <button
      type="button"
      className={cn('je-iconbtn', `je-iconbtn--${variant}`, `je-iconbtn--${size}`, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={px} />
    </button>
  )
}

export function Badge({ children, tone = 'neutral', dot = false, className, ...rest }) {
  return (
    <span className={cn('je-badge', tone !== 'neutral' && `je-badge--${tone}`, className)} {...rest}>
      {dot ? <span className="je-badge__dot" /> : null}
      {children}
    </span>
  )
}

export function Tag({ children, selected = false, selectable = false, onRemove, onClick, className, ...rest }) {
  const clickable = selectable || !!onClick
  return (
    <span
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.(e)
              }
            }
          : undefined
      }
      aria-pressed={selectable ? selected : undefined}
      className={cn('je-tag', clickable && 'je-tag--selectable', selected && 'je-tag--selected', className)}
      {...rest}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          className="je-tag__remove"
          aria-label="Verwijder"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(e)
          }}
        >
          <Icon name="x" size={13} />
        </button>
      ) : null}
    </span>
  )
}

export function Tabs({ items = [], value, onChange, variant = 'underline', className, style }) {
  return (
    <div
      role="tablist"
      className={cn('je-tabs', variant === 'pills' && 'je-tabs--pills', 'je-tabs--scroll', className)}
      style={style}
    >
      {items.map((it) => {
        const v = typeof it === 'string' ? it : it.value
        const l = typeof it === 'string' ? it : it.label
        const on = v === value
        return (
          <button
            key={v}
            role="tab"
            aria-selected={on}
            type="button"
            className={cn('je-tab', on && 'je-tab--active')}
            onClick={() => onChange?.(v)}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

export function Checkbox({ label, description, checked, defaultChecked, onChange, disabled = false, className, style, ...rest }) {
  const [inner, setInner] = useState(!!defaultChecked)
  const isOn = checked === undefined ? inner : checked
  return (
    <label
      className={cn('je-choice', disabled && 'je-choice--disabled', className)}
      style={{ position: 'relative', ...style }}
    >
      <input
        type="checkbox"
        className="je-choice__native"
        checked={isOn}
        disabled={disabled}
        onChange={(e) => {
          if (checked === undefined) setInner(e.target.checked)
          onChange?.(e)
        }}
        {...rest}
      />
      <span className={cn('je-check', isOn && 'je-check--on')} aria-hidden="true">
        {isOn ? <Icon name="check" size={12} strokeWidth={2.5} /> : null}
      </span>
      {label || description ? (
        <span>
          {label}
          {description ? <span className="je-choice__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  )
}

export function Switch({ label, checked, onChange, disabled = false, className, ...rest }) {
  return (
    <label
      className={cn('je-choice', disabled && 'je-choice--disabled', className)}
      style={{ position: 'relative', alignItems: 'center' }}
    >
      <input
        type="checkbox"
        role="switch"
        className="je-choice__native"
        checked={!!checked}
        disabled={disabled}
        onChange={onChange}
        {...rest}
      />
      <span className={cn('je-switch', checked && 'je-switch--on')} aria-hidden="true">
        <span className="je-switch__knob" />
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  )
}

export function Field({ label, hint, error, required = false, htmlFor, children, className, style }) {
  // Het label hangt aan het veld, ook als de aanroeper geen id meegaf. Zonder
  // die koppeling heeft een invoerveld geen naam: een voorleesprogramma noemt
  // het "tekstveld" en een klik op het label zet de cursor er niet in. Omdat
  // het label hier naast het veld staat en niet eromheen, moet dat hier
  // gebeuren — en dan meteen voor alle schermen in plaats van per stuk.
  const gegenereerd = useId()
  const enige = Children.count(children) === 1 ? Children.only(children) : null
  const koppelbaar = enige && isValidElement(enige) && !enige.props.id && !enige.props['aria-label']
  const id = htmlFor ?? (koppelbaar ? gegenereerd : undefined)

  return (
    <div className={cn('je-field', className)} style={style}>
      {label ? (
        <label className="je-field__label" htmlFor={id}>
          {label}
          {required ? <span className="je-field__req"> *</span> : null}
        </label>
      ) : null}
      {id && koppelbaar && !htmlFor ? cloneElement(enige, { id }) : children}
      {error ? <span className="je-field__error">{error}</span> : hint ? <span className="je-field__hint">{hint}</span> : null}
    </div>
  )
}

// Velden geven hun ref door: een zoekveld dat bij het openen de focus pakt of
// een invoer die na het opslaan leeggemaakt wordt, heeft het echte element
// nodig. Zonder dit moet elk scherm zijn eigen <input> schrijven.
export const Input = forwardRef(function Input({ boxed = false, invalid = false, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn('je-input', boxed && 'je-input--boxed', invalid && 'je-input--invalid', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})

export const Textarea = forwardRef(function Textarea({ boxed = false, className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('je-textarea', boxed && 'je-textarea--boxed', className)} {...rest} />
})

export const Select = forwardRef(function Select(
  { options = [], placeholder, boxed = false, className, children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={cn('je-select', boxed && 'je-select--boxed', className)} {...rest}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return (
          <option key={v} value={v}>
            {l}
          </option>
        )
      })}
      {children}
    </select>
  )
})

/**
 * Wegklikken zoals het hoort: escape sluit, de focus begint binnenin, en de
 * pagina eronder scrollt niet mee. Eén keer geschreven voor dialoog én
 * zijpaneel, want een halve versie hiervan is hoe een overlay ergens anders
 * plots anders aanvoelt.
 */
function useDismiss(open, onClose, panelRef) {
  useEffect(() => {
    if (!open) return undefined

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)

    const vorige = document.activeElement
    panelRef?.current?.focus?.()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      vorige?.focus?.()
    }
  }, [open, onClose, panelRef])
}

export function Dialog({ open = false, title, onClose, footer, width, children, className }) {
  const panel = useRef(null)
  useDismiss(open, onClose, panel)

  if (!open) return null
  return (
    <div className={cn('je-dialog', className)} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="je-dialog__scrim" onClick={onClose} />
      <div ref={panel} tabIndex={-1} className="je-dialog__panel" style={width ? { maxWidth: width } : undefined}>
        {onClose ? (
          <span className="je-dialog__close">
            <IconButton icon="x" label="Sluiten" onClick={onClose} />
          </span>
        ) : null}
        {title ? <h2 className="je-dialog__title">{title}</h2> : null}
        <div className="je-dialog__body">{children}</div>
        {footer ? <div className="je-dialog__footer">{footer}</div> : null}
      </div>
    </div>
  )
}

/**
 * Het zeshoekje uit het logo, met initialen. Staat overal waar het design een
 * persoon toont: in lijsten, op kaarten, in de werklast.
 */
export function Hex({ children, size = 26, tone = 'pale', title, className, style }) {
  const tones = {
    pale: { background: 'var(--navy-100)', color: 'var(--navy-800)' },
    ink: { background: 'var(--navy-800)', color: 'var(--white)' },
    muted: { background: 'var(--slate-100)', color: 'var(--slate-500)' },
    quiet: { background: 'var(--navy-50)', color: 'var(--text-accent)' },
  }
  return (
    <span
      title={title}
      className={cn('je-hexchip', className)}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        fontSize: size >= 34 ? 12 : size >= 26 ? 10 : 9,
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/** Initialen van een profiel: "Jasper Hansen" → "JH". */
export function initialsOf(profile) {
  const name = (profile?.fullName || profile?.email || '?').trim()
  const parts = name.split(/[\s@.]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}

const LOGO_SRC = `${import.meta.env.BASE_URL}brand/je-concept-logo.png`

/**
 * Het JE Concept-woordmerk: het zeshoekige logo met "JE" en "Concept" ernaast.
 *
 * Het logobestand hoort in public/brand/je-concept-logo.png. Ontbreekt het,
 * dan valt de app terug op een getekend zeshoekje met JE, zodat er nooit een
 * gebroken afbeelding in de zijbalk staat.
 */
export function Logotype({ size = 40, invert = false, word = true, className, style }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={cn('je-logotype', className)} style={{ fontSize: Math.round(size * 0.62), ...style }}>
      {failed ? (
        <span
          className="je-hexchip"
          aria-label="JE Concept"
          style={{
            width: size,
            height: size,
            flex: `0 0 ${size}px`,
            background: invert ? 'var(--navy-100)' : 'var(--navy-800)',
            color: invert ? 'var(--navy-950)' : 'var(--white)',
            fontFamily: 'var(--font-serif)',
            fontSize: Math.round(size * 0.36),
          }}
        >
          JE
        </span>
      ) : (
        <img
          className={cn('je-logotype__mark', invert && 'je-logotype__mark--invert')}
          src={LOGO_SRC}
          alt="JE Concept"
          width={size}
          height={size}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      )}
      {word ? (
        <span className="je-logotype__word">
          <span className="je-logotype__je">JE</span>
          <span className="je-logotype__concept">Concept</span>
        </span>
      ) : null}
    </span>
  )
}

/** Eyebrow + titel + acties: de kop van elk scherm in het design. */
export function Eyebrow({ children, className, style }) {
  return (
    <div className={cn('je-eyebrow', className)} style={style}>
      {children}
    </div>
  )
}

export function PanelHead({ label, sub, right, color, className }) {
  return (
    <div className={cn('je-panel__head', className)}>
      <span className="je-eyebrow" style={color ? { color } : undefined}>
        {label}
      </span>
      {sub ? <span className="je-panel__sub">{sub}</span> : null}
      {right != null ? <span className="je-panel__right">{right}</span> : null}
    </div>
  )
}

/** Dun voortgangsbalkje van 3px onder kaarten en rijen. */
export function Bar({ pct, color = 'var(--accent)', height = 3 }) {
  return (
    <span className="je-bar" style={{ height }}>
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </span>
  )
}

export function Stat({ label, value, sub }) {
  return (
    <div className="je-stat">
      <div className="je-caps">{label}</div>
      <div className="je-stat__value">{value}</div>
      {sub ? <div className="je-muted-caption">{sub}</div> : null}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   De rest van het systeem.

   Deze onderdelen stonden in een tweede componentenset met eigen kleuren. Ze
   staan nu hier, op dezelfde tokens, zodat er één antwoord is op "hoe ziet een
   avatar, een spinner of een zijpaneel eruit".
   ═══════════════════════════════════════════════════════════════════════════ */

/** Initialen uit een naam, of anders uit een adres. */
export function initials(fullName, email) {
  const bron = (fullName ?? '').trim()
  if (bron) {
    const delen = bron.split(/\s+/)
    return ((delen[0]?.[0] ?? '') + (delen.length > 1 ? delen[delen.length - 1][0] : '')).toUpperCase()
  }
  return (email ?? '?').slice(0, 2).toUpperCase()
}

export function Avatar({ profile, size = 'sm', ring = false, className, ...rest }) {
  const label = profile?.fullName || profile?.email || 'Niet toegewezen'
  const klassen = cn('je-avatar', `je-avatar--${size}`, ring && 'je-avatar--ring', className)

  if (profile?.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt={label}
        title={label}
        referrerPolicy="no-referrer"
        className={klassen}
        {...rest}
      />
    )
  }

  return (
    <span title={label} className={klassen} {...rest}>
      {initials(profile?.fullName, profile?.email)}
    </span>
  )
}

/** Een paar avatars naast elkaar, met een telling voor de rest. */
export function AvatarStack({ profiles = [], max = 3, size = 'xs', className }) {
  const getoond = profiles.slice(0, max)
  const rest = profiles.length - getoond.length

  return (
    <span className={cn('je-avatars', className)}>
      {getoond.map((p, i) => (
        <Avatar key={p.id ?? i} profile={p} size={size} ring />
      ))}
      {rest > 0 ? <span className="je-avatars__rest">+{rest}</span> : null}
    </span>
  )
}

export function Spinner({ size = 'md', className }) {
  return (
    <span
      role="status"
      aria-label="Bezig met laden"
      className={cn('je-spinner', size === 'lg' && 'je-spinner--lg', className)}
    />
  )
}

export function EmptyState({ title, description, action, icon, className }) {
  return (
    <div className={cn('je-empty', className)}>
      {icon ? (
        <span className="je-empty__icon">
          {typeof icon === 'string' ? <Icon name={icon} size={24} /> : icon}
        </span>
      ) : null}
      <p className="je-empty__title">{title}</p>
      {description ? <p className="je-empty__text">{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  )
}

/** Voortgang van 0 tot 1. De dunne variant onder een kaart is `Bar`. */
export function ProgressBar({ value = 0, color, className }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('je-progress', className)}
    >
      <span
        className="je-progress__fill"
        style={{ width: `${pct}%`, ...(color ? { background: color } : null) }}
      />
    </div>
  )
}

export function Dot({ color, className, ...rest }) {
  return (
    <span
      aria-hidden="true"
      className={cn('je-dot', className)}
      style={color ? { background: color } : undefined}
      {...rest}
    />
  )
}

/**
 * Een paneel dat van rechts inschuift.
 *
 * Escape sluit, de achtergrond sluit, de focus begint binnenin en de pagina
 * eronder scrollt niet mee — anders raak je bij het sluiten je plek kwijt.
 */
export function Drawer({ open = false, onClose, title, subtitle, children, footer, className }) {
  const panel = useRef(null)
  useDismiss(open, onClose, panel)

  if (!open) return null

  return (
    <div className={cn('je-drawer', className)}>
      <div className="je-drawer__scrim" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="je-drawer__panel"
      >
        <header className="je-drawer__head">
          <div style={{ minWidth: 0 }}>
            <div className="je-drawer__title">{title}</div>
            {subtitle ? <div className="je-drawer__sub">{subtitle}</div> : null}
          </div>
          <IconButton icon="x" label="Sluiten" onClick={onClose} />
        </header>
        <div className="je-drawer__body">{children}</div>
        {footer ? <footer className="je-drawer__foot">{footer}</footer> : null}
      </aside>
    </div>
  )
}

/** Een knop die eerst vraagt of je het zeker weet. */
export function ConfirmButton({ onConfirm, children, question = 'Zeker weten?', ...rest }) {
  return (
    <Button
      {...rest}
      onClick={() => {
        if (window.confirm(question)) onConfirm?.()
      }}
    >
      {children}
    </Button>
  )
}
