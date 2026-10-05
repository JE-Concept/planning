import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getMessaging } from 'firebase-admin/messaging'
import { logger } from 'firebase-functions'
import { ENTITIES, RULE_STAMP, changedFields, isRuleEcho, planFor } from './automations.js'
import { adressenVan, draadVan, eventUitAdres, kiesEvent, klantVanAdres } from './mail-koppeling.js'
import {
  bepaalOntvangers,
  isTeLaat,
  perPersoon,
  kort,
  leesbaar,
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
import { taalVan, zeg } from './teksten.js'
import { hoortInSpiegel, kopieVan, moetBijwerken } from './social-projectie.js'
import { maakAapiFuncties } from './aapi-import.js'
import { AUDIT, regelVan, teOud } from './audit.js'
import { maakAgendaFeed } from './agenda.js'
import { maakPortaal } from './portaal.js'
import { maakVerhuur } from './verhuur.js'
import { maakVerhuurOrders } from './verhuur-orders.js'
import { maakDrive } from './drive.js'
import { maakHerhalingen } from './herhalingen.js'
import { maakLinkVoorbeeld } from './linkvoorbeeld.js'
import { maakPloegFuncties } from './ploeg.js'
import { maakArchiveren } from './archiveren.js'

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
    // De afdeling komt uit de uitnodiging. Zonder dit krijgt een medewerker bij
    // zijn eerste aanmelding een lege openings- en sluitingslijst, en moet er
    // alsnog een beheerder aan te pas komen.
    department: invite.data()?.department ?? null,
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

  /*
    Push gaat in één keer naar veel toestellen met één tekst erin, en die tekst
    hangt nu aan de taal van de ontvanger. Dus eerst op taal groeperen en dan
    per groep versturen — met één taal (het gewone geval) blijft dat precies één
    verzending, zoals eerst.
  */
  const perTaal = new Map()
  for (const { id, taal } of ontvangers.push) {
    if (!perTaal.has(taal)) perTaal.set(taal, [])
    perTaal.get(taal).push(id)
  }

  let verstuurd = 0
  if (push) {
    for (const [taal, ids] of perTaal) verstuurd += await stuurMelding(ids, push(taal))
  }

  const batch = db.batch()
  let gemaild = 0
  for (const { id, adres, taal } of ontvangers.email) {
    const inhoud = mail ? mail(taal, adres) : null
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
      push: (taal) => ({
        title: zeg(taal, 'push.toewijzing'),
        body: kort(na.title),
        url: '/tasks',
        tag: `taak-${event.params.taskId}`,
      }),
      mail: (taal) => mailVoorToewijzing({ taak, link: `${APP}/#/tasks`, taal }),
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

    // Deze gaat buiten `verstuur` om — één persoon, geen voorkeuren — dus hier
    // wordt de taal van dat ene profiel zelf opgezocht.
    const profiel = (await db.collection('profiles').doc(reviewer).get()).data()
    const verstuurd = await stuurMelding([reviewer], {
      title: zeg(taalVan(profiel), 'push.review'),
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
      // Wie met @ aangesproken is, hoort het te weten — ook als hij niet op
      // het event staat. Dat is precies waarvoor je iemand vermeldt.
      vermeld: reactie.mentions ?? [],
    })
    if (kandidaten.length === 0) return

    const uitkomst = await verstuur({
      soort: 'reactie',
      kandidaten,
      profielen,
      push: (taal) => ({
        title: zeg(taal, 'push.reactie', { wie: reactie.authorName || zeg(taal, 'push.iemand') }),
        body: kort(leesbaar(reactie.body)),
        url: '/tasks',
        tag: `taak-${reactie.taskId}`,
      }),
      mail: (taal) =>
        mailVoorReactie({ taak, reactie: { ...reactie, body: leesbaar(reactie.body) }, link: `${APP}/#/tasks`, taal }),
    })

    if (uitkomst.push || uitkomst.email) {
      logger.info('Melding bij reactie', { taskId: reactie.taskId, ...uitkomst })
    }
  }
)

