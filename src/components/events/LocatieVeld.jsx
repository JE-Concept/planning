import { useEffect, useId, useRef, useState } from 'react'
import { kaartIngesteld, kaartLink, locatieDetails, vrijeLocatie, zoekLocaties } from '@lib/kaart'
import { Field, Icon, Input, Spinner } from '@components/ds'
import { useTaal } from '@context/TaalProvider'

/**
 * Het locatieveld van een event, met Google Maps eronder.
 *
 * Het blijft een tekstveld: typen mag altijd, en wat er vandaag in de dossiers
 * staat ("bij de klant thuis", "nog te bepalen") blijft gewoon staan. Wie een
 * echt adres kiest, koppelt er meteen de plek aan vast, zodat de kaartlink de
 * juiste zaal opent en niet de eerste met dezelfde naam.
 *
 * Zonder `VITE_GOOGLE_MAPS_API_KEY` is er geen lijst en is dit precies het
 * veld dat er altijd al stond.
 */
export default function LocatieVeld({ value, onChange, label, hint }) {
  const { t, taal } = useTaal()
  const id = useId()
  const [suggesties, setSuggesties] = useState([])
  const [open, setOpen] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [actief, setActief] = useState(-1)
  // Wat er staat nadat iemand gekozen heeft, hoeft niet opnieuw opgezocht:
  // anders opent de lijst weer zodra het veld de focus krijgt.
  const gekozen = useRef(value?.location ?? '')

  const tekst = value?.location ?? ''
  const metKaart = kaartIngesteld()
  const link = kaartLink(value)

  useEffect(() => {
    if (!metKaart) return undefined
    const vraag = tekst.trim()
    if (vraag.length < 3 || vraag === gekozen.current) {
      setSuggesties([])
      return undefined
    }

    // Wachten tot iemand uitgetypt is. Elke aanslag doorsturen is een verzoek
    // per letter — dat kost geld en levert een lijst op die staat te knipperen.
    const afbreker = new AbortController()
    const wacht = setTimeout(async () => {
      setBezig(true)
      try {
        const lijst = await zoekLocaties(vraag, { signal: afbreker.signal, taal })
        setSuggesties(lijst)
        setActief(-1)
        setOpen(true)
      } catch {
        // Geen suggesties is geen fout die iemand moet lezen: het veld werkt
        // nog, alleen zonder hulp. Een rode melding per mislukte letter zou
        // het invullen juist in de weg staan.
        setSuggesties([])
      } finally {
        setBezig(false)
      }
    }, 260)

    return () => {
      clearTimeout(wacht)
      afbreker.abort()
    }
  }, [tekst, metKaart, taal])

  const kies = async (suggestie) => {
    setOpen(false)
    setSuggesties([])
    gekozen.current = suggestie.tekst
    // Alvast de tekst zetten: de details duren een verzoek lang, en zolang mag
    // het veld niet leeg of oud blijven staan.
    onChange(vrijeLocatie(suggestie.tekst))
    try {
      const details = await locatieDetails(suggestie.id, { taal })
      if (details) {
        gekozen.current = details.location ?? suggestie.tekst
        onChange(details)
      }
    } catch {
      // De tekst staat er al; zonder coördinaten opent de kaartlink gewoon op
      // het adres. Dat is het verschil tussen precies en bruikbaar, niet
      // tussen werkt en werkt niet.
    }
  }

  const opToets = (e) => {
    if (!open || suggesties.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActief((i) => (i + 1) % suggesties.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActief((i) => (i <= 0 ? suggesties.length : i) - 1)
    } else if (e.key === 'Enter' && actief >= 0) {
      e.preventDefault()
      kies(suggesties[actief])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <Field
      label={label ?? t('events.fiche.locatie')}
      hint={hint ?? (metKaart ? t('events.locatie.hint') : undefined)}
      htmlFor={id}
    >
      <div style={{ position: 'relative' }}>
        <Input
          id={id}
          value={tekst}
          autoComplete="off"
          role={metKaart ? 'combobox' : undefined}
          aria-expanded={metKaart ? open && suggesties.length > 0 : undefined}
          aria-autocomplete={metKaart ? 'list' : undefined}
          placeholder={metKaart ? t('events.locatie.plaatshouder') : undefined}
          onChange={(e) => {
            gekozen.current = ''
            onChange(vrijeLocatie(e.target.value))
          }}
          onFocus={() => setOpen(true)}
          // Met een muisklik op een suggestie verliest het veld eerst de focus;
          // meteen sluiten zou de klik opeten.
          onBlur={() => setTimeout(() => setOpen(false), 140)}
          onKeyDown={opToets}
        />

        {bezig ? (
          <span style={{ position: 'absolute', right: 8, top: 8, pointerEvents: 'none' }}>
            <Spinner size="sm" />
          </span>
        ) : null}

        {open && suggesties.length > 0 ? (
          <div className="je-results je-locatielijst" role="listbox" aria-label={t('events.locatie.lijst')}>
            {suggesties.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={i === actief}
                className="je-plainbtn je-locatieoptie"
                style={{ background: i === actief ? 'var(--accent-quiet)' : 'transparent' }}
                onMouseEnter={() => setActief(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  kies(s)
                }}
              >
                <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
                  <Icon name="map-pin" size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="je-locatieoptie__hoofd">{s.hoofd}</span>
                  {s.onder ? <span className="je-muted-caption je-locatieoptie__onder">{s.onder}</span> : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {link ? (
        <a
          className="je-link-quiet je-locatiekaart"
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="map-pin" size={14} />
          {t('events.locatie.openen')}
        </a>
      ) : null}
    </Field>
  )
}
