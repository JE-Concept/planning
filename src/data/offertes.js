import { useEffect, useState } from 'react'
import { deleteDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { maakRegel, offerteVanEvent, totalenVan } from '@lib/offerte'

/**
 * De offertes: één document per offerte, met het event erbij.
 *
 * Niet als veld op het event, om twee redenen. Een offerte heeft een eigen
 * leven — ze wordt verstuurd, ze verloopt, ze wordt goedgekeurd — en dat zijn
 * wijzigingen die niets met het event te maken hebben. En de publieke pagina
 * leest er één, zonder dat daar het hele event bij hoeft te komen.
 *
 * `token` is wat het adres van de publieke pagina afschermt. Hij staat op het
 * document en niet in een aparte lijst: een offerte is één ding, en een sleutel
 * die ergens anders ligt raakt achterop wanneer de offerte verdwijnt.
 */

/** Het geheim in het adres van de klant. Zelfde lengte als de agenda-sleutel. */
export function nieuwToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** De offerte van dit event, live. Er is er hoogstens één. */
export function useOfferte(eventId) {
  const [staat, setStaat] = useState({ laadt: true, offerte: null })

  useEffect(() => {
    if (!eventId) return setStaat({ laadt: false, offerte: null })
    return onSnapshot(
      query(col(COL.offertes), where('eventId', '==', eventId)),
      (snap) => setStaat({ laadt: false, offerte: fromQuery(snap)[0] ?? null }),
      () => setStaat({ laadt: false, offerte: null })
    )
  }, [eventId])

  return staat
}

/** Alle offertes, nieuwste eerst — voor het overzicht en het zoeken. */
export function useOffertes() {
  const [rijen, setRijen] = useState([])

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.offertes), orderBy('createdAt', 'desc')),
        (snap) => setRijen(fromQuery(snap)),
        () => setRijen([])
      ),
    []
  )

  return rijen
}

/**
 * De offerte van een event maken.
 *
 * Het volgnummer is het aantal offertes van dit jaar plus één. Niet mooi maar
 * wel waar: er is er één per event, ze worden nooit met z'n tweeën tegelijk
 * aangemaakt, en een teller in een apart document zou bij elke offerte een
 * tweede schrijfbeurt kosten om hetzelfde te weten.
 */
export async function maakOfferte({ event, prijs = null, uid = null, volgnummer = 1 }) {
  const basis = offerteVanEvent({ event, prijs, volgnummer })
  const doc = newRef(COL.offertes)

  await setDoc(doc, {
    ...basis,
    token: nieuwToken(),
    createdAt: serverTimestamp(),
    createdBy: uid ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: uid ?? null,
  })

  return doc.id
}

/** Iets aan de offerte wijzigen. De totalen worden nooit bewaard — die reken je. */
export const bewerkOfferte = (id, velden, uid = null) =>
  updateDoc(ref(COL.offertes, id), { ...velden, updatedAt: serverTimestamp(), updatedBy: uid ?? null })

/** Een regel toevoegen, wijzigen of weghalen. */
export const zetRegels = (id, regels, uid = null) => bewerkOfferte(id, { regels }, uid)

export const voegRegelToe = (offerte, regel, uid = null) =>
  zetRegels(offerte.id, [...(offerte.regels ?? []), maakRegel(regel)], uid)

export const wijzigRegel = (offerte, regelId, velden, uid = null) =>
  zetRegels(
    offerte.id,
    (offerte.regels ?? []).map((r) => (r.id === regelId ? maakRegel({ ...r, ...velden, id: r.id }) : r)),
    uid
  )

export const wisRegel = (offerte, regelId, uid = null) =>
  zetRegels(
    offerte.id,
    (offerte.regels ?? []).filter((r) => r.id !== regelId),
    uid
  )

/**
 * De offerte klaarzetten voor de klant.
 *
 * Het bedrag gaat mee naar het event: daar staat `quoteAmount`, en dat is wat
 * de pijplijn en het dashboard tonen. Twee bedragen die uit elkaar lopen is
 * erger dan één bedrag dat op twee plekken staat.
 */
export async function verstuurOfferte(offerte, uid = null) {
  const totalen = totalenVan(offerte.regels)
  await bewerkOfferte(
    offerte.id,
    { status: 'verstuurd', verstuurdOp: serverTimestamp(), bedragExcl: totalen.excl, bedragIncl: totalen.incl },
    uid
  )
  return totalen
}

/** Een nieuw adres voor de klant. Het oude werkt daarna niet meer. */
export const vernieuwToken = (id, uid = null) => bewerkOfferte(id, { token: nieuwToken() }, uid)

export const wisOfferte = (id) => deleteDoc(ref(COL.offertes, id))

/**
 * Het adres waarop de klant deze offerte opent.
 *
 * Volledig en niet relatief: dit gaat in een mail, in een bericht, of iemand
 * leest het voor aan de telefoon. Een pad zonder domein helpt daar niemand.
 */
export const offerteLink = (offerte) =>
  offerte?.token ? `${import.meta.env.VITE_APP_URL ?? window.location.origin}/#/offerte/${offerte.token}` : null
