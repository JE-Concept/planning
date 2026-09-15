import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import {
  PRESETS,
  authorizeUrl,
  awaitJob,
  canvaFetch,
  createPkcePair,
  designToPost,
  exchangeCode,
  randomState,
  refreshTokens,
} from './lib/canva.js'

initializeApp()
const db = getFirestore()

const REGION = 'europe-west1'

const CANVA_CLIENT_ID = defineSecret('CANVA_CLIENT_ID')
const CANVA_CLIENT_SECRET = defineSecret('CANVA_CLIENT_SECRET')
const CANVA_REDIRECT_URI = defineSecret('CANVA_REDIRECT_URI')

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

  // The very first person through the door owns the workspace; without this
  // nobody could ever invite anybody.
  const anyProfile = await db.collection('profiles').limit(1).get()
  const role = anyProfile.empty ? 'owner' : (invite.data()?.role ?? 'member')

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
// ║ HTTP API (/api/…) — Canva Connect                                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function json(res, status, body) {
  res.status(status).set('Cache-Control', 'no-store').json(body)
}

async function requireUser(req) {
  const header = req.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw Object.assign(new Error('Niet aangemeld.'), { status: 401 })

  const decoded = await getAuth().verifyIdToken(token)
  const profile = await db.collection('profiles').doc(decoded.uid).get()
  if (!profile.exists || profile.data().active === false) {
    throw Object.assign(new Error('Geen toegang tot JE Planning.'), { status: 403 })
  }
  return { uid: decoded.uid, profile: profile.data() }
}

/**
 * Returns a usable access token, refreshing it when it is about to expire.
 * Canva access tokens live four hours; refreshing a minute early costs nothing
 * and removes a whole class of "expired mid-request" failures.
 */
