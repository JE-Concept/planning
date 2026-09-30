/**
 * De service worker van JE Plan. Eén stuk, met twee taken.
 *
 * 1. De app draaien als geïnstalleerde app: de schil komt uit de cache wanneer
 *    het netwerk traag of weg is, zodat er geen witte pagina staat op een
 *    festivalterrein met één streepje bereik — of in de koelcel, waar de
 *    dagelijkse lijsten afgevinkt worden.
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

// ─── Welke build dit is ─────────────────────────────────────────────────────

/**
 * Dit bestand gaat ongewijzigd door de build en kent dus geen bestandsnamen.
 *
 * Die staan in `version.json`, waar de app al naar kijkt om te melden dat er
 * een nieuwe versie klaarstaat. De worker leest hetzelfde bestand: het nummer
 * van de build wordt de naam van zijn cache, en de lijst eronder is precies wat
 * erin moet. Zo kan er geen tweede waarheid ontstaan over welke versie draait.
 *
 * Het buildnummer komt mee in de registratie-URL (zie `registreerServiceWorker`
 * in src/lib/push.js). Zonder dat zou dit bestand bij elke uitrol byte voor
 * byte hetzelfde zijn, zou de browser geen update zien, en zou de cache voor
 * altijd de bestanden van de allereerste uitrol houden.
 */
const config = Object.fromEntries(new URL(self.location).searchParams.entries())

const CACHE = `je-plan-${config.build || 'onbekend'}`

/**
 * Waar de worker op terugvalt als `version.json` niet te lezen is.
 *
 * Een mislukte installatie is erger dan een halve: dan is er helemaal geen
 * offline schil. Hiermee opent de app in elk geval, en de gehashte bestanden
 * komen alsnog in de cache zodra ze één keer opgehaald zijn.
 */
const NOODSCHIL = ['index.html', 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png']

const bij = (naam) => new URL(naam, self.registration.scope).href

async function schilVanDezeBuild() {
  try {
    const antwoord = await fetch(bij('version.json'), { cache: 'no-store' })
    if (!antwoord.ok) return NOODSCHIL
    const { schil } = await antwoord.json()
    return Array.isArray(schil) && schil.length ? schil : NOODSCHIL
  } catch {
    return NOODSCHIL
  }
}

// ─── Installeren en opruimen ────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const schil = await schilVanDezeBuild()
      const cache = await caches.open(CACHE)
      // Faalt er één bestand, dan hoeft de hele installatie niet om te vallen.
      await Promise.allSettled(schil.map((naam) => cache.add(bij(naam))))
      // De vorige worker mag meteen plaatsmaken: de pagina die deze registreerde,
      // draait al op de nieuwe bestanden.
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys()
      // Alleen de eigen caches van oudere builds; wat iets anders ooit
      // achterliet, is niet van ons om weg te gooien.
      await Promise.all(
        namen.filter((n) => n.startsWith('je-plan-') && n !== CACHE).map((n) => caches.delete(n))
      )
      await self.clients.claim()
    })()
  )
})

// ─── Ophalen ────────────────────────────────────────────────────────────────

const eigen = (url) => url.origin === self.location.origin

/**
 * Netwerk eerst voor de pagina, cache eerst voor de gehashte bundels.
 *
 * Netwerk eerst voor de pagina is geen detail maar de veiligheidsklep. Een
 * uitrol moet aankomen, en wie vastzit moet met herladen bij een vérse pagina
 * uitkomen: de schijfcache van Firestore kan op zichzelf blijven wachten als
 * een tabblad niet netjes afsloot, en `herstelZonderCache` in
 * src/lib/firebase.js herstart de app dan met een vlag in sessionStorage. Zou
 * deze worker de pagina uit zijn cache serveren, dan zou die herstelweg
 * eindigen op dezelfde vastgelopen versie.
 *
 * Alleen eigen bestanden. Firestore en Firebase Auth gaan nooit door de cache:
 * die praten zelf met de server, en een gecachet antwoord op een query is een
 * planning die stilstaat zonder dat iemand dat ziet. `version.json` evenmin —
 * dat is precies de vraag "is er iets nieuws?", en die mag de cache niet
 * beantwoorden.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!eigen(url)) return
  if (url.pathname.endsWith('/version.json')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((antwoord) => {
          // Alleen een echte pagina mag de schil worden. Zonder deze controle
          // verving een 404 of een 500 — een uitrol die halverwege staat, een
          // storing bij Hosting — het bewaarde beginscherm door een foutpagina,
          // en kreeg iedereen zonder verbinding díé te zien tot er weer bereik
          // was. Dat is precies andersom dan de bedoeling.
          if (antwoord.ok && antwoord.type === 'basic') {
            const kopie = antwoord.clone()
            caches.open(CACHE).then((cache) => cache.put(bij('index.html'), kopie))
          }
          return antwoord
        })
        .catch(async () => (await caches.match(bij('index.html'))) ?? Response.error())
    )
    return
  }

  // De gehashte bestanden: de naam draagt de inhoud, dus wat in de cache staat
  // is per definitie het juiste. Wat er nog niet in staat — een scherm dat deze
  // persoon voor het eerst opent — komt er bij het ophalen in, zodat het de
  // volgende keer ook zonder verbinding opent.
  // Wat in de schil staat, moet er ook uit gehaald kunnen worden. `favicon.svg`
  // en `manifest.webmanifest` gingen wél de cache in bij het installeren maar
  // werden nooit uit de cache geserveerd — zonder verbinding viel het icoon van
  // de geïnstalleerde app dan alsnog weg.
  const uitDeSchil =
    url.pathname.endsWith('/favicon.svg') || url.pathname.endsWith('/manifest.webmanifest')

  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/') || uitDeSchil) {
    event.respondWith(
      caches.match(request).then(
        (gecachet) =>
          gecachet ??
          fetch(request).then((antwoord) => {
            if (antwoord.ok) {
              const kopie = antwoord.clone()
              caches.open(CACHE).then((cache) => cache.put(request, kopie))
            }
            return antwoord
          })
      )
    )
  }
})

// ─── Meldingen ──────────────────────────────────────────────────────────────

/**
 * De Firebase-configuratie komt mee in dezelfde registratie-URL.
 *
 * Een service worker leest geen build-variabelen: hij staat als los bestand in
 * `public/` en gaat ongewijzigd door de build. De configuratie is publiek (ze
 * staat ook in de bundel), dus meegeven in de query is hier geen lek.
 */
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
