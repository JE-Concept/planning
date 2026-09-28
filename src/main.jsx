import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

/**
 * In de demobuild worden de firebase/*-imports naar `demo/` gealiast en moet de
 * in-memory database gevuld zijn voordat het eerste abonnement loopt. In een
 * gewone build is de voorwaarde statisch onwaar en valt de import weg bij het
 * bundelen.
 */
async function boot() {
  const demo = import.meta.env.MODE === 'demo'
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
}

boot()