/**
 * Elke ochtend nakijken of de tool zelf nog draait.
 *
 * ── Waarom dit nodig is ───────────────────────────────────────────────────
 * De ophaler van de post schrijft bij waar ze gebleven was, en dat staat sinds
 * kort ook op een scherm. Maar een scherm werkt alleen als iemand kijkt, en
 * niemand opent Instellingen om te controleren of alles nog draait. Loopt een
 * app-wachtwoord af, dan stopt de post in stilte, en het eerste signaal is een
 * klant die vraagt waarom niemand antwoordt.
 *
 * Dus kijkt de tool zelf, één keer per dag, en zegt het tegen de beheerders
 * als er iets aan de hand is. Alleen dan: een dagelijks bericht dat "alles is
 * in orde" zegt, wordt na een week weggeklikt zonder lezen, en dan wordt het
 * bericht dat er wél toe doet ook weggeklikt.
 *
 * ── Waarom acht uur en niet zes ───────────────────────────────────────────
 * De drempel op het scherm ligt op zes uur; hier op acht. Wie 's ochtends
 * kijkt, ziet een storing van vannacht al staan; een melding hoort pas te
 * komen wanneer het echt niet meer vanzelf goedkomt. Een uitrol of een
 * herstart van een paar uur is dat niet.
 */
export const controleerSysteem = onSchedule(
  { region: REGION, schedule: '30 8 * * *', timeZone: 'Europe/Brussels' },
  async () => {
    const klachten = []

    const postvak = (await db.doc('instellingen/postvak').get()).data()
    const laatste = postvak?.laatsteKeer?.toDate?.() ?? null
    const uren = laatste ? Math.floor((Date.now() - laatste.getTime()) / 3600000) : null

    // Nog nooit gedraaid is een taak en geen storing: dan staat de sleutel er
    // gewoon nog niet. Daar is een melding elke ochtend geen dienst voor.
    if (laatste && uren >= 8) klachten.push({ wat: 'post', uren })

    const mislukt = await db.collection('mailQueue').where('status', '==', 'mislukt').limit(25).get()
    if (!mislukt.empty) klachten.push({ wat: 'mail', aantal: mislukt.size })

    if (klachten.length === 0) return

    const profielen = await alleProfielen()
    const beheerders = profielen
      .filter((p) => p.active !== false && (p.role === 'owner' || p.role === 'admin'))
      .map((p) => p.id)
    if (beheerders.length === 0) return

    const uitkomst = await verstuur({
      soort: 'systeem',
      kandidaten: beheerders,
      profielen,
      push: (taal) => ({
        title: zeg(taal, 'push.systeem'),
        body: klachten
          .map((k) =>
            k.wat === 'post'
              ? zeg(taal, 'push.systeem_post', { uren: k.uren })
              : zeg(taal, 'push.systeem_mail', { aantal: k.aantal })
          )
          .join(' '),
        url: '/instellingen?tab=systeem',
        tag: 'systeem',
      }),
      mail: (taal) => ({
        onderwerp: zeg(taal, 'mail.systeem.onderwerp'),
        tekst: [
          zeg(taal, 'mail.systeem.kop'),
          '',
          ...klachten.map((k) =>
            k.wat === 'post'
              ? zeg(taal, 'push.systeem_post', { uren: k.uren })
              : zeg(taal, 'push.systeem_mail', { aantal: k.aantal })
          ),
          '',
          `${APP}/#/instellingen?tab=systeem`,
        ].join('\n'),
      }),
    })

    logger.warn('Systeemcontrole sloeg alarm', { klachten, ...uitkomst })
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
        push: (taal) => ({
          title: zeg(taal, 'push.deadline', { aantal: taken.length }),
          body: kort(taken[0].title),
          url: '/tasks',
          tag: 'deadline-morgen',
        }),
        mail: (taal) => mailVoorDeadline({ taken, link: `${APP}/#/tasks`, nu, taal }),
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
        push: (taal) => ({
          title: zeg(taal, 'push.telaat', { aantal: taken.length }),
          body: kort(taken[0].title),
          url: '/tasks',
          tag: 'te-laat',
        }),
        mail: (taal) => mailVoorTeLaat({ taken, link: `${APP}/#/tasks`, nu, taal }),
      })
      if (uitkomst.push || uitkomst.email) mensen += 1
    }

    logger.info('Te-laat-lijst verstuurd', { taken: laat.length, mensen })
  }
)

/**
 * De eventdatums als agenda-abonnement, op één adres met een sleutel erin.
 *
 * De uitleg over hoe dat afgeschermd is, staat in `agenda.js` — net als waarom
 * ze met `invoker: 'private'` uitrolt en pas daarna publiek gezet wordt.
 */
export const agenda = maakAgendaFeed({ db, region: REGION })

