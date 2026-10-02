import { TAB_STAND_TEKST } from '@lib/aapi-weergave'
import { useTaal } from '@context/TaalProvider'

/**
 * Het planningsbolletje: groen, oranje of rood.
 *
 * Dezelfde kleur en dezelfde betekenis als op de personeelstab van een event,
 * en dat is het punt: wie hem daar leert kennen, leest hem op het bord zonder
 * uitleg. Eén component, zodat de twee niet uit elkaar kunnen lopen.
 *
 * Niets tonen wanneer er geen stand is. Dat is een event waar AAPI niet aan te
 * pas komt of dat buiten het venster valt, en een kleur zou daar liegen — een
 * rood bolletje op een event waarvan de planning nog gemaakt moet worden, is
 * een vals alarm dat iedereen leert wegkijken.
 */
export default function PlanningBol({ stand, titel = true }) {
  const { t } = useTaal()
  if (!stand) return null
  const uitleg = t(TAB_STAND_TEKST[stand])
  return (
    <span
      className={`je-bol je-bol--${stand}`}
      role="img"
      aria-label={uitleg}
      title={titel ? uitleg : undefined}
    />
  )
}
