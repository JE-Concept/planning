import { useState } from 'react'
import { Button, Icon, IconButton } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { nogNietNu, useInstalleren } from '@lib/installeren'

/**
 * De uitnodiging om JE Plan op je beginscherm te zetten.
 *
 * ── Waarom dit een balk is en geen knop op het profiel ────────────────────
 * Hij stónd op het profiel, en daar kwam niemand. Een geïnstalleerde app is
 * geen luxe voor deze tool: zonder installatie geen pushbericht op een
 * iPhone, geen app tussen de andere apps, en geen scherm dat opent zonder
 * eerst een adresbalk. Juist de ploeg — die de tool op een telefoon gebruikt
 * en niet op een laptop — heeft er het meest aan.
 *
 * ── Waarom hij weg te klikken is, en toch terugkomt ───────────────────────
 * Een balk die blijft staan, wordt genegeerd en dan weggescrold. Een balk die
 * je één keer wegklikt en nooit meer ziet, bereikt wie onderweg wegklikte
 * nooit meer. Veertien dagen later staat hij er opnieuw.
 *
 * ── Waarom op een iPhone iets anders staat ────────────────────────────────
 * Safari kent geen installatieknop en zal die nooit kennen. Daar kunnen we
 * alleen de weg wijzen: Deel → Zet op beginscherm. Zonder die regel is de app
 * op de helft van de telefoons niet te installeren zonder dat iemand het
 * voordoet.
 */
export default function InstallBalk() {
  const { t } = useTaal()
  const { uitnodigen, apple, installeer } = useInstalleren()
  const [uitleg, setUitleg] = useState(false)

  if (!uitnodigen) return null

  return (
    <div className="je-installbalk" role="status">
      <Icon name="download" size={16} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="je-installbalk__tekst">{t('install.titel')}</div>
        {uitleg ? (
          <div className="je-installbalk__uitleg">{t('install.apple_stappen')}</div>
        ) : (
          <div className="je-installbalk__uitleg">{t('install.waarom')}</div>
        )}
      </div>

      {apple ? (
        <Button size="sm" variant="secondary" onClick={() => setUitleg((v) => !v)}>
          {t(uitleg ? 'install.begrepen' : 'install.hoe')}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={installeer}>
          {t('install.nu')}
        </Button>
      )}

      <IconButton icon="x" label={t('install.later')} variant="bare" size="sm" onClick={nogNietNu} />
    </div>
  )
}
