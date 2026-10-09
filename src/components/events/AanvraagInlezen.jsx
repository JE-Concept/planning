import { useEffect, useMemo, useRef } from 'react'
import { formatDate } from '@lib/dates'
import { leesAanvraag, zelfdeMail } from '@lib/aanvraag'
import { Badge, Field, Icon, Textarea } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useLosseMails } from '@data/mails'

/**
 * Een aanvraag van een klant plakken en er een event van maken.
 *
 * Wat hier staat is bewust géén ingevuld formulier dat doet alsof het klopt.
 * Het toont wát het gelezen heeft en wát het gegokt heeft, en het geraden deel
 * staat er zichtbaar anders bij. Een offerte die op een verkeerd gelezen datum
 * staat, gaat de deur uit en de klant rekent erop; dan is één seconde
 * nakijken in dit scherm de goedkoopste seconde van het hele dossier.
 *
 * De uitleg bij een gok zegt wélke gok het is. Eerst stond er bij elke datum
 * "er staat geen jaartal in de mail", ook wanneer het jaartal er pal naast
 * stond — en een uitleg die niet klopt, leert mensen de uitleg niet te lezen.
 *
 * Het lezen zelf staat in `@lib/aanvraag` — geen model, geen sleutel, en
 * getest op de mails die hier echt binnenkomen.
 */
export default function AanvraagInlezen({ tekst, onTekst, formules, plekken, onGelezen, onPostvak }) {
  const { t } = useTaal()
  const laatste = useRef(null)
  const { mails: postvak } = useLosseMails()

  const gelezen = useMemo(() => {
    if (!tekst.trim()) return null
    return leesAanvraag(tekst, { formules, plekken })
  }, [tekst, formules, plekken])

  // Staat deze mail al in Aanvragen, dan hangt díé straks aan het event.
  const uitPostvak = useMemo(() => (tekst.trim() ? zelfdeMail(tekst, postvak) : null), [tekst, postvak])
  useEffect(() => {
    onPostvak?.(uitPostvak)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uitPostvak?.id])

  // Doorgeven aan de dialoog eromheen, maar alleen wanneer er echt iets
  // veranderde: anders zet dit bij elke aanslag de velden terug en kan er niets
  // meer met de hand aangepast worden.
  const sleutel = gelezen
    ? JSON.stringify([
        gelezen.datum,
        gelezen.tot,
        gelezen.personen,
        gelezen.soort,
        gelezen.formule?.id,
        gelezen.plek?.id,
        gelezen.zaal?.adres,
        gelezen.klant,
        gelezen.email,
        gelezen.telefoon,
      ])
    : ''
  useEffect(() => {
    if (!gelezen || sleutel === laatste.current) return
    laatste.current = sleutel
    onGelezen(gelezen)
    // `gelezen` en `onGelezen` veranderen bij elke aanslag mee; `sleutel` is
    // juist wat er van overblijft als er inhoudelijk iets wijzigde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel])

  const datumUitleg = gelezen
    ? [
        !gelezen.jaarGegeven && t('aanvraag.jaar_geraden'),
        !gelezen.weekdagKlopt && t('aanvraag.weekdag_klopt_niet'),
        gelezen.losseDagen && t('aanvraag.losse_dagen'),
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  const regels = gelezen
    ? [
        gelezen.datum && {
          sleutel: 'events.velden.datum',
          // Zoals elke andere datum in de tool, en niet als 2026-11-14.
          waarde: gelezen.tot
            ? t('aanvraag.reeks', { van: formatDate(gelezen.datum), tot: formatDate(gelezen.tot) })
            : formatDate(gelezen.datum),
          geraden: gelezen.onzeker.includes('datum'),
          uitleg: datumUitleg || null,
        },
        gelezen.personen && {
          sleutel: 'events.fiche.gasten',
          waarde: `${gelezen.personen} pax`,
          geraden: gelezen.onzeker.includes('personen'),
          uitleg: gelezen.personenTot
            ? t('aanvraag.vork', { laag: gelezen.personen, hoog: gelezen.personenTot })
            : null,
        },
        gelezen.soort && { sleutel: 'events.velden.type', waarde: gelezen.soort },
        gelezen.formule && {
          sleutel: 'events.fiche.formule',
          waarde: gelezen.formule.name,
          geraden: gelezen.onzeker.includes('formule'),
        },
        gelezen.zaal && { sleutel: 'events.fiche.locatie', waarde: gelezen.zaal.adres },
        gelezen.plek && { sleutel: 'events.velden.concept', waarde: gelezen.plek.name },
        gelezen.klant && { sleutel: 'events.fiche.klant', waarde: gelezen.klant },
        gelezen.email && { sleutel: 'klant.email', waarde: gelezen.email },
        gelezen.telefoon && { sleutel: 'klant.telefoon', waarde: gelezen.telefoon },
      ].filter(Boolean)
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <Field label={t('aanvraag.plak')} hint={t('aanvraag.plak_hint')}>
        <Textarea
          boxed
          rows={10}
          value={tekst}
          onChange={(e) => onTekst(e.target.value)}
          placeholder={t('aanvraag.plaatshouder')}
          aria-label={t('aanvraag.plak')}
        />
      </Field>

      {gelezen ? (
        <div className="je-gelezen">
          <span className="je-caps">{t('aanvraag.gelezen')}</span>
          {regels.length === 0 ? (
            <p className="je-muted-caption" style={{ margin: 0 }}>
              {t('aanvraag.niets')}
            </p>
          ) : (
            <dl className="je-gelezen__lijst">
              {regels.map((r) => (
                <div key={r.sleutel} className="je-gelezen__rij">
                  <dt className="je-muted-caption">{t(r.sleutel)}</dt>
                  <dd>
                    <span className="je-gelezen__waarde">{r.waarde}</span>
                    {r.geraden ? (
                      <Badge tone="warning" title={r.uitleg ?? undefined}>
                        {t('aanvraag.geraden')}
                      </Badge>
                    ) : null}
                    {r.uitleg ? <span className="je-muted-caption je-gelezen__uitleg">{r.uitleg}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {gelezen.vragen.length ? (
            <div className="je-gelezen__vragen">
              <span className="je-caps">{t('aanvraag.vragen')}</span>
              <ul>
                {gelezen.vragen.map((v) => (
                  <li key={v}>
                    <Icon name="corner-down-left" size={13} />
                    {t(v)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="je-muted-caption" style={{ margin: 0 }}>
            {uitPostvak ? t('aanvraag.mail_uit_postvak', { van: uitPostvak.van || '' }) : t('aanvraag.mail_bewaard')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
