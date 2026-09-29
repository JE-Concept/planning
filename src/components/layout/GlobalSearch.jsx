import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatDay } from '@lib/dates'
import { labelOf } from '@lib/pipeline'
import { groepeer, rangschik } from '@lib/zoeken'
import { Icon } from '@components/ds'
import { useAssistant } from '@context/AssistantProvider'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useCustomers } from '@data/customers'
import { isDone, useEvents } from '@data/events'
import { useMeetings } from '@data/meetings'
import { templateSummary } from '@data/templates'

/**
 * De zoekbalk bovenaan: events, taken, klanten, de verslagen van het
 * teamoverleg, mensen en (voor beheerders) templates.
 *
 * ⌘K of Ctrl+K opent hem van waar je ook staat, ook vanuit een invoerveld; /
 * doet hetzelfde met één toets zolang je niet aan het typen bent. Pijltjes door
 * de lijst, Enter opent. Vindt hij niets, dan gaat de vraag naar de assistent —
 * dat is vaker het juiste antwoord dan "geen resultaten".
 *
 * De verslagen komen uit `useMeetings`, die filtert op `viewerIds`. Dat is geen
 * nette extra maar een voorwaarde: de regels laten alleen documenten door waar
 * je in die lijst staat, en een query die dat niet spiegelt faalt in zijn
 * geheel in plaats van korter te worden. Wie niet bij een overleg hoorde, vindt
 * het hier dus ook niet — en dat klopt.
 *
 * Het rangschikken staat in @lib/zoeken, met tests. Een handvol verslagen naast
 * honderden taken op één hoop sorteren betekent dat de verslagen er nooit bij
 * staan, en dat is het soort fout dat niemand komt melden.
 */

/** De volgorde van de kopjes. Vast, want ze mogen niet wisselen onder je vinger. */
const SOORTEN = ['Events', 'Taken', 'Klanten', 'Verslagen', 'Mensen', 'Templates']

/**
 * Het kopje zoals het op het scherm staat.
 *
 * De soort zelf blijft Nederlands: hij groepeert en sorteert, en @lib/zoeken
 * rekent ermee. Alleen wat je leest hangt aan de taal.
 */
const SOORT_LABEL = {
  Events: 'inst.zoek.soort.events',
  Taken: 'inst.zoek.soort.taken',
  Klanten: 'inst.zoek.soort.klanten',
  Verslagen: 'inst.zoek.soort.verslagen',
  Mensen: 'inst.zoek.soort.mensen',
  Templates: 'inst.zoek.soort.templates',
}

/** Tiebreaker bij een gelijke score: waar het vaakst naar gezocht wordt, staat boven. */
const GEWICHT = { Events: 5, Taken: 4, Klanten: 3, Verslagen: 2, Mensen: 1, Templates: 0 }

const samen = (...stukken) => stukken.filter(Boolean).join(' · ')

