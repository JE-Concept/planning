import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import '@styles/je-ds.css'
import './styles/verhuur.css'

/*
  Live: echte paden, zodat /artikel/m-koeling een deelbare link is. In de
  preview (modus `demo`, als artifact gepubliceerd): een hekje, want daar is
  er maar één bestand en geen server die /artikel/… naar index.html stuurt.
*/
const Router = import.meta.env.MODE === 'demo' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>
)
