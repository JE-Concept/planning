import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db, isConfigured } from './firebase'

/**
 * Meldingen op je telefoon.
 *
 * Eén toestel is één token. Iemand die op zijn telefoon én op de laptop werkt,
 * krijgt twee rijen in `pushTokens` — dat is precies de bedoeling: je zet het
 * per toestel aan en per toestel weer uit, en een oud toestel neemt de
 * meldingen van het nieuwe niet mee.
 *
 * De registratie van de service worker gebeurt hier en nergens anders, zodat
 * meldingen en de geïnstalleerde app dezelfde worker delen. Twee workers kunnen
 * niet dezelfde scope hebben.
 */

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY

let registratie = null

export const pushMogelijk = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'Notification' in window &&
  'PushManager' in window

/** Of de sleutel voor webpush bij de build is meegegeven. */
export const pushIngesteld = () => Boolean(VAPID) && isConfigured

export const meldingsrecht = () => (pushMogelijk() ? Notification.permission : 'unsupported')

/**
 * Registreert de service worker, met de Firebase-configuratie in de URL.
 *
 * De worker staat als los bestand in `public/` en gaat ongewijzigd door de
 * build; hij kan dus geen build-variabelen lezen. Meegeven in de query is de
 * gangbare weg, en veilig: deze sleutels staan sowieso in de bundel.
 */
export async function registreerServiceWorker() {
  if (!pushMogelijk() || !isConfigured) return null
  if (registratie) return registratie

  const config = app.options
  const query = new URLSearchParams({
    apiKey: config.apiKey,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId ?? '',
    appId: config.appId ?? '',
  })

  try {
    registratie = await navigator.serviceWorker.register(`/sw.js?${query}`, { scope: '/' })
    return registratie
  } catch (err) {
    console.warn('JE Plan: service worker niet geregistreerd', err)
    return null
  }
}

async function messaging() {
  const { getMessaging, isSupported } = await import('firebase/messaging')
  if (!(await isSupported())) return null
  return getMessaging(app)
}

/**
 * Zet meldingen aan op dit toestel en onthoudt het token.
 *
 * Geeft terug wat er gebeurde, want de app moet het verschil kunnen uitleggen
 * tussen "je hebt geweigerd" (alleen jij kunt dat terugdraaien, in de
 * browserinstellingen) en "dit werkt hier niet".
 */
export async function zetPushAan(profileId) {
  if (!pushMogelijk()) return { ok: false, reden: 'onmogelijk' }
  if (!pushIngesteld()) return { ok: false, reden: 'niet-ingesteld' }

  const recht = await Notification.requestPermission()
  if (recht !== 'granted') return { ok: false, reden: recht === 'denied' ? 'geweigerd' : 'afgebroken' }

  const serviceWorkerRegistration = await registreerServiceWorker()
  if (!serviceWorkerRegistration) return { ok: false, reden: 'onmogelijk' }

  const mess = await messaging()
  if (!mess) return { ok: false, reden: 'onmogelijk' }

  const { getToken } = await import('firebase/messaging')
  const token = await getToken(mess, { vapidKey: VAPID, serviceWorkerRegistration })
  if (!token) return { ok: false, reden: 'geen-token' }

  await setDoc(
    doc(db, 'pushTokens', token),
    {
      profileId,
      token,
      // Waarmee, zodat je in de instellingen herkent welk toestel je uitzet.
      toestel: navigator.userAgent.slice(0, 180),
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  )

  window.localStorage?.setItem('je-planning:push', token)
  return { ok: true, token }
}

/** Zet ze uit op dit toestel: token weg bij Firebase én de rij hier weg. */
export async function zetPushUit() {
  const bewaard = window.localStorage?.getItem('je-planning:push')

  try {
    const mess = await messaging()
    if (mess) {
      const { deleteToken } = await import('firebase/messaging')
      await deleteToken(mess)
    }
  } catch {
    // Het token kan al ingetrokken zijn door de browser. De rij hieronder is
    // wat telt: zolang die staat, blijft er gestuurd worden.
  }

  if (bewaard) await deleteDoc(doc(db, 'pushTokens', bewaard)).catch(() => {})
  window.localStorage?.removeItem('je-planning:push')
}

/** Staat het op dit toestel aan? */
export const pushStaatAan = () =>
  pushMogelijk() && Notification.permission === 'granted' && Boolean(window.localStorage?.getItem('je-planning:push'))

/**
 * Meldingen terwijl de app open staat.
 *
 * De browser toont die niet zelf — met de app voor je neus is een systeempopup
 * ook overdreven. Dit geeft ze door aan de app, die er een toast van maakt.
 */
export async function luisterNaarMeldingen(onBericht) {
  if (!pushMogelijk() || !pushIngesteld()) return () => {}

  const mess = await messaging()
  if (!mess) return () => {}

  const { onMessage } = await import('firebase/messaging')
  return onMessage(mess, (payload) => onBericht(payload.data ?? {}))
}
