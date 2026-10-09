import { Suspense, lazy, useId, useMemo, useState } from 'react'
import { KOPPELSOORTEN, SOORT, koppelsleutel, schoneKoppeling } from '@lib/koppelingen'
import { Icon, Tag } from '@components/ds'
import { useTaal } from '@context/TaalProvider'

/*
  De lijst met resultaten komt pas binnen wanneer er getypt wordt. Ze haalt
  klanten, events, materiaal, offertes en uren op, en de code daarvoor hoort
  niet in elk scherm dat een kiezer in een dialoog heeft staan.
*/
const Resultaten = lazy(() => import('./ObjectKiezerLijst'))

/**
 * Eén veld om naar iets in JE Plan te wijzen: een klant, een event, een taak,
 * materiaal, een offerte of een urenboeking.
 *
 * Typen zoekt over alle soorten tegelijk, met dezelfde rangschikking als de
 * zoekbalk bovenaan; de rij soorten erboven beperkt tot één soort wanneer je
 * weet wat je zoekt. Wat gekozen is staat als pil boven het veld en gaat er
 * met het kruisje weer af.
 *
 *   <ObjectKiezer waarde={koppelingen} onChange={setKoppelingen} />
 *   <ObjectKiezer waarde={klant ? [klant] : []} onChange={([k]) => …} soorten={['klant']} meerdere={false} />
 *
 * `waarde` is een lijst `{ soort, id, label }` — precies wat op een notitie
 * komt (zie `@lib/koppelingen`). Met `meerdere={false}` vervangt een keuze de
 * vorige in plaats van erbij te komen.
 *
 * De gegevens worden pas opgehaald zodra er getypt wordt: de kiezer staat in
 * dialogen die vaak opengaan zonder dat iemand iets koppelt, en dan zijn zes
 * abonnementen op klanten, materiaal en uren werk dat niemand leest.
 *
 * Met `nieuw` staat onderaan de lijst een laatste keuze die het getypte zelf
 * aanmaakt — "Nieuwe klant ‘Jolien en Bernd’ maken". `nieuw.maak(tekst)` maakt
 * het object en geeft de koppeling terug, die dan gekozen wordt alsof ze er al
 * stond. Wie zoekt en niets vindt, hoeft zo het veld niet uit om het aan te
 * maken; dat ommetje was precies waarom er namen zonder fiche op events
 * stonden. `naam` is wat een voorleesprogramma (en een browsertest) het veld
 * noemt, wanneer de plaatshouder dat niet is.
 */
export default function ObjectKiezer({
  waarde = [],
  onChange,
  soorten = null,
  meerdere = true,
  plaatshouder,
  naam,
  nieuw = null,
  autoFocus = false,
}) {
  const { t } = useTaal()
  const id = useId()
  const [vraag, setVraag] = useState('')
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState(null)
  const [maakt, setMaakt] = useState(false)

  const toegestaan = useMemo(
    () => KOPPELSOORTEN.filter((s) => !soorten || soorten.includes(s.soort)),
    [soorten]
  )

  const kies = (k) => {
    const schoon = schoneKoppeling(k)
    if (!schoon) return
    onChange?.(meerdere ? [...waarde, schoon] : [schoon])
    setVraag('')
    if (!meerdere) setOpen(false)
  }

  /*
    De maker meldt zelf wat er misging (een toast in zijn eigen woorden); hier
    gaat het er alleen om dat een mislukte poging het veld niet op slot laat.
  */
  const maakNieuw = async () => {
    const tekst = vraag.trim()
    if (!nieuw || !tekst || maakt) return
    setMaakt(true)
    try {
      const k = await nieuw.maak(tekst)
      if (k) kies(k)
    } catch {
      // zie hierboven
    } finally {
      setMaakt(false)
    }
  }

  const weg = (k) => onChange?.(waarde.filter((w) => koppelsleutel(w) !== koppelsleutel(k)))

  return (
    <div className="je-objectkiezer">
      {waarde.length ? (
        <div className="je-objectkiezer__gekozen">
          {waarde.map((k) => (
            <Tag key={koppelsleutel(k)} onRemove={() => weg(k)}>
              <Icon name={SOORT[k.soort]?.icon ?? 'circle'} size={14} />
              <span className="je-objectkiezer__label">{k.label || t(SOORT[k.soort]?.sleutel)}</span>
            </Tag>
          ))}
        </div>
      ) : null}

      {/* Bij één soort is een rij met één knop geen keuze. */}
      {toegestaan.length > 1 ? (
        <div className="je-objectkiezer__soorten" role="group" aria-label={t('notities.kiezer.soort')}>
          <Tag selectable selected={!filter} onClick={() => setFilter(null)}>
            {t('notities.kiezer.alles')}
          </Tag>
          {toegestaan.map((s) => (
            <Tag key={s.soort} selectable selected={filter === s.soort} onClick={() => setFilter(s.soort)}>
              {t(s.sleutel)}
            </Tag>
          ))}
        </div>
      ) : null}

      <div className="je-objectkiezer__veld">
        <div className="je-search">
          <Icon name="search" size={16} />
          <input
            value={vraag}
            autoFocus={autoFocus}
            disabled={maakt}
            onChange={(e) => {
              setVraag(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 140)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
                e.stopPropagation()
              }
            }}
            placeholder={plaatshouder ?? t('notities.kiezer.plaatshouder')}
            aria-label={naam ?? plaatshouder ?? t('notities.kiezer.plaatshouder')}
            aria-controls={`${id}-lijst`}
            aria-expanded={open && !!vraag.trim()}
            role="combobox"
          />
        </div>
        {open && vraag.trim() ? (
          <Suspense fallback={null}>
            <Resultaten
              id={`${id}-lijst`}
              vraag={vraag}
              soorten={filter ? [filter] : toegestaan.map((s) => s.soort)}
              gekozen={waarde}
              onKies={kies}
              nieuw={nieuw ? { soort: nieuw.soort, label: nieuw.label(vraag.trim()), onMaak: maakNieuw } : null}
            />
          </Suspense>
        ) : null}
      </div>
    </div>
  )
}
