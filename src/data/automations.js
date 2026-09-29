import { useEffect, useState } from 'react'
import {
  deleteDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'

/**
 * De business rules zoals ze in Instellingen staan.
 *
 * Alleen beheren gebeurt hier; uitvoeren doet de server (een trigger op elke
 * taak die van status verandert). Dat is bewust: een taak verandert ook van
 * status op het bord van een collega of vanuit de overlegfunctie, en een regel
 * die alleen in deze browser draait, geldt dan niet.
 */

export function useAutomations() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.automations), orderBy('position')),
        (snap) => {
          setRules(fromQuery(snap))
          setLoading(false)
        },
        () => setLoading(false)
      ),
    []
  )

  return { rules, loading }
}

/**
 * Het logboek: welke regel vuurde, op welk document, en bij een tabel op welke
 * rij.
 *
 * Alleen de server schrijft hierin (zie `firestore.rules`), want alleen de
 * server weet het. Het team leest mee: "waarom staat deze taak ineens bij
 * iemand anders" is een vraag die een antwoord hoort te hebben, en dezelfde
 * lijn als het activiteitenlog bij een taak — bijschrijven, nooit herschrijven.
 */
export function useAutomationRuns({ max = 25 } = {}) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.automationRuns), orderBy('firedAt', 'desc'), limit(max)),
        (snap) => {
          setRuns(fromQuery(snap))
          setLoading(false)
        },
        // Een logboek dat niet laadt mag het beheerscherm niet meenemen.
        () => setLoading(false)
      ),
    [max]
  )

  return { runs, loading }
}

export function createAutomation(rule) {
  const automationRef = newRef(COL.automations)
  return setDoc(automationRef, {
    ...rule,
    name: (rule.name ?? '').trim(),
    position: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then(() => automationRef.id)
}

export function updateAutomation(id, patch) {
  return updateDoc(ref(COL.automations, id), { ...patch, updatedAt: serverTimestamp() })
}

export function deleteAutomation(id) {
  return deleteDoc(ref(COL.automations, id))
}
