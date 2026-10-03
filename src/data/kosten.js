import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { COL } from '@lib/collections'
import { auth, db } from '@lib/firebase'

/**
 * De uurkost per statuut, waarmee de marge van een event gerekend wordt.
 *
 * ── Waarom dit één document is en geen veld per medewerker ────────────────
 * Omdat het hier niet over mensen gaat. Wat iemand verdient staat in AAPI en
 * hoort daar te blijven staan — zie `CLAUDE.md`. Dit is een kengetal per
 * statuut waarmee je een formule kunt beoordelen: "een flexi kost ons
 * ongeveer zoveel per uur, alles inbegrepen". Eén document, door een
 * beheerder te zetten, en nergens een bedrag dat aan een naam hangt.
 *
 * ── Waarom er geen standaardwaarden zijn ──────────────────────────────────
 * Een verzonnen uurkost geeft een marge die eruitziet als een meting, en daar
 * worden prijzen op gezet. Zolang er niets staat, telt loon niet mee in de
 * kost en zegt het scherm dat erbij.
 */
export function useKosten() {
  const [tarieven, setTarieven] = useState(null)
  const [laadt, setLaadt] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        doc(db, COL.config, 'kosten'),
        (snap) => {
          setTarieven(snap.exists() ? (snap.data().statuutTarief ?? {}) : {})
          setLaadt(false)
        },
        // Een leesfout is hier geen reden om het scherm te stranden: zonder
        // tarieven blijft de marge bruikbaar, ze heet alleen onvolledig.
        () => {
          setTarieven({})
          setLaadt(false)
        }
      ),
    []
  )

  return { tarieven: tarieven ?? {}, laadt }
}

/**
 * Een tarief zetten of weghalen.
 *
 * Een leeg veld wist het tarief in plaats van er nul van te maken: nul is een
 * uitspraak ("dit statuut kost ons niets"), leeg is er geen.
 */
export function zetTarief(statuut, waarde) {
  const schoon = waarde === '' || waarde === null || waarde === undefined ? null : Number(waarde)
  return setDoc(
    doc(db, COL.config, 'kosten'),
    {
      statuutTarief: { [statuut]: Number.isFinite(schoon) ? schoon : null },
      updatedBy: auth.currentUser?.uid ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}
