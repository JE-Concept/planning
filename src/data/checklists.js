import { useEffect, useMemo, useState } from 'react'
import {
  arrayUnion,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { COL, col, fromQuery, newRef, ref } from '@lib/collections'
import { meldSnapshot, vergeetBron } from '@lib/offline'
import { isWeekend, runId } from '@lib/checklist-templates'
import { dayKey } from '@lib/dates'
import { auth } from '@lib/firebase'

export { isWeekend, runId }

/**
 * Openen en sluiten, per dag, door meerdere mensen tegelijk.
 *
 * Eén run per lijst per dag, met een vaste id `<lijst>_<dag>`. Dat is wat het
 * samen afvinken mogelijk maakt: wie de lijst opent, opent dezelfde. De stand
 * staat in een map `items`, gesleuteld op punt-id, en elke afvinking schrijft
 * alleen zijn eigen sleutel — twee mensen die tegelijk een ander punt aanvinken
 * overschrijven elkaar dus niet.
 */

/**
 * De lijsten zelf: openen, sluiten, en wat het team er later bij maakt.
 *
 * Gearchiveerde lijsten blijven weg op de werkvloer — daar wil niemand een
 * lijst zien die niet meer geldt — maar in Instellingen horen ze erbij, anders
 * kun je ze niet terughalen.
 */
export function useChecklists({ includeArchived = false, aan = true } = {}) {
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading] = useState(aan)

  // `aan` staat erbij voor de socialrol: zij mag de afvinklijsten niet lezen,
  // en een geweigerde vraag is geen lege lijst maar een fout in de console.
  useEffect(() => {
    if (!aan) {
      setLoading(false)
      return undefined
    }
    return onSnapshot(
      query(col(COL.checklists), orderBy('position')),
      (snap) => {
        setChecklists(fromQuery(snap))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [aan])

  const zichtbaar = useMemo(
    () => (includeArchived ? checklists : checklists.filter((c) => !c.archived)),
    [checklists, includeArchived]
  )

  return { checklists: zichtbaar, loading }
}

/**
 * De runs van één dag, live — je ziet de vinkjes van je collega binnenkomen.
 *
 * En, sinds de keuken en de koelcel: welke lijsten nog op dit toestel staan.
 * Firestore schrijft offline naar de schijfcache en stuurt later vanzelf door;
 * `hasPendingWrites` per document is het enige eerlijke antwoord op "is mijn
 * vinkje al weg?". Zonder dat sluit iemand de app in de veronderstelling dat
 * het rond is.
 */
export function useRunsForDay(day, { aan = true } = {}) {
  const [runs, setRuns] = useState([])
  const [wachtendeRuns, setWachtendeRuns] = useState(() => new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!day || !aan) {
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const bron = `checklistRuns:${day}`

    const stop = onSnapshot(
      query(col(COL.checklistRuns), where('day', '==', day)),
      (snap) => {
        meldSnapshot(bron, snap)
        setRuns(fromQuery(snap))
        setWachtendeRuns(
          new Set(snap.docs.filter((d) => d.metadata?.hasPendingWrites).map((d) => d.data().checklistId))
        )
        setLoading(false)
      },
      () => setLoading(false)
    )

    return () => {
      stop()
      vergeetBron(bron)
    }
  }, [day, aan])

  return useMemo(
    () => ({
      runs,
      byChecklist: Object.fromEntries(runs.map((r) => [r.checklistId, r])),
      wachtendeRuns,
      loading,
    }),
    [runs, wachtendeRuns, loading]
  )
}

/**
 * De runs van een reeks dagen, voor het verslag.
 *
 * Eén vraag voor een hele maand in plaats van dertig. Er zit geen `onSnapshot`
 * op: een verslag over augustus verandert niet meer, en een abonnement dat
 * dertig documenten live houdt terwijl je een rapport leest, kost leesbewerkingen
 * zonder dat er iets aan verandert.
 */
export function useRunsInRange(van, tot) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!van || !tot) return undefined
    let gestopt = false
    setLoading(true)

    getDocs(query(col(COL.checklistRuns), where('day', '>=', van), where('day', '<=', tot)))
      .then((snap) => {
        if (gestopt) return
        setRuns(fromQuery(snap))
        setLoading(false)
      })
      .catch((err) => {
        if (gestopt) return
        console.error('JE Plan: de dagen zijn niet op te halen', err)
        setLoading(false)
      })

    return () => {
      gestopt = true
    }
  }, [van, tot])

  return { runs, loading }
}

/**
 * Vinkt één punt aan of uit.
 *
 * `setDoc` met merge voegt diep samen, dus dit raakt alleen `items.<id>` en
 * laat de rest van de map staan. De voortgang wordt uit die map gerekend en
 * niet als getal bewaard: twee mensen die hetzelfde punt aanvinken zouden een
 * opgeslagen teller laten wegdrijven, en een fout getal is erger dan geen.
 */
