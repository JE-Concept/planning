import { useCallback, useEffect, useState } from 'react'
import { callApi } from '@lib/firebase'
import { CANVA_PRESETS, designIdFromUrl } from '@lib/canva-url'

export { CANVA_PRESETS, designIdFromUrl }

/**
 * Canva Connect, seen from the browser.
 *
 * The client never holds a Canva token: it asks our Cloud Function for an
 * authorise URL, and from then on the function does every Canva call with the
 * tokens it stored server-side. What comes back here is only what the calendar
 * needs to draw a card — ids, urls and a thumbnail.
 */

export function useCanvaStatus() {
  const [status, setStatus] = useState({ loading: true, connected: false })

  const refresh = useCallback(async () => {
    try {
      const data = await callApi('/canva/status')
      setStatus({ loading: false, ...data })
    } catch (err) {
      setStatus({ loading: false, connected: false, error: err.message })
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...status, refresh }
}

/** Sends the user to Canva and back; the function handles the token exchange. */
export async function connectCanva(redirectTo = window.location.pathname) {
  const { url } = await callApi('/canva/connect', {
    method: 'POST',
    body: { redirectTo },
  })
  window.location.assign(url)
}

export function disconnectCanva() {
  return callApi('/canva/disconnect', { method: 'POST' })
}

export function listBrandTemplates() {
  return callApi('/canva/brand-templates')
}

/** Creates a design (blank preset or from a brand template) and links it to a post. */
export function createDesign({ postId, preset, brandTemplateId, title }) {
  return callApi('/canva/designs', {
    method: 'POST',
    body: { postId, preset, brandTemplateId, title },
  })
}

/** Links a design somebody already made, pasted as a Canva URL. */
export function linkDesign({ postId, url }) {
  const designId = designIdFromUrl(url)
  if (!designId) throw new Error('Dat lijkt geen Canva-ontwerplink. Plak de volledige URL.')
  return callApi('/canva/link', { method: 'POST', body: { postId, designId } })
}

/** Pulls the current title, urls and thumbnail of a linked design. */
export function refreshDesign(postId) {
  return callApi('/canva/refresh', { method: 'POST', body: { postId } })
}

/** Asks Canva for an export and returns the download links. */
export function exportDesign(postId, format = 'png') {
  return callApi('/canva/export', { method: 'POST', body: { postId, format } })
}

// ─── Canva as the source of the calendar ────────────────────────────────────

/**
 * What is in Canva right now — searched, or the contents of one folder.
 * The server annotates each design with the post it already became, so the
 * browser never offers the same design twice.
 */
export function browseDesigns({ query: q = '', folderId = '', continuation = '' } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (folderId) params.set('folderId', folderId)
  if (continuation) params.set('continuation', continuation)
  return callApi(`/canva/browse${params.toString() ? `?${params}` : ''}`)
}

export function listCanvaFolders(parent = 'root') {
  return callApi(`/canva/folders?parent=${encodeURIComponent(parent)}`)
}

/** Turns Canva designs into calendar posts. Importing twice is a no-op. */
export function importDesigns({ designIds, brandId, scheduledAt, taskId }) {
  return callApi('/canva/import', {
    method: 'POST',
    body: { designIds, brandId, scheduledAt: scheduledAt ?? null, taskId: taskId ?? null },
  })
}

// ─── The review, and its road back ──────────────────────────────────────────

/**
 * Asks for a review, approves, or sends it back for changes.
 *
 * The decision is always stored here; pushing it onto the Canva design as a
 * comment is best effort, so the answer says whether that half worked.
 */
export function reviewPost({ postId, action, note = '', reviewerId = null }) {
  return callApi('/canva/review', {
    method: 'POST',
    body: { postId, action, note, reviewerId },
  })
}

/** Pulls the replies the designer left on the design back into the post. */
export function pullCanvaComments(postId) {
  return callApi('/canva/comments', { method: 'POST', body: { postId } })
}