/**
 * Wat een klant ziet: zijn offerte en zijn dossiers, zonder account.
 *
 * Waarom dat een functie is en geen Firestore-lezing, staat in `portaal.js`.
 * Kort: een browser leest altijd een heel document, en op een offerte staan
 * marges en interne notities.
 */
export const portaal = maakPortaal({ db, region: REGION })

/**
 * De etalage van de verhuur: wat er los te huren is, en wat er vrij is.
 *
 * Staat hier en niet bij de betaling, omdat die codebase aan Stripe-geheimen
 * hangt en overgeslagen wordt zolang die er niet zijn. Een verhuursite die
 * niets toont is erger dan een die toont maar nog niet laat afrekenen. Welke
 * velden het pand verlaten, staat in `verhuur-aanbod.js` — een witte lijst,
 * zodat een nieuw veld op een artikel niet vanzelf openbaar wordt.
 */
export const verhuur = maakVerhuur({ db, region: REGION })

/*
  Wat er in JE Plan gebeurt wanneer de verhuursite iets binnenbrengt: een
  betaalde huur wordt een event in "planning ongoing" en de beheerders krijgen
  een pushmelding; een aanvraag levert een melding op. Zie `verhuur-orders.js`
  voor waarom dit hier staat en niet bij de betaling.
*/
export const { verhuurOrderBetaald, verhuurAanvraagBinnen } = maakVerhuurOrders({
  db,
  region: REGION,
  verstuur,
  alleProfielen,
})

/* Werk dat vanzelf terugkomt; zie `herhalingen.js` voor waarom het 's nachts
   gebeurt en niet zodra iemand de tool opent. */
export const herhalingen = maakHerhalingen({ db, region: REGION })

/*
  Het voorbeeldkaartje bij een link in een notitie. Een browser mag een vreemde
  site niet lezen, dus doet de server het — met de nodige bewaking eromheen,
  want dit is het enige punt waar een gebruiker de server een adres laat
  opvragen. Zie `linkvoorbeeld.js`.
*/
export const { linkVoorbeeld } = maakLinkVoorbeeld({ db, region: REGION })

/*
  Aanmelden met een cijfercode, voor de ploeg: wie één zaterdag per maand komt
  werken, maakt daar geen Google-account voor aan. De code staat in een
  collectie die geen enkel tabblad mag openen; alleen deze functies komen
  erbij. Zie `ploeg.js` voor wat die vier cijfers wél en niet beschermen.
*/
/*
  Het archief op het document in plaats van in de browser.

  De app haalde élk event op — ook het trouwfeest van twee jaar geleden — om er
  daarna de helft van te verbergen. Nu schrijft de server het antwoord, en
  vraagt de app alleen nog wat er níét op staat. Zie `archiveren.js`.
*/
export const { archiveerBijWijziging, archiveerDagelijks } = maakArchiveren({ db, region: REGION })

export const { ploegLijst, ploegAanmelden, ploegCodeWijzigen, ploegCodeLezen } = maakPloegFuncties({
  db,
  region: REGION,
})

/*
  De planning uit AAPI: importeren en koppelen. Het rekenwerk staat in `aapi/`,
  los van Firebase, zodat een test een hele import kan naspelen met het echte
  exportbestand — twee keer, om te bewijzen dat er de tweede keer niets gebeurt.
*/
export const { aapiImport, aapiKoppel, aapiMailImport } = maakAapiFuncties({
  db,
  region: REGION,
  /*
    Wat de import per mail oplevert, gaat naar de beheerders. Niet naar
    iedereen: dit is een systeembericht over een koppeling, en wie de bar doet
    heeft er niets aan.

    Alleen wanneer er iets veranderde of iets een keuze vraagt — dat beslist de
    trigger. Een dagelijkse mail die niets wijzigde, hoeft niemands telefoon te
    laten trillen.
  */
  meld: async ({ gelukt, rapport, fout, bestandsnaam }) => {
    const profielen = await alleProfielen()
    const beheerders = profielen
      .filter((p) => p.active !== false && (p.role === 'owner' || p.role === 'admin'))
      .map((p) => p.id)
    if (beheerders.length === 0) return

    const regels = (taal) =>
      gelukt
        ? [
            zeg(taal, 'push.planning_klaar', {
              nieuw: rapport.shiftsCreated,
              bij: rapport.shiftsUpdated,
              weg: rapport.shiftsRemoved,
            }),
            ...(rapport.linksAmbiguous
              ? [zeg(taal, 'push.planning_twijfel', { aantal: rapport.linksAmbiguous })]
              : []),
          ]
        : [fout]

    await verstuur({
      soort: 'systeem',
      kandidaten: beheerders,
      profielen,
      push: (taal) => ({
        title: zeg(taal, gelukt ? 'push.planning' : 'push.planning_mislukt'),
        body: regels(taal).join(' '),
        url: '/planning?tab=import',
        tag: 'aapi-planning',
      }),
      mail: (taal) => ({
        onderwerp: zeg(taal, 'mail.planning.onderwerp'),
        tekst: [bestandsnaam, '', ...regels(taal), '', `${APP}/#/planning?tab=import`].join('\n'),
      }),
    })
  },
})