export function toggleItem({ checklist, day, item, done, profile, scope }) {
  const id = runId(checklist.id, day)
  const [year, month, dayOfMonth] = day.split('-').map(Number)

  return setDoc(
    ref(COL.checklistRuns, id),
    {
      checklistId: checklist.id,
      checklistKey: checklist.key ?? checklist.id,
      checklistName: checklist.name,
      brandId: checklist.brandId ?? null,
      day,
      // Middag, zodat een tijdzoneverschuiving de datum nooit een dag verzet.
      date: new Date(year, month - 1, dayOfMonth, 12, 0, 0),
      weekend: Boolean(scope?.weekend),
      participants: arrayUnion(profile.id),
      items: {
        [item.id]: done
          ? { done: true, byId: profile.id, byName: profile.fullName || profile.email, at: new Date() }
          : { done: false, byId: null, byName: null, at: null },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/**
 * De waarde die bij een punt hoort.
 *
 * Bij het beoordelen van frituurolie is "afgevinkt" niet het hele antwoord —
 * wanneer ze vervangen is, is het antwoord. Zulke waarden staan naast het
 * vinkje in dezelfde map, dus ze verhuizen mee met de dag en met wie het
 * invulde.
 */
export function setItemValue({ checklist, day, item, waarde, profile }) {
  return setDoc(
    ref(COL.checklistRuns, runId(checklist.id, day)),
    {
      checklistId: checklist.id,
      checklistName: checklist.name,
      day,
      participants: arrayUnion(profile.id),
      items: {
        [item.id]: {
          waarde: waarde === '' ? null : waarde,
          waardeById: profile.id,
          waardeByName: profile.fullName || profile.email,
          waardeAt: new Date(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/**
 * De opmerking onderaan het papieren blad — bij sluiten ook wat naar de
 * volgende shift moet. Eén veld per dag, dus de laatste schrijver wint; de naam
 * erbij maakt zichtbaar wie dat was.
 */
export function saveNotes({ checklist, day, notes, profile }) {
  return setDoc(
    ref(COL.checklistRuns, runId(checklist.id, day)),
    {
      checklistId: checklist.id,
      day,
      notes,
      notesById: profile.id,
      notesByName: profile.fullName || profile.email,
      notesAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/** Markeert de lijst als afgerond; puur voor het overzicht. */
export function closeRun({ checklist, day, profile }) {
  return setDoc(
    ref(COL.checklistRuns, runId(checklist.id, day)),
    {
      checklistId: checklist.id,
      day,
      closedAt: serverTimestamp(),
      closedById: profile.id,
      closedByName: profile.fullName || profile.email,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

// ─── Beheer ─────────────────────────────────────────────────────────────────

/**
 * Een lijst aanpassen.
 *
 * De secties gaan als geheel mee. Dat is grof maar eerlijk: het gaat om een
 * handvol beheerders die af en toe een punt toevoegen, niet om een scherm waar
 * twee mensen tegelijk in zitten. De ids van de punten blijven daarbij staan —
 * daar hangen de afvinkingen van vandaag aan.
 */
export function updateChecklist(id, patch) {
  return setDoc(ref(COL.checklists, id), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
}

export function createChecklist({ name, kind = 'other' }) {
  const checklistRef = newRef(COL.checklists)
  return setDoc(checklistRef, {
    key: checklistRef.id,
    name: name.trim(),
    kind,
    brandId: null,
    sections: [{ id: 'algemeen', title: 'Algemeen', items: [] }],
    position: Date.now(),
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then(() => checklistRef.id)
}

/**
 * Archiveren, niet wissen.
 *
 * De afgevinkte dagen blijven bestaan en verwijzen naar deze lijst; verdwijnt
 * ze, dan is niet meer na te gaan wat er toen precies afgevinkt werd. Dat is
 * bij een FAVV-lijst geen detail.
 */
export function archiveChecklist(id) {
  // De dag erbij, zodat het verslag weet tot wanneer de lijst gold. Zonder die
  // datum blijft een lijst die niemand meer gebruikt elke dag als gemist staan.
  return updateChecklist(id, { archived: true, archivedOn: dayKey(new Date()) })
}

export function restoreChecklist(id) {
  return updateChecklist(id, { archived: false, archivedOn: null })
}

// ─── Sluitingsdagen ─────────────────────────────────────────────────────────

/**
 * Wanneer de bistro dicht is: `config/bistro`, veld `gesloten`.
 *
 * Eén document voor de zaak en niet een veld per lijst — de bistro is dicht,
 * niet de openingslijst. Wat erin staat en waarom de vaste weekdagen een
 * geschiedenis dragen, staat bij `sluitingOp` in `@lib/checklist-report`.
 *
 * `config` mag iedereen met een profiel lezen, en dat is hier nodig: ook wie
 * 's ochtends opent, moet kunnen zien dat het vandaag een sluitingsdag is.
 * Schrijven doet alleen een beheerder.
 */
export function useSluiting({ aan = true } = {}) {
  const [sluiting, setSluiting] = useState(null)
  const [loading, setLoading] = useState(aan)

  useEffect(() => {
    if (!aan) {
      setLoading(false)
      return undefined
    }
    return onSnapshot(
      ref(COL.config, 'bistro'),
      (snap) => {
        setSluiting(snap.exists() ? (snap.data().gesloten ?? null) : null)
        setLoading(false)
      },
      // Niet te lezen is hier geen reden om het verslag te stranden; het telt
      // dan zonder sluitingsdagen, zoals voor dit veld bestond.
      () => setLoading(false)
    )
  }, [aan])

  return { sluiting, loading }
}

/**
 * Het hele `gesloten`-veld in één keer.
 *
 * Een merge voegt mappen samen maar vervangt lijsten, dus beide lijsten gaan
 * altijd mee: zo kan een weggehaalde periode niet blijven hangen.
 */
export function bewaarSluiting(gesloten) {
  return setDoc(
    ref(COL.config, 'bistro'),
    {
      gesloten: { weekdagen: gesloten?.weekdagen ?? [], periodes: gesloten?.periodes ?? [] },
      updatedBy: auth.currentUser?.uid ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/** Alleen voor een lijst die nog nooit gebruikt is; anders archiveren. */
export function deleteChecklist(id) {
  return deleteDoc(ref(COL.checklists, id))
}
