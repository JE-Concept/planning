import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isConfigured = Boolean(config.apiKey && config.projectId)

if (!isConfigured) {
  // A missing key is a deploy mistake, not a state to design around — the login
  // screen says so plainly instead of leaving somebody on a blank page.
  console.error(
    'JE Planning: de VITE_FIREBASE_* variabelen ontbreken. ' +
      'Zet ze in .env.local (lokaal) of in de Firebase Hosting build-omgeving.'
  )
}

export const app = initializeApp(config)

// Long polling auto-detect keeps the realtime channel alive behind corporate
// proxies that choke on the streaming transport.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
export const auth = getAuth(app)
export const storage = getStorage(app)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

if (import.meta.env.VITE_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

setPersistence(auth, browserLocalPersistence).catch(() => {
  /* Safari private mode falls back to in-memory persistence on its own. */
})

/** Base URL of the Cloud Functions API, rewritten by Hosting in production. */
export const apiBase =
  import.meta.env.VITE_USE_EMULATORS === '1'
    ? `http://127.0.0.1:5001/${config.projectId}/europe-west1/api`
    : '/api'

/** Calls our own HTTPS function with the caller's Firebase ID token attached. */
export async function callApi(path, { method = 'GET', body, signal } = {}) {
  const user = auth.currentUser
  if (!user) throw new Error('Niet aangemeld.')

  const token = await user.getIdToken()
  const response = await fetch(`${apiBase}${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.error || `Onverwachte fout (${response.status}).`)
  }
  return payload
}
