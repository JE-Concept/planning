/** Auth-stub voor de demobuild: altijd aangemeld als Jasper. */
const DEMO_USER = {
  uid: 'u-jasper',
  email: 'jasper@jeconcept.be',
  displayName: 'Jasper Hansen',
  photoURL: null,
  getIdToken: async () => 'demo-token',
}

let current = DEMO_USER
const watchers = new Set()

export const getAuth = () => ({ get currentUser() { return current } })
export class GoogleAuthProvider { setCustomParameters() {} }
export const browserLocalPersistence = 'demo'
export const setPersistence = async () => {}
export const connectAuthEmulator = () => {}

export function onAuthStateChanged(_auth, cb) {
  watchers.add(cb)
  queueMicrotask(() => cb(current))
  return () => watchers.delete(cb)
}

export async function signInWithPopup() {
  current = DEMO_USER
  watchers.forEach((cb) => cb(current))
  return { user: current }
}

export async function signOut() {
  // In de demo blijft aanmelden zinloos, dus meteen weer binnen.
  watchers.forEach((cb) => cb(current))
}
