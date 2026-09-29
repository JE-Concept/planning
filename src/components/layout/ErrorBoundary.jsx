import { Component } from 'react'
import { Button } from '@ui/index'

/**
 * Het vangnet onder de app.
 *
 * Zonder dit haalt React bij de eerste fout in een render de hele boom weg en
 * blijft er een wit scherm staan — geen melding, geen knop, niets om op te
 * klikken. Dat is wat er gebeurde bij elk tabblad dat openstond terwijl er
 * uitgerold werd: de pagina vroeg een bestand op dat na de uitrol niet meer
 * bestond, en het scherm ging op wit.
 *
 * Twee soorten fouten, twee antwoorden. Een pagina die niet geladen raakt is
 * bijna altijd een oude versie tegenover een nieuwe uitrol; die lost zichzelf
 * op met één herlaadbeurt, en dat gebeurt hier vanzelf (één keer — anders zit
 * je in een lus die je niet kunt stoppen). Elke andere fout blijft staan, met
 * wat er misging, want stil herladen verbergt dan alleen een bug.
 */

const GEPROBEERD = 'je-plan:herladen-na-laadfout'

/** Een brok van de app die niet geladen raakte — niet zomaar een bug. */
export function isLaadfout(error) {
  const tekst = `${error?.name ?? ''} ${error?.message ?? ''}`
  return (
    /Failed to fetch dynamically imported module/i.test(tekst) ||
    /error loading dynamically imported module/i.test(tekst) ||
    /Importing a module script failed/i.test(tekst) ||
    (/ChunkLoadError/i.test(tekst) && true)
  )
}

const RUSTTIJD = 60_000

/**
 * Mag er herladen worden?
 *
 * Hoogstens één keer per minuut. Dat is de rem op de lus: helpt herladen niet
 * — omdat het bestand echt weg is en niet alleen vervangen — dan valt de
 * tweede poging binnen die minuut en blijft de melding staan in plaats van dat
 * het tabblad blijft knipperen. Een uur later is het weer een nieuwe kans,
 * want dan gaat het om een nieuwe uitrol.
 */
export function magHerladen(storage = globalThis.sessionStorage, nu = Date.now()) {
  try {
    const vorige = Number(storage?.getItem(GEPROBEERD) ?? 0)
    if (vorige && nu - vorige < RUSTTIJD) return false
    storage?.setItem(GEPROBEERD, String(nu))
    return true
  } catch {
    // Safari in privémodus geeft hier een fout. Dan liever niet herladen dan
    // eindeloos herladen.
    return false
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (isLaadfout(error) && magHerladen()) {
      // De nieuwe index.html noemt de nieuwe bestandsnamen; de oude cache van
      // de service worker mag daar niet tussen komen te staan.
      const opnieuw = () => window.location.reload()
      if (globalThis.caches?.keys) {
        globalThis.caches
          .keys()
          .then((namen) => Promise.all(namen.map((n) => globalThis.caches.delete(n))))
          .finally(opnieuw)
      } else {
        opnieuw()
      }
      return
    }

    console.error('JE Plan: onverwachte fout', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (isLaadfout(error)) {
      return (
        <Melding
          titel="Even opnieuw laden"
          tekst="Er is net een nieuwe versie uitgerold. Herlaad de pagina om verder te gaan."
          knop="Herladen"
          onKlik={() => window.location.reload()}
        />
      )
    }

    return (
      <Melding
        titel="Hier ging iets mis"
        tekst="Dit scherm kon niet getoond worden. De rest van de tool werkt nog."
        knop="Opnieuw proberen"
        onKlik={() => this.setState({ error: null })}
        details={error?.message}
      />
    )
  }
}

function Melding({ titel, tekst, knop, onKlik, details }) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="font-display text-lg font-extrabold text-ink-900">{titel}</p>
        <p className="mt-2 text-sm text-ink-600">{tekst}</p>

        <div className="mt-4 flex justify-center gap-2">
          <Button variant="primary" size="sm" onClick={onKlik}>
            {knop}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.location.assign('/')}>
            Naar het begin
          </Button>
        </div>

        {details ? (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-ink-500">Technische melding</summary>
            <p className="mt-1 break-words rounded-md bg-ink-50 p-2 font-mono text-[11px] text-ink-700">
              {details}
            </p>
          </details>
        ) : null}
      </div>
    </div>
  )
}
