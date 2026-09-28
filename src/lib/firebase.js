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
