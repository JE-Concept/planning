import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { COL, col, fromQuery, ref } from '@lib/collections'

/**
 * De events zonder één bedrag erin, voor wie de echte niet mag lezen.
 *
 * Twee rollen lezen hier: de socialrol, die content maakt bij events, en de
 * medewerkers, die de events willen zien waarop ze staan. Welke rijen wie mag,
 * staat in `firestore.rules` — de socialrol alle, een medewerker alleen die
 * waar hij zelf in `medewerkers` staat.
 *
 * Hieronder: de socialrol ziet ze allemaal.
 *
 * `socialEvents` is een kale kopie van de events die content moeten opleveren,
 * bijgehouden door een trigger. Waarom die kopie bestaat staat in
 * `functions/social-projectie.js`; kort: Firestore kan geen velden verbergen,
 * dus "geen prijzen zien" kan alleen door de events zelf niet te mogen lezen.
 *
 * `aan` staat erbij zodat het scherm dit abonnement niet opent voor wie de
 * echte events wél mag lezen. Twee bronnen tegelijk openen zou dezelfde kaarten
 * twee keer binnenhalen, en voor het team is de kale kopie de mindere van de
 * twee.
 */
export function useSocialEventKaarten({ aan = true } = {}) {
  const [kaarten, setKaarten] = useState([])
  const [loading, setLoading] = useState(aan)

  useEffect(() => {
    if (!aan) {
      setKaarten([])
      setLoading(false)
      return undefined
    }

    return onSnapshot(
      query(col(COL.socialEvents), where('archived', '==', false)),
      (snap) => {
        setKaarten(fromQuery(snap).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [aan])

  return { events: kaarten, loading }
}

/**
 * Zoeken in de kale kopieën, voor de projectkiezer van de socialrol.
 *
 * Het team zoekt in `tasks`; die collectie mag zij niet lezen, dus zocht ze in
 * een lijst die altijd leeg bleef — met een rechtenfout erachter. Hier komt ze
 * wel ergens: een post aan een event hangen lukt, alleen uit een kortere lijst.
 * Dat is geen beperking maar de waarheid — in deze kopie staan precies de events
 * die content moeten opleveren, en aan de andere heeft ze niets te hangen.
 */
export function useMijnEvents(uid) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(Boolean(uid))

  useEffect(() => {
    if (!uid) {
      setEvents([])
      setLoading(false)
      return undefined
    }

    /*
      De vraag is zelf al beperkt tot wat deze persoon mag zien, en dat moet
      ook: de regels staan een medewerker alleen de rijen toe waar hij in
      `medewerkers` staat, en Firestore weigert een `list` die méér zou kunnen
      opleveren. Een breder abonnement met een filter erachteraan geeft hier
      dus geen gegevens maar een rechtenfout — en dat is de bedoeling.

      Geen `orderBy` erbij: dat zou een samengestelde index vragen voor een
      lijst van hooguit een stuk of twintig events. Sorteren doet de browser.
    */
    return onSnapshot(
      query(col(COL.socialEvents), where('medewerkers', 'array-contains', uid)),
      (snap) => {
        setEvents(
          fromQuery(snap)
            .filter((e) => !e.parentId)
            .sort((a, b) => new Date(a.eventDate ?? 0) - new Date(b.eventDate ?? 0))
        )
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [uid])

  return { events, loading }
}

export function useSocialEventZoeker(term, { max = 25, enabled = true } = {}) {
  const { events, loading } = useSocialEventKaarten({ aan: enabled })

  const results = useMemo(() => {
    const naald = term.trim().toLowerCase()
    const hoofd = events.filter((e) => !e.parentId)
    if (!naald) return hoofd.slice(0, max)
    return hoofd
      .filter((e) => `${e.title ?? ''} ${e.listName ?? ''}`.toLowerCase().includes(naald))
      .slice(0, max)
  }, [events, term, max])

  return { results, loading }
}

/** Eén kale kopie, live — voor het paneel dat erbij hoort. */
export function useSocialEventKaart(id) {
  const [kaart, setKaart] = useState(null)

  useEffect(() => {
    if (!id) return setKaart(null)
    return onSnapshot(
      ref(COL.socialEvents, id),
      (snap) => setKaart(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setKaart(null)
    )
  }, [id])

  return kaart
}
