import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { COL, col, fromQuery } from '@lib/collections'
import { useAuth } from './AuthProvider'

const WorkspaceContext = createContext(null)

/**
 * The small, slow-moving collections — people, brands, spaces, lists, tags.
 * They fit in memory, every screen needs them, and keeping one live
 * subscription per collection costs far less than re-reading them per view.
 */
export function WorkspaceProvider({ children }) {
  const { state, isStaff } = useAuth()
  const [data, setData] = useState({
    profiles: [],
    brands: [],
    spaces: [],
    folders: [],
    lists: [],
    tags: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (state !== 'ready') return undefined

    // Personeel mag alleen de profielen lezen — de rest van de werkruimte is
    // voor hen gesloten. Die abonnementen dan toch openen levert een scherm vol
    // rechtenfouten op in plaats van een lijst.
    const pending = isStaff
      ? new Set(['profiles'])
      : new Set(['profiles', 'brands', 'spaces', 'folders', 'lists', 'tags'])
    const settle = (key) => {
      pending.delete(key)
      if (pending.size === 0) setLoading(false)
    }

    setError(null)

    // Elk abonnement moet ook bij een fout "klaar" melden. Anders blijft er
    // eentje openstaan in de teller en blijft het hele scherm hangen op
    // "Werkruimte laden…" — een molentje dat nooit stopt, zonder te zeggen
    // waarom. Dat is precies zo onbruikbaar als een wit scherm.
    const subscribe = (key, q) =>
      onSnapshot(
        q,
        (snap) => {
          setData((current) => ({ ...current, [key]: fromQuery(snap) }))
          settle(key)
        },
        (err) => {
          console.error(`JE Plan: ${key} kon niet geladen worden`, err)
          setError(err)
          settle(key)
        }
      )

    const unsubscribers = [
      subscribe('profiles', query(col(COL.profiles), orderBy('email'))),
      ...(isStaff
        ? []
        : [
            subscribe('brands', query(col(COL.brands), orderBy('position'))),
            subscribe('spaces', query(col(COL.spaces), orderBy('position'))),
            subscribe('folders', query(col(COL.folders), orderBy('position'))),
            subscribe('lists', query(col(COL.lists), orderBy('position'))),
            subscribe('tags', query(col(COL.tags), orderBy('name'))),
          ]),
    ]

    return () => unsubscribers.forEach((stop) => stop())
  }, [state, isStaff])

  const value = useMemo(() => {
    const byId = (items) => Object.fromEntries(items.map((i) => [i.id, i]))
    const activeLists = data.lists.filter((l) => !l.archived)

    return {
      ...data,
      loading,
      error,
      activeLists,
      boards: activeLists.filter((l) => l.kind !== 'social'),
      socialLists: activeLists.filter((l) => l.kind === 'social'),
      profileById: byId(data.profiles),
      brandById: byId(data.brands),
      listById: byId(data.lists),
      spaceById: byId(data.spaces),
      folderById: byId(data.folders),
      /** Board columns live on the list document, so no extra read per board. */
      statusesOf: (listId) =>
        [...(data.lists.find((l) => l.id === listId)?.statuses ?? [])].sort(
          (a, b) => a.position - b.position
        ),
    }
  }, [data, loading, error])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace moet binnen <WorkspaceProvider> gebruikt worden.')
  return ctx
}
