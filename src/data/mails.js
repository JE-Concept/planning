import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { COL, col, fromQuery, ref } from '@lib/collections'
import { app } from '@lib/firebase'

/**
 * De post rond een event.
 *
 * Alleen lezen en koppelen. De berichten zelf komen van de ophaler in
 * `functions-mail/postvak.js` en worden nooit vanuit het scherm aangepast: een
 * draad die een browser kan bewerken, is geen bewijs meer van wat er gezegd
 * is. De rules staan dat ook niet toe — alleen `eventId`, `customerId`,
 * `koppeling` en `gelezen` mogen van hier veranderen.
 */

/** De maildraad van één event, oudste bovenaan — zoals een gesprek leest. */
export function useEventMails(eventId) {
  const [mails, setMails] = useState([])

  useEffect(() => {
    if (!eventId) {
      setMails([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.mails), where('eventId', '==', eventId), orderBy('datum')),
      (snap) => setMails(fromQuery(snap)),
      // Een geweigerde vraag is een fout en geen leeg antwoord; zonder deze
      // tak blijft het scherm de draad van het vórige event tonen.
      () => setMails([])
    )
  }, [eventId])

  return mails
}

/**
 * Wat nergens bij hoort: het postvak Aanvragen.
 *
 * Nieuwste bovenaan, want dit is een werklijst en geen gesprek: wie het opent,
 * wil weten wat er vanochtend binnenkwam. Die volgorde wordt hier omgedraaid
 * en niet aan Firestore gevraagd — dat zou een tweede index kosten die alleen
 * in de richting verschilt, voor een lijst die per definitie kort is. Is ze
 * lang, dan is er een heel ander probleem dan sorteren.
 */
export function useLosseMails() {
  const [mails, setMails] = useState([])
  const [laadt, setLaadt] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.mails), where('eventId', '==', null), orderBy('datum')),
        (snap) => {
          setMails(fromQuery(snap).reverse())
          setLaadt(false)
        },
        () => setLaadt(false)
      ),
    []
  )

  return { mails, laadt }
}

/** Een bericht met de hand aan een event hangen. */
export const koppelMail = (id, { eventId, customerId = null }) =>
  updateDoc(ref(COL.mails, id), { eventId, customerId, koppeling: 'handmatig' })

/**
 * Een geplakte aanvraag in de draad van haar event zetten.
 *
 * Langs de server, want de browser schrijft niet in `mails` — zie
 * `functions/mail-plakken.js`. De rij draagt `bron: 'geplakt'`, zodat de draad
 * blijft zeggen wat er van de mailserver kwam en wat iemand in een vak zette.
 */
export const plakMail = ({ eventId, tekst, onderwerp = '', van = '' }) =>
  httpsCallable(getFunctions(app, 'europe-west1'), 'mailPlakken')({ eventId, tekst, onderwerp, van }).then((r) => r.data)

/** Losmaken: terug naar het postvak, zodat iemand anders ernaar kan kijken. */
export const ontkoppelMail = (id) =>
  updateDoc(ref(COL.mails, id), { eventId: null, koppeling: null })
