import { Icon } from '@components/ds'
import { useOffline } from '@context/OfflineProvider'

/**
 * De regel bovenaan wanneer er geen verbinding is, of wanneer er nog werk op
 * dit toestel staat.
 *
 * Hij staat op dezelfde plek als de melding over een nieuwe versie, want het is
 * dezelfde soort mededeling: iets waar je niets aan hoeft te doen, maar wat je
 * wél moet weten voor je de app wegklikt. Geen knop, geen kruisje — er valt
 * niets te bevestigen en wegklikken zou precies het misverstand maken dat dit
 * moet voorkomen.
 *
 * Zwijgt zodra alles doorgestuurd is; zie `offlineBericht` in @lib/offline voor
 * waarom dat belangrijker is dan het altijd te laten staan.
 */
export default function OfflineBar() {
  const { bericht } = useOffline()
  if (!bericht) return null

  return (
    <div className={`je-offlinebar je-offlinebar--${bericht.toon}`} role="status" aria-live="polite">
      <Icon name={bericht.toon === 'offline' ? 'cloud-off' : 'loader'} size={15} />
      <span className="je-offlinebar__tekst">{bericht.tekst}</span>
      <span className="je-offlinebar__detail">{bericht.detail}</span>
    </div>
  )
}