/**
 * Een binnengekomen mail aan het juiste event hangen.
 *
 * Het rekenwerk staat in `mail-koppeling.js`, met tests erop; hier staat alleen
 * wat er uit de database bij moet. Dat is met opzet: een mail bij het verkeerde
 * event zetten is erger dan hem nergens zetten, en een regel die je kan
 * nalezen is een regel die je kan vertrouwen.
 *
 * De trigger draait op het aanmaken én op het bijwerken zonder koppeling, maar
 * doet niets zodra er al een event aan hangt: wie met de hand koppelt, wordt
 * niet overruled door een server die het beter denkt te weten.
 *
 * Wat nergens bij hoort, blijft staan met `eventId: null`. Dat is geen fout
 * maar het postvak Aanvragen: een nieuwe klant die schrijft, heeft nog geen
 * event, en iemand moet er sowieso naar kijken.
 */
export const koppelMail = onDocumentCreated(
  { region: REGION, document: 'mails/{id}' },
  async (event) => {
    const bericht = event.data?.data()
    if (!bericht || bericht.eventId) return

    /*
      Waarom niet alle events en klanten ophalen: dat zijn er honderden en het
      gebeurt bij elke mail. De draad zoeken we op de Message-ID's waar dit
      bericht zelf naar wijst, en de klant op het adres van de afzender. Alleen
      wanneer er een klant gevonden is, halen we diens events op.
    */
    const naar = draadVan(bericht)
    const bekend = []
    for (const id of naar.slice(0, 10)) {
      const snap = await db.collection('mails').where('messageId', '==', id).limit(1).get()
      if (!snap.empty) bekend.push({ id: snap.docs[0].id, ...snap.docs[0].data() })
    }

    const klantenSnap = await db.collection('customers').get()
    const klanten = klantenSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const klant = klantVanAdres(bericht.van, klanten)

    // De events die ertoe kunnen doen: die van deze klant, plus het event uit
    // het antwoordadres als dat er staat.
    const events = []
    if (klant) {
      const snap = await db
        .collection('tasks')
        .where('customerId', '==', klant.id)
        .where('archived', '==', false)
        .get()
      events.push(...snap.docs.filter((d) => !d.data().parentId).map((d) => ({ id: d.id, ...d.data() })))
    }
    for (const adres of [...adressenVan(bericht.aan), ...adressenVan(bericht.cc)]) {
      const id = eventUitAdres(adres)
      if (!id || events.some((e) => e.id === id)) continue
      const snap = await db.collection('tasks').doc(id).get()
      if (snap.exists) events.push({ id: snap.id, ...snap.data() })
    }

    const uit = kiesEvent({ bericht, bekend, events, klanten: klant ? [klant] : [] })
    if (!uit.eventId && !uit.customerId) return

    await event.data.ref.update({
      eventId: uit.eventId,
      customerId: uit.customerId,
      koppeling: uit.reden,
    })
    logger.info('Mail gekoppeld', { id: event.params.id, eventId: uit.eventId, reden: uit.reden })
  }
)

/**
 * De kale kopie van een event voor de socialrol, bijgehouden.
 *
 * Waarom die kopie bestaat, staat in `social-projectie.js`. Kort: Firestore kan
 * geen velden verbergen, dus "geen prijzen zien" kan alleen door ze niet te
 * mogen lezen — en dan moet er iets anders zijn om wél te lezen.
 *
 * De kopie verdwijnt zodra een event van het socialbord af gaat: gearchiveerd,
 * verwijderd, of met de hand uitgezet. Een kopie die blijft staan is een event
 * dat op het socialbord blijft hangen terwijl het er niet meer hoort.
 */
