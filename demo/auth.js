/** Auth-stub voor de demobuild: altijd aangemeld als Jasper. */
const DEMO_USER = {
  uid: 'u-jasper',
  email: 'jasper@jeconcept.be',
  displayName: 'Jasper Hansen',
  photoURL: null,
  getIdToken: async () => 'demo-token',
}

/*
  Met `?afgemeld` begint de demo buiten.

  Anders is het aanmeldscherm in de demo onbereikbaar — en dus ook niet te
  testen, terwijl er sinds de cijfercode twee wegen naar binnen lopen. Eén
  parameter, en de browsertest kan het scherm openen dat een medewerker als
  eerste ziet.
*/
const begintBuiten =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('afgemeld')

let current = begintBuiten ? null : DEMO_USER
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

/**
 * Aanmelden met een cijfercode doet in de demo hetzelfde als met Google:
 * je komt binnen als Jasper. De controle op de code gebeurt in de stub van
 * `ploegAanmelden`, zodat een verkeerde code hier hetzelfde zegt als live.
 */
export async function signInWithCustomToken() {
  return signInWithPopup()
}

export async function signInWithPopup() {
  current = DEMO_USER
  watchers.forEach((cb) => cb(current))
  return { user: current }
}

export async function signOut() {
  // In de demo blijft aanmelden zinloos, dus meteen weer binnen — tenzij de
  // demo met `?afgemeld` begon; dan is buiten blijven juist het punt.
  if (begintBuiten) current = null
  watchers.forEach((cb) => cb(current))
}
