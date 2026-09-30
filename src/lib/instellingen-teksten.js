import { voegCatalogusToe } from '@lib/i18n'
import instellingen from './taal/instellingen'

/**
 * De teksten van het instellingenscherm, bij het scherm zelf.
 *
 * ── Waarom dit bestand buiten `taal/` staat ───────────────────────────────
 * `i18n.js` leest die map met een glob. Stond dit bestand erin, dan las de
 * glob het mee, importeerde het i18n terug, en was `voegCatalogusToe` nog niet
 * gedefinieerd op het moment dat het aangeroepen werd. Een kringetje dat pas
 * bij de eerste test zichtbaar werd.
 *
 * ── Waarom dit bestand bestaat ────────────────────────────────────────────
 * Vijfhonderd sleutels over pijplijnen, templates, formules en business rules:
 * een kwart van de hele catalogus, voor één scherm dat toch al apart
 * binnenkomt. Ze meeleveren met de rest betekende dat iedereen die de tool
 * opent — en elke klant die op een offertelink klikt — twaalf kilobyte aan
 * instellingenteksten ophaalde die hij nooit te zien krijgt.
 *
 * ── Waarom dit werkt zonder opnieuw te tekenen ────────────────────────────
 * Dit bestand wordt geïmporteerd door `pages/Settings.jsx` en zit dus in
 * dezelfde brok. Die brok wordt ingeladen vóór het scherm tekent, en deze
 * regel draait bij dat inladen. Tegen de tijd dat er één label op het scherm
 * staat, staan de teksten er al — geen laadtoestand, geen sleutels die even
 * zichtbaar zijn.
 *
 * Wie hier een tekst zoekt: die staat in `instellingen.js`, zoals altijd.
 * Dit bestand doet niets anders dan hem aanmelden.
 */
voegCatalogusToe('./taal/instellingen.js', instellingen)
