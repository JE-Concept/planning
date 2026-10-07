#!/usr/bin/env node
/**
 * Datums zonder uur uit ClickUp op de juiste dag zetten.
 *
 *   node scripts/onderhoud/clickup-datums.mjs [--schrijf]
 *
 * ClickUp bewaart een datum zonder uur als 04:00 in de tijdzone van wie hem
 * invulde; de migratie nam dat tijdstip over. In België gaf dat events "om
 * 04:00", en wat Charish (tijdzone Manila) invulde, viel de avond ervoor om
 * 22:00 of 21:00. Zie src/lib/clickupdatum.js: de app leest die datums al
 * goed; dit script zet ze ook zo in de database, zodat de agendafeed, de
 * Drive-mappen en elke functie dezelfde dag zien.
 *
 * Het raakt alleen gemigreerde documenten (met `clickupId`), alleen de velden
 * eventDate, startDate, dueDate en eventEndDate, en alleen een tijdstip dat
 * precies 04:00:00.000 is in Brussel of Manila. Dat wordt die dag om 12:00 in
 * Brussel, zoals de tool zelf een datum zonder uur bewaart.
 */
import { CLICKUP_DATUMVELDEN, clickupDag } from '../../src/lib/clickupdatum.js'
import { schrijftEcht, verbind, verslag } from './_hulp.mjs'

const db = verbind()
const echt = schrijftEcht()

/** 12:00 in Brussel op die dag, met het zomeruur van die dag. */
function middagInBrussel(sleutel) {
  const [j, m, d] = sleutel.split('-').map(Number)
  const proef = new Date(Date.UTC(j, m - 1, d, 12))
  const uurDaar = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', hourCycle: 'h23' }).format(proef))
  return new Date(Date.UTC(j, m - 1, d, 12 - (uurDaar - 12)))
}

const snap = await db.collection('tasks').where('clickupId', '!=', null).get()

const regels = []
let geraakt = 0
for (const doc of snap.docs) {
  const data = doc.data()
  const patch = {}
  const uitleg = []
  for (const veld of CLICKUP_DATUMVELDEN) {
    const waarde = data[veld]?.toDate?.() ?? null
    const dag = clickupDag(waarde)
    if (!dag) continue
    patch[veld] = middagInBrussel(dag)
    uitleg.push(`${veld} ${waarde.toISOString()} → ${dag}`)
  }
  if (!uitleg.length) continue
  geraakt += 1
  regels.push(`${data.title ?? doc.id}: ${uitleg.join(', ')}`)
  if (echt) await doc.ref.update(patch)
}

verslag({ gevonden: snap.size, geraakt, regels, echt })
