import { cn } from '@lib/cn'
import { Icon } from '@components/ds'
import { Link } from 'react-router-dom'

/**
 * De kop van elk scherm, zoals in het design: een eyebrow in brede kapitalen,
 * de titel in Oswald, en de acties rechts onderaan uitgelijnd.
 *
 * Schermen die nog geen eyebrow meegeven (de oudere pagina's) tonen hun
 * ondertitel als een rustige regel onder de titel.
 */
export default function PageHeader({ title, eyebrow, subtitle, actions, tabs, back, className }) {
  return (
    <header className={cn('je-pagehead', className)}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {back ? (
          <Link
            to={back.to}
            className="je-plainbtn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 'var(--space-4)',
              color: 'var(--text-2)',
              font: 'var(--type-body-sm)',
              textDecoration: 'none',
            }}
          >
            <Icon name="chevron-left" size={16} />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <div className="je-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="je-muted-caption" style={{ marginTop: 4, fontSize: 13 }}>{subtitle}</p> : null}
      </div>
      {actions ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>{actions}</div>
      ) : null}
      {tabs ? (
        <div className="je-tabs je-tabs--scroll" style={{ flexBasis: '100%', marginBottom: 'calc(-1 * var(--space-6) - 1px)', border: 0 }}>
          {tabs}
        </div>
      ) : null}
    </header>
  )
}

/** Tab in de kop van een ouder scherm; zelfde vorm als de tabs in het design. */
export function Tab({ active, children, ...props }) {
  return (
    <button type="button" role="tab" aria-selected={!!active} className={cn('je-tab', active && 'je-tab--active')} {...props}>
      {children}
    </button>
  )
}
