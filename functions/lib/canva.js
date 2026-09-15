import crypto from 'node:crypto'

/**
 * Canva Connect, the server half.
 *
 * Canva uses OAuth 2.0 with PKCE. The code verifier never leaves our side: it
 * is stored against a one-shot `state` and thrown away the moment the callback
 * spends it, so a leaked redirect cannot be replayed into a token.
 */

export const AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize'
export const API = 'https://api.canva.com/rest/v1'

/** Everything the calendar needs, and nothing it does not. */
export const SCOPES = [
  'profile:read',
  'design:meta:read',
  'design:content:read',
  'design:content:write',
  'asset:read',
  'brandtemplate:meta:read',
  'brandtemplate:content:read',
].join(' ')

const base64url = (buffer) => buffer.toString('base64url')

export function createPkcePair() {
  const codeVerifier = base64url(crypto.randomBytes(64))
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())
  return { codeVerifier, codeChallenge }
}

export function randomState() {
  return base64url(crypto.randomBytes(32))
}

export function authorizeUrl({ clientId, redirectUri, state, codeChallenge }) {
  const params = new URLSearchParams({
    code_challenge: codeChallenge,
    code_challenge_method: 's256',
    scope: SCOPES,
    response_type: 'code',
    client_id: clientId,
    state,
    redirect_uri: redirectUri,
  })
  return `${AUTHORIZE_URL}?${params}`
}

async function tokenRequest({ clientId, clientSecret, body }) {
  const response = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams(body),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      payload.error_description || payload.error || `Canva gaf ${response.status} terug.`
    )
  }
  return payload
}

export function exchangeCode({ clientId, clientSecret, code, codeVerifier, redirectUri }) {
  return tokenRequest({
    clientId,
    clientSecret,
    body: {
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    },
  })
}

export function refreshTokens({ clientId, clientSecret, refreshToken }) {
  return tokenRequest({
    clientId,
    clientSecret,
    body: { grant_type: 'refresh_token', refresh_token: refreshToken },
  })
}

/** Authenticated Canva call. Throws with Canva's own message so the UI can show it. */
export async function canvaFetch(accessToken, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Canva gaf ${response.status} terug.`)
  }
  return payload
}

/** The formats the app offers, mapped to what the Canva API accepts. */
export const PRESETS = {
  'instagram-post': { width: 1080, height: 1080 },
  'instagram-story': { width: 1080, height: 1920 },
  'facebook-post': { width: 1200, height: 630 },
  'linkedin-post': { width: 1200, height: 1200 },
  poster: { width: 3508, height: 4961 },
}

/** Canva's design payload → the handful of fields a post stores. */
export function designToPost(design) {
  return {
    canvaDesignId: design.id,
    canvaEditUrl: design.urls?.edit_url ?? null,
    canvaViewUrl: design.urls?.view_url ?? null,
    canvaThumbnailUrl: design.thumbnail?.url ?? null,
    canvaSyncedAt: new Date(),
  }
}

/**
 * Polls an async Canva job (exports, autofills) until it leaves `in_progress`.
 * Canva's own guidance is to poll; the jobs we start finish in seconds.
 */
export async function awaitJob(accessToken, path, { attempts = 12, delayMs = 1000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const payload = await canvaFetch(accessToken, path)
    const job = payload.job ?? payload.export ?? payload
    if (job.status && job.status !== 'in_progress') return job
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error('Canva is nog bezig met deze taak. Probeer het zo meteen opnieuw.')
}
