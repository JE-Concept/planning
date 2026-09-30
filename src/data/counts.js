import { useMemo } from 'react'
import { dayKey } from '@lib/dates'
import { runProgress } from '@lib/checklist-templates'
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
  const { uid, isStaff, isSocial, profile } = useAuth()

  /*
    Elke teller vraagt alleen wat deze rol mag lezen.

    Dat is geen zuinigheid maar noodzaak: een vraag die de regels weigeren komt
    terug als een fout, niet als een leeg antwoord — en die fout staat dan in de
    console van iemand die niets verkeerd deed. De socialrol mag de taken en de
    afvinklijsten niet lezen; personeel de taken niet.
  */
  const { tasks } = useMyTasks(isStaff || isSocial ? null : uid)
  const review = useReviewQueue(undefined, { enabled: !isStaff })

  const today = dayKey()
  const { checklists } = useChecklists({ aan: !isSocial })
  const { byChecklist } = useRunsForDay(today, { aan: !isSocial })

  /*
    Met dezelfde ogen tellen als de pagina zelf.

    Dit stond eerder los van wie er kijkt, en dan telt `runProgress` alleen de
    punten die voor iedereen zijn. De zijbalk zei dan 5 terwijl er op de pagina
    24, 36, 12 en 5 open stonden — vier lijsten met werk, en een cijfer waar je
    niets aan kon afleiden. Een teller die niet klopt is erger dan geen teller,
    want je leert hem wegkijken.
  */
  const openChecklistItems = useMemo(
    () =>
      checklists.reduce((total, list) => {
        const { done, total: n } = runProgress(list, byChecklist[list.id], {
          date: new Date(),
          person: profile,
        })
        return total + (n - done)
      }, 0),
    [checklists, byChecklist, profile]
  )

  return useMemo(
    () => ({
      '/tasks': tasks.length,
      '/social': review.length,
      '/openen-sluiten': openChecklistItems,
    }),
    [tasks.length, review.length, openChecklistItems]
  )
}
