import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getMessaging } from 'firebase-admin/messaging'
import { logger } from 'firebase-functions'
import { ENTITIES, RULE_STAMP, changedFields, isRuleEcho, planFor } from './automations.js'
import {
  bepaalOntvangers,
  isTeLaat,
  perPersoon,
  kort,
  nieuweReviewer,
  nieuweToegewezenen,
  vervaltMorgen,
  wieBijReactie,
} from './notify.js'
import {
  mailVoorDeadline,
  mailVoorReactie,
  mailVoorTeLaat,
  mailVoorToewijzing,
} from './mail.js'

initializeApp()
const db = getFirestore()

const REGION = 'europe-west1'

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Access                                                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Turns a Google sign-in into a profile — or refuses to.
 *
 * The security rules treat "has a profile" as "is a member", so this function
 * is the only door: an address is let in when it was invited, or when it lives
 * on one of our own domains. Everything else signs in to nothing.
 */
export const ensureProfile = onCall({ region: REGION }, async (request) => {
  const { auth } = request
  if (!auth) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')

  const uid = auth.uid
  const email = (auth.token.email ?? '').toLowerCase()
  if (!email) throw new HttpsError('permission-denied', 'Dit account heeft geen e-mailadres.')

  const profileRef = db.collection('profiles').doc(uid)
  const existing = await profileRef.get()

  if (existing.exists) {
    if (existing.data().active === false) {
      throw new HttpsError('permission-denied', 'Dit account is gedeactiveerd.')
    }
    // Google is the source of truth for name and picture; keep them fresh.
    await profileRef.set(
      {
        email,
        fullName: auth.token.name ?? existing.data().fullName ?? null,
        avatarUrl: auth.token.picture ?? existing.data().avatarUrl ?? null,
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return { ok: true, role: existing.data().role }
  }

  const domain = email.split('@')[1] ?? ''
  const [invite, access] = await Promise.all([
    db.collection('invites').doc(email).get(),
    db.collection('config').doc('access').get(),
  ])

  const allowedDomains = access.exists
    ? (access.data().allowedDomains ?? [])
    : ['jeconcept.be', 'kenjeklanten.be']

  if (!invite.exists && !allowedDomains.includes(domain)) {
    logger.warn('Toegang geweigerd', { email })
    throw new HttpsError('permission-denied', `${email} heeft geen toegang tot JE Plan.`)
  }

  // Somebody has to own an empty workspace, or nobody can ever invite anybody.
  // Which somebody is a named address, not whoever happens to sign in first:
  // that race is how the wrong person ends up owning the planning, and it is
  // not undoable from inside the app once it has happened.
  const bootstrapOwner = (access.data()?.bootstrapOwnerEmail ?? '').toLowerCase()
  const anyProfile = await db.collection('profiles').limit(1).get()

  const role = invite.data()?.role
    ?? (anyProfile.empty && (!bootstrapOwner || bootstrapOwner === email) ? 'owner' : 'member')

  await profileRef.set({
    email,
    fullName: auth.token.name ?? null,
    avatarUrl: auth.token.picture ?? null,
    role,
    hourlyRate: null,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  })

  if (invite.exists) await invite.ref.delete()

  logger.info('Profiel aangemaakt', { email, role })
  return { ok: true, role }
})

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Een lijst hernoemen                                                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Trekt een nieuwe lijstnaam door naar alles wat er een kopie van bewaart.
 *
 * Firestore kan niet joinen, dus een taak draagt de naam van zijn lijst mee
 * (net als zijn status). Dat is wat een bord snel houdt, maar het betekent ook
 * dat hernoemen in Instellingen anders alleen de zijbalk verandert: op de taken
 * zelf, in de tijdregistratie en in de kolom "project" bij een social post
 * bleef de oude naam staan. Vandaar deze trigger — één keer per hernoeming,
 * server-side, ongeacht wie het deed of waarvandaan (ook de seed).
 *
 * De schrijfacties gaan per 400 in een batch: Firestore staat er 500 toe, en
 * een lijst met honderden taken loopt daar zo voorbij.
 */
export const spreadListRename = onDocumentUpdated(
  { region: REGION, document: 'lists/{listId}' },
  async (event) => {
    const listId = event.params.listId
    const oud = event.data?.before?.data()?.name ?? null
    const nieuw = event.data?.after?.data()?.name ?? null
    if (!nieuw || oud === nieuw) return

    const doelen = [
      { col: 'tasks', veld: 'listName', filter: ['listId', '==', listId] },
      { col: 'timeEntries', veld: 'listName', filter: ['listId', '==', listId] },
      { col: 'runningTimers', veld: 'listName', filter: ['listId', '==', listId] },
      // Een social post verwijst naar de taak, niet naar de lijst; de naam van
      // de lijst staat er los bij om het project in één regel te kunnen tonen.
      { col: 'socialPosts', veld: 'taskListName', filter: ['taskListName', '==', oud] },
    ]

    let bijgewerkt = 0
    for (const doel of doelen) {
      if (doel.filter[0] === 'taskListName' && !oud) continue

      const snap = await db.collection(doel.col).where(...doel.filter).get()
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = db.batch()
        snap.docs.slice(i, i + 400).forEach((doc) => {
          batch.update(doc.ref, { [doel.veld]: nieuw })
        })
        await batch.commit()
      }
      bijgewerkt += snap.size
    }

    logger.info('Lijst hernoemd', { listId, oud, nieuw, bijgewerkt })
  }
)

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Business rules                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Past de regels uit Instellingen toe — op elke entiteit dezelfde manier.
 *
 * Er stond hier één trigger, op taken, die alleen bij een statuswissel keek.
 * Nu een regel over een klant, een post, een dag van de afvinklijst, een
 * urenboeking of een profiel kan gaan, en over elk veld daarvan, kan die
 * goedkope voorwaarde niet meer: welk veld ertoe doet, staat in de regel en
 * niet in deze code. In de plaats daarvan staan er twee andere remmen, en die
 * zijn ook de lusbeveiliging:
 *
 * 1. `isRuleEcho` — deze functie schrijft haar eigen resultaat weg en wordt
 *    daar opnieuw wakker van. Die schrijfbeurt draagt `ruleStamp`, en daaraan
 *    herkent ze zichzelf voor er ook maar één regel gelezen is.
 * 2. Een lege patch. Wat al zo staat, wordt niet geschreven; zonder schrijving
 *    geen tweede ronde. Dat was van in het begin de stop en dat blijft het,
 *    ook wanneer een wijziging langs een andere weg terugkomt.
 *
 * De regels worden ongefilterd opgehaald en hier op entiteit gescheiden. Dat
 * kost één leesbeurt van een kleine collectie, en het is de enige manier om de
 * bestaande regels mee te nemen: die staan er zonder `entity` in, want toen
 * bestond er maar één.
 */
function automatiseer(entity) {
  return onDocumentWritten(
    { region: REGION, document: `${entity.collection}/{docId}` },
    async (event) => {
      const na = event.data?.after?.data()
      if (!na) return

      const voor = event.data?.before?.exists ? event.data.before.data() : null
      if (isRuleEcho(voor, na)) return
      if (voor && changedFields(voor, na, entity.key).length === 0) return

      const snap = await db.collection('automations').where('enabled', '==', true).get()
      const rules = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => (r.entity ?? 'task') === entity.key)
      if (rules.length === 0) return

      const docId = event.params.docId
      const { patch, fired } = planFor({
        rules,
        entity: entity.key,
        doc: { id: docId, ...na },
        before: voor,
        now: new Date(),
      })

      if (Object.keys(patch).length === 0) return

      await event.data.after.ref.update({
        ...patch,
        [RULE_STAMP]: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      // Waarom staat deze taak ineens bij iemand anders? Het logboek beantwoordt
      // dat, tot op de rij van de beslissingstabel die het deed. Zelfde lijn als
      // het activiteitenlog bij een taak: bijschrijven, nooit herschrijven.
      await db.collection('automationRuns').add({
        entity: entity.key,
        collection: entity.collection,
        docId,
        docTitle: na.title ?? na.name ?? na.fullName ?? na.checklistName ?? null,
        rules: fired,
        ruleIds: fired.map((f) => f.id).filter(Boolean),
        fields: Object.keys(patch),
        firedAt: FieldValue.serverTimestamp(),
      })

      logger.info('Business rule toegepast', {
        entity: entity.key,
        docId,
        regels: fired,
        velden: Object.keys(patch),
      })
    }
  )
}

/**
 * Eén trigger per collectie, met een vaste exportnaam per entiteit.
 *
 * Bewust uitgeschreven en niet met een lus over `ENTITIES` gegenereerd: Firebase
 * leidt de naam van een functie af uit de naam van de export, en een export die
 * pas bij het laden ontstaat, is er bij het uitrollen niet. `applyAutomations`
 * houdt zijn naam, zodat de bestaande functie bijgewerkt wordt in plaats van
 * dat er een tweede naast komt te staan die hetzelfde doet.
 */
const entiteit = (key) => ENTITIES.find((e) => e.key === key)

export const applyAutomations = automatiseer(entiteit('task'))
export const applyCustomerAutomations = automatiseer(entiteit('customer'))
export const applySocialAutomations = automatiseer(entiteit('socialPost'))
export const applyChecklistAutomations = automatiseer(entiteit('checklistRun'))
export const applyTimeAutomations = automatiseer(entiteit('timeEntry'))
export const applyProfileAutomations = automatiseer(entiteit('profile'))

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Meldingen                                                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Stuurt één melding naar alle toestellen van een paar mensen.
 *
 * Bewust data-only: de melding wordt in de service worker opgebouwd, zodat ze
 * er op elk toestel hetzelfde uitziet en op dezelfde plek in de app uitkomt.
 *
 * Een token verloopt zodra iemand de app verwijdert of zijn browsergegevens
 * wist. Firebase zegt dat met zoveel woorden terug, en dan gaat de rij hier
 * weg — anders blijft er jaren gestuurd worden naar toestellen die niet meer
 * bestaan.
 */
async function stuurMelding(profileIds, { title, body, url, tag }) {
  const ontvangers = [...new Set(profileIds.filter(Boolean))]
  if (ontvangers.length === 0) return 0

  const rijen = []
  // 'in' neemt er tien tegelijk.
  for (let i = 0; i < ontvangers.length; i += 10) {
    const snap = await db
      .collection('pushTokens')
      .where('profileId', 'in', ontvangers.slice(i, i + 10))
      .get()
    rijen.push(...snap.docs)
  }
  if (rijen.length === 0) return 0

  const antwoord = await getMessaging().sendEachForMulticast({
    tokens: rijen.map((d) => d.id),
    data: { title, body: body ?? '', url: url ?? '/', tag: tag ?? 'je-planning' },
    webpush: { headers: { Urgency: 'normal', TTL: '86400' } },
  })

  await Promise.all(
    antwoord.responses.map((r, i) => {
      const code = r.error?.code ?? ''
      const dood =
        code.includes('registration-token-not-registered') || code.includes('invalid-argument')
      return dood ? rijen[i].ref.delete() : null
    })
  )

  return antwoord.successCount
}

/**
 * Het adres waar een melding naartoe wijst.
 *
 * Staat hier als constante en niet in vier teksten: de tool verhuist ooit naar
 * een ander domein, en dan is een mail met een dood adres erger dan geen mail.
 */
const APP = process.env.APP_URL ?? 'https://planning.jeconcept.be'

/** Alle profielen, één keer per aanroep. Het zijn er tien, geen tienduizend. */
async function alleProfielen() {
  const snap = await db.collection('profiles').get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Eén bericht versturen langs de kanalen die de ontvanger openliet.
 *
 * `bepaalOntvangers` doet het denkwerk — wie valt af en waarom staat daar —
 * en dit stuurt wat eruit komt. De e-mail gaat niet rechtstreeks de deur uit
 * maar in `mailQueue`; waarom die wachtrij ertussen zit, staat bovenaan
 * `mail.js`. Kort: de SMTP-sleutel mag ontbreken zonder dat er iets breekt.
 */
async function verstuur({ soort, kandidaten, behalve = null, profielen, push, mail }) {
  const ontvangers = bepaalOntvangers({ soort, kandidaten, profielen, behalve })

  const verstuurd = push ? await stuurMelding(ontvangers.push, push) : 0

  const batch = db.batch()
  let gemaild = 0
  for (const { id, adres } of ontvangers.email) {
    const inhoud = mail ? mail(adres) : null
    if (!inhoud) continue
    batch.set(db.collection('mailQueue').doc(), {
      aan: adres,
      profileId: id,
      soort,
      onderwerp: inhoud.onderwerp,
      tekst: inhoud.tekst,
      status: 'wachtend',
      pogingen: 0,
      createdAt: FieldValue.serverTimestamp(),
    })
    gemaild += 1
  }
  if (gemaild) await batch.commit()

  return { push: verstuurd, email: gemaild }
}

/**
 * "Er staat iets voor jou klaar."
 *
 * Alleen wie er nieuw op komt te staan, en nooit wie de wijziging zelf maakte.
 * Daarvoor schrijft de app `updatedBy` mee op elke taakwijziging; zonder dat
 * trilt je telefoon wanneer je een taak naar jezelf haalt, en dat is precies
 * hoe mensen meldingen uitzetten.
 */
export const notifyAssignment = onDocumentWritten(
  { region: REGION, document: 'tasks/{taskId}' },
  async (event) => {
    const na = event.data?.after?.data()
    if (!na || na.archived) return

    const voor = event.data?.before?.exists ? event.data.before.data() : null
    const nieuw = nieuweToegewezenen(voor, na, na.updatedBy ?? na.createdBy ?? null)
    if (nieuw.length === 0) return

    const taak = { id: event.params.taskId, ...na }
    const uitkomst = await verstuur({
      soort: 'toewijzing',
      kandidaten: nieuw,
      profielen: await alleProfielen(),
      push: {
        title: 'Nieuwe taak voor jou',
        body: kort(na.title),
        url: '/mijn-werk',
        tag: `taak-${event.params.taskId}`,
      },
      mail: () => mailVoorToewijzing({ taak, link: `${APP}/#/tasks` }),
    })

    if (uitkomst.push || uitkomst.email) {
      logger.info('Melding bij toewijzing', { taskId: event.params.taskId, ...uitkomst })
    }
  }
)

/** "Er wacht een post op jouw review." */
export const notifyReviewRequest = onDocumentWritten(
  { region: REGION, document: 'socialPosts/{postId}' },
  async (event) => {
    const na = event.data?.after?.data()
    if (!na) return

    const voor = event.data?.before?.exists ? event.data.before.data() : null
    const reviewer = nieuweReviewer(voor, na)
    if (!reviewer) return

    const verstuurd = await stuurMelding([reviewer], {
      title: 'Een post wacht op jouw review',
      body: kort(na.title),
      url: '/social',
      tag: `post-${event.params.postId}`,
    })

    if (verstuurd) logger.info('Reviewmelding verstuurd', { postId: event.params.postId, verstuurd })
  }
)

/**
 * Trekt een nieuwe klantnaam door naar de events die eraan hangen.
 *
 * Dezelfde reden als bij een lijstnaam: een event draagt de naam van zijn klant
 * mee zodat een bord niet per kaart een tweede document hoeft te lezen. Wordt
 * de klant hernoemd — een bvba die van naam verandert, een tikfout — dan moet
 * die kopie mee, anders staat op het bord jarenlang de oude naam.
 */
export const spreadCustomerRename = onDocumentUpdated(
  { region: REGION, document: 'customers/{customerId}' },
  async (event) => {
    const oud = event.data?.before?.data()?.name ?? null
    const nieuw = event.data?.after?.data()?.name ?? null
    if (!nieuw || oud === nieuw) return

    const snap = await db
      .collection('tasks')
      .where('customerId', '==', event.params.customerId)
      .get()

    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch()
      snap.docs.slice(i, i + 400).forEach((doc) => batch.update(doc.ref, { customerName: nieuw }))
      await batch.commit()
    }

    logger.info('Klant hernoemd', { customerId: event.params.customerId, oud, nieuw, events: snap.size })
  }
)

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Reacties, deadlines en de ochtendlijst                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * "Er is op je taak gereageerd."
 *
 * Naar de uitvoerders én naar wie er eerder al op reageerde: een gesprek van
 * drie berichten waarin de eerste twee sprekers niets meer horen, is geen
 * gesprek. De schrijver zelf krijgt niets — dat rekenwerk staat in
 * `wieBijReactie`, met de rest van de afwegingen.
 *
 * Alleen reacties op een taak. Een reactie op een social post hangt aan het
 * reviewspoor, dat zijn eigen melding heeft; daar nog een tweede bericht
 * bovenop maakt dat allebei genegeerd worden.
 */
export const notifyComment = onDocumentCreated(
  { region: REGION, document: 'comments/{commentId}' },
  async (event) => {
    const reactie = event.data?.data()
    if (!reactie?.taskId) return

    const [taakSnap, eerdere, profielen] = await Promise.all([
      db.collection('tasks').doc(reactie.taskId).get(),
      db.collection('comments').where('taskId', '==', reactie.taskId).orderBy('createdAt').get(),
      alleProfielen(),
    ])
    if (!taakSnap.exists) return

    const taak = { id: taakSnap.id, ...taakSnap.data() }
    const kandidaten = wieBijReactie({
      taak,
      // De nieuwe reactie staat er zelf ook al in; die telt niet als "eerdere".
      eerdereReacties: eerdere.docs.filter((d) => d.id !== event.params.commentId).map((d) => d.data()),
      auteur: reactie.authorId ?? null,
    })
    if (kandidaten.length === 0) return

    const uitkomst = await verstuur({
      soort: 'reactie',
      kandidaten,
      profielen,
      push: {
        title: `${reactie.authorName || 'Iemand'} reageerde`,
        body: kort(reactie.body),
        url: '/tasks',
        tag: `taak-${reactie.taskId}`,
      },
      mail: () => mailVoorReactie({ taak, reactie, link: `${APP}/#/tasks` }),
    })

    if (uitkomst.push || uitkomst.email) {
      logger.info('Melding bij reactie', { taskId: reactie.taskId, ...uitkomst })
    }
  }
)

/**
 * De taken van morgen, elke ochtend om zeven uur.
 *
 * 's Ochtends en niet 's avonds: een deadline die je om acht uur 's avonds te
 * horen krijgt, kun je die dag niets meer mee. En één dag vooruit en niet
 * dezelfde dag, want dan is het geen waarschuwing meer maar een verwijt.
 *
 * De query haalt een ruim venster op en de dag zelf wordt in `vervaltMorgen`
 * bepaald, op de Brusselse kalender. Deze functie draait namelijk op UTC, en
 * een taak die om half twaalf 's avonds vervalt hoort bij de dag die wij
 * meemaken, niet bij de dag van de server.
 *
 * Let op wat een geplande functie is: ze draait met beheerdersrechten en ziet
 * dus álle taken, ook die van boards waar niet iedereen komt. Daarom gaat er
 * per taak alleen iets naar wie er zelf op staat, en nooit een overzicht van
 * het hele team naar één persoon.
 */
export const notifyDueTomorrow = onSchedule(
  { region: REGION, schedule: '0 7 * * *', timeZone: 'Europe/Brussels' },
  async () => {
    const nu = new Date()
    const venster = await db
      .collection('tasks')
      .where('archived', '==', false)
      .where('dueDate', '>=', new Date(nu.getTime() - 86400000))
      .where('dueDate', '<=', new Date(nu.getTime() + 3 * 86400000))
      .get()

    const morgen = vervaltMorgen(
      venster.docs.map((d) => ({ id: d.id, ...d.data() })),
      nu
    )
    if (morgen.length === 0) {
      logger.info('Deadlines morgen: niets')
      return
    }

    const profielen = await alleProfielen()
    let mensen = 0

    for (const [uid, taken] of perPersoon(morgen)) {
      const uitkomst = await verstuur({
        soort: 'deadline',
        kandidaten: [uid],
        profielen,
        push: {
          title: taken.length === 1 ? 'Morgen te doen' : `Morgen vervallen ${taken.length} taken`,
          body: kort(taken[0].title),
          url: '/tasks',
          tag: 'deadline-morgen',
        },
        mail: () => mailVoorDeadline({ taken, link: `${APP}/#/tasks`, nu }),
      })
      if (uitkomst.push || uitkomst.email) mensen += 1
    }

    logger.info('Deadlines morgen verstuurd', { taken: morgen.length, mensen })
  }
)

/**
 * De ochtendmail met wat er op jouw naam over tijd staat.
 *
 * Half acht, een half uur na de deadlinemelding: twee berichten in dezelfde
 * minuut lezen als één bericht, en dan wordt er één van gelezen.
 *
 * Eén bericht per persoon met alles erin, en alleen wanneer er iets in staat.
 * Een dagelijkse mail die "niets te laat" zegt, leert men wegklikken — en
 * daarna gaat ook de mail van de dag dat het er wél toe doet ongelezen weg.
 * `mailVoorTeLaat` geeft daarom niets terug bij een lege lijst, en dit stuurt
 * dan ook niets.
 *
 * Standaard staat dit bericht uit; wie het wil, zet het aan bij Meldingen.
 */
export const notifyOverdueDigest = onSchedule(
  { region: REGION, schedule: '30 7 * * *', timeZone: 'Europe/Brussels' },
  async () => {
    const nu = new Date()
    const snap = await db
      .collection('tasks')
      .where('archived', '==', false)
      .where('dueDate', '<', nu)
      .get()

    const laat = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) => isTeLaat(t, nu))
    if (laat.length === 0) {
      logger.info('Te-laat-lijst: niets')
      return
    }

    const profielen = await alleProfielen()
    let mensen = 0

    for (const [uid, taken] of perPersoon(laat)) {
      const uitkomst = await verstuur({
        soort: 'telaat',
        kandidaten: [uid],
        profielen,
        push: {
          title: `${taken.length} ${taken.length === 1 ? 'taak staat' : 'taken staan'} te laat`,
          body: kort(taken[0].title),
          url: '/tasks',
          tag: 'te-laat',
        },
        mail: () => mailVoorTeLaat({ taken, link: `${APP}/#/tasks`, nu }),
      })
      if (uitkomst.push || uitkomst.email) mensen += 1
    }

    logger.info('Te-laat-lijst verstuurd', { taken: laat.length, mensen })
  }
)
