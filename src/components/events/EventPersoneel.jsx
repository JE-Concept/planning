import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatTime } from '@lib/dates'
import {
  STAND_TEKST,
  STAND_TOON,
  STATUUT_TEKST,
  afdelingLabel,
  kleurVan,
  minutenVan,
  mogelijkVoor,
  samenvatting,
  standVan,
  urenTekst,
} from '@lib/aapi-weergave'
import { Badge, Button, Icon } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { koppelShift, useAapiShifts, useShiftsVanEvent } from '@data/aapi'

/**
 * Wie er op dit event staat, volgens AAPI.
 *
 * ── De vraag die dit beantwoordt ──────────────────────────────────────────
 * "Staat er zaterdag genoeg volk, en van welk soort." Vandaar de samenvatting
 * bovenaan — aantal, uren, uitsplitsing per statuut — en pas daaronder de
 * namen. Wie het detail wil, scrolt; wie wil weten of het goed zit, niet.
 *
 * ── Waarom er ook staat wie er níét op staat ──────────────────────────────
 * Een shift die bij geen enkel event terechtkwam, is onzichtbaar zolang je
 * alleen kijkt naar wat gekoppeld is. Juist die wil je zien, en juist hier:
 * wie op dit event staat te kijken, weet of die persoon erbij hoort. Daarom
 * het blok "mogelijk voor dit event" eronder, met één knop per shift.
 *
 * ── Wat hier (nog) niet kan ───────────────────────────────────────────────
 * Iemand met de hand toevoegen die niet in AAPI staat — externen die
 * rechtstreeks factureren. De lijst is daarop voorbereid: elke regel is een
 * `PersoneelRij` met zijn eigen bron, en een handmatige rij past ertussen
 * zonder dat deze component verandert.
 */
export default function EventPersoneel({ event }) {
  const { t } = useTaal()
  const toast = useToast()
  const navigate = useNavigate()
  const [bezig, setBezig] = useState(null)

  const { shifts } = useShiftsVanEvent(event?.id)

  // De dagen die dit event raakt. Een event duurt één dag in JE Plan, maar de
  // opbouw kan daags ervoor beginnen — vandaar ook de dag ervoor.
  const dagen = useMemo(() => {
    if (!event?.eventDate) return []
    const d = new Date(event.eventDate)
    const sleutel = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    const dagEerder = new Date(d)
    dagEerder.setDate(d.getDate() - 1)
    return [sleutel(dagEerder), sleutel(d)]
  }, [event?.eventDate])

  const { van, tot } = useMemo(() => {
    if (!dagen.length) return {}
    return { van: new Date(`${dagen[0]}T00:00:00`), tot: new Date(`${dagen[1]}T23:59:59`) }
  }, [dagen])

  const { shifts: vanDieDagen } = useAapiShifts({ van, tot })

  const kandidaten = useMemo(
    () => mogelijkVoor(event?.id, dagen, vanDieDagen),
    [event?.id, dagen, vanDieDagen]
  )

  const telling = useMemo(() => samenvatting(shifts), [shifts])

  const koppel = async (planningId, status, eventId = null) => {
    setBezig(planningId)
    try {
      await koppelShift({ planningId, eventId, status })
      toast.success(t(status === 'unlinked' ? 'aapi.shift.losgemaakt' : 'aapi.shift.gekoppeld'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(null)
    }
  }

  // Niets te melden en niets te kiezen: dan hoort dit blok er ook niet te
  // staan. Een lege kop op elk event is ruis op de events waar AAPI niet aan
  // te pas komt.
  if (!shifts.length && !kandidaten.length) return null

  return (
    <section className="je-panel">
      <div className="je-panel__head">
        <span className="je-eyebrow">{t('aapi.event.titel')}</span>
        <span className="je-panel__right">
          {t('aapi.event.samenvatting', { aantal: telling.gepland, uren: urenTekst(telling.minuten) })}
          {telling.afgezegd ? ` · ${t('aapi.event.afgezegd', { aantal: telling.afgezegd })}` : ''}
        </span>
      </div>

      {Object.keys(telling.perStatuut).length ? (
        <div className="je-personeelstatuten">
          {Object.entries(telling.perStatuut)
            .sort((a, b) => b[1] - a[1])
            .map(([statuut, aantal]) => (
              <Badge key={statuut} tone="neutral">
                {aantal}× {t(STATUUT_TEKST[statuut] ?? 'aapi.statuut.onbekend')}
              </Badge>
            ))}
        </div>
      ) : null}

      {shifts.length === 0 ? (
        <p className="je-muted-caption" style={{ padding: 'var(--space-5) var(--space-6)' }}>
          {t('aapi.event.leeg')}
        </p>
      ) : (
        shifts.map((s) => (
          <PersoneelRij
            key={s.aapiPlanningId}
            shift={s}
            bezig={bezig === s.aapiPlanningId}
            actie={
              <Button
                size="sm"
                variant="ghost"
                loading={bezig === s.aapiPlanningId}
                onClick={() => koppel(s.aapiPlanningId, 'unlinked')}
              >
                {t('aapi.shift.losmaken')}
              </Button>
            }
          />
        ))
      )}

      {kandidaten.length ? (
        <>
          <div className="je-panel__head" style={{ borderTop: '1px solid var(--border-hairline)' }}>
            <span className="je-eyebrow">{t('aapi.event.mogelijk')}</span>
          </div>
          {kandidaten.map((s) => (
            <PersoneelRij
              key={s.aapiPlanningId}
              shift={s}
              bezig={bezig === s.aapiPlanningId}
              actie={
                <Button
                  size="sm"
                  variant="secondary"
                  loading={bezig === s.aapiPlanningId}
                  onClick={() => koppel(s.aapiPlanningId, 'manual', event.id)}
                >
                  {t('aapi.event.koppel_hier')}
                </Button>
              }
            />
          ))}
        </>
      ) : null}

      <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <Button
          size="sm"
          variant="ghost"
          iconLeft="calendar-days"
          onClick={() => navigate(`/planning?dag=${dagen[1] ?? ''}`)}
        >
          {t('aapi.event.naar_kalender')}
        </Button>
      </div>
    </section>
  )
}

/**
 * Eén regel: wie, wanneer, welke afdeling, welk statuut, welke stand.
 *
 * `actie` komt van buiten zodat dezelfde regel zowel in de gekoppelde lijst
 * als in de lijst met kandidaten past — en zodat er later een handmatig
 * toegevoegde kracht naast kan staan met zijn eigen knop.
 */
function PersoneelRij({ shift, actie }) {
  const { t } = useTaal()
  const stand = standVan(shift)

  return (
    <div className="je-personeelrij" style={{ '--afdeling': kleurVan(shift.locationName) }}>
      <span className="je-personeelrij__streep" aria-hidden="true" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{shift.naam || shift.aapiEmployeeId}</div>
        <div className="je-muted-caption">
          {afdelingLabel(t, shift.locationName)}
          {' · '}
          {formatTime(shift.start)}–{formatTime(shift.end)}
          {' · '}
          {t('aapi.shift.pauze', { minuten: shift.pauseMinutes ?? 0 })}
          {' · '}
          {urenTekst(minutenVan(shift))}
        </div>
      </div>
      <Badge tone="neutral">{t(STATUUT_TEKST[shift.statuut] ?? 'aapi.statuut.onbekend')}</Badge>
      <Badge tone={STAND_TOON[stand]}>{t(STAND_TEKST[stand])}</Badge>
      {actie}
    </div>
  )
}
