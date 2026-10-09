import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@lib/cn'
import { dayKey, startOfDay } from '@lib/dates'
import { raaktPeriode } from '@lib/eventdagen'
import { PERIODES, agendaDagen, dagenInBeeld, eventsPerDag, inHokje, verschuif } from '@lib/kalender'
import { indexOf } from '@lib/pipeline'
import { planningKleur, planningVan } from '@lib/planning'
import { weekNummer } from '@lib/social-planning'
import { PeriodeKiezer, Tabs } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { usePlanningStanden } from '@data/aapi'
import PlanningBol from './PlanningBol'
import { eventTijd, maandNaam, paxLabel, shortDate, weekdagKort } from './parts'

/**
 * De eventkalender: een maand of een week, en op een telefoon een agenda.
 *
 * ── Waarom er een week bij kwam ───────────────────────────────────────────
 * In een maandhokje van tachtig pixels staat een naam, afgekapt, en verder
 * niets. Voor "wat staat er volgende week" wil je het uur, het aantal gasten
 * en de klant zien zonder elk event te openen. De week heeft daar de ruimte
 * voor; de maand blijft voor het overzicht van ver.
 *
 * ── Waarom een telefoon geen raster krijgt ────────────────────────────────
 * Zeven kolommen op 390 pixels is vijfenvijftig per dag, en daar werd een
 * event één letter ("N", "S."). Een lijst met alleen de dagen waarop iets
 * valt, leest op een telefoon zoals een agenda hoort te lezen. De keuze tussen
 * maand en week blijft: ze bepaalt hoe ver de lijst reikt.
 *
 * De keuze staat in het adres (`?periode=week`), zodat een link naar "de week
 * van het trouwfeest" ook op die week opent.
 */
