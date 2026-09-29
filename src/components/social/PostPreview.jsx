import { useState } from 'react'
import { cn } from '@lib/cn'
import { formatDateTime } from '@lib/dates'
import { channelMeta, hoofdKanaal, kanalenVan } from '@lib/social-channels'
import { heeftEigenPublicatiedatum, publicatieMoment } from '@lib/social-planning'
import { Tabs } from '@components/ds'
import { useTaal } from '@context/TaalProvider'

/**
 * Hoe de post eruitziet als hij online staat.
 *
 * Geen koppeling met Instagram of Facebook — er gaat hier niets de deur uit.
 * Het is een voorbeeldweergave, zodat Charish en Jasper vóór publicatie zien
 * wat er straks staat: het beeld in de verhouding van het kanaal, de tekst
 * eronder, de hashtags. Dat is precies wat er misging zonder: een beeld dat op
 * Instagram staand bijgesneden wordt, ziet er in een liggend ontwerp prima uit
 * tot het online komt.
 *
 * Staat een post op meerdere kanalen, dan is er per kanaal een tab: dezelfde
 * tekst, maar wel het formaat van dát kanaal.
 */
export default function PostPreview({ post, brand }) {
  const { t } = useTaal()
  const kanalen = kanalenVan(post)
  const [gekozen, setGekozen] = useState(null)
  const actief = kanalen.includes(gekozen) ? gekozen : hoofdKanaal(post)
  const kanaal = channelMeta(actief)

  const caption = (post.caption ?? '').trim()
  const hashtags = (post.hashtags ?? '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))

  const teLang = kanaal.captionMax != null && caption.length > kanaal.captionMax
  const teVeelTags = kanaal.hashtagMax != null && hashtags.length > kanaal.hashtagMax
  const moment = publicatieMoment(post)

  return (
    <section className="je-postprev">
      <h3 className="label">{t('social.preview.kop')}</h3>

      {kanalen.length > 1 ? (
        <Tabs
          variant="pills"
          value={actief}
          onChange={setGekozen}
          items={kanalen.map((key) => ({ value: key, label: channelMeta(key).label }))}
          className="je-postprev__tabs"
        />
      ) : null}

      <article className="je-postprev__card" aria-label={t('social.preview.voorbeeld_voor', { kanaal: kanaal.label })}>
        <header className="je-postprev__head">
          <span
            className="je-postprev__avatar"
            style={{ background: brand?.color ?? 'var(--text-3)' }}
            aria-hidden="true"
          >
            {(brand?.name ?? 'JE').slice(0, 1).toUpperCase()}
          </span>
          <span className="je-postprev__naam">{brand?.name ?? 'JE Concept'}</span>
          <span className="je-postprev__kanaal" style={{ color: kanaal.color }}>
            {kanaal.label}
          </span>
        </header>

        <Beeld url={post.assetUrl} ratio={kanaal.ratio} ratioLabel={kanaal.ratioLabel} />

        {/* Geen echte knoppen: dit is beeldvulling, zodat de tekst op dezelfde
            plek staat als in de echte feed en je ziet hoeveel ervan zichtbaar is. */}
        <div className="je-postprev__acties" aria-hidden="true">
          <span>♡</span>
          <span>💬</span>
          <span>↗</span>
        </div>

        <div className="je-postprev__tekst">
          {caption ? (
            <p className={cn('je-postprev__caption', teLang && 'je-postprev__caption--lang')}>
              <strong>{brand?.name ?? 'JE Concept'}</strong> {caption}
            </p>
          ) : (
            <p className="je-postprev__leeg">{t('social.preview.geen_tekst')}</p>
          )}

          {hashtags.length > 0 ? (
            <p className="je-postprev__tags">{hashtags.join(' ')}</p>
          ) : null}

          <p className="je-postprev__wanneer">
            {moment
              ? t(
                  heeftEigenPublicatiedatum(post)
                    ? 'social.preview.gaat_online'
                    : 'social.preview.gaat_online_van_event',
                  { datum: formatDateTime(moment) }
                )
              : t('social.preview.geen_datum')}
          </p>
        </div>
      </article>

      <p className="je-postprev__regels">
        {t('social.preview.beeld', { verhouding: kanaal.ratioLabel })}
        {kanaal.captionMax != null
          ? t('social.preview.tekens', { aantal: caption.length, max: kanaal.captionMax })
          : ''}
        {kanaal.hashtagMax != null
          ? t('social.preview.hashtags', { aantal: hashtags.length, max: kanaal.hashtagMax })
          : ''}
      </p>

      {teLang ? (
        <p className="je-postprev__waarschuwing">
          {t('social.preview.te_lang', { kanaal: kanaal.label })}
        </p>
      ) : null}
      {teVeelTags ? (
        <p className="je-postprev__waarschuwing">
          {t('social.preview.te_veel_tags', { kanaal: kanaal.label, max: kanaal.hashtagMax })}
        </p>
      ) : null}
    </section>
  )
}

/**
 * Het beeld, of de plek waar het hoort te komen.
 *
 * "Link naar het ontwerp" is vaak een Canva- of Drive-link en geen afbeelding.
 * Dan hoort er geen kapot plaatje te staan maar het lege kader in de juiste
 * verhouding: ook zonder beeld zegt dat kader wat er nog moet komen.
 */
function Beeld({ url, ratio, ratioLabel }) {
  const [stuk, setStuk] = useState(false)

  return (
    <div className="je-postprev__beeld" style={{ aspectRatio: ratio }}>
      {url && !stuk ? (
        <img src={url} alt="" onError={() => setStuk(true)} />
      ) : (
        <span className="je-postprev__plaatshouder">{ratioLabel}</span>
      )}
    </div>
  )
}
