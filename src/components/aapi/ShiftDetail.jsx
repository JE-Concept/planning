import { useMemo, useState } from 'react'
import { formatDate, formatDateTime, formatTime } from '@lib/dates'
import { Acties, Badge, Button, Drawer, Field, Select } from '@components/ds'
import {
  KOPPELING_TEKST,
  afdelingLabel,
  STAND_TEKST,
  STAND_TOON,
  STATUUT_TEKST,
  minutenVan,
  standVan,
  urenTekst,
} from '@lib/aapi-weergave'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { koppelShift } from '@data/aapi'

/**
 * Alles over één shift, en wat je eraan kunt veranderen.
 *
 * Veranderen is precies één ding: bij welk event hij hoort. De tijden, de naam
 * en het statuut komen uit AAPI en horen daar aangepast te worden — twee
 * systemen die allebei de waarheid mogen schrijven, is hoe je niet meer weet
 * welke klopt.
 *
 * De oorspronkelijk geplande tijden staan erbij wanneer ze afwijken. Dat is het
 * antwoord op "stond dat er altijd al zo in", en die vraag komt elke keer dat
 * iemand zegt dat hij iets anders afgesproken had.
 */
export default function ShiftDetail({ shift, naam, events = [], eventById = {}, onClose, onNaarDag }) {
  const { t } = useTaal()
  const toast = useToast()
  const [bezig, setBezig] = useState(false)
  const [keuze, setKeuze] = useState(shift?.eventRef ?? '')

  const stand = standVan(shift)
  const verschoven = useMemo(() => {
    if (!shift?.defaultStart || !shift?.defaultEnd) return false
    return (
      new Date(shift.defaultStart).getTime() !== new Date(shift.start).getTime()
      || new Date(shift.defaultEnd).getTime() !== new Date(shift.end).getTime()
    )
  }, [shift])

  const vanDieDag = useMemo(
    () => events.filter((e) => e.dag === shift?.dag),
    [events, shift?.dag]
  )

  const zet = async (status, eventId = null) => {
    setBezig(true)
    try {
      await koppelShift({ planningId: shift.aapiPlanningId, eventId, status })
      toast.success(t(status === 'unlinked' ? 'aapi.shift.losgemaakt' : 'aapi.shift.gekoppeld'))
      onClose?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  if (!shift) return null

  return (
    <Drawer
      open
      onClose={onClose}
      title={naam}
      subtitle={`${formatDate(shift.start)} · ${formatTime(shift.start)}–${formatTime(shift.end)}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Badge tone={STAND_TOON[stand]}>{t(STAND_TEKST[stand])}</Badge>
          <Badge tone="neutral">{afdelingLabel(t, shift.locationName)}</Badge>
          <Badge tone="neutral">{t(STATUUT_TEKST[shift.statuut] ?? 'aapi.statuut.onbekend')}</Badge>
        </div>

        <dl className="je-shiftdetail">
          <dt>{t('aapi.shift.gepland_van')}</dt>
          <dd>
            {formatTime(shift.start)}–{formatTime(shift.end)}
            {' · '}
            {t('aapi.shift.pauze', { minuten: shift.pauseMinutes ?? 0 })}
            {' · '}
            {t('aapi.shift.netto', { uren: urenTekst(minutenVan(shift)) })}
          </dd>

          {/* Alleen tonen wanneer het afwijkt; anders staat er twee keer hetzelfde. */}
          {verschoven ? (
            <>
              <dt>{t('aapi.shift.oorspronkelijk')}</dt>
              <dd>
                {formatTime(shift.defaultStart)}–{formatTime(shift.defaultEnd)}
                {' · '}
                {t('aapi.shift.pauze', { minuten: shift.defaultPauseMinutes ?? 0 })}
              </dd>
            </>
          ) : null}

          <dt>{t('aapi.shift.vestiging')}</dt>
          <dd>
            {shift.establishmentName ?? '—'}
            <div className="je-muted-caption">{t('aapi.shift.vestiging_hint')}</div>
          </dd>

          <dt>{t('aapi.shift.event')}</dt>
          <dd>
            {shift.eventRef ? eventById[shift.eventRef]?.name ?? shift.eventRef : '—'}
            <div className="je-muted-caption">
              {t(KOPPELING_TEKST[shift.linkStatus] ?? 'aapi.koppeling.nvt')}
              {shift.linkStatus === 'auto' && shift.linkScore != null
                ? ` · ${t('aapi.shift.score', { score: Math.round(shift.linkScore * 100) })}`
                : ''}
            </div>
          </dd>
        </dl>

        {/*
          De kandidaten die de machine overwoog, met hun score. Dit is wat
          `ambiguous` bruikbaar maakt in plaats van alleen vervelend: je ziet
          waarom het een vraag werd.
        */}
        {(shift.linkCandidates ?? []).length > 0 ? (
          <div>
            <span className="je-caps">{t('aapi.shift.kandidaten')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              {shift.linkCandidates.map((k) => (
                <Button
                  key={k.eventId}
                  size="sm"
                  variant="secondary"
                  loading={bezig}
                  onClick={() => zet('manual', k.eventId)}
                >
                  {eventById[k.eventId]?.name ?? k.eventId}
                  {' · '}
                  {t('aapi.shift.score', { score: Math.round(k.score * 100) })}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {shift.locationName === 'evenementen' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Field label={t('aapi.shift.kies_event')}>
              <Select value={keuze} onChange={(e) => setKeuze(e.target.value)}>
                <option value="">—</option>
                {vanDieDag.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </Select>
            </Field>
            <Acties
              plaats="rij"
              terug={shift.linkStatus !== 'unlinked' ? { label: t('aapi.shift.losmaken'), bezig, onClick: () => zet('unlinked') } : null}
              tweede={{ label: t('aapi.shift.geen_event'), bezig, onClick: () => zet('none') }}
              hoofd={{ label: t('aapi.event.koppel_hier'), bezig, uit: !keuze, onClick: () => zet('manual', keuze) }}
            />
          </div>
        ) : null}

        <div className="je-muted-caption">
          {shift.aapiLastModifiedOn ? `AAPI · ${formatDateTime(shift.aapiLastModifiedOn)}` : null}
        </div>

        {onNaarDag ? (
          <Button size="sm" variant="ghost" iconLeft="calendar-days" onClick={() => onNaarDag(shift.dag)}>
            {t('aapi.shift.naar_kalender')}
          </Button>
        ) : null}
      </div>
    </Drawer>
  )
}