export default function EventKalender({ events, narrow }) {
  const { t } = useTaal()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const planningStanden = usePlanningStanden(events)
  const [anker, setAnker] = useState(() => startOfDay(new Date()))

  const periode = PERIODES.includes(params.get('periode')) ? params.get('periode') : 'maand'
  const zetPeriode = (p, nieuwAnker) => {
    const next = new URLSearchParams(params)
    if (p === 'maand') next.delete('periode')
    else next.set('periode', p)
    setParams(next, { replace: true })
    if (nieuwAnker) setAnker(nieuwAnker)
  }

  const vandaag = dayKey(new Date())
  const dagen = dagenInBeeld(anker, periode)
  const perDag = eventsPerDag(events)
  const open = (id) => navigate(`/events/${id}`)

  // De dagen die er echt bij horen: in een maand niet de randdagen van de
  // vorige en de volgende, die staan er alleen om de weken vol te maken.
  const maand = anker.getMonth()
  const eigen = periode === 'maand' ? dagen.filter((d) => d.getMonth() === maand) : dagen
  // Het aantal gaat over dossiers, niet over dagen: een festival van drie
  // dagen is één event deze week.
  const aantal = events.filter((e) => raaktPeriode(e, dayKey(eigen[0]), dayKey(eigen[eigen.length - 1]))).length

  const titel =
    periode === 'week'
      ? t('events.kal.weektitel', {
          nummer: weekNummer(dagen[0]),
          van: shortDate(dagen[0]),
          tot: shortDate(dagen[6]),
        })
      : `${maandNaam(anker)} ${anker.getFullYear()}`

  return (
    <div className="je-panel je-kal" data-periode={periode}>
      <div className="je-kal__kop">
        <PeriodeKiezer
          vorige={{
            label: t(periode === 'week' ? 'events.kal.vorige_week' : 'events.maand.vorige'),
            onClick: () => setAnker((a) => verschuif(a, periode, -1)),
          }}
          nu={{ label: t('alg.vandaag'), onClick: () => setAnker(startOfDay(new Date())) }}
          volgende={{
            label: t(periode === 'week' ? 'events.kal.volgende_week' : 'events.maand.volgende'),
            onClick: () => setAnker((a) => verschuif(a, periode, 1)),
          }}
        />
        <h2 className="je-kal__titel">{titel}</h2>
        <Tabs
          variant="pills"
          className="je-kal__periode"
          items={[
            { value: 'maand', label: t('events.kal.maand') },
            { value: 'week', label: t('events.kal.week') },
          ]}
          value={periode}
          onChange={(p) => zetPeriode(p)}
        />
        <span className="je-muted-caption je-kal__aantal">{t('events.aantal', { aantal })}</span>
      </div>

      {narrow ? (
        <Agenda dagen={eigen} perDag={perDag} vandaag={vandaag} standen={planningStanden} onOpen={open} />
      ) : periode === 'week' ? (
        <div className="je-kal__raster" data-periode="week">
          {dagen.map((d) => {
            const sleutel = dayKey(d)
            return (
              <div key={sleutel} className={cn('je-kal__dag', sleutel === vandaag && 'je-kal__dag--vandaag')}>
                <div className="je-kal__dagkop">
                  <span className="je-eyebrow">{weekdagKort(d)}</span>
                  <span className="je-kal__nummer" aria-current={sleutel === vandaag ? 'date' : undefined}>
                    {d.getDate()}
                  </span>
                </div>
                {(perDag[sleutel] ?? []).map((e) => (
                  <Chip key={e.id} event={e} stand={planningStanden.get(e.id)} uitgebreid onOpen={open} />
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="je-kal__raster" data-periode="maand">
          {dagen.slice(0, 7).map((d) => (
            <div key={`kop-${dayKey(d)}`} className="je-eyebrow je-kal__weekdag">
              {weekdagKort(d)}
            </div>
          ))}
          {dagen.map((d) => {
            const sleutel = dayKey(d)
            const { getoond, meer } = inHokje(perDag[sleutel])
            return (
              <div
                key={sleutel}
                className={cn(
                  'je-kal__dag',
                  d.getMonth() !== maand && 'je-kal__dag--buiten',
                  sleutel === vandaag && 'je-kal__dag--vandaag'
                )}
              >
                <span className="je-kal__nummer" aria-current={sleutel === vandaag ? 'date' : undefined}>
                  {d.getDate()}
                </span>
                {getoond.map((e) => (
                  <Chip key={e.id} event={e} stand={planningStanden.get(e.id)} onOpen={open} />
                ))}
                {/* Wat niet past, staat in de week van die dag: daar is plaats
                    voor alles, met het uur en de gasten erbij. */}
                {meer ? (
                  <button type="button" className="je-plainbtn je-kal__meer" onClick={() => zetPeriode('week', d)}>
                    {t('events.maand.meer', { aantal: meer })}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** De agenda op een telefoon: alleen de dagen waarop iets valt, plus vandaag. */
function Agenda({ dagen, perDag, vandaag, standen, onOpen }) {
  const { t } = useTaal()
  const rijen = agendaDagen(dagen, perDag, vandaag)
  if (!rijen.length) {
    return <p className="je-muted-caption je-kal__leeg">{t('events.kal.leeg')}</p>
  }
  return (
    <ol className="je-kal__agenda">
      {rijen.map(({ datum, sleutel }) => (
        <li key={sleutel} className={cn('je-kal__agendadag', sleutel === vandaag && 'je-kal__dag--vandaag')}>
          <div className="je-kal__agendadatum" aria-current={sleutel === vandaag ? 'date' : undefined}>
            <span className="je-eyebrow">{weekdagKort(datum)}</span>
            <span className="je-kal__nummer">{datum.getDate()}</span>
          </div>
          <div className="je-kal__agendaevents">
            {(perDag[sleutel] ?? []).length ? (
              perDag[sleutel].map((e) => <Chip key={e.id} event={e} stand={standen.get(e.id)} uitgebreid onOpen={onOpen} />)
            ) : (
              <span className="je-muted-caption">{t('events.kal.vandaag_niets')}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * Eén event in de kalender.
 *
 * In een maandhokje is het een naam met stipjes: het eerste zegt of het
 * verkocht is, het tweede de planningstand, het derde of er volk staat — en
 * voluit in de tooltip. In de week en de agenda is er plaats voor het uur, de
 * gasten en de klant op een tweede regel.
 */
function Chip({ event: e, stand, uitgebreid = false, onOpen }) {
  const onder = uitgebreid ? [eventTijd(e), e.pax ? paxLabel(e) : null, e.customerName].filter(Boolean).join(' · ') : ''
  return (
    <button
      type="button"
      title={[e.name, planningVan(e)?.label].filter(Boolean).join(' · ')}
      onClick={() => onOpen(e.id)}
      className={cn('je-calchip', uitgebreid && 'je-calchip--groot')}
    >
      <span className="je-calchip__regel">
        <span
          aria-hidden="true"
          className="je-calchip__stip"
          style={{ background: indexOf(e.statusName) >= indexOf('offer accepted') ? 'var(--navy-700)' : 'var(--navy-300)' }}
        />
        {planningKleur(e) ? (
          <span aria-hidden="true" className="je-calchip__stip" style={{ borderRadius: 3, background: planningKleur(e) }} />
        ) : null}
        <PlanningBol stand={stand} titel={false} />
        <span className="je-calchip__naam">{e.name}</span>
      </span>
      {onder ? <span className="je-calchip__onder">{onder}</span> : null}
    </button>
  )
}
