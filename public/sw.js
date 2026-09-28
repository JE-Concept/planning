/**
 * De service worker van JE Plan. Eén stuk, met twee taken.
 *
 * 1. De app draaien als geïnstalleerde app: de schil komt uit de cache wanneer
 *    het netwerk traag of weg is, zodat er geen witte pagina staat op een
 *    festivalterrein met één streepje bereik.
 * 2. Meldingen tonen terwijl de app dicht is. Dat kan alleen hier — een pagina
 *    die niet open staat, kan niets tonen.
 *
 * Twee service workers kunnen niet dezelfde scope delen, vandaar één bestand
 * voor allebei.
 *
 * Belangrijk bij het aanpassen: een kapotte service worker blijft op het
 * toestel van iedereen staan, ook na een goede deploy. De uitweg is dit bestand
 * vervangen door alleen `self.registration.unregister()` en dat uitrollen; bij
 * het volgende bezoek ruimt elk toestel zichzelf op.
 */

const VERSIE = 'je-planning-v1'
const SCHIL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']

// ─── Installeren en opruimen ────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSIE)
      // Faalt er één bestand, dan hoeft de hele installatie niet om te vallen.
      .then((cache) => Promise.allSettled(SCHIL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== VERSIE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

// ─── Ophalen ────────────────────────────────────────────────────────────────

const isSchil = (url) => url.origin === self.location.origin

/**
 * Netwerk eerst voor de pagina, cache eerst voor de gehashte bundels.
 *
 * Alleen eigen bestanden. Firestore en Firebase Auth gaan nooit door de cache:
 * die praten zelf met de server, en een gecachet antwoord op een query is een
 * planning die stilstaat zonder dat iemand dat ziet.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!isSchil(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((antwoord) => {
          const kopie = antwoord.clone()
          caches.open(VERSIE).then((cache) => cache.put('/index.html', kopie))
          return antwoord
        })
        .catch(() => caches.match('/index.html').then((c) => c ?? Response.error()))
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (gecachet) =>
          gecachet ??
          fetch(request).then((antwoord) => {
            if (antwoord.ok) {
              const kopie = antwoord.clone()
              caches.open(VERSIE).then((cache) => cache.put(request, kopie))
            }
            return antwoord
          })
      )
    )
  }
})

// ─── Meldingen ──────────────────────────────────────────────────────────────

/**
 * De Firebase-configuratie komt mee in de registratie-URL.
 *
 * Een service worker leest geen build-variabelen: hij staat als los bestand in
 * `public/` en gaat ongewijzigd door de build. De configuratie is publiek (ze
 * staat ook in de bundel), dus meegeven in de query is hier geen lek.
 */
const config = Object.fromEntries(new URL(self.location).searchParams.entries())

if (config.apiKey && config.projectId) {
  try {
    importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
    importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

    firebase.initializeApp(config)
    firebase.messaging().onBackgroundMessage((payload) => {
      const { title, body, url, tag } = payload.data ?? {}
      if (!title) return

      self.registration.showNotification(title, {
        body: body ?? '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        // Zelfde tag = vervangen in plaats van stapelen. Drie keer dezelfde
        // taak in je meldingenlijst leest niemand meer.
        tag: tag ?? 'je-planning',
        data: { url: url ?? '/' },
      })
    })
  } catch (err) {
    // Geen meldingen is vervelend; een service worker die niet installeert en
    // daarmee ook de schil uit de cache haalt, is erger.
    console.warn('JE Plan: meldingen niet geladen', err)
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const doel = new URL(event.notification.data?.url ?? '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((vensters) => {
      // Staat de app al open, dan daar naartoe — niet een tweede venster erbij.
      for (const venster of vensters) {
        if (venster.url.startsWith(self.location.origin) && 'focus' in venster) {
          venster.navigate?.(doel)
          return venster.focus()
        }
      }
      return self.clients.openWindow(doel)
    })
  )
})
