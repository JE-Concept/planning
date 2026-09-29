import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

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
    'JE Plan: de VITE_FIREBASE_* variabelen ontbreken. ' +
      'Zet ze in .env.local (lokaal) of in de Firebase Hosting build-omgeving.'
  )
}

export const app = initializeApp(config)

/**
 * Firestore, met de gegevens op schijf.
 *
 * Zonder cache haalt elk bezoek elk bord opnieuw op — en het grootste bord
 * heeft honderden taken. Met de cache staat alles er meteen en vraagt de
 * verbinding alleen nog wat er sinds de vorige keer veranderde. Dat scheelt
 * wachten op een telefoon op mobiel internet, en het scheelt leesbewerkingen,
 * want die worden per stuk gefactureerd.
 *
 * De tabbladbeheerder erbij omdat mensen de tool in meerdere tabbladen open
 * hebben; zonder hem werkt de cache maar in één ervan.
 *
 * Long polling auto-detect houdt het realtime-kanaal overeind achter proxies
 * die de streaming-verbinding dichtknijpen.
 */
function maakFirestore() {
  const basis = { experimentalAutoDetectLongPolling: true }

  // Privémodus en oudere browsers hebben geen IndexedDB. Dan maar zonder
  // cache: trager is beter dan een tool die niet opent.
  if (typeof indexedDB === 'undefined') return initializeFirestore(app, basis)

  try {
    return initializeFirestore(app, {
      ...basis,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (err) {
    console.warn('JE Plan: geen schijfcache voor Firestore', err)
    return initializeFirestore(app, basis)
  }
}

export const db = maakFirestore()
export const auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

if (import.meta.env.VITE_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

setPersistence(auth, browserLocalPersistence).catch(() => {
  /* Safari private mode falls back to in-memory persistence on its own. */
})
