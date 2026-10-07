import { useCallback, useEffect, useState } from 'react'

/**
 * De winkelmand: wat iemand bij elkaar zoekt, en voor wanneer.
 *
 * ── Waarom de periode in de mand zit en niet per regel ────────────────────
 * Omdat je één keer laadt en één keer terugbrengt. Twee artikelen voor twee
 * verschillende weekenden zijn twee huren, en die splitsing bij het afrekenen
 * willen verzinnen levert een camion op die twee keer rijdt voor één
 * factuur. Eén periode per mand, en wie twee weekenden nodig heeft, rekent
 * twee keer af.
 *
 * ── Waarom dit in localStorage staat ──────────────────────────────────────
 * Iemand zoekt op zijn telefoon in de rij aan de kassa, legt hem weg, en komt
 * 's avonds terug op de laptop. Dat laatste kunnen we niet oplossen zonder
 * account, maar het eerste wel — en een mand die leegloopt omdat je per
 * ongeluk terugging, is de reden dat mensen afhaken.
 *
 * Het staat in de browser van de bezoeker en nergens anders: dit is geen
 * reservatie. Pas bij het afrekenen legt de server iets vast.
 */

const SLEUTEL = 'je-verhuur-mand'

const leeg = { van: '', tot: '', regels: [] }

/* Een kapotte of oude mand mag de site niet tegenhouden: dan maar leeg. */
function lees() {
  try {
    const rauw = localStorage.getItem(SLEUTEL)
    if (!rauw) return leeg
    const uit = JSON.parse(rauw)
    if (!Array.isArray(uit?.regels)) return leeg
    return { van: String(uit.van ?? ''), tot: String(uit.tot ?? ''), regels: uit.regels }
  } catch {
    return leeg
  }
}

function schrijf(mand) {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(mand))
  } catch {
    // Privémodus, volle schijf, geblokkeerde opslag. De mand werkt deze sessie
    // gewoon door; alleen onthouden lukt niet, en daar hoeft niemand iets van
    // te merken.
  }
}

export function useMand() {
  const [mand, setMand] = useState(lees)

  useEffect(() => {
    schrijf(mand)
  }, [mand])

  /*
    Hetzelfde artikel nog eens toevoegen verhoogt het aantal in plaats van een
    tweede regel te maken. Twee regels met dezelfde statafel zouden bij het
    afrekenen apart tegen de voorraad gelegd worden, en dan past wat in totaal
    niet past.
  */
  const erbij = useCallback((materiaalId, aantal = 1) => {
    setMand((oud) => {
      const bestaat = oud.regels.find((r) => r.materiaalId === materiaalId)
      const regels = bestaat
        ? oud.regels.map((r) => (r.materiaalId === materiaalId ? { ...r, aantal: r.aantal + aantal } : r))
        : [...oud.regels, { materiaalId, aantal }]
      return { ...oud, regels }
    })
  }, [])

  const zetAantal = useCallback((materiaalId, aantal) => {
    const n = Math.max(0, Math.round(Number(aantal) || 0))
    setMand((oud) => ({
      ...oud,
      regels: n === 0 ? oud.regels.filter((r) => r.materiaalId !== materiaalId)
        : oud.regels.map((r) => (r.materiaalId === materiaalId ? { ...r, aantal: n } : r)),
    }))
  }, [])

  const weg = useCallback((materiaalId) => zetAantal(materiaalId, 0), [zetAantal])

  const zetPeriode = useCallback((van, tot) => setMand((oud) => ({ ...oud, van, tot: tot || van })), [])

  const leegmaken = useCallback(() => setMand(leeg), [])

  const stuks = mand.regels.reduce((som, r) => som + r.aantal, 0)

  return { mand, erbij, zetAantal, weg, zetPeriode, leegmaken, stuks }
}

/** Alle dagsleutels van `van` tot en met `tot`. Allebei inbegrepen. */
export function dagenTussen(van, tot) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(van ?? '')) return []
  const eind = /^\d{4}-\d{2}-\d{2}$/.test(tot ?? '') ? tot : van
  if (eind < van) return []

  const uit = []
  const d = new Date(`${van}T12:00:00`)
  while (uit.length < 180) {
    const sleutel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    uit.push(sleutel)
    if (sleutel >= eind) break
    d.setDate(d.getDate() + 1)
  }
  return uit
}
