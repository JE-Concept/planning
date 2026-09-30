import { useState } from 'react'
import { formatDateTime } from '@lib/dates'
import { Badge, Button, Icon } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { ontkoppelMail, useEventMails } from '@data/mails'

/**
 * De mailwisseling met de klant, op het event.
 *
 * Een offerte wordt zelden in één mail afgesproken. Er gaat een vraag heen,
 * een prijs terug, een "kan het ook een week later", en dat alles staat in de
 * mailbox van wie toevallig antwoordde. Wie het dossier overneemt, weet dan
 * niet wat er afgesproken is — en dat is precies wat er misgaat.
 *
 * Hier staat de hele draad: wat binnenkwam en wat JE Plan zelf verstuurde,
 * op volgorde. De tekst wordt getoond zoals ze aankwam, zonder opmaak: HTML
 * van een willekeurige afzender in je eigen scherm laden is precies hoe een
 * mail meer doet dan tonen wat erin staat.
 *
 * Bij elk bericht staat waaróm het hier hangt. "Via het antwoordadres" is
 * zeker; "de enige lopende aanvraag van deze klant" is een redenering, en dan
 * hoort er een knop bij om het los te maken.
 */
export default function MailDraad({ ev }) {
  const { t } = useTaal()
  const toast = useToast()
  const mails = useEventMails(ev.id)

  if (mails.length === 0) {
    return (
      <div className="je-panel" style={{ padding: 'var(--space-6)' }}>
        <p className="je-muted-caption" style={{ margin: 0 }}>
          {t('mail.geen_draad')}
        </p>
      </div>
    )
  }

  return (
    <div className="je-maildraad">
      {mails.map((mail) => (
        <MailBericht key={mail.id} mail={mail} toast={toast} t={t} />
      ))}
    </div>
  )
}

function MailBericht({ mail, toast, t }) {
  const [open, setOpen] = useState(false)
  const uitgaand = mail.richting === 'uit'
  const tekst = String(mail.tekst ?? '')
  // Een antwoord sleept het hele vorige bericht mee. Wie de draad leest, wil
  // het nieuwe stuk zien; de rest staat er al boven.
  const geknipt = tekst.split(/\n(?=(?:>|Op .+ schreef |On .+ wrote ))/)[0].trim()
  const meer = geknipt.length < tekst.trim().length

  return (
    <article className="je-mail" data-uit={uitgaand ? '' : undefined}>
      <header className="je-mail__kop">
        <Icon name={uitgaand ? 'arrow-right' : 'mail'} size={14} />
        <span className="je-mail__wie">{uitgaand ? mail.aan : mail.van}</span>
        <span className="je-muted-caption">{mail.datum ? formatDateTime(mail.datum) : ''}</span>
        {mail.koppeling && mail.koppeling !== 'adres' && mail.koppeling !== 'handmatig' ? (
          <Badge tone="warning" title={t(`mail.koppeling.${mail.koppeling}`)}>
            {t('mail.geraden')}
          </Badge>
        ) : null}
      </header>

      <div className="je-mail__onderwerp">{mail.onderwerp || t('mail.geen_onderwerp')}</div>
      <div className="je-mail__tekst">{open ? tekst : geknipt}</div>

      {(mail.bijlagen ?? []).length ? (
        <div className="je-mail__bijlagen">
          {mail.bijlagen.map((b) => (
            <span key={b.naam} className="je-muted-caption">
              <Icon name="paperclip" size={13} /> {b.naam}
            </span>
          ))}
          <span className="je-muted-caption">{t('mail.bijlagen_uitleg')}</span>
        </div>
      ) : null}

      <div className="je-mail__voet">
        {meer ? (
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? t('mail.minder') : t('mail.meer')}
          </Button>
        ) : null}
        {mail.koppeling && mail.koppeling !== 'adres' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => ontkoppelMail(mail.id).catch((err) => toast.error(err.message))}
          >
            {t('mail.losmaken')}
          </Button>
        ) : null}
      </div>
    </article>
  )
}
