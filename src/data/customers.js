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
import { COL, col, fromQuery, newRef, normalise, ref } from '@lib/collections'
import { auth, db } from '@lib/firebase'

/**
 * Klanten.
 *
 * Tot nu stond een klant in de titel van een event en verder nergens: "Trouw
 * Niels en Inez", "Blum België". Dat werkt tot iemand vraagt wat we vorig jaar
 * voor Blum deden, of waar hun btw-nummer stond, of welk logo we van hen
 * hebben. Daarom staan ze nu apart, met de events eraan.
 *
 * Een event verwijst naar de klant (`customerId`) en draagt zijn naam mee
 * (`customerName`), zoals het ook de naam van zijn lijst meedraagt: Firestore
 * kan niet joinen en een bord dat per kaart de klant moet opzoeken, leest zich
 * scheef. Die kopie wordt server-side bijgewerkt wanneer een klant hernoemd
 * wordt.
 */

const doorWie = () => auth.currentUser?.uid ?? null

export const leegAdres = () => ({ street: '', postalCode: '', city: '', country: 'België' })

export const nieuwContact = () => ({
  id: crypto.randomUUID(),
  name: '',
  role: '',
  email: '',
  phone: '',
  // Eén van de contactpersonen is de hoofdcontactpersoon. Wie de eerste is bij
  // een nieuwe klant, wordt het vanzelf — zie `primaryContact` in @lib/klanten.
  primary: false,
})

/**
 * Het adres waarop een klant al zijn dossiers volgt.
 *
 * De sleutel wordt pas aangemaakt wanneer iemand de link opvraagt: een sleutel
 * die nooit gedeeld is, hoeft niet te bestaan. Daarna blijft hij staan, want
 * hij zit dan in een mail bij de klant.
 */
export async function klantLink(klant) {
  let token = klant?.portalToken
  if (!token) {
    token = nieuwToken()
    await updateDoc(ref(COL.customers, klant.id), { portalToken: token })
  }
  return `${import.meta.env.VITE_APP_URL ?? window.location.origin}/#/klant/${token}`
}

/** Dezelfde vorm als de sleutel van een offerte en van de agendafeed. */
function nieuwToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function useCustomers({ includeArchived = false } = {}) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        query(col(COL.customers), orderBy('name')),
        (snap) => {
          setCustomers(fromQuery(snap))
          setLoading(false)
        },
        () => setLoading(false)
      ),
    []
  )

  const zichtbaar = useMemo(
    () => (includeArchived ? customers : customers.filter((c) => !c.archived)),
    [customers, includeArchived]
  )

  return { customers: zichtbaar, loading }
}

export function useCustomer(id) {
  const [customer, setCustomer] = useState(null)

  useEffect(() => {
    if (!id) {
      setCustomer(null)
      return undefined
    }
    return onSnapshot(
      doc(db, COL.customers, id),
      (snap) => setCustomer(snap.exists() ? normalise({ id: snap.id, ...snap.data() }) : null),
      () => setCustomer(null)
    )
  }, [id])

  return customer
}

/**
 * Alles wat aan deze klant hangt.
 *
 * Zonder sorteervolgorde in de query: een klant heeft er tientallen, niet
 * duizenden, en zo is er geen samengestelde index nodig voor iets wat de
 * browser in een oogwenk doet.
 */
export function useCustomerTasks(customerId) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) {
      setTasks([])
      setLoading(false)
      return undefined
    }

    return onSnapshot(
      query(col(COL.tasks), where('customerId', '==', customerId)),
      (snap) => {
        setTasks(fromQuery(snap).filter((t) => !t.archived))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [customerId])

  const gesorteerd = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        // Open werk eerst, daarna het recentste.
        if (a.open !== b.open) return a.open ? -1 : 1
        return (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0)
      }),
    [tasks]
  )

  return { tasks: gesorteerd, loading }
}

export function createCustomer(data) {
  const customerRef = newRef(COL.customers)
  return setDoc(customerRef, {
    name: (data.name ?? '').trim(),
    vatNumber: data.vatNumber ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    website: data.website ?? '',
    address: data.address ?? leegAdres(),
    // Facturatie gaat vaak ergens anders naartoe dan de post: een
    // boekhoudkantoor, een hoofdzetel, een aparte mailbox. Leeg betekent
    // "hetzelfde als hierboven" (zie `billingAddressOf`), niet "onbekend".
    billingAddress: data.billingAddress ?? leegAdres(),
    billingEmail: data.billingEmail ?? '',
    contacts: data.contacts ?? [],
    notes: data.notes ?? '',
    brandId: data.brandId ?? null,
    archived: false,
    createdBy: doorWie(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then(() => customerRef.id)
}

export function updateCustomer(id, patch) {
  return updateDoc(ref(COL.customers, id), { ...patch, updatedAt: serverTimestamp() })
}

/**
 * Archiveren, niet wissen.
 *
 * De events blijven naar deze klant verwijzen; verdwijnt hij, dan staat er in
 * de geschiedenis een naam zonder gegevens. Wissen kan alleen zolang er niets
 * aan hangt, en dat controleert het scherm.
 */
export const archiveCustomer = (id) => updateCustomer(id, { archived: true })
export const restoreCustomer = (id) => updateCustomer(id, { archived: false })
export const deleteCustomer = (id) => deleteDoc(ref(COL.customers, id))
