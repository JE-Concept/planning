import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, addMonths, dayKey, formatDate, formatMonth, formatWeekday, startOfMonth, startOfWeek } from '@lib/dates'
import { useNarrow } from '@lib/useNarrow'
import {
  AFDELINGEN,
  afdelingLabel,
  kleurVan,
  naamVan,
  perDag,
  teltMee,
  urenTekst,
  vraagtAandacht,
} from '@lib/aapi-weergave'
import { Badge, Button, Checkbox, Icon, IconButton, Select, Tabs } from '@components/ds'
import { EmptyState, Spinner } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import ShiftBlok from '@components/aapi/ShiftBlok'
import ShiftDetail from '@components/aapi/ShiftDetail'
import PlanningImport from '@components/aapi/PlanningImport'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useAapiMedewerkers, useAapiShifts } from '@data/aapi'
import { useEvents } from '@data/events'

/**
 * De planning: wie wanneer werkt, uit AAPI.
 *
 * ── Waarom naast het rooster en niet erin ─────────────────────────────────
 * JE Plan heeft al een weekrooster (`/rooster`). Dat is met de hand gemaakt en
 * hangt aan profielen van deze tool. Dit komt uit een ander systeem en hangt
 * aan mensen die hier meestal geen account hebben — vijftien in de export van
 * oktober, waarvan de meesten nooit inloggen. Eén scherm van maken zou
 * betekenen dat een import het handwerk overschrijft, of andersom.
 *
 * Dat die twee op termijn dubbel werk zijn, klopt. Welke van de twee blijft,
 * is een beslissing van wie ermee plant en niet van de code.
 *
 * ── Waarom een week van zeven kolommen en geen uurraster ──────────────────
 * Een uurraster laat zien wie wanneer overlapt, en dat is de vraag van een
 * zaalverantwoordelijke op de dag zelf. De vraag hier is "staat er genoeg volk
 * en klopt de koppeling" — en daarvoor is een stapel per dag leesbaarder,
 * zeker met twintig shifts op een zaterdag.
 */
