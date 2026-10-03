import { useEffect, useMemo, useState } from 'react'
import {
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { auth, db } from '@lib/firebase'
import { bezetPerDag } from '@lib/voorraad'

/**
 * Het verhuurmateriaal en wat erop gereserveerd staat.
 *
 * ── Waarom reservaties een eigen collectie zijn ───────────────────────────
 * Dezelfde voorraad wordt van twee kanten aangesproken: een eigen event, en
 * straks een aanvraag van de verhuursite. Stond de reservatie als lijstje op
 * het event, dan was er geen plek waar die twee samenkomen, en dan ziet
 * niemand een dubbele boeking aankomen tot de camion half geladen is.
 *
 * ── Waarom de naam van het artikel op de reservatie staat ─────────────────
 * Firestore kan niet joinen. Een kalender met veertig rijen zou anders veertig
 * keer het artikel moeten ophalen om er een naam bij te zetten. Dezelfde
 * afspraak als bij een taak die haar kolomnaam meedraagt: de schrijvers
 * hieronder verversen de kopie, niemand anders.
 */

const doorWie = () => auth.currentUser?.uid ?? null

/** Alle artikelen, op volgorde van het magazijn. */
export function useMateriaal({ inclusiefGearchiveerd = false } = {}) {
  const [items, setItems] = useState([])
  const [laadt, setLaadt] = useState(true)

  useEffect(() => {
    const clauses = inclusiefGearchiveerd ? [] : [where('archived', '==', false)]
    return onSnapshot(
      query(col(COL.materiaal), ...clauses, orderBy('position')),
      (snap) => {
        setItems(fromQuery(snap))
        setLaadt(false)
      },
      () => setLaadt(false)
    )
  }, [inclusiefGearchiveerd])

  const opId = useMemo(() => Object.fromEntries(items.map((m) => [m.id, m])), [items])
  return { materiaal: items, opId, laadt }
}

/**
 * De reservaties die een periode raken.
 *
 * Firestore kan niet op twee bereiken tegelijk filteren, dus staat er één
 * bereik in de vraag (`tot >= van`) en wordt de andere kant in de browser
 * weggelaten. Dat haalt wat te veel op — alles wat ná de periode begint — en
 * dat is bij deze aantallen de goedkoopste van de twee fouten: de andere zou
 * zijn dat een reservatie die over de grens heen loopt, niet meetelt.
 */
export function useReservaties({ van, tot } = {}) {
  const [rijen, setRijen] = useState([])
  const [laadt, setLaadt] = useState(true)

  useEffect(() => {
    if (!van) {
      setRijen([])
      setLaadt(false)
      return undefined
    }
    return onSnapshot(
      query(col(COL.reservaties), where('tot', '>=', van), orderBy('tot')),
      (snap) => {
        setRijen(fromQuery(snap))
        setLaadt(false)
      },
      () => setLaadt(false)
    )
  }, [van])

  const binnen = useMemo(() => (tot ? rijen.filter((r) => (r.van ?? '') <= tot) : rijen), [rijen, tot])
  const perMateriaal = useMemo(() => {
    const kaart = new Map()
    for (const r of binnen) {
      const rij = kaart.get(r.materiaalId) ?? []
      rij.push(r)
      kaart.set(r.materiaalId, rij)
    }
    return kaart
  }, [binnen])

  return { reservaties: binnen, perMateriaal, laadt }
}

/** De reservaties van één event, voor het blok op de fiche. */
export function useEventReservaties(eventId) {
  const [rijen, setRijen] = useState([])

  useEffect(() => {
    if (!eventId) {
      setRijen([])
      return undefined
    }
    return onSnapshot(
      query(col(COL.reservaties), where('eventId', '==', eventId)),
      (snap) => setRijen(fromQuery(snap)),
      () => setRijen([])
    )
  }, [eventId])

  return rijen
}

/**
 * Wat er per artikel per dag bezet is, klaar om een balk mee te tekenen.
 *
 * Rekent in de browser uit `reservaties`, en dat kan omdat een backofficeblik
 * altijd over een afgebakende periode gaat — twee weken, een maand. De
 * verhuursite kan dat niet; die krijgt straks de dagtellers die
 * `functions/voorraad.js` wegschrijft.
 */
export function useBezet(materiaal = [], reservatiesPerMateriaal, nu = undefined) {
  return useMemo(() => {
    const kaart = new Map()
    for (const m of materiaal) {
      kaart.set(
        m.id,
        bezetPerDag(reservatiesPerMateriaal?.get?.(m.id) ?? [], { uitloopDagen: m.uitloopDagen ?? 0, nu })
      )
    }
    return kaart
  }, [materiaal, reservatiesPerMateriaal, nu])
}

// ─── Schrijven ──────────────────────────────────────────────────────────────

export function maakMateriaal(velden) {
  const materiaalRef = newRef(COL.materiaal)
  return setDoc(materiaalRef, {
    naam: '',
    omschrijving: '',
    categorie: 'Overig',
    aantal: 1,
    // Dagen na de huur waarop het stuk nog niet opnieuw inzetbaar is: wassen,
    // nakijken, terugrijden. Zonder dit belooft de site wat het magazijn niet
    // waarmaakt.
    uitloopDagen: 1,
    prijsPerDag: null,
    prijsWeekend: null,
    prijsWeek: null,
    vervangwaarde: null,
    // Intern. Gaat nooit mee in de publieke feed — zie `firestore.rules`.
    inkoopwaarde: null,
    leverancier: '',
    gerelateerd: [],
    position: Date.now(),
    archived: false,
    createdBy: doorWie(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...velden,
  }).then(() => materiaalRef.id)
}

export function wijzigMateriaal(id, patch) {
  return updateDoc(ref(COL.materiaal, id), { ...patch, updatedAt: serverTimestamp() })
}

/**
 * Materiaal vastleggen voor een event of een aanvraag.
 *
 * Er wordt hier niet gecontroleerd of het past. Dat klinkt verkeerd en is het
 * niet: het scherm rekent vooraf en waarschuwt, maar wie tóch wil
 * overboeken moet dat kunnen — je huurt bij, of je belt de andere klant. Een
 * slot dat je niet kunt openen, leidt tot een reservatie die iemand buiten de
 * tool om maakt, en dan klopt de kalender zeker niet meer.
 *
 * Wat er wél gebeurt: een overboeking komt als conflict op het scherm, en
 * blijft daar tot iemand ze oplost.
 */
export function reserveer({ materiaal, van, tot, aantal, eventId = null, eventNaam = null, status = 'vast' }) {
  const reservatieRef = newRef(COL.reservaties)
  return setDoc(reservatieRef, {
    materiaalId: materiaal.id,
    // Een kopie, zodat een kalenderrij geen tweede leesbeurt nodig heeft.
    materiaalNaam: materiaal.naam ?? '',
    aantal: Math.max(1, Math.round(Number(aantal) || 1)),
    van,
    tot: tot || van,
    status,
    soort: eventId ? 'event' : 'verhuur',
    eventId,
    eventNaam,
    aanvraagId: null,
    optieVervalt: null,
    createdBy: doorWie(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then(() => reservatieRef.id)
}

export function wijzigReservatie(id, patch) {
  return updateDoc(ref(COL.reservaties, id), { ...patch, updatedAt: serverTimestamp() })
}

/**
 * Een reservatie weghalen.
 *
 * Echt verwijderen en niet op "geannuleerd" zetten: een reservatie die niet
 * doorgaat, hoort uit de kalender te verdwijnen. Wat er gebeurd is, staat in
 * het logboek — daar is het voor.
 */
export function verwijderReservatie(id) {
  return deleteDoc(doc(db, COL.reservaties, id))
}
