import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { COL, col, fromQuery, normalise } from '@lib/collections'
import { db } from '@lib/firebase'
import { isPipelineList } from '@lib/pipeline'
import { DEFAULT_FORMULES } from '@lib/formule-templates'
import { DEFAULT_TEMPLATES } from '@data/templates'
import { useAuth } from './AuthProvider'

const WorkspaceContext = createContext(null)

/*
  De kostenplaatsen voor werk dat niet aan een event hangt.

  Ze droegen een vlag `billable`, en die is weg: JE Concept werkt met een vaste
  prijs per event, dus "mag dit doorgerekend worden" was een vraag die nooit
  gesteld werd. Wat de kostenplaats nog doet is groeperen — hoeveel uur ging
  er naar administratie, hoeveel naar socials.
*/
export const DEFAULT_COST_CENTERS = [
  { name: 'Intern werk' },
  { name: 'Administratie & facturatie' },
  { name: 'Socials algemeen' },
]

/**
 * The small, slow-moving collections — people, brands, spaces, lists, tags.
 * They fit in memory, every screen needs them, and keeping one live
 * subscription per collection costs far less than re-reading them per view.
 */
export function WorkspaceProvider({ children }) {
  const { state, isStaff, isSocial } = useAuth()
  const [data, setData] = useState({
    profiles: [],
    brands: [],
    spaces: [],
    folders: [],
    lists: [],
    tags: [],
    templates: [],
    formules: [],
    access: null,
    workspaceConfig: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vastgelopen, setVastgelopen] = useState(false)

  useEffect(() => {
    if (state !== 'ready') return undefined

    // Personeel mag alleen de profielen lezen — de rest van de werkruimte is
    // voor hen gesloten. Die abonnementen dan toch openen levert een scherm vol
    // rechtenfouten op in plaats van een lijst.
    const pending = isStaff
      ? new Set(['profiles'])
      : isSocial
        ? new Set(['profiles', 'brands', 'lists', 'tags'])
        : new Set(['profiles', 'brands', 'spaces', 'folders', 'lists', 'tags', 'templates', 'formules'])
    const settle = (key) => {
      pending.delete(key)
      if (pending.size === 0) {
        clearTimeout(klok)
        setLoading(false)
      }
    }

    setError(null)
    setVastgelopen(false)

    // Een fout meldt zich; een vastgelopen cache doet dat niet. Dan komt er
    // simpelweg nooit een eerste antwoord, en bleef "Werkruimte laden…" staan.
    // Deze klok maakt van dat stilzwijgen een scherm met een uitweg.
    const klok = setTimeout(() => {
      if (pending.size > 0) setVastgelopen(true)
    }, 15000)

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
      /*
        De socialrol leest alleen wat ze nodig heeft, en dat is precies wat de
        regels haar toestaan. Dat is geen overdaad aan voorzichtigheid: een
        abonnement dat de regels weigeren laat het hele scherm op een
        foutmelding stranden. Wat de client vraagt, moet spiegelen wat de regels
        toelaten — anders werkt er niets in plaats van iets minder.

        `formules` en `templates` staan er niet bij: daar staan prijzen in.
      */
      ...(isStaff
        ? []
        : isSocial
          ? [
              subscribe('brands', query(col(COL.brands), orderBy('position'))),
              subscribe('lists', query(col(COL.lists), orderBy('position'))),
              subscribe('tags', query(col(COL.tags), orderBy('name'))),
            ]
          : [
            subscribe('brands', query(col(COL.brands), orderBy('position'))),
            subscribe('spaces', query(col(COL.spaces), orderBy('position'))),
            subscribe('folders', query(col(COL.folders), orderBy('position'))),
            subscribe('lists', query(col(COL.lists), orderBy('position'))),
            subscribe('tags', query(col(COL.tags), orderBy('name'))),
            subscribe('templates', query(col(COL.templates), orderBy('position'))),
            subscribe('formules', query(col(COL.formules), orderBy('position'))),
            // Instellingen die het design toont: de toegelaten domeinen en de
            // kostenplaatsen. Twee kleine documenten; ontbreken ze, dan gelden
            // de standaarden. Ze tellen niet mee voor "geladen".
            onSnapshot(
              doc(db, COL.config, 'access'),
              (snap) => setData((c) => ({ ...c, access: snap.exists() ? snap.data() : null })),
              () => {}
            ),
            onSnapshot(
              doc(db, COL.config, 'workspace'),
              (snap) => setData((c) => ({ ...c, workspaceConfig: snap.exists() ? normalise(snap.data()) : null })),
              () => {}
            ),
          ]),
    ]

    return () => {
      clearTimeout(klok)
      unsubscribers.forEach((stop) => stop())
    }
  }, [state, isStaff, isSocial])

  const value = useMemo(() => {
    const byId = (items) => Object.fromEntries(items.map((i) => [i.id, i]))
    const activeLists = data.lists.filter((l) => !l.archived)
    const eventsList = activeLists.find(isPipelineList) ?? null
    const templates = data.templates.length ? data.templates : DEFAULT_TEMPLATES
    // Zolang er niets bewaard is gelden de voorbeeldformules, precies zoals bij
    // de templates: een lege werkruimte hoort al iets te kunnen.
    const formules = data.formules.length ? data.formules : DEFAULT_FORMULES

    return {
      ...data,
      templates,
      templatesStored: data.templates.length > 0,
      formules: formules.filter((f) => !f.archived),
      alleFormules: formules,
      formulesStored: data.formules.length > 0,
      eventsList,
      eventStatuses: [...(eventsList?.statuses ?? [])].sort((a, b) => a.position - b.position),
      allowedDomains: data.access?.allowedDomains ?? ['jeconcept.be', 'kenjeklanten.be'],
      costCenters: data.workspaceConfig?.costCenters ?? DEFAULT_COST_CENTERS,
      loading,
      error,
      vastgelopen,
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
  }, [data, loading, error, vastgelopen])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace moet binnen <WorkspaceProvider> gebruikt worden.')
  return ctx
}
