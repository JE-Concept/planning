import { useEffect, useMemo, useState } from 'react'
import {
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { app, auth, db } from '@lib/firebase'
import { bezetPerDag } from '@lib/voorraad'
import { keurBestand, verkleinFoto } from '@lib/beeld'

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

/**
 * Een vaste volgorde voor reservaties.
 *
 * Firestore geeft een vraag zonder `orderBy` terug in een volgorde die niet
 * vastligt, en bij elke wijziging kan ze anders zijn. Op het scherm springen
 * de rijen dan van plaats bij elk klein ding dat verandert — en wie net op
 * "Is buiten" wilde klikken, klikt op de regel eronder. Sorteren in de
 * browser en niet in de vraag, want dan is er geen tweede index nodig voor
 * een lijst van hooguit enkele tientallen rijen.
 */
const opVolgorde = (a, b) =>
  (a.van ?? '').localeCompare(b.van ?? '')
  || (a.materiaalNaam ?? '').localeCompare(b.materiaalNaam ?? '')
  || (a.id ?? '').localeCompare(b.id ?? '')

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

  const binnen = useMemo(
    () => (tot ? rijen.filter((r) => (r.van ?? '') <= tot) : rijen).sort(opVolgorde),
    [rijen, tot]
  )
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
      (snap) => setRijen(fromQuery(snap).sort(opVolgorde)),
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

/**
 * De laatste online afgerekende huren.
 *
 * Alleen lezen: deze rijen komen uit `functions-betaling/` en de browser mag
 * er niet aan — zie `firestore.rules`. Een beperkt aantal, want dit is een
 * blok op een scherm en geen boekhouding; wat er met het geld gebeurde, staat
 * bij Stripe en straks op de factuur.
 */
export function useHuurorders({ hoeveel = 12 } = {}) {
  const [orders, setOrders] = useState([])
  const [laadt, setLaadt] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.huurorders), orderBy('createdAt', 'desc'), limit(hoeveel)),
        (snap) => {
          setOrders(fromQuery(snap))
          setLaadt(false)
        },
        () => setLaadt(false)
      ),
    [hoeveel]
  )

  return { orders, laadt }
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
    /*
      Mag dit stuk zonder gesprek de deur uit?

      Standaard niet, en dat is met opzet de veilige kant: een tent moet
      geplaatst worden en een mobiele bar moet op een camion. Wie dit aanzet,
      zegt "dit kan een vreemde zelf komen halen en zelf afrekenen" — en dan
      doet de verhuursite dat ook, zonder dat er nog iemand naar kijkt.
    */
    directTeHuren: false,
    // Wat de klant vooruitbetaalt en terugkrijgt. Staat buiten de btw en
    // buiten de omzet — zie `lib/huurprijs.js`.
    waarborg: null,
    // Een glas voor één dag verhuren kost meer aan wassen dan het opbrengt.
    minDagen: 1,
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

/**
 * Het stuk is buiten, of het is terug.
 *
 * Twee aparte functies en geen `wijzigReservatie` met een stand erin, omdat
 * er bij terugbrengen iets bij hoort: de dag waarop het echt binnenkwam.
 * Kwam het vroeger terug dan geboekt, dan geeft `lib/voorraad.js` de dagen
 * ertussen weer vrij — anders staat een tent twee dagen voor niets
 * geblokkeerd terwijl ze in het magazijn ligt.
 */
export function markeerUit(id) {
  return wijzigReservatie(id, { status: 'uit', uitGegaanOp: serverTimestamp() })
}

export function markeerTerug(id, dag) {
  return wijzigReservatie(id, { status: 'terug', teruggebrachtOp: dag })
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

/**
 * De waarborg terugstorten — via de server, nooit vanuit de browser.
 *
 * Dit is de enige handeling in het magazijn die geld laat vertrekken, en
 * daarom gebeurt ze in `functions-betaling/` met de Stripe-sleutel die de
 * browser niet heeft. Wat hier gebeurt is één vraag stellen: deze order, dit
 * bedrag aan schade ingehouden. De server beslist of dat mag (alleen een
 * beheerder, alleen een betaalde order, nooit twee keer) en schrijft het
 * resultaat op de order; het scherm leest dat terug via de snapshot.
 */
export function waarborgTerug(orderId, schadeEuro = 0) {
  const aanroep = httpsCallable(getFunctions(app, 'europe-west1'), 'verhuurWaarborgTerug')
  const schadeCent = Math.max(0, Math.round((Number(String(schadeEuro).replace(',', '.')) || 0) * 100))
  return aanroep({ orderId, schadeCent }).then((r) => r.data)
}

/**
 * De productfoto erop — vraag 9 in `docs/vragen-productie.md`.
 *
 * Eerst verkleinen in de browser, dan naar de opslag, dan pas het veld op het
 * artikel: een `foto` die naar een bestand wijst dat er niet staat, is een
 * gebroken plaatje op een openbare pagina. Eén bestand per artikel — een
 * nieuwe foto vervangt de vorige, en de download-URL blijft dezelfde vorm.
 *
 * De site krijgt de URL met token en geen pad: ze heeft geen Storage-SDK en
 * hoort die niet te krijgen (zie `tests/verhuur-bundel.test.js`).
 */
/* De klachten van `keurBestand`, in de woorden van het magazijn. */
const FOTOKLACHT = {
  geen_bestand: 'artikel.foto_geen_bestand',
  geen_beeld: 'artikel.foto_geen_beeld',
  te_groot: 'artikel.foto_te_groot',
}

export async function uploadFoto(id, file) {
  const klacht = keurBestand(file)
  if (klacht) throw new Error(FOTOKLACHT[klacht])

  const blob = await verkleinFoto(file)
  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage')
  const bestand = storageRef(getStorage(app), `materiaal/${id}/foto.jpg`)
  await uploadBytes(bestand, blob, { contentType: 'image/jpeg' })
  const url = await getDownloadURL(bestand)
  await wijzigMateriaal(id, { foto: url })
  return url
}

/** De foto weg. Het bestand mag blijven; het veld is wat de site leest. */
export const verwijderFoto = (id) => wijzigMateriaal(id, { foto: null })
