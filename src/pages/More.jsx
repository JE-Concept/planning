import { NavLink } from 'react-router-dom'
import { Icon } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { useTaal } from '@context/TaalProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { MORE } from '@components/layout/Sidebar'

/** Op een telefoon: de schermen die niet in de balk onderaan passen. */
export default function More() {
  const { boards, eventsList } = useWorkspace()
  const { t } = useTaal()
  const items = [
    ...MORE,
    ...boards.filter((l) => l.id !== eventsList?.id).map((l) => ({ to: `/bord/${l.id}`, icon: 'kanban', label: l.name })),
  ]
  return (
    <div>
      <PageHeader eyebrow="JE Plan" title={t('menu.meer')} />
      <div className="je-pagebody">
        <nav className="je-panel">
          {items.map((item, i) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="je-hover-quiet"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-5)',
                borderTop: i ? '1px solid var(--border-hairline)' : 'none',
                color: 'var(--text-1)',
                font: 'var(--type-body-sm)',
                textDecoration: 'none',
              }}
            >
              <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
                <Icon name={item.icon} size={18} />
              </span>
              <span style={{ flex: 1 }}>{item.sleutel ? t(item.sleutel) : item.label}</span>
              <Icon name="chevron-right" size={16} />
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
