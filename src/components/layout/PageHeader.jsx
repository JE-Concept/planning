import { cn } from '@lib/cn'
import { Acties, Icon } from '@components/ds'
import { Link } from 'react-router-dom'

/**
 * De kop van elk scherm, zoals in het design: een eyebrow in brede kapitalen,
 * de titel in Oswald, en de acties rechts onderaan uitgelijnd.
 *
 * Schermen die nog geen eyebrow meegeven (de oudere pagina's) tonen hun
 * ondertitel als een rustige regel onder de titel.
 *
 * Rechts staan twee soorten dingen, en ze worden niet meer door elkaar gezet:
 * - `bediening`: wat het beeld verandert maar niets doet (bladeren door een
 *   periode, een filter, een zoekveld, een statusbadge);
 * - `acties`: wat iets doet, als `{ hoofd, tweede, gevaar }` voor `Acties`. De
 *   hoofdactie van de pagina ("Nieuw event") staat zo overal op dezelfde plek
 *   en in dezelfde vorm: helemaal rechts en gevuld.
 */
export default function PageHeader({ title, eyebrow, subtitle, bediening, acties, tabs, back, className }) {
  return (
    <header className={cn('je-pagehead', className)}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {back ? (
          <Link
            to={back.to}
            // `je-terug` geeft hem op een telefoon een raakvlak; met een muis
            // blijft het een regel tekst. Zie `@media (pointer: coarse)`.
            className="je-plainbtn je-terug"
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
      {bediening || acties ? (
        <div className="je-pagehead__rechts">
          {bediening}
          {acties ? <Acties plaats="kop" {...acties} /> : null}
        </div>
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
