import { useEffect, useState } from 'react'
import { limit as limitTo, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { COL, col, fromQuery } from '@lib/collections'

/**
 * Het logboek lezen.
 *
 * Alleen lezen: schrijven doen de triggers, met beheerdersrechten, en de regels
 * laten een browser er niets in zetten. Dat is het punt van een logboek — een
 * regel die de app zelf kan schrijven of overslaan, bewijst niets.
 *
 * De vraag staat hier zo kaal mogelijk: de laatste N regels, nieuwste eerst.
 * Filteren op wie en op soort gebeurt in het scherm en niet in de query, om
 * twee redenen. Het zijn er een paar duizend, geen miljoen — dat filtert een
 * browser sneller dan een tweede ronde naar de database. En elke combinatie van
 * filters in de query zou een eigen index vragen, die uitgerold moet zijn
 * voordat het scherm het doet; tot dan is een filter die niets teruggeeft niet
 * te onderscheiden van een dag waarop er niets gebeurde.
 */
export function useLogboek({ max = 1000, soort = '', wie = '' } = {}) {
  const [regels, setRegels] = useState([])
  const [loading, setLoading] = useState(true)
  const [fout, setFout] = useState(null)

  useEffect(() => {
    setLoading(true)

    // Eén filter mag wel in de query: dat scheelt bij een lang logboek, en de
    // index ervoor staat klaar. Twee tegelijk niet — die combinatie filtert het
    // scherm.
    const delen = [col(COL.auditLog)]
    if (soort) delen.push(where('soort', '==', soort))
    else if (wie) delen.push(where('actorId', '==', wie))
    delen.push(orderBy('at', 'desc'), limitTo(max))

    return onSnapshot(
      query(...delen),
      (snap) => {
        setRegels(fromQuery(snap))
        setFout(null)
        setLoading(false)
      },
      (err) => {
        setFout(err)
        setLoading(false)
      }
    )
  }, [max, soort, wie])

  return { regels, loading, fout }
}

/** De geschiedenis van één ding — voor de knop "wat is hiermee gebeurd". */
export function useLogboekVan(documentId, { max = 50 } = {}) {
  const [regels, setRegels] = useState([])

  useEffect(() => {
    if (!documentId) return setRegels([])
    return onSnapshot(
      query(col(COL.auditLog), where('documentId', '==', documentId), orderBy('at', 'desc'), limitTo(max)),
      (snap) => setRegels(fromQuery(snap)),
      () => setRegels([])
    )
  }, [documentId, max])

  return regels
}
