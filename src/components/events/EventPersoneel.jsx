import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dayKey, formatDate, formatTime, formatWeekday } from '@lib/dates'
import {
  STAND_TEKST,
  STAND_TOON,
  STATUUT_TEKST,
  afdelingLabel,
  groepenPerDag,
  isOpen,
  kleurVan,
  minutenVan,
  mogelijkVoor,
  naamOfOpen,
  samenvatting,
  standVan,
  tabStand,
  urenTekst,
} from '@lib/aapi-weergave'
import { dagenVan, isMeerdaags } from '@lib/eventdagen'
import { Badge, Button } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { koppelShift, useAapiMedewerkers, useAapiShifts, useShiftsVanEvent } from '@data/aapi'

/**
 * Wie er op dit event staat.
 *
 * ── Waarom er hier niemand met de hand bijkomt ────────────────────────────
 * "Medewerkers" was een rijtje vinkjes op de fiche: duid aan wie er komt
 * werken. Dat is dezelfde vraag die AAPI beantwoordt, en twee antwoorden op
 * één vraag gaan uit elkaar lopen — iemand vinkt hier aan, de planning in AAPI
 * zegt iets anders, en dan is er geen manier meer om te weten welke van de twee
 * klopt. Zeker niet wanneer er loon aan hangt.
 *
 * Dus één bron: AAPI. Wie hier staat, staat daar ingepland; klopt het niet,
 * dan klopt de planning niet en hoort die rechtgezet te worden waar ze gemaakt
 * is. Wat hier wél een menselijke beslissing blijft, is bij wélk event een
 * shift hoort — en ook die loopt via een functie, zodat ze één keer bestaat.
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
/**
 * Alles wat dit event over personeel weet, in één abonnement.
 *
 * Een eigen hook omdat twee plekken het nodig hebben: dit blok, en het
 * bolletje op de tab. Zou elk zijn eigen abonnement openen, dan staan er twee
 * luisteraars op dezelfde vraag en kunnen ze een tel uit elkaar lopen — en
 * juist dán zegt het bolletje iets anders dan wat eronder staat.
 */
export function useEventPersoneel(event) {
  const { shifts } = useShiftsVanEvent(event?.id)
  const { opId: medewerkerOpId } = useAapiMedewerkers()

  /*
    De dagen die dit event raakt: elke dag van het event, en de dag ervoor.

    Die dag ervoor staat er omdat de opbouw daags voordien begint — een shift
    van donderdagavond hoort bij het feest van vrijdag. Sinds een event
    meerdaags kan zijn, zijn het er niet twee maar zoveel als het duurt.
  */
  const dagen = useMemo(() => {
    const eigen = dagenVan(event)
    if (!eigen.length) return []
    const eerste = new Date(`${eigen[0]}T12:00:00`)
    eerste.setDate(eerste.getDate() - 1)
    return [dayKey(eerste), ...eigen]
  }, [event])

  const { van, tot } = useMemo(() => {
    if (!dagen.length) return {}
    return { van: new Date(`${dagen[0]}T00:00:00`), tot: new Date(`${dagen[dagen.length - 1]}T23:59:59`) }
  }, [dagen])

  const { shifts: vanDieDagen } = useAapiShifts({ van, tot })

  const kandidaten = useMemo(
    () => mogelijkVoor(event?.id, dagen, vanDieDagen),
    [event?.id, dagen, vanDieDagen]
  )

  const telling = useMemo(() => samenvatting(shifts), [shifts])
  const stand = useMemo(() => tabStand({ shifts, kandidaten }), [shifts, kandidaten])

  return { shifts, kandidaten, dagen, medewerkerOpId, telling, stand }
}

