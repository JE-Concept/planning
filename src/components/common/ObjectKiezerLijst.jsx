import { useEffect, useMemo, useState } from 'react'
import { formatDay } from '@lib/dates'
import { SOORT, koppelsleutel } from '@lib/koppelingen'
import { kiezerKandidaten, kiezerResultaten, magNieuw } from '@lib/objectkiezer'
import { urenTekst } from '@lib/rooster'
import { Icon } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useCustomers } from '@data/customers'
import { useEvents } from '@data/events'
import { useMateriaal } from '@data/materiaal'
import { useOffertes } from '@data/offertes'
import { useTimeEntries } from '@data/time'

/**
 * De lijst onder het veld. Een eigen component, zodat de abonnementen pas
 * starten wanneer hij er staat — en stoppen wanneer hij weggaat.
 */
export default function Resultaten({ id, vraag, soorten, gekozen, onKies, nieuw = null }) {
  const { t } = useTaal()
  const [actief, setActief] = useState(0)
  const bronnen = useBronnen(soorten)

  const kandidaten = useMemo(
    () => kiezerKandidaten(bronnen, { dag: formatDay, duur: (s) => urenTekst(Math.round((s ?? 0) / 60)) }),
    [bronnen]
  )
  const resultaten = useMemo(
    () => kiezerResultaten(kandidaten, vraag, { soorten, gekozen }),
    [kandidaten, vraag, soorten, gekozen]
  )
  // De keuze "nieuw maken" staat altijd als laatste, ook voor de pijltjes.
  const metNieuw = !!nieuw && magNieuw(kandidaten, vraag, nieuw.soort)
  const aantal = resultaten.length + (metNieuw ? 1 : 0)
  const nu = Math.min(actief, Math.max(0, aantal - 1))
  const kiesOp = (i) => (i < resultaten.length ? onKies(resultaten[i]) : metNieuw ? nieuw.onMaak() : null)

  /*
    De pijltjes luisteren op het document en niet op het veld: het veld is van
    de ouder, en die hoeft niet te weten wat er in de lijst geselecteerd staat.
    Alleen zolang de lijst er is, en alleen wanneer de cursor in een kiezer
    staat — anders zou Enter in een ander veld van dezelfde dialoog ineens
    iets koppelen.

    Zonder lijst van afhankelijkheden: de luisteraar moet de lijst kennen
    zoals ze nu getekend is, en een lijst die per toetsaanslag verandert
    zou hem toch elke keer opnieuw zetten.
  */
  useEffect(() => {
    const luister = (e) => {
      if (!e.target?.closest?.('.je-objectkiezer')) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActief(Math.min(nu + 1, aantal - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActief(Math.max(nu - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        kiesOp(nu)
      }
    }
    document.addEventListener('keydown', luister)
    return () => document.removeEventListener('keydown', luister)
  })

  return (
    <div className="je-results je-objectkiezer__lijst" role="listbox" id={id}>
      {resultaten.length === 0 && !metNieuw ? (
        <p className="je-muted-caption" style={{ margin: 0, padding: 'var(--space-3) var(--space-5)' }}>
          {t('notities.kiezer.niets', { vraag: vraag.trim() })}
        </p>
      ) : (
        resultaten.map((r, i) => (
          <button
            key={koppelsleutel(r)}
            type="button"
            role="option"
            aria-selected={i === nu}
            className="je-plainbtn je-objectkiezer__optie"
            style={{ background: i === nu ? 'var(--accent-quiet)' : 'transparent' }}
            onMouseEnter={() => setActief(i)}
            // `mousedown` en niet `click`: anders verliest het veld eerst de
            // focus, gaat de lijst dicht en komt de klik nergens aan.
            onMouseDown={(e) => {
              e.preventDefault()
              onKies(r)
            }}
          >
            <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
              <Icon name={SOORT[r.soort]?.icon ?? 'circle'} size={16} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="je-objectkiezer__titel">{r.titel}</span>
              <span className="je-objectkiezer__sub">
                {[t(SOORT[r.soort]?.sleutel), r.sub].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
        ))
      )}
      {metNieuw ? (
        <button
          type="button"
          role="option"
          aria-selected={nu === resultaten.length}
          className="je-plainbtn je-objectkiezer__optie je-objectkiezer__nieuw"
          style={{ background: nu === resultaten.length ? 'var(--accent-quiet)' : 'transparent' }}
          onMouseEnter={() => setActief(resultaten.length)}
          onMouseDown={(e) => {
            e.preventDefault()
            nieuw.onMaak()
          }}
        >
          <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
            <Icon name="plus" size={16} />
          </span>
          <span className="je-objectkiezer__titel" style={{ flex: 1, minWidth: 0 }}>
            {nieuw.label}
          </span>
        </button>
      ) : null}
    </div>
  )
}

/** Wat er te kiezen valt — alleen de soorten die gevraagd zijn. */
function useBronnen(soorten) {
  const { profileById } = useWorkspace()
  const wil = (s) => soorten.includes(s)

  const { customers } = useCustomers()
  const { events, tasks } = useEvents()
  const { materiaal } = useMateriaal()
  const offertes = useOffertes()

  /*
    Uren: deze maand en de vorige. Een urenboeking koppel je aan een notitie
    kort nadat ze gebeurde ("die drie uur waren eigenlijk voor Blum"); een
    boeking van een half jaar terug zoek je in de urenregistratie zelf.
  */
  const [deze, vorige] = useMemo(() => {
    const nu = new Date()
    const maand = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return [maand(nu), maand(new Date(nu.getFullYear(), nu.getMonth() - 1, 1))]
  }, [])
  const { entries: urenNu } = useTimeEntries({ month: wil('uren') ? deze : null })
  const { entries: urenVoor } = useTimeEntries({ month: wil('uren') ? vorige : null })

  return useMemo(
    () => ({
      klanten: wil('klant') ? customers : [],
      events: wil('event') || wil('taak') ? events : [],
      taken: wil('taak') ? tasks : [],
      materiaal: wil('materiaal') ? materiaal : [],
      offertes: wil('offerte') ? offertes : [],
      uren: wil('uren') ? [...urenNu, ...urenVoor] : [],
      profileById,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, events, tasks, materiaal, offertes, urenNu, urenVoor, profileById, soorten.join()]
  )
}