export default function GlobalSearch({ narrow }) {
  const { isAdmin, uid } = useAuth()
  const { profiles, templates, eventStatuses } = useWorkspace()
  const { events, tasks, eventById } = useEvents()
  const { customers } = useCustomers()
  const { meetings } = useMeetings(uid)
  const { ask } = useAssistant()
  const { t } = useTaal()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const { pathname } = useLocation()

  // Naar een ander scherm: de zoekopdracht hoort bij het vorige.
  useEffect(() => {
    setQ('')
    setOpen(false)
    setIdx(0)
  }, [pathname])

  useEffect(() => {
    const onKey = (e) => {
      // ⌘K en Ctrl+K: overal, ook met de cursor in een veld — dat is precies
      // waarvoor een combinatie met een modificatietoets dient.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
        return
      }

      const doel = e.target
      const tag = (doel?.tagName || '').toLowerCase()
      const inVeld = tag === 'input' || tag === 'textarea' || tag === 'select' || doel?.isContentEditable
      if (e.key === '/' && !inVeld && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const done = () => {
    setQ('')
    setOpen(false)
    setIdx(0)
  }

  /**
   * Alles waarin gezocht kan worden, in één vorm.
   *
   * `titel` bepaalt de score, `extra` helpt vinden zonder de volgorde te
   * bepalen. Zo vind je de trouw van Niels ook via de naam van de klant, zonder
   * dat élke taak van diezelfde klant bovenaan komt te staan.
   */
  const kandidaten = useMemo(() => {
    const voornaam = (id) => (profiles.find((p) => p.id === id)?.fullName ?? '').split(' ')[0]

    const uit = [
      ...events.map((e) => ({
        soort: 'Events',
        titel: e.name,
        extra: [e.customerName, e.concept, e.location, e.eventType],
        icon: 'calendar-days',
        sub: samen(e.eventDate ? formatDay(e.eventDate) : null, e.concept, labelOf(e.statusName, eventStatuses)),
        go: () => navigate(`/events/${e.id}`),
      })),
      ...tasks.map((taak) => ({
        soort: 'Taken',
        titel: taak.title,
        extra: [eventById[taak.parentId]?.name, taak.description],
        icon: isDone(taak) ? 'check-circle' : 'circle',
        sub: samen(
          eventById[taak.parentId]?.name,
          voornaam(taak.assignees?.[0]),
          taak.dueDate ? formatDay(taak.dueDate) : null
        ),
        go: () => navigate(`/events/${taak.parentId}?taak=${taak.id}`),
      })),
      ...customers.map((c) => ({
        soort: 'Klanten',
        titel: c.name,
        extra: [c.email, c.vatNumber, c.address?.city, ...(c.contacts ?? []).map((k) => k.name)],
        icon: 'building',
        sub: samen(c.address?.city, c.vatNumber, t('inst.zoek.klantfiche')),
        go: () => navigate('/klanten'),
      })),
      ...meetings.map((m) => ({
        soort: 'Verslagen',
        titel: m.titel || t('inst.zoek.overleg_van', { datum: m.datum }),
        extra: [
          ...(m.samenvatting ?? []).map((s) => s.onderwerp),
          ...(m.samenvatting ?? []).map((s) => s.tekst),
          ...(m.deelnemers ?? []),
        ],
        icon: 'messages-square',
        sub: samen(
          m.datum ? formatDay(m.datum) : null,
          t('inst.zoek.punt', { aantal: (m.samenvatting ?? []).length }),
          t('inst.zoek.teamoverleg')
        ),
        go: () => navigate('/overleg'),
      })),
      ...profiles
        .filter((p) => p.active !== false && p.role !== 'staff')
        .map((p) => ({
          soort: 'Mensen',
          titel: p.fullName || p.email,
          extra: [p.email],
          icon: 'users',
          sub: t('inst.zoek.mens_sub', {
            aantal: tasks.filter((taak) => !isDone(taak) && taak.assignees?.includes(p.id)).length,
          }),
          go: () => navigate('/werklast'),
        })),
    ]

    if (isAdmin) {
      uit.push(
        ...templates.map((tp) => ({
          soort: 'Templates',
          titel: tp.name,
          extra: [],
          icon: tp.icon,
          sub: t('inst.zoek.template_sub', { uitleg: templateSummary(tp) }),
          go: () => navigate(`/instellingen?tab=templates&template=${tp.id}`),
        }))
      )
    }

    return uit.map((k) => ({ ...k, gewicht: GEWICHT[k.soort] ?? 0 }))
  }, [events, tasks, customers, meetings, profiles, templates, isAdmin, eventById, eventStatuses, navigate, t])

  const ranglijst = useMemo(() => rangschik(kandidaten, q), [kandidaten, q])
  const groups = useMemo(() => groepeer(ranglijst, SOORTEN), [ranglijst])

  // De knoppen worden per kopje getekend, niet in de volgorde van de ranglijst;
  // de pijltjes moeten dezelfde weg volgen als het oog.
  const zichtbaar = useMemo(() => groups.flatMap(([, items]) => items), [groups])
  const active = Math.min(idx, Math.max(0, zichtbaar.length - 1))

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx(Math.min(active + 1, zichtbaar.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx(Math.max(active - 1, 0))
    } else if (e.key === 'Enter') {
      if (zichtbaar[active]) {
        zichtbaar[active].go()
        done()
      } else if (q.trim()) {
        const vraag = q
        done()
        ask(vraag)
      }
    } else if (e.key === 'Escape') {
      done()
      e.currentTarget.blur()
    }
  }

  let k = 0
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 560, minWidth: 0 }}>
      <div className={`je-search${open ? ' je-search--open' : ''}`}>
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setIdx(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={t('inst.zoek.plaatshouder')}
          aria-label={t('alg.zoeken')}
        />
        {narrow ? null : <span className="je-kbd">⌘K</span>}
      </div>
      {open && q.trim() ? (
        <div className="je-results" role="listbox">
          {groups.map(([label, items]) => (
            <div key={label}>
              <div
                style={{
                  padding: 'var(--space-3) var(--space-5) var(--space-2)',
                  font: 'var(--type-eyebrow)',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--text-2)',
                }}
              >
                {t(SOORT_LABEL[label] ?? label)}
              </div>
              {items.map((r) => {
                const my = k++
                const on = my === active
                return (
                  <button
                    key={`${label}-${my}`}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onMouseDown={() => {
                      r.go()
                      done()
                    }}
                    onMouseEnter={() => setIdx(my)}
                    className="je-plainbtn"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-3) var(--space-5)',
                      background: on ? 'var(--accent-quiet)' : 'transparent',
                    }}
                  >
                    <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
                      <Icon name={r.icon} size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', font: 'var(--type-body-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.titel}
                      </span>
                      <span style={{ display: 'block', font: 'var(--type-caption)', fontWeight: 400, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.sub}
                      </span>
                    </span>
                    {on ? (
                      <span style={{ color: 'var(--text-3)', display: 'flex' }}>
                        <Icon name="corner-down-left" size={14} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-3)',
              padding: 'var(--space-4) var(--space-5) var(--space-2)',
              borderTop: '1px solid var(--border-hairline)',
            }}
          >
            <span className="je-muted-caption" style={{ flex: 1 }}>
              {zichtbaar.length
                ? t('inst.zoek.resultaat', { aantal: zichtbaar.length })
                : t('inst.zoek.niets', { vraag: q.trim() })}
            </span>
            <button
              type="button"
              className="je-plainbtn"
              onMouseDown={() => {
                const vraag = q
                done()
                ask(vraag)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--type-caption)', color: 'var(--text-accent)' }}
            >
              <Icon name="sparkles" size={14} />
              {t('inst.zoek.assistent')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
