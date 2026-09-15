import { Link } from 'react-router-dom'
import { Button, EmptyState } from '@ui/index'

export default function NotFound() {
  return (
    <div className="p-8">
      <EmptyState
        title="Deze pagina bestaat niet"
        description="De link klopt niet meer, of het bord is verwijderd."
        action={
          <Link to="/">
            <Button variant="primary">Naar vandaag</Button>
          </Link>
        }
      />
    </div>
  )
}
