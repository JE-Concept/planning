import { Link } from 'react-router-dom'
import { useTaal } from '@context/TaalProvider'
import { EmptyState } from '@components/ds'

export default function NotFound() {
  const { t } = useTaal()

  return (
    <div className="p-8">
      <EmptyState
        title={t('events.weg.titel')}
        description={t('events.weg.tekst')}
        actie={{ label: t('events.weg.knop'), as: Link, to: '/' }}
      />
    </div>
  )
}