export default function Planning() {
  const { t } = useTaal()
  const { isAdmin } = useAuth()
  const narrow = useNarrow()
  const [params, setParams] = useSearchParams()

  const tab = params.get('tab') === 'import' ? 'import' : 'kalender'
  const weergave = params.get('weergave') === 'maand' ? 'maand' : 'week'

  const [anker, setAnker] = useState(() => {
    const dag = params.get('dag')
    return dag ? new Date(`${dag}T12:00:00`) : new Date()
  })
  const [open, setOpen] = useState(null)

  const [afdeling, setAfdeling] = useState('')
  const [wie, setWie] = useState('')
  const [enkelProblemen, setEnkelProblemen] = useState(false)
  const [toonGeannuleerd, setToonGeannuleerd] = useState(true)

  // Het bereik dat we ophalen. Een week begint op maandag, een maand op de
  // maandag van de week waarin de eerste valt — zo staat het raster vol.
  const { van, tot, dagen } = useMemo(() => {
    const begin = weergave === 'maand' ? startOfWeek(startOfMonth(anker)) : startOfWeek(anker)
    const aantal = weergave === 'maand' ? 42 : 7
    const lijst = Array.from({ length: aantal }, (_, i) => addDays(begin, i))
    const eind = new Date(lijst[lijst.length - 1])
    eind.setHours(23, 59, 59, 999)
    return { van: begin, tot: eind, dagen: lijst }
  }, [anker, weergave])

  const { shifts, laadt } = useAapiShifts({ van, tot })
  // De namen staan op het medewerkerskaartje; zie `naamVan`.
  const { opId: medewerkerOpId } = useAapiMedewerkers()
  const { events, eventById } = useEvents()

  const eventsMetDag = useMemo(
    () => events.map((e) => ({ ...e, dag: e.eventDate ? dayKey(e.eventDate) : null })),
    [events]
  )

  const mensen = useMemo(() => {
    const op = new Map()
    for (const s of shifts) if (s.aapiEmployeeId) op.set(s.aapiEmployeeId, naamVan(s, medewerkerOpId))
    return [...op].sort((a, b) => a[1].localeCompare(b[1]))
  }, [shifts, medewerkerOpId])

  const zichtbaar = useMemo(
    () =>
      shifts.filter((s) => {
        if (afdeling && s.locationName !== afdeling) return false
        if (wie && s.aapiEmployeeId !== wie) return false
        if (enkelProblemen && !vraagtAandacht(s)) return false
        if (!toonGeannuleerd && !teltMee(s)) return false
        return true
      }),
    [shifts, afdeling, wie, enkelProblemen, toonGeannuleerd]
  )

  const gebundeld = useMemo(() => perDag(zichtbaar), [zichtbaar])
  const vandaag = dayKey(new Date())
  const maandSleutel = dayKey(startOfMonth(anker)).slice(0, 7)

  const verzet = (richting) =>
    setAnker((d) => (weergave === 'maand' ? addMonths(d, richting) : addDays(d, richting * 7)))

  const zetTab = (v) => {
    const nieuw = new URLSearchParams(params)
    nieuw.set('tab', v)
    setParams(nieuw, { replace: true })
  }

  const zetWeergave = (v) => {
    const nieuw = new URLSearchParams(params)
    nieuw.set('weergave', v)
    setParams(nieuw, { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader eyebrow={t('aapi.eyebrow')} title={t('aapi.titel')} subtitle={t('aapi.uitleg')} />

      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <Tabs
          items={[
            { value: 'kalender', label: t('aapi.tab.kalender') },
            ...(isAdmin ? [{ value: 'import', label: t('aapi.tab.import') }] : []),
          ]}
          value={tab}
          onChange={zetTab}
        />

        {tab === 'import' ? (
          <PlanningImport onNaarDag={(dag) => {
            setAnker(new Date(`${dag}T12:00:00`))
            zetTab('kalender')
          }} />
        ) : (
          <>
            <div className="je-planbalk">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <IconButton icon="chevron-left" label={t('aapi.vorige')} size="sm" onClick={() => verzet(-1)} />
                <span style={{ font: 'var(--type-h3)', textTransform: 'uppercase', minWidth: narrow ? 120 : 190, textAlign: 'center' }}>
                  {weergave === 'maand'
                    ? `${formatMonth(anker)}`
                    : `${formatDate(dagen[0])} – ${formatDate(dagen[6])}`}
                </span>
                <IconButton icon="chevron-right" label={t('aapi.volgende')} size="sm" onClick={() => verzet(1)} />
                <Button size="sm" variant="ghost" onClick={() => setAnker(new Date())}>
                  {t('aapi.vandaag')}
                </Button>
              </div>

              <Tabs
                items={[
                  { value: 'week', label: t('aapi.week') },
                  { value: 'maand', label: t('aapi.maand') },
                ]}
                value={weergave}
                onChange={zetWeergave}
              />
            </div>

            <div className="je-planfilters">
              <Select
                aria-label={t('aapi.filter.afdeling')}
                value={afdeling}
                onChange={(e) => setAfdeling(e.target.value)}
                options={[
                  { value: '', label: t('aapi.filter.afdeling') },
                  ...AFDELINGEN.map((a) => ({ value: a, label: afdelingLabel(t, a) })),
                ]}
              />
              <Select
                aria-label={t('aapi.filter.medewerker')}
                value={wie}
                onChange={(e) => setWie(e.target.value)}
                options={[
                  { value: '', label: t('aapi.filter.medewerker') },
                  ...mensen.map(([id, naam]) => ({ value: id, label: naam })),
                ]}
              />
              <Checkbox
                label={t('aapi.filter.enkel_problemen')}
                checked={enkelProblemen}
                onChange={() => setEnkelProblemen((v) => !v)}
              />
              <Checkbox
                label={t('aapi.filter.toon_geannuleerd')}
                checked={toonGeannuleerd}
                onChange={() => setToonGeannuleerd((v) => !v)}
              />
              <span className="je-planlegende">
                {AFDELINGEN.map((a) => (
                  <span key={a}>
                    <span style={{ background: kleurVan(a) }} />
                    {afdelingLabel(t, a)}
                  </span>
                ))}
              </span>
            </div>

            {laadt ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
                <Spinner />
              </div>
            ) : shifts.length === 0 ? (
              <EmptyState title={t('aapi.leeg')} description={t('aapi.leeg_uitleg')} />
            ) : (
              <div className="je-panel" style={{ overflow: 'hidden' }}>
                <div className="je-planrooster">
                  {dagen.map((dag) => {
                    const sleutel = dayKey(dag)
                    const vanDieDag = gebundeld[sleutel] ?? []
                    const tellend = vanDieDag.filter(teltMee)
                    const buiten = weergave === 'maand' && sleutel.slice(0, 7) !== maandSleutel

                    return (
                      <div
                        key={sleutel}
                        className="je-planrooster__dag"
                        data-buiten={buiten ? '' : undefined}
                        data-vandaag={sleutel === vandaag ? '' : undefined}
                      >
                        <div className="je-planrooster__kop">
                          <span className="je-planrooster__nummer">
                            {narrow || weergave === 'week' ? `${formatWeekday(dag)} ${dag.getDate()}` : dag.getDate()}
                          </span>
                          {tellend.length ? (
                            <span className="je-muted-caption">
                              {t('aapi.aantal_dag', { aantal: tellend.length })}
                            </span>
                          ) : null}
                        </div>

                        {vanDieDag.map((s) => (
                          <ShiftBlok
                            key={s.aapiPlanningId}
                            shift={s}
                            naam={naamVan(s, medewerkerOpId)}
                            eventNaam={s.eventRef ? eventById[s.eventRef]?.name : null}
                            onClick={() => setOpen(s)}
                            compact={weergave === 'maand' && !narrow}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Eén regel die zegt hoeveel werk er die periode staat. */}
            {zichtbaar.length ? (
              <div className="je-muted-caption">
                {t('aapi.event.samenvatting', {
                  aantal: zichtbaar.filter(teltMee).length,
                  uren: urenTekst(zichtbaar.reduce((op, s) => op + (teltMee(s) ? Math.max(0, Math.round((new Date(s.end) - new Date(s.start)) / 60000) - (s.pauseMinutes ?? 0)) : 0), 0)),
                })}
              </div>
            ) : null}
          </>
        )}
      </div>

      {open ? (
        <ShiftDetail
          shift={open}
          naam={naamVan(open, medewerkerOpId)}
          events={eventsMetDag}
          eventById={eventById}
          onClose={() => setOpen(null)}
          onNaarDag={(dag) => {
            setAnker(new Date(`${dag}T12:00:00`))
            setOpen(null)
          }}
        />
      ) : null}
    </div>
  )
}
