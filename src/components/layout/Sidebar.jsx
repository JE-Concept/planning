import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@lib/cn'
import { Dot } from '@ui/index'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'

const MAIN = [
  { to: '/', label: 'Vandaag', end: true, icon: '◴' },
  { to: '/mijn-werk', label: 'Mijn werk', icon: '☑' },
  { to: '/social', label: 'Social kalender', icon: '▦' },
  { to: '/openen-sluiten', label: 'Openen & sluiten', icon: '☑' },
  { to: '/overleg', label: 'Teamoverleg', icon: '✎' },
  { to: '/uren', label: 'Uren', icon: '⏱' },
  { to: '/goals', label: 'Goals', icon: '◎' },
]

function itemClass({ isActive }) {
  return cn(
    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
    isActive
      ? 'bg-ink-800 font-medium text-white'
      : 'text-ink-300 hover:bg-ink-800/60 hover:text-white'
  )
}

export default function Sidebar({ onNavigate, counts = {} }) {
  const { spaces, boards, folderById } = useWorkspace()
  const { isStaff } = useAuth()
  const [collapsed, setCollapsed] = useState({})

  const main = isStaff ? MAIN.filter((item) => item.to === '/openen-sluiten') : MAIN

  // Boards hang under their space; a space with no boards is noise in a
  // sidebar, so it only appears once it has one.
  const grouped = useMemo(() => {
    return spaces
      .map((space) => ({
        space,
        lists: boards
          .filter((l) => l.spaceId === space.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      }))
      .filter((group) => group.lists.length > 0)
  }, [spaces, boards])

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="flex h-full w-60 shrink-0 flex-col gap-4 overflow-y-auto bg-navy-dark px-3 py-4"
    >
      <NavLink to="/" onClick={onNavigate} className="flex items-center gap-2 px-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-600 text-xs font-bold text-white">
          JE
        </span>
        <span className="text-sm font-semibold text-white">Planning</span>
      </NavLink>

      <ul className="space-y-0.5">
        {main.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={itemClass} onClick={onNavigate}>
              <span aria-hidden="true" className="w-4 text-center text-ink-400">
                {item.icon}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              {counts[item.to] ? (
                <span
                  className="shrink-0 text-xs font-semibold tabular-nums text-ink-400"
                  aria-label={`${counts[item.to]} openstaand`}
                >
                  {counts[item.to]}
                </span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        {(isStaff ? [] : grouped).map(({ space, lists }) => (
          <div key={space.id}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [space.id]: !c[space.id] }))}
              aria-expanded={!collapsed[space.id]}
              className="flex w-full items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400 hover:text-ink-200"
            >
              <span aria-hidden="true">{collapsed[space.id] ? '▸' : '▾'}</span>
              <Dot color={space.color} />
              <span className="truncate">{space.name}</span>
            </button>

            {!collapsed[space.id] ? (
              <ul className="space-y-0.5">
                {lists.map((list) => (
                  <li key={list.id}>
                    <NavLink
                      to={`/bord/${list.id}`}
                      className={itemClass}
                      onClick={onNavigate}
                      title={folderById[list.folderId]?.name}
                    >
                      <span aria-hidden="true" className="w-4 text-center text-ink-500">
                        ▤
                      </span>
                      <span className="truncate">{list.name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-auto">
        {isStaff ? null : (
        <NavLink to="/instellingen" className={itemClass} onClick={onNavigate}>
          <span aria-hidden="true" className="w-4 text-center text-ink-400">
            ⚙
          </span>
          Instellingen
        </NavLink>
        )}
      </div>
    </nav>
  )
}
