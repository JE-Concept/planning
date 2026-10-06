import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

/**
 * Wat er in JE Plan gebeurt wanneer de verhuursite iets binnenbrengt.
 *
 * ── Waarom dit hier staat en niet in `functions-betaling/` ────────────────
 * Twee redenen. De betaalcodebase hangt aan Stripe-geheimen en wordt
 * overgeslagen zolang die ontbreken; een aanvraag die geen melding oplevert
 * omdat Stripe nog niet ingericht is, is een gemiste opdracht. En het maken
 * van een event vraagt om de lijst, haar kolommen en de pushtokens — dat is
 * de wereld van déze codebase, en daar hoort de betaalfunctie niets van te
 * weten. Zij zet de order op "betaald"; dit kijkt toe en doet de rest.
 *
 * ── Waarom een betaalde huur een event wordt (vraag 18) ───────────────────
 * Jasper wil alles op één kalender. Een afhaling van statafels is misschien
 * geen feest, maar ze moet wel klaarstaan en terugkomen, en wie het bord
 * leest moet dat zien zonder naar het magazijn te hoeven. Rechtstreeks in
 * "planning ongoing": er is geen aanvraag, geen offerte en geen akkoord meer
 * af te wachten — er is betaald.
 *
 * Zonder taken uit een template: een online huur heeft geen draaiboek nodig.
 * Wat er wel moet gebeuren — klaarzetten, meegeven, terugnemen — staat op de
 * laadlijst, per dag.
 */

const KOLOM_NA_BETALING = 'planning ongoing'

/**
 * Wat de verhuursite binnenbrengt, ook in de log van messaging zetten.
 *
 * De verhuursite heeft haar eigen weg — een aanvraag in het postvak, een
 * betaalde huur als event — en die blijft. Maar wie onder Instellingen →
 * Messaging kijkt wat er van buiten binnenkwam, hoort ook deze te zien: één
 * plek voor "kwam het aan". De bron `verhuur` staat in `BRONNEN` met
 * `kaart: false`, dus de verwerker maakt er geen tweede kaart van.
 * `create` met een vast id: een trigger die twee keer vuurt, geeft één rij.
 * Mislukt dit, dan gaat de rest gewoon door — de log is een spiegel, niet de
 * weg zelf.
 */
async function spiegelNaarLog(db, { soort, sleutel, inhoud }) {
  try {
    await db.collection('messaging').doc(`verhuur-${sleutel}`).create({
      bron: 'verhuur',
      soort,
      sleutel,
      tijdstip: null,
      taal: 'nl',
      inhoud,
      ontvangen: FieldValue.serverTimestamp(),
      verwerking: {},
      // Outbox, net als de ingang van messaging: de relay zet de rij op de bus.
      bus: { stand: 'wacht' },
      versie: 1,
    })
  } catch (err) {
    if (err?.code !== 6) logger.warn('Verhuur niet in de messaging-log gezet', { sleutel, fout: String(err?.message ?? err) })
  }
}

export function maakVerhuurOrders({ db, region, verstuur, alleProfielen }) {
  /** Beheerders: wie het magazijn en het geld draagt. */
  const beheerders = (profielen) =>
    profielen.filter((p) => p.active !== false && (p.role === 'owner' || p.role === 'admin')).map((p) => p.id)

  const orderBetaald = onDocumentUpdated(
    { region, document: 'huurorders/{id}' },
    async (event) => {
      const voor = event.data?.before?.data()
      const na = event.data?.after?.data()
      if (!na || voor?.status === na.status) return
      if (na.status !== 'betaald' && na.status !== 'nakijken') return

      const orderId = event.params.id
      const profielen = await alleProfielen()

      await spiegelNaarLog(db, {
        soort: na.status === 'betaald' ? 'huur.betaald' : 'huur.nakijken',
        sleutel: `order-${orderId}`,
        inhoud: {
          naam: na.klant?.naam ?? '',
          email: na.klant?.email ?? '',
          van: na.van ?? null,
          tot: na.tot ?? null,
          bedrag: Number(na.teBetalen ?? 0),
          regels: (na.regels ?? []).map((r) => `${r.aantal} × ${r.naam}`).join(', '),
        },
      })

      /*
        Idempotent op het document zelf: Firestore levert een trigger soms
        twee keer af, en twee events voor één huur is precies wat het bord
        onbetrouwbaar maakt. Het eerste wat we doen is de koppeling claimen.
      */
      if (na.status === 'betaald' && !na.eventId) {
        const eventId = await maakEvent({ db, orderId, order: na })
        if (eventId) {
          await event.data.after.ref.update({ eventId, updatedAt: FieldValue.serverTimestamp() })
        }
      }

      const naam = na.klant?.naam || na.klant?.email || 'een klant'
      const bedrag = `€ ${Number(na.teBetalen ?? 0).toFixed(2).replace('.', ',')}`
      await verstuur({
        soort: 'verhuur',
        kandidaten: beheerders(profielen),
        profielen,
        push: () => ({
          title: na.status === 'nakijken' ? `Nakijken: online huur van ${naam}` : `Online huur van ${naam}`,
          body:
            na.status === 'nakijken'
              ? `Het betaalde bedrag wijkt af van ${bedrag}. Kijk na vóór de camion vertrekt.`
              : `${bedrag} betaald · ${na.van} tot ${na.tot}`,
          url: '/materiaal',
          tag: `verhuur-${orderId}`,
        }),
        // De mail komt al uit `functions-betaling/`, met de regels erin.
        mail: null,
      })
    }
  )

  const aanvraagBinnen = onDocumentCreated(
    { region, document: 'verhuuraanvragen/{id}' },
    async (event) => {
      const aanvraag = event.data?.data()
      if (!aanvraag) return
      await spiegelNaarLog(db, {
        soort: 'offerte.aangevraagd',
        sleutel: `aanvraag-${event.params.id}`,
        inhoud: {
          naam: aanvraag.naam ?? '',
          email: aanvraag.email ?? '',
          telefoon: aanvraag.telefoon ?? '',
          datum: aanvraag.datum ?? null,
          personen: aanvraag.gasten ?? null,
          bericht: aanvraag.wat ?? '',
        },
      })
      const profielen = await alleProfielen()
      const wie = aanvraag.naam || aanvraag.email || 'iemand'

      await verstuur({
        soort: 'verhuur',
        kandidaten: beheerders(profielen),
        profielen,
        push: () => ({
          title: `Offerteaanvraag van ${wie}`,
          body: String(aanvraag.wat ?? '').slice(0, 120),
          url: '/aanvragen',
          tag: `aanvraag-${event.params.id}`,
        }),
        mail: () => ({
          onderwerp: `Offerteaanvraag van ${wie} (verhuursite)`,
          tekst: [
            `${wie} vroeg een offerte via rental.jeconcept.be.`,
            '',
            aanvraag.datum ? `Datum: ${aanvraag.datum}` : null,
            aanvraag.gasten ? `Personen: ${aanvraag.gasten}` : null,
            `Contact: ${aanvraag.email}${aanvraag.telefoon ? ` · ${aanvraag.telefoon}` : ''}`,
            '',
            aanvraag.wat,
            '',
            'Zie het postvak in JE Plan (Events → envelopje).',
          ]
            .filter((r) => r !== null)
            .join('\n'),
        }),
      })
    }
  )

  return { verhuurOrderBetaald: orderBetaald, verhuurAanvraagBinnen: aanvraagBinnen }
}