async function accessTokenFor(uid, secrets) {
  const ref = db.collection('canvaConnections').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) throw Object.assign(new Error('Canva is niet gekoppeld.'), { status: 428 })

  const connection = snap.data()
  const expiresAt = connection.expiresAt?.toDate?.() ?? new Date(connection.expiresAt)

  if (expiresAt.getTime() - Date.now() > 60_000) return connection.accessToken

  try {
    const fresh = await refreshTokens({ ...secrets, refreshToken: connection.refreshToken })
    await ref.set(
      {
        accessToken: fresh.access_token,
        refreshToken: fresh.refresh_token ?? connection.refreshToken,
        expiresAt: new Date(Date.now() + fresh.expires_in * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return fresh.access_token
  } catch (err) {
    // A refresh token Canva no longer accepts means the link is really gone;
    // say so instead of failing every later call the same opaque way.
    await ref.delete()
    await db.collection('profiles').doc(uid).set({ canvaConnected: false }, { merge: true })
    throw Object.assign(new Error(`Canva-koppeling verlopen (${err.message}). Koppel opnieuw.`), {
      status: 428,
    })
  }
}

async function postRef(postId) {
  const ref = db.collection('socialPosts').doc(postId)
  const snap = await ref.get()
  if (!snap.exists) throw Object.assign(new Error('Post niet gevonden.'), { status: 404 })
  return { ref, post: snap.data() }
}

export const api = onRequest(
  {
    region: REGION,
    secrets: [CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_REDIRECT_URI],
    cors: true,
  },
  async (req, res) => {
    // Hosting rewrites keep the /api prefix; the emulator does not.
    const path = req.path.replace(/^\/api/, '') || '/'
    const secrets = {
      clientId: CANVA_CLIENT_ID.value(),
      clientSecret: CANVA_CLIENT_SECRET.value(),
    }
    const redirectUri = CANVA_REDIRECT_URI.value()

    try {
      // ── The OAuth callback is the one route Canva itself calls ───────────
      if (path === '/canva/callback') {
        const { code, state, error } = req.query
        if (error) return res.redirect(`/instellingen?canva=${encodeURIComponent(error)}`)
        if (!code || !state) return res.redirect('/instellingen?canva=ontbrekende-code')

        const stateRef = db.collection('canvaOauthStates').doc(String(state))
        const stateSnap = await stateRef.get()
        if (!stateSnap.exists) return res.redirect('/instellingen?canva=verlopen')

        const { codeVerifier, uid, redirectTo } = stateSnap.data()
        await stateRef.delete()

        const tokens = await exchangeCode({
          ...secrets,
          code: String(code),
          codeVerifier,
          redirectUri,
        })

        let canvaUserId = null
        let canvaTeamId = null
        try {
          const me = await canvaFetch(tokens.access_token, '/users/me')
          canvaUserId = me.team_user?.user_id ?? null
          canvaTeamId = me.team_user?.team_id ?? null
        } catch (err) {
          logger.warn('Canva /users/me faalde', { message: err.message })
        }

        await db.collection('canvaConnections').doc(uid).set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope ?? null,
          canvaUserId,
          canvaTeamId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })

        await db
          .collection('profiles')
          .doc(uid)
          .set({ canvaConnected: true, connectedAt: FieldValue.serverTimestamp() }, { merge: true })

        return res.redirect(`${redirectTo || '/instellingen'}?canva=gekoppeld`)
      }

      // ── Everything else is called by the app, with an ID token ───────────
      const { uid } = await requireUser(req)

      if (path === '/canva/status') {
        const snap = await db.collection('canvaConnections').doc(uid).get()
        if (!snap.exists) return json(res, 200, { connected: false })

        const connection = snap.data()
        let brandTemplates = []
        try {
          const token = await accessTokenFor(uid, secrets)
          const payload = await canvaFetch(token, '/brand-templates?limit=50')
          brandTemplates = (payload.items ?? []).map((t) => ({ id: t.id, title: t.title }))
        } catch (err) {
          // Brand templates are an enterprise feature; their absence is not an
          // error, it just means the panel offers one way in less.
          logger.info('Geen merksjablonen beschikbaar', { message: err.message })
        }

        return json(res, 200, {
          connected: true,
          canvaUserId: connection.canvaUserId ?? null,
          brandTemplates,
        })
      }

      if (path === '/canva/connect' && req.method === 'POST') {
        const { codeVerifier, codeChallenge } = createPkcePair()
        const state = randomState()

        await db.collection('canvaOauthStates').doc(state).set({
          codeVerifier,
          uid,
          redirectTo: req.body?.redirectTo ?? '/instellingen',
          createdAt: FieldValue.serverTimestamp(),
        })

        return json(res, 200, {
          url: authorizeUrl({ clientId: secrets.clientId, redirectUri, state, codeChallenge }),
        })
      }

      if (path === '/canva/disconnect' && req.method === 'POST') {
        await db.collection('canvaConnections').doc(uid).delete()
        await db.collection('profiles').doc(uid).set({ canvaConnected: false }, { merge: true })
        return json(res, 200, { connected: false })
      }

      if (path === '/canva/brand-templates') {
        const token = await accessTokenFor(uid, secrets)
        const payload = await canvaFetch(token, '/brand-templates?limit=50')
        return json(res, 200, { items: payload.items ?? [] })
      }

      if (path === '/canva/designs' && req.method === 'POST') {
        const { postId, preset, brandTemplateId, title } = req.body ?? {}
        const { ref, post } = await postRef(postId)
        const token = await accessTokenFor(uid, secrets)

        let design
        if (brandTemplateId) {
          // A brand template becomes a design by autofilling it — with no
          // fields to fill, that is simply "give me a copy of this".
          const job = await canvaFetch(token, '/autofills', {
            method: 'POST',
            body: {
              brand_template_id: brandTemplateId,
              title: title || post.title,
              data: {},
            },
          })
          const finished = await awaitJob(token, `/autofills/${job.job.id}`)
          if (finished.status !== 'success') {
            throw new Error(finished.error?.message ?? 'Canva kon het sjabloon niet invullen.')
          }
          design = finished.result.design
        } else {
          const size = PRESETS[preset] ?? PRESETS['instagram-post']
          const payload = await canvaFetch(token, '/designs', {
            method: 'POST',
            body: {
              design_type: { type: 'custom', width: size.width, height: size.height },
              title: title || post.title,
            },
          })
          design = payload.design
        }

        const patch = designToPost(design)
        await ref.set(
          { ...patch, status: post.status === 'idea' ? 'design' : post.status, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        )
        return json(res, 200, patch)
      }

      if (path === '/canva/link' && req.method === 'POST') {
        const { postId, designId } = req.body ?? {}
        const { ref } = await postRef(postId)
        const token = await accessTokenFor(uid, secrets)

        const payload = await canvaFetch(token, `/designs/${encodeURIComponent(designId)}`)
        const patch = designToPost(payload.design)
        await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        return json(res, 200, patch)
      }

      if (path === '/canva/refresh' && req.method === 'POST') {
        const { postId } = req.body ?? {}
        const { ref, post } = await postRef(postId)
        if (!post.canvaDesignId) throw Object.assign(new Error('Deze post heeft geen ontwerp.'), { status: 400 })

        const token = await accessTokenFor(uid, secrets)
        const payload = await canvaFetch(token, `/designs/${encodeURIComponent(post.canvaDesignId)}`)
        const patch = designToPost(payload.design)
        await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        return json(res, 200, patch)
      }

      if (path === '/canva/export' && req.method === 'POST') {
        const { postId, format = 'png' } = req.body ?? {}
        const { post } = await postRef(postId)
        if (!post.canvaDesignId) throw Object.assign(new Error('Deze post heeft geen ontwerp.'), { status: 400 })

        const token = await accessTokenFor(uid, secrets)
        const job = await canvaFetch(token, '/exports', {
          method: 'POST',
          body: { design_id: post.canvaDesignId, format: { type: format } },
        })
        const finished = await awaitJob(token, `/exports/${job.job.id}`)
        if (finished.status !== 'success') {
          throw new Error(finished.error?.message ?? 'Exporteren is niet gelukt.')
        }
        return json(res, 200, { urls: finished.urls ?? [] })
      }

      return json(res, 404, { error: 'Onbekend endpoint.' })
    } catch (err) {
      const status = err.status ?? 500
      if (status >= 500) logger.error('API-fout', { path, message: err.message })
      return json(res, status, { error: err.message })
    }
  }
)

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Housekeeping                                                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Canva thumbnail URLs are signed and expire. Refreshing the ones on upcoming
 * posts every morning keeps the calendar from filling with broken images —
 * and only touches posts somebody is about to look at.
 */
export const canvaSync = onSchedule(
  {
    region: REGION,
    schedule: '0 6 * * *',
    timeZone: 'Europe/Brussels',
    secrets: [CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_REDIRECT_URI],
  },
  async () => {
    const secrets = {
      clientId: CANVA_CLIENT_ID.value(),
      clientSecret: CANVA_CLIENT_SECRET.value(),
    }

    const from = new Date(Date.now() - 7 * 86400000)
    const to = new Date(Date.now() + 45 * 86400000)

    const posts = await db
      .collection('socialPosts')
      .where('scheduledAt', '>=', from)
      .where('scheduledAt', '<=', to)
      .get()

    const linked = posts.docs.filter((d) => d.data().canvaDesignId)
    if (linked.length === 0) return

    const connections = await db.collection('canvaConnections').limit(1).get()
    if (connections.empty) {
      logger.info('Geen Canva-koppeling, thumbnails overgeslagen.')
      return
    }

    const uid = connections.docs[0].id
    let token
    try {
      token = await accessTokenFor(uid, secrets)
    } catch (err) {
      logger.warn('Canva-token niet bruikbaar', { message: err.message })
      return
    }

    let refreshed = 0
    for (const doc of linked) {
      try {
        const payload = await canvaFetch(token, `/designs/${encodeURIComponent(doc.data().canvaDesignId)}`)
        await doc.ref.set(designToPost(payload.design), { merge: true })
        refreshed += 1
      } catch (err) {
        logger.warn('Thumbnail verversen faalde', { post: doc.id, message: err.message })
      }
    }

    logger.info(`Canva-thumbnails ververst: ${refreshed}/${linked.length}`)
  }
)

/** OAuth states are single use; anything older than an hour is abandoned. */
export const cleanupOauthStates = onSchedule(
  { region: REGION, schedule: '0 * * * *', timeZone: 'Europe/Brussels' },
  async () => {
    const cutoff = new Date(Date.now() - 3600_000)
    const stale = await db.collection('canvaOauthStates').where('createdAt', '<', cutoff).get()
    await Promise.all(stale.docs.map((d) => d.ref.delete()))
    if (!stale.empty) logger.info(`Oude OAuth-states opgeruimd: ${stale.size}`)
  }
)
