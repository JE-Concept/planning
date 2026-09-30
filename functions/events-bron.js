/**
 * Waar de events vandaan komen.
 *
 * Staat los van `agenda.js` omdat er geen `firebase-functions` aan te pas
 * komt: het is een vraag aan de database plus wat vertaalwerk, en dat hoort na
 * te rekenen te zijn zonder de hele functies-SDK op te starten — dezelfde lijn
 * als `notify.js` en `audit.js`.
 */

/**
 * De eventlijst herkennen aan haar kolommen, niet aan een vast id.
 *
 * Kopie van `isPipelineList` in `src/lib/pipeline.js` — `functions/` wordt
 * apart verpakt en kan niets uit `src/` importeren, net als bij `ical.js`. Er
 * staat een test op die meldt wanneer de twee uit elkaar lopen.
 */
export function isEventLijst(lijst) {
  const namen = new Set((lijst?.statuses ?? []).map((s) => s.name))
  return namen.has('request') && namen.has('ready to invoice') && namen.has('invoiced')
}

/**
 * De events voor de feed.
 *
 * Hier stond `db.collection('events')`, en die collectie bestaat niet: een
 * event ís in JE Plan een taak op het hoofdniveau van de eventlijst — zo staan
 * de gemigreerde ClickUp-gegevens erin en zo leest de hele app ze (zie
 * `src/data/events.js`). Die query gaf dus altijd nul rijen terug, en iedereen
 * die zijn agenda abonneerde, kreeg een lege agenda zonder één foutmelding.
 *
 * De velden worden hier vertaald naar wat `eventRegels` verwacht: een taak
 * heet `title` en draagt haar dag als `eventDate`, met `startDate` en `dueDate`
 * als terugval voor de oudere dossiers — dezelfde volgorde als `eventDateOf`
 * in de app, zodat de agenda en het scherm dezelfde dag tonen.
 */
export async function eventsVoorFeed(db) {
  const lijsten = await db.collection('lists').get()
  const lijst = lijsten.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => !l.archived)
    .find(isEventLijst)

  // Geen eventlijst gevonden: een lege agenda, geen fout. Een feed die 500
  // geeft, laat Google na een paar pogingen het hele abonnement opzeggen.
  if (!lijst) return []

  const snap = await db
    .collection('tasks')
    .where('listId', '==', lijst.id)
    .where('archived', '==', false)
    .get()

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    // Subtaken zijn het werk bij een event, geen tweede item in je agenda.
    .filter((taak) => !taak.parentId)
    .map((taak) => ({
      id: taak.id,
      name: taak.title ?? null,
      date: taak.eventDate ?? taak.startDate ?? taak.dueDate ?? null,
      location: taak.location ?? null,
      customerName: taak.customerName ?? null,
      statusName: taak.statusName ?? null,
      // Het team zegt "pax" en zo staat het op de offerte en in de database;
      // `eventRegels` noemt het `guests`. Zonder deze vertaling bleef de regel
      // "120 personen" uit elk agenda-item weg.
      guests: taak.pax ?? taak.guests ?? null,
    }))
}
