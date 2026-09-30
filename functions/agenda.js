/**
 * De eventdatums als agenda-abonnement.
 *
 * Eén adres dat je in Google Calendar, Apple Agenda of Outlook plakt, en de
 * events staan erin. Waarom een .ics-feed en niet de Google Calendar API staat
 * bovenaan `src/lib/ical.js`; kort: de API vraagt een instemmingsscherm dat
 * Google moet keuren en tokens van medewerkers in onze database, en dit vraagt
 * niets.
 *
 * ── Hoe het afgeschermd is ────────────────────────────────────────────────
 * Met een sleutel in het adres, want een agenda-abonnement kan geen
 * aanmeldscherm tonen en geen header meesturen. Dat is dus zo veilig als het
 * adres: wie het doorstuurt, deelt zijn agenda. Daarom:
 *
 *   - de sleutel is 32 willekeurige tekens uit `crypto`, geen geraden getal;
 *   - er is er één per persoon, met het profiel-id als documentnaam, zodat een
 *     nieuwe sleutel de oude meteen ongeldig maakt;
 *   - de app zegt erbij wat het adres is en dat het niet gedeeld moet worden;
 *   - er staat niets in de feed wat een teamlid niet toch al mag zien.
 *
 * Personeel krijgt niets: hun login toont alleen de openings- en sluitingslijst,
 * en een agenda met alle events erin zou meer tonen dan het scherm waar ze op
 * mogen. Een gedeactiveerd profiel krijgt ook niets meer — dat is precies het
 * geval waarvoor dit met een sleutel per persoon werkt in plaats van met één
 * adres voor iedereen.
 */

import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { agendaVan } from './ical.js'

const APP = process.env.APP_URL ?? 'https://planning.jeconcept.be'

/** Maakt de functie met de database erbij, zodat ze in een test na te rekenen is. */
export function maakAgendaFeed({ db, region }) {
  /*
    `invoker: 'private'` betekent hier niet dat de feed privé is.

    Het zegt tegen de Firebase CLI: zet zelf geen IAM-binding. Dat recht
    (`cloudfunctions.functions.setIamPolicy`) heeft het serviceaccount van de
    uitrol niet, en daarop strandde de hele functions-uitrol — één functie die
    alle andere meesleepte.

    Publiek bereikbaar wordt ze een stap later, in de workflow, met
    `gcloud run services add-iam-policy-binding`. Dat recht heeft het account
    wél: dezelfde stap staat er al voor `ensureProfile` en die slaagt. Zo is er
    geen nieuwe rol nodig om dit aan te zetten.
  */
  return onRequest({ region, cors: false, invoker: 'private' }, async (verzoek, antwoord) => {
    const sleutel = String(verzoek.query?.sleutel ?? '').trim()

    /*
      Eén antwoord voor "geen sleutel", "verkeerde sleutel" en "geen toegang
      meer". Wie het adres raadt, hoort niet te kunnen afleiden of een sleutel
      bestond — en wie zijn eigen sleutel intypte, ziet het verschil toch in de
      app.
    */
    const weiger = () => {
      antwoord.status(404).type('text/plain').send('Geen agenda op dit adres.')
    }

    if (!/^[A-Za-z0-9_-]{16,64}$/.test(sleutel)) return weiger()

    const rijen = await db.collection('agendaSleutels').where('sleutel', '==', sleutel).limit(1).get()
    if (rijen.empty) return weiger()

    const uid = rijen.docs[0].id
    const profiel = (await db.collection('profiles').doc(uid).get()).data()
    if (!profiel || profiel.active === false || profiel.role === 'staff') return weiger()

    const events = await db.collection('events').where('archived', '==', false).get()

    const tekst = agendaVan(
      events.docs.map((d) => ({ id: d.id, ...d.data() })),
      { naam: 'JE Plan — events', basis: APP }
    )

    logger.info('Agenda opgehaald', { uid, events: events.size })

    antwoord
      .status(200)
      .set('Content-Type', 'text/calendar; charset=utf-8')
      .set('Content-Disposition', 'inline; filename="je-plan.ics"')
      // Een uur: een agenda die vaker vraagt, krijgt hetzelfde antwoord, en
      // Google haalt sowieso op wanneer het Google uitkomt.
      .set('Cache-Control', 'private, max-age=3600')
      .send(tekst)

    // Wanneer iemand zijn agenda voor het laatst ophaalde, helpt bij de vraag
    // "staat het er nu in of niet" — en die vraag komt.
    await rijen.docs[0].ref.set({ laatstGelezen: new Date() }, { merge: true })
  })
}
