import { useState } from 'react'
import { Button } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { leesPloegcode } from '@data/ploeg'

/**
 * De cijfercode van een medewerker, op aanvraag.
 *
 * ── Waarom ze er niet gewoon staat ────────────────────────────────────────
 * Jasper wil ze kunnen zien, en dat is de reden dat ze leesbaar bewaard wordt
 * in plaats van versleuteld. Maar vier cijfers zijn de vorm van een bankcode,
 * en mensen hergebruiken die — dus staat ze niet standaard op een scherm dat
 * open blijft liggen terwijl er iemand meekijkt. Eén klik, en ze verdwijnt
 * weer zodra je de pagina verlaat.
 *
 * ── Waarom het opvragen bijgehouden wordt ─────────────────────────────────
 * Dat is wat "zichtbaar in de backoffice" draaglijk maakt: niet dat niemand
 * kan kijken, maar dat kijken niet onzichtbaar is. Het logboek staat in
 * `personeelCodeGelezen`.
 */
export default function PloegCode({ medewerkerId }) {
  const { t } = useTaal()
  const toast = useToast()
  const [code, setCode] = useState(null)
  const [bezig, setBezig] = useState(false)

  if (code !== null) {
    return (
      <span className="je-ploegcode" title={t('ploeg.code_bekeken')}>
        {code || t('ploeg.geen_code')}
      </span>
    )
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      iconLeft="eye"
      loading={bezig}
      onClick={async () => {
        setBezig(true)
        try {
          setCode(await leesPloegcode(medewerkerId))
        } catch (err) {
          toast.error(err.message)
        } finally {
          setBezig(false)
        }
      }}
    >
      {t('ploeg.toon_code')}
    </Button>
  )
}
