import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import './styles/je-ds.css'
import './styles/app.css'
import './index.css'

/**
 * In de demobuild worden de firebase/*-imports naar `demo/` gealiast en moet de
 * in-memory database gevuld zijn voordat het eerste abonnement loopt. In een
 * gewone build is de voorwaarde statisch onwaar en valt de import weg bij het
 * bundelen.
 */
/**
 * Eén adres, niet twee.
 *
 * Firebase blijft de site ook op <project>.web.app serveren naast het eigen
 * domein. Dat is niet onschuldig: elk adres heeft zijn eigen aanmeldsessie, dus
 * wie op het verkeerde binnenkomt, logt apart in. Daarom stuurt de app zichzelf
 * door naar het adres dat telt.
 *
 * Alleen actief als VITE_CANONICAL_HOST bij de build is meegegeven, want een
 * omleiding naar een domein dat nog niet gekoppeld is, maakt de tool
 * onbereikbaar in plaats van netjes.
 */
function redirectToCanonicalHost() {
  const canonical = import.meta.env.VITE_CANONICAL_HOST
  if (!canonical || window.location.hostname === canonical) return false
  if (window.location.hostname === 'localhost') return false

  const url = new URL(window.location.href)
  url.hostname = canonical
  url.protocol = 'https:'
  url.port = ''
  window.location.replace(url.toString())
  return true
}

async function boot() {
  const demo = import.meta.env.MODE === 'demo'
  if (!demo && redirectToCanonicalHost()) return

  if (demo) await import('../demo/boot.js')

  // De demobuild wordt onder een subpad gepubliceerd; een padgebaseerde router
  // zou daar op elke route naast zitten.
  const Router = demo ? HashRouter : BrowserRouter

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Router>
        <App />
      </Router>
    </StrictMode>
  )

  // Na het renderen: de service worker mag het eerste scherm niet vertragen.
  // Niet in de demo — die draait onder een subpad en zou een worker met een
  // scope achterlaten die daar niet hoort.
  if (!demo) {
    const { registreerServiceWorker } = await import('./lib/push')
    registreerServiceWorker()
  }
}

boot()