export default function EventPersoneel({ event, personeel }) {
  const { t } = useTaal()
  const toast = useToast()
  const navigate = useNavigate()
  const [bezig, setBezig] = useState(null)

  const { shifts, kandidaten, dagen, medewerkerOpId, telling } = personeel

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

  const openDiensten = useMemo(() => shifts.filter(isOpen), [shifts])
  const ingevuld = useMemo(() => shifts.filter((s) => !isOpen(s)), [shifts])

  /*
    Bij een meerdaags event wordt de lijst per dag opgedeeld.

    Want dan is "elf mensen, 84 uur" over de hele reeks geen antwoord op de
    vraag die iemand stelt. Die vraag is "staat er zaterdag genoeg volk", en
    dat is een vraag per dag. Bij een event van één dag zou een kop boven een
    enkele lijst alleen maar ruis zijn.

    `dagen` draagt ook de dag vóór het event — de opbouw — en die krijgt dus
    zijn eigen groep. Dat klopt: wie de tent zet, werkt een andere dag dan wie
    bedient.
  */
  const perDagGroepen = useMemo(
    () => (isMeerdaags(event) ? groepenPerDag(ingevuld, dagen) : null),
    [event, ingevuld, dagen]
  )

  const losmaakRij = (s) =>
    rij(
      s,
      <Button
        size="sm"
        variant="ghost"
        loading={bezig === s.aapiPlanningId}
        onClick={() => koppel(s.aapiPlanningId, 'unlinked')}
      >
        {t('aapi.shift.losmaken')}
      </Button>
    )

  const rij = (s, actie = null) => (
    <PersoneelRij
      key={s.aapiPlanningId}
      shift={s}
      naam={naamOfOpen(t, s, medewerkerOpId)}
      bezig={bezig === s.aapiPlanningId}
      actie={actie}
    />
  )

  return (
    <section className="je-panel">
      <div className="je-panel__head">
        <span className="je-eyebrow">{t('aapi.event.titel')}</span>
        <span className="je-panel__right">
          {t('aapi.event.samenvatting', { aantal: telling.gepland, uren: urenTekst(telling.minuten) })}
          {telling.open ? ` · ${t('aapi.event.open_aantal', { aantal: telling.open })}` : ''}
          {telling.afgezegd ? ` · ${t('aapi.event.afgezegd', { aantal: telling.afgezegd })}` : ''}
        </span>
      </div>

      {/*
        Wat er nog ingevuld moet worden, bovenaan en niet tussen de rest.

        Een openstaande dienst is het gat in de planning, en een gat tussen
        twintig ingevulde regels is een gat dat niemand ziet. Er staat geen knop
        bij: invullen gebeurt in AAPI, want daar hangt de Dimona aan.
      */}
      {openDiensten.length ? (
        <>
          <div className="je-panel__head je-panel__head--open">
            <span className="je-eyebrow">{t('aapi.event.open_titel')}</span>
            <span className="je-panel__right">{openDiensten.length}</span>
          </div>
          <p className="je-muted-caption" style={{ padding: 'var(--space-3) var(--space-6) 0' }}>
            {t('aapi.event.open_uitleg')}
          </p>
          {openDiensten.map((s) => rij(s))}
        </>
      ) : null}

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

      {ingevuld.length === 0 ? (
        <p className="je-muted-caption" style={{ padding: 'var(--space-5) var(--space-6)' }}>
          {t('aapi.event.leeg')}
        </p>
      ) : perDagGroepen ? (
        perDagGroepen.map((groep) => (
          <div key={groep.dag}>
            <div className="je-dagkop">
              <span className="je-dagkop__dag">
                {formatWeekday(`${groep.dag}T12:00:00`)} {formatDate(`${groep.dag}T12:00:00`)}
              </span>
              <span className="je-muted-caption">
                {groep.shifts.length
                  ? t('aapi.event.samenvatting', {
                      aantal: groep.telling.gepland,
                      uren: urenTekst(groep.telling.minuten),
                    })
                  : t('aapi.event.dag_leeg')}
              </span>
            </div>
            {groep.shifts.map((s) => losmaakRij(s))}
          </div>
        ))
      ) : (
        ingevuld.map((s) => losmaakRij(s))
      )}

      {kandidaten.length ? (
        <>
          <div className="je-panel__head" style={{ borderTop: '1px solid var(--border-hairline)' }}>
            <span className="je-eyebrow">{t('aapi.event.mogelijk')}</span>
          </div>
          {kandidaten.map((s) =>
            rij(
              s,
              <Button
                size="sm"
                variant="secondary"
                loading={bezig === s.aapiPlanningId}
                onClick={() => koppel(s.aapiPlanningId, 'manual', event.id)}
              >
                {t('aapi.event.koppel_hier')}
              </Button>
            )
          )}
        </>
      ) : null}

      <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <Button
          size="sm"
          variant="ghost"
          iconLeft="calendar-days"
          // `dagen[0]` is de dag vóór het event; de eerste eventdag staat erachter.
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
function PersoneelRij({ shift, naam, actie }) {
  const { t } = useTaal()
  const stand = standVan(shift)

  return (
    <div className="je-personeelrij" style={{ '--afdeling': kleurVan(shift.locationName) }}>
      <span className="je-personeelrij__streep" aria-hidden="true" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{naam}</div>
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
