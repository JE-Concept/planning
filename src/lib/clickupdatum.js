/**
 * Datums uit ClickUp zonder uur.
 *
 * ── Wat er misging ────────────────────────────────────────────────────────
 * ClickUp bewaart een datum zonder uur als 04:00 's ochtends in de tijdzone van
 * wie hem invulde. De migratie nam dat tijdstip over zoals het was. Voor wie in
 * België werkt, gaf dat een event "om 04:00"; voor Charish, die in de tijdzone
 * van Manila werkt (UTC+8, geen zomeruur), werd 04:00 daar 22:00 (zomer) of
 * 21:00 (winter) de avond ervoor hier. "Ruben Theuwen – 25 april 2027" stond
 * zo op 24 april om 22:00. Nagekeken in ClickUp: due_date 2027-04-24T20:00Z,
 * aangemaakt door Charish.
 *
 * ── Wat dit doet ──────────────────────────────────────────────────────────
 * Een tijdstip dat precies 04:00:00.000 is in Brussel of in Manila, op een
 * gemigreerd document, is een dag zonder uur. Het wordt die kalenderdag om
 * 12:00, zoals de tool zelf een datum zonder uur bewaart: dan toont geen
 * enkel scherm een uur, en valt het event op de juiste dag.
 *
 * Alleen voor documenten met een `clickupId`: wat in de tool zelf ingevuld
 * wordt, komt nooit op 04:00 terecht, en een echt tijdstip van 22:00 in de
 * zomer mag niet verschuiven.
 */

const VELDEN = ['eventDate', 'startDate', 'dueDate', 'eventEndDate']

const deel = (tijdzone) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tijdzone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
const BRUSSEL = deel('Europe/Brussels')
const MANILA = deel('Asia/Manila')

function onderdelen(fmt, d) {
  const o = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
  return { jaar: Number(o.year), maand: Number(o.month), dag: Number(o.day), uur: `${o.hour}:${o.minute}:${o.second}` }
}

/** De kalenderdag als 'YYYY-MM-DD' als dit een ClickUp-datum zonder uur is, anders null. */
export function clickupDag(waarde) {
  const d = waarde instanceof Date ? waarde : null
  if (!d || Number.isNaN(d.getTime()) || d.getUTCMilliseconds() !== 0) return null
  for (const fmt of [BRUSSEL, MANILA]) {
    const o = onderdelen(fmt, d)
    if (o.uur === '04:00:00') {
      return `${o.jaar}-${String(o.maand).padStart(2, '0')}-${String(o.dag).padStart(2, '0')}`
    }
  }
  return null
}

/** Dezelfde dag om 12:00 lokale tijd: zo bewaart de tool een datum zonder uur. */
const middag = (sleutel) => new Date(`${sleutel}T12:00:00`)

/** Een gemigreerd document met zijn datums op de juiste dag en zonder vals uur. */
export function herstelClickupDatums(doc) {
  if (!doc || !doc.clickupId) return doc
  let uit = doc
  for (const veld of VELDEN) {
    const dag = clickupDag(doc[veld])
    if (!dag) continue
    if (uit === doc) uit = { ...doc }
    uit[veld] = middag(dag)
  }
  return uit
}

export { VELDEN as CLICKUP_DATUMVELDEN }
