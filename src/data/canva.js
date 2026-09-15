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
