import { useNavigate } from 'react-router-dom'
import { SOORT, koppelsleutel, routeVan } from '@lib/koppelingen'
import { Icon, Tag } from '@components/ds'
import { useTaal } from '@context/TaalProvider'

/**
 * Waar een notitie aan hangt, als pillen die je naar het object brengen.
 *
 * `zonder` laat één koppeling weg: op de fiche van een klant hoeft er onder
 * elke notitie niet nog eens te staan dat ze over die klant gaat.
 */
export default function Koppelingen({ koppelingen = [], zonder = null, onNavigeer }) {
  const { t } = useTaal()
  const navigate = useNavigate()
  const weg = zonder ? koppelsleutel(zonder) : null
  const getoond = koppelingen.filter((k) => koppelsleutel(k) !== weg)
  if (!getoond.length) return null

  return (
    <div className="je-koppelingen">
      {getoond.map((k) => {
        const naar = routeVan(k)
        return (
          <Tag
            key={koppelsleutel(k)}
            onClick={
              naar
                ? (e) => {
                    // De pil staat vaak in een kaart die zelf een knop is.
                    e.stopPropagation()
                    onNavigeer?.()
                    navigate(naar)
                  }
                : undefined
            }
            title={t(SOORT[k.soort]?.sleutel)}
          >
            <Icon name={SOORT[k.soort]?.icon ?? 'circle'} size={14} />
            <span className="je-objectkiezer__label">{k.label || t(SOORT[k.soort]?.sleutel)}</span>
          </Tag>
        )
      })}
    </div>
  )
}