export const spiegelSocialEvent = onDocumentWritten(
  { region: REGION, document: 'tasks/{taskId}' },
  async (event) => {
    const na = event.data?.after?.exists ? event.data.after.data() : null
    const voor = event.data?.before?.exists ? event.data.before.data() : null
    const spiegel = db.collection('socialEvents').doc(event.params.taskId)

    if (!hoortInSpiegel(na)) {
      if (hoortInSpiegel(voor)) await spiegel.delete().catch(() => {})
      return
    }

    if (!moetBijwerken(voor, na)) return
    await spiegel.set({ ...kopieVan(na), taskId: event.params.taskId, bijgewerkt: FieldValue.serverTimestamp() })
  }
)

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Het logboek                                                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Eén trigger per collectie, allemaal met dezelfde inhoud.
 *
 * Firestore-triggers willen een vast pad, dus één trigger over alle collecties
 * bestaat niet. Daarom deze fabriek: wat er gelogd wordt staat in `audit.js`, en
 * hieronder staat alleen welke collecties meedoen. Komt er een collectie bij,
 * dan is het daar één regel en hier één.
 */
function logboekTrigger(collectie) {
  return onDocumentWritten({ region: REGION, document: `${collectie}/{id}` }, async (event) => {
    const regel = regelVan({
      collectie,
      id: event.params.id,
      voor: event.data?.before?.exists ? event.data.before.data() : null,
      na: event.data?.after?.exists ? event.data.after.data() : null,
    })
    if (!regel) return

    // De naam van wie het deed staat mee in de regel. Dat is dubbelop met het
    // profiel, en met opzet: een logboek dat pas leesbaar is wanneer je er een
    // tweede collectie bij haalt, is onleesbaar zodra iemand vertrekt en zijn
    // profiel verdwijnt.
    let actorNaam = null
    if (regel.actorId) {
      const profiel = await db.collection('profiles').doc(regel.actorId).get()
      actorNaam = profiel.exists ? (profiel.data().fullName ?? profiel.data().email ?? null) : null
    }

    await db.collection('auditLog').add({ ...regel, actorNaam, at: FieldValue.serverTimestamp() })
  })
}

export const logboekTaken = logboekTrigger('tasks')
export const logboekKlanten = logboekTrigger('customers')
export const logboekLijsten = logboekTrigger('lists')
export const logboekProfielen = logboekTrigger('profiles')
export const logboekFormules = logboekTrigger('formules')
export const logboekTemplates = logboekTrigger('templates')
export const logboekRegels = logboekTrigger('automations')
export const logboekOffertes = logboekTrigger('offertes')
export const logboekHuurorders = logboekTrigger('huurorders')
export const logboekAfvinklijsten = logboekTrigger('checklists')
export const logboekDiensten = logboekTrigger('shifts')
export const logboekInstellingen = logboekTrigger('config')

/**
 * Het logboek opruimen, één keer per maand.
 *
 * Twee jaar is lang genoeg om nog iets te kunnen navragen en kort genoeg om
 * geen archief te worden dat niemand meer doorzoekt. Zonder opruimen groeit
 * dit eeuwig door — en een logboek dat te groot is om te doorzoeken, is
 * hetzelfde als geen logboek.
 */
export const logboekOpruimen = onSchedule(
  { region: REGION, schedule: '0 4 1 * *', timeZone: 'Europe/Brussels' },
  async () => {
    const nu = new Date()
    const grens = new Date(nu)
    grens.setMonth(grens.getMonth() - 24)

    let weg = 0
    // In stukken: een verwijderbatch mag er vijfhonderd, en een logboek van
    // twee jaar telt er meer.
    for (let ronde = 0; ronde < 20; ronde += 1) {
      const oud = await db.collection('auditLog').where('at', '<', grens).limit(400).get()
      if (oud.empty) break

      const batch = db.batch()
      for (const rij of oud.docs) if (teOud({ at: rij.data().at }, nu)) batch.delete(rij.ref)
      await batch.commit()
      weg += oud.size
      if (oud.size < 400) break
    }

    logger.info('Logboek opgeruimd', { verwijderd: weg, soorten: Object.keys(AUDIT).length })
  }
)

/*
  Documenten op Google Drive: een map per event en per klant in de gedeelde
  Drive van JE Concept, geschreven door het runtime-serviceaccount. Waarom
  Drive en niet Storage, en waarom via de server, staat in `drive.js`.
*/
export const drive = maakDrive({ db, region: REGION })
