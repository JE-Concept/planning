#!/usr/bin/env node
/**
 * "Te factureren" hoort bij één persoon.
 *
 *   node scripts/onderhoud/te-factureren-verantwoordelijke.mjs [--schrijf]
 *
 * Er bestaat een business rule die een event dat op *ready to invoice* komt
 * bij Elke legt. Die regel vuurt op een statuswijziging, dus de events die al
 * in die kolom stonden toen de regel gemaakt werd, hebben hem nooit gezien —
 * daar staan nog meerdere mensen op.
 *
 * Dit script past dezelfde regel toe op wat er al staat. Het raakt alleen
 * `assignees`, en dat is sinds de splitsing de verantwoordelijke: de ploeg die
 * komt werken staat in `medewerkers` en blijft onaangeroerd.
 *
 * Wie het al goed heeft — alleen Elke — wordt overgeslagen. Dat scheelt niet
 * alleen schrijfbeurten: het houdt de lijst in de log beperkt tot wat er echt
 * veranderde.
 */
import { profielVan, schrijftEcht, verbind, verslag } from './_hulp.mjs'

const EMAIL = process.env.INVOICING_EMAIL ?? 'elke@kenjeklanten.be'
const STATUS = 'ready to invoice'

const db = verbind()
const echt = schrijftEcht()
const elke = await profielVan(db, EMAIL)

const snap = await db
  .collection('tasks')
  .where('statusName', '==', STATUS)
  .where('archived', '==', false)
  .get()

const regels = []
let geraakt = 0

for (const doc of snap.docs) {
  const data = doc.data()
  const huidig = data.assignees ?? []
  const klopt = huidig.length === 1 && huidig[0] === elke.id
  if (klopt) continue

  geraakt += 1
  regels.push(`${data.title ?? doc.id}: ${huidig.length} toegewezen → ${elke.fullName ?? EMAIL}`)

  if (echt) {
    await doc.ref.set({ assignees: [elke.id], updatedAt: new Date() }, { merge: true })
  }
}

verslag({ gevonden: snap.size, geraakt, regels, echt })
