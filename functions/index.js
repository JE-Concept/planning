import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

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
    throw new HttpsError('permission-denied', `${email} heeft geen toegang tot JE Planning.`)
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
