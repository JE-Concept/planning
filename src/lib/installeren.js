import { useEffect, useState } from 'react'

/**
 * De app op het beginscherm krijgen.
 *
 * ── Waarom dit niet in een component staat ────────────────────────────────
 * `beforeinstallprompt` vuurt één keer, kort na het laden. Wie ernaar luistert
 * vanuit een scherm dat pas later getekend wordt, hoort hem nooit — en dat was
 * precies wat er gebeurde: de installatieknop stond op het profiel, en tegen
 * de tijd dat iemand dat opende was het moment voorbij. De knop verscheen dus
 * zelden tot nooit.
 *
 * Daarom wordt hij hier opgevangen, meteen bij het laden, en bewaard tot
 * iemand hem gebruikt. Wie later vraagt of installeren kan, krijgt het
 * antwoord van toen.
 *
 * ── Waarom iOS apart staat ────────────────────────────────────────────────
 * Safari kent `beforeinstallprompt` niet en zal het ook nooit kennen: Apple
 * wil dat je het zelf doet via Deel → Zet op beginscherm. Zonder uitleg is de
 * app daar dus niet te installeren, en dat is net de helft van de telefoons.
 * Wat we daar kunnen geven is de weg wijzen.
 */

let bewaard = null
const luisteraars = new Set()

const meld = () => luisteraars.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Tegenhouden, anders toont Chrome zijn eigen balk — die verschijnt één
    // keer, onthoudt dat je hem wegklikte, en komt dan nooit meer terug.
    e.preventDefault()
    bewaard = e
    meld()
  })
  window.addEventListener('appinstalled', () => {
    bewaard = null
    meld()
  })
}

/** Draait de app al als geïnstalleerde app? Dan valt er niets aan te bieden. */
export function alsAppGeopend() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true
  )
}

/** Een iPhone of iPad in Safari: installeren kan, maar alleen met de hand. */
export function isApple() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const appleToestel = /iPad|iPhone|iPod/.test(ua)
    // iPadOS doet zich voor als een Mac; een Mac met aanraakscherm bestaat niet.
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  // Chrome en Firefox op iOS kunnen niet installeren; alleen Safari.
  return appleToestel && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

/*
  "Later" is niet "nooit".

  Een balk die je één keer wegklikt en nooit meer ziet, is een balk die zijn
  werk niet doet: wie onderweg wegklikt, denkt er thuis niet meer aan. Twee
  weken is lang genoeg om niet te zeuren en kort genoeg om de ploeg die er nog
  niet aan toe kwam, opnieuw te bereiken.
*/
const LATER_SLEUTEL = 'je-plan:installeren-later'
const LATER_DAGEN = 14

export function nogNietNu() {
  try {
    localStorage.setItem(LATER_SLEUTEL, String(Date.now()))
  } catch {
    // Een browser die niets wil bewaren toont de balk straks opnieuw. Dat is
    // vervelender dan stil zijn, maar minder erg dan omvallen.
  }
  meld()
}

function recentWeggeklikt() {
  try {
    const toen = Number(localStorage.getItem(LATER_SLEUTEL) || 0)
    return toen > 0 && Date.now() - toen < LATER_DAGEN * 86400_000
  } catch {
    return false
  }
}

/**
 * Wat er over installeren te zeggen valt, hier en nu.
 *
 * `uitnodigen` is de vraag of er een balk mag staan: alleen op een toestel dat
 * je aanraakt, alleen wanneer de app nog niet geïnstalleerd is, en alleen als
 * er iets te doen valt — een bewaarde prompt, of een iPhone waar we de weg
 * kunnen wijzen.
 */
export function useInstalleren() {
  const [, hertekenen] = useState(0)

  useEffect(() => {
    const fn = () => hertekenen((n) => n + 1)
    luisteraars.add(fn)
    return () => luisteraars.delete(fn)
  }, [])

  const alGeopend = alsAppGeopend()
  const apple = isApple()
  const kan = Boolean(bewaard) || apple
  const aanraakbaar =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

  return {
    kan: kan && !alGeopend,
    apple,
    alGeopend,
    uitnodigen: kan && !alGeopend && aanraakbaar && !recentWeggeklikt(),
    /** Vraagt het de browser. Op een iPhone valt er niets te vragen. */
    installeer: async () => {
      if (!bewaard) return false
      const prompt = bewaard
      bewaard = null
      meld()
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      return outcome === 'accepted'
    },
  }
}
