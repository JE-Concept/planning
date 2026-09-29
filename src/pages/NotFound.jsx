import { Link } from 'react-router-dom'
import { useTaal } from '@context/TaalProvider'
import { Button, EmptyState } from '@ui/index'

export default function NotFound() {
  const { t } = useTaal()

  return (
    <div className="p-8">
      <EmptyState
        title={t('events.weg.titel')}
        description={t('events.weg.tekst')}
        action={
          <Link to="/">
            <Button variant="primary">{t('events.weg.knop')}</Button>
          </Link>
        }
      />
    </div>
  )
}
