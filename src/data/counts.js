import { useMemo } from 'react'
import { dayKey } from '@lib/dates'
import { isWeekend, runProgress } from '@lib/checklist-templates'
import { useAuth } from '@context/AuthProvider'
import { useChecklists, useRunsForDay } from '@data/checklists'
import { useReviewQueue } from '@data/social'
import { useMyTasks } from '@data/tasks'

/**
 * De getallen naast de navigatie.
 *
 * Eén plek, en één keer geabonneerd: de zijbalk staat twee keer in de boom
 * (vast links, en in de mobiele lade), en elk van die twee zijn eigen
 * abonnementen laten openen is dubbel werk voor hetzelfde antwoord.
 *
 * Wat geteld wordt, is steeds "wat wacht er op mij of op ons vandaag" — niet
 * hoeveel er in totaal bestaat. Een teller die nooit op nul komt leert je
 * hem te negeren.
 */
export function useNavCounts() {
  const { uid, isStaff } = useAuth()

  const { tasks } = useMyTasks(isStaff ? null : uid)
  const review = useReviewQueue(undefined, { enabled: !isStaff })

  const today = dayKey()
  const weekend = isWeekend()
  const { checklists } = useChecklists()
  const { byChecklist } = useRunsForDay(today)

  const openChecklistItems = useMemo(
    () =>
      checklists.reduce((total, list) => {
        const { done, total: n } = runProgress(list, byChecklist[list.id], { weekend })
        return total + (n - done)
      }, 0),
    [checklists, byChecklist, weekend]
  )

  return useMemo(
    () => ({
      '/mijn-werk': tasks.length,
      '/social': review.length,
      '/openen-sluiten': openChecklistItems,
    }),
    [tasks.length, review.length, openChecklistItems]
  )
}
