import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'
import { isEventLijst } from './events-bron.js'
import { archiefVelden, moetBijgewerkt } from './archief-stand.js'

/**
 * Het archief op het document zetten in plaats van in de browser.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * De app abonneerde zich op élke taak in de eventlijst — alle events én al hun
 * subtaken, op elk scherm, voor elke gebruiker — en besliste daarna in de
 * browser welke er in het archief hoorden. Dat werkt bij tachtig events. Bij
 * vijfhonderd is het een tragere start, meer geheugen op een telefoon, en
 * Firestore rekent per gelezen document, elke keer dat iemand de app opent.
 *
 * Nu staat het antwoord op het document en vraagt de app alleen nog wat er
 * níét op staat.
 *
 * ── Waarom twee functies en niet één ──────────────────────────────────────
 * Een event sluit op twee manieren. Iemand zet hem op `complete` — dan hoort
 * hij meteen van het bord, en daar is de trigger voor; wachten tot morgen zou
 * een stap terug zijn tegenover wat de browser deed. Of er is gefactureerd en
 * er gaan zestig dagen voorbij — daar gebeurt niets voor dat een trigger kan
 * horen, en dus is er een nachtelijke ronde.
 *
 * ── Waarom de subtaken meegaan ────────────────────────────────────────────
 * De app haalt een event en zijn taken met één vraag op. Zou alleen het event
 * het veld dragen, dan bleven de taken van een afgesloten event wél binnenkomen
 * en was er niets gewonnen.
 */

/** Firestore schrijft hoogstens 500 bewerkingen per batch. */
const PER_BATCH = 400

export function maakArchiveren({ db, region }) {
  /** De eventlijst, herkend aan haar statussen en niet aan haar naam. */
  async function eventLijstId() {
    const lijsten = await db.collection('lists').get()
    const lijst = lijsten.docs.map((d) => ({ id: d.id, ...d.data() })).find(isEventLijst)
    return lijst?.id ?? null
  }

  /**
   * Eén event en zijn taken op de juiste stand zetten.
   *
   * Geeft terug wat er veranderde, zodat de aanroeper kan tellen — en zodat de
   * trigger zichzelf niet eindeloos opnieuw wekt: de tweede keer klopt alles
   * en wordt er niets meer geschreven.
   */
  async function zetStand(eventId, event, nu) {
    const hoort = archiefVelden(event, { nu })
    const stand = { geschreven: false, was: event?.afgesloten === true, wordt: hoort.afgesloten, jaar: hoort.afgeslotenJaar }
    if (!moetBijgewerkt(event, { nu })) return stand

    const velden = { ...hoort, updatedAt: FieldValue.serverTimestamp() }
    const kinderen = await db.collection('tasks').where('parentId', '==', eventId).get()

    const batch = db.batch()
    batch.set(db.collection('tasks').doc(eventId), velden, { merge: true })
    for (const kind of kinderen.docs.slice(0, PER_BATCH - 1)) batch.set(kind.ref, velden, { merge: true })
    await batch.commit()

    // Meer dan vierhonderd subtaken op één event komt niet voor, maar stil
    // de helft overslaan is erger dan traag zijn.
    const rest = kinderen.docs.slice(PER_BATCH - 1)
    for (let i = 0; i < rest.length; i += PER_BATCH) {
      const extra = db.batch()
      for (const kind of rest.slice(i, i + PER_BATCH)) extra.set(kind.ref, velden, { merge: true })
      await extra.commit()
    }

    return { ...stand, geschreven: true }
  }

  /**
   * Zodra iemand de status van een event verzet.
   *
   * Alleen op het event zelf: een subtaak die verandert, verandert niets aan
   * of het dossier afgesloten is. En alleen wanneer de status of een datum
   * veranderde — anders wekt elk vinkje op een taak deze functie.
   */
  const archiveerBijWijziging = onDocumentWritten(
    { document: 'tasks/{id}', region },
    async (event) => {
      const na = event.data?.after?.data()
      if (!na || na.parentId) return
      const voor = event.data?.before?.data() ?? {}

      const geraakt = ['statusName', 'eventDate', 'eventEndDate', 'dueDate', 'completedAt']
      const verschil = geraakt.some((veld) => String(voor[veld] ?? '') !== String(na[veld] ?? ''))
      // Of het veld zelf ontbreekt: dan is dit een event van vóór deze functie.
      if (!verschil && na.afgesloten !== undefined) return

      const lijstId = await eventLijstId()
      if (!lijstId || na.listId !== lijstId) return

      const stand = await zetStand(event.params.id, na, new Date()).catch((err) => {
        logger.warn('archiefstand niet gezet', { id: event.params.id, fout: String(err?.message ?? err) })
        return null
      })

      /*
        Het lijstje jaren en de teller meteen mee bijwerken.

        Het archiefscherm leest die twee om te weten wélke jaren het mag
        opvragen en hoeveel er in totaal in zit — het haalt niet meer alles op
        om dat zelf te tellen. Zou alleen de nachtronde ze bijhouden, dan stond
        een event dat je nu op `complete` zet pas morgen in het archief, en dat
        leest als verdwenen. De nachtronde schrijft ze daarna exact opnieuw, dus
        een telling die ooit scheef loopt, trekt zich binnen een dag recht.
      */
      if (!stand?.geschreven || stand.was === stand.wordt) return

      const patch = { aantal: FieldValue.increment(stand.wordt ? 1 : -1) }
      if (stand.wordt && stand.jaar) patch.jaren = FieldValue.arrayUnion(stand.jaar)
      await db.collection('config').doc('archief').set(patch, { merge: true }).catch((err) =>
        logger.warn('archiefstand van config niet bijgewerkt', { fout: String(err?.message ?? err) })
      )
    }
  )

  /**
   * De nachtelijke ronde: wat door tijdsverloop afgesloten raakt.
   *
   * Om 05:10, vóór de herhalingen van 05:40 — dan staat het bord 's ochtends
   * meteen juist, en loopt de ene nachtklus niet in de andere.
   */
  const archiveerDagelijks = onSchedule(
    { region, schedule: '10 5 * * *', timeZone: 'Europe/Brussels' },
    async () => {
      const lijstId = await eventLijstId()
      if (!lijstId) {
        logger.warn('Geen eventlijst gevonden; archiefronde overgeslagen.')
        return
      }

      const nu = new Date()
      const snap = await db.collection('tasks').where('listId', '==', lijstId).get()
      const events = snap.docs.filter((d) => !d.data().parentId)

      let gewijzigd = 0
      let dicht = 0
      const jaren = new Set()
      for (const doc of events) {
        const stand = await zetStand(doc.id, doc.data(), nu)
        if (stand.geschreven) gewijzigd += 1
        if (stand.wordt) {
          dicht += 1
          if (stand.jaar) jaren.add(stand.jaar)
        }
      }

      /*
        De jaren waarin er iets in het archief zit, plus hoeveel het er zijn.

        Het archiefscherm vraagt per jaar op, en moet dus weten welke jaren er
        zijn zonder eerst alles op te halen — want dat is precies wat hier
        afgeschaft wordt. Hier worden ze exact geschreven en niet opgeteld: dit
        is de ronde die een teller rechttrekt die overdag scheef liep.
      */
      await db.collection('config').doc('archief').set(
        { jaren: [...jaren].sort((a, b) => b - a), aantal: dicht, bijgewerkt: FieldValue.serverTimestamp() },
        { merge: true }
      )

      logger.info('Archiefronde klaar', { events: events.length, gewijzigd, archief: dicht, jaren: [...jaren] })
    }
  )

  return { archiveerBijWijziging, archiveerDagelijks }
}
