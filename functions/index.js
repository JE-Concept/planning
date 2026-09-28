import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getMessaging } from 'firebase-admin/messaging'
import { logger } from 'firebase-functions'
import { planFor } from './automations.js'
import { kort, nieuweReviewer, nieuweToegewezenen } from './notify.js'

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
 * Past de regels uit Instellingen toe op een taak die van status verandert.
 *
 * Alleen op dat moment, en op een nieuwe taak — niet op elke schrijving. Dat
 * houdt de trigger goedkoop (zonder statuswissel wordt de regelcollectie niet
 * eens gelezen) en het is ook inhoudelijk het juiste moment: wie na de wissel
 * bewust iemand anders toewijst, moet dat niet bij de volgende bewerking
 * teruggedraaid zien worden.
 *
 * Deze functie schrijft de taak die haar wakker maakte. Dat maakt haar opnieuw
 * wakker, met dezelfde status voor en na — en daar stopt het: de voorwaarde
 * hieronder is dan niet meer waar.
 */
export const applyAutomations = onDocumentWritten(
  { region: REGION, document: 'tasks/{taskId}' },
  async (event) => {
    const na = event.data?.after?.data()
    if (!na) return

    const voor = event.data?.before?.exists ? event.data.before.data() : null
    const statusGewijzigd = !voor || (voor.statusName ?? null) !== (na.statusName ?? null)
    if (!statusGewijzigd) return

    const regels = await db.collection('automations').where('enabled', '==', true).get()
    if (regels.empty) return

    const { patch, fired } = planFor({
      rules: regels.docs.map((d) => ({ id: d.id, ...d.data() })),
      task: { id: event.params.taskId, ...na },
      before: voor,
      now: new Date(),
    })

    if (Object.keys(patch).length === 0) return

    await event.data.after.ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() })
    logger.info('Business rule toegepast', {
      taskId: event.params.taskId,
      status: na.statusName ?? null,
      regels: fired,
      velden: Object.keys(patch),
    })
  }
)

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

    const verstuurd = await stuurMelding(nieuw, {
      title: 'Nieuwe taak voor jou',
      body: kort(na.title),
      url: '/mijn-werk',
      tag: `taak-${event.params.taskId}`,
    })

    if (verstuurd) logger.info('Melding verstuurd', { taskId: event.params.taskId, verstuurd })
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
