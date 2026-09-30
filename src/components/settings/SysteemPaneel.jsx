import { formatDateTime } from '@lib/dates'
import { STIL_NA_UREN } from '@lib/systeem'
import { useSysteem } from '@data/systeem'
import { Badge, Icon, Spinner } from '@components/ds'
import { useTaal } from '@context/TaalProvider'

/**
 * Doet de tool nog wat ze hoort te doen?
 *
 * ── Waarom dit scherm er is ───────────────────────────────────────────────
 * De ophaler van de post schreef elke vijf minuten bij waar ze gebleven was,
 * en niemand las dat. Mislukte mails stonden in de wachtrij met de reden
 * erbij, en geen enkel scherm toonde het. Loopt een app-wachtwoord af, dan
 * stopt de post in stilte, en het eerste signaal is een klant die vraagt
 * waarom niemand antwoordt.
 *
 * Hier staat het in twee regels. Niet als grafiek en niet als logbestand: wie
 * dit opent, wil één ding weten, en dat is of er iets aan de hand is.
 */
export default function SysteemPaneel() {
  const { t } = useTaal()
  const { postvak, mislukt, laadt, postStaat, urenStil, stand } = useSysteem()

  if (laadt) {
    return (
      <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Spinner /> {t('systeem.laden')}
      </div>
    )
  }

  const laatste = postvak?.laatsteKeer?.toDate?.() ?? (postvak?.laatsteKeer ? new Date(postvak.laatsteKeer) : null)

  return (
    <div className="je-systeem">
      <div className="je-systeem__kop">
        <span className="je-caps">{t('systeem.titel')}</span>
        <Badge tone={stand === 'goed' ? 'success' : stand === 'let_op' ? 'warning' : 'neutral'} dot>
          {t(`systeem.stand.${stand}`)}
        </Badge>
      </div>

      <Regel
        icoon="mail"
        goed={postStaat === 'goed'}
        titel={t('systeem.post')}
        tekst={
          postStaat === 'nooit'
            ? t('systeem.post_nooit')
            : postStaat === 'stil'
              ? t('systeem.post_stil', { uren: urenStil, grens: STIL_NA_UREN })
              : t('systeem.post_goed', { wanneer: formatDateTime(laatste) })
        }
      />

      <Regel
        icoon="alert-triangle"
        goed={mislukt.length === 0}
        titel={t('systeem.uitgaand')}
        tekst={
          mislukt.length === 0
            ? t('systeem.uitgaand_goed')
            : t('systeem.uitgaand_mislukt', { aantal: mislukt.length })
        }
      />

      {mislukt.length ? (
        <ul className="je-systeem__lijst">
          {mislukt.slice(0, 5).map((rij) => (
            <li key={rij.id}>
              <span className="je-systeem__wie">{rij.aan}</span>
              <span className="je-muted-caption">{rij.reden || t('systeem.geen_reden')}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="je-muted-caption" style={{ margin: 0 }}>
        {t('systeem.uitleg')}
      </p>
    </div>
  )
}

function Regel({ icoon, goed, titel, tekst }) {
  return (
    <div className="je-systeem__regel" data-goed={goed ? '' : undefined}>
      <Icon name={goed ? 'check-circle' : icoon} size={16} />
      <span className="je-systeem__titel">{titel}</span>
      <span className="je-systeem__tekst">{tekst}</span>
    </div>
  )
}