/**
 * Een event voor een betaalde huur, in de kolom "planning ongoing".
 *
 * Dezelfde velden als `createEventFromTemplate` in de browser schrijft —
 * wat daar staat, moet hier ook staan, anders is dit het ene event op het
 * bord dat zich anders gedraagt. Geen taken eronder, met opzet: zie de kop.
 */
async function maakEvent({ db, orderId, order }) {
  const lijsten = await db.collection('lists').where('kind', '==', 'tasks').where('archived', '==', false).limit(1).get()
  if (lijsten.empty) {
    logger.warn('Geen eventlijst; de huur komt niet op het bord', { orderId })
    return null
  }
  const lijst = { id: lijsten.docs[0].id, ...lijsten.docs[0].data() }
  const kolom =
    lijst.statuses?.find((s) => s.name === KOLOM_NA_BETALING) ??
    lijst.statuses?.find((s) => s.kind === 'active') ??
    lijst.statuses?.[0]
  if (!kolom) {
    logger.warn('Eventlijst zonder kolommen; de huur komt niet op het bord', { orderId })
    return null
  }

  const dag = (sleutel) => (sleutel ? new Date(`${sleutel}T12:00:00`) : null)
  const naam = order.klant?.naam?.trim() || order.klant?.email || 'Online huur'
  const regels = (order.regels ?? []).map((r) => `${r.aantal} × ${r.naam}`).join(', ')
  const nu = new Date()
  const jaar = dag(order.van)?.getFullYear() ?? nu.getFullYear()

  const ref = db.collection('tasks').doc()
  await ref.set({
    listId: lijst.id,
    listName: lijst.name ?? 'Events',
    spaceId: lijst.spaceId ?? null,
    brandId: lijst.brandId ?? null,
    parentId: null,
    title: `Verhuur — ${naam}`,
    description: [
      `Online betaald via rental.jeconcept.be. Kenmerk ${orderId}.`,
      '',
      regels,
      '',
      order.klant?.opmerking ? `Opmerking van de klant: ${order.klant.opmerking}` : null,
    ]
      .filter((r) => r !== null)
      .join('\n'),
    eventDate: dag(order.van),
    eventEndDate: order.tot && order.tot !== order.van ? dag(order.tot) : null,
    dueDate: dag(order.van),
    startDate: null,
    customerId: order.customerId ?? null,
    customerName: order.customerName ?? order.klant?.naam?.trim() ?? null,
    eventType: 'Verhuur',
    templateId: null,
    priority: null,
    timeEstimateMinutes: null,
    assignees: [],
    position: Date.now(),
    pax: null,
    location: null,
    locationPlaceId: null,
    locationLat: null,
    locationLng: null,
    formule: null,
    formuleId: null,
    formuleKeuzes: null,
    formulePrijsPerPersoon: null,
    formuleBtw: null,
    formuleInclBtw: null,
    quoteAmount: order.exclBtw ?? null,
    budget: order.exclBtw ?? null,
    bestellijst: [],
    tags: ['verhuur'],
    archived: false,
    afgesloten: false,
    afgeslotenJaar: null,
    completedAt: null,
    trackedSeconds: 0,
    commentCount: 0,
    statusId: kolom.id,
    statusName: kolom.name,
    statusColor: kolom.color,
    statusKind: kolom.kind,
    open: kolom.kind !== 'done' && kolom.kind !== 'closed',
    // Waar het geld vandaan kwam, zodat de fiche terug kan naar de order.
    huurorderId: orderId,
    createdBy: null,
    updatedBy: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  // De reservaties horen bij het event, zodat het tabblad Materiaal ze toont.
  const batch = db.batch()
  for (const id of order.reservatieIds ?? []) {
    batch.update(db.collection('reservaties').doc(id), {
      eventId: ref.id,
      eventNaam: `Verhuur — ${naam}`,
      soort: 'event',
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()

  logger.info('Event gemaakt voor online huur', { orderId, eventId: ref.id, jaar })
  return ref.id
}
