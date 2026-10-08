import { useState } from 'react'
import { Button, Spinner } from '@components/ds'
import NotitieBewerken from '@components/notities/NotitieBewerken'
import NotitieDetail from '@components/notities/NotitieDetail'
import NotitieLijst from '@components/notities/NotitieLijst'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useNotities } from '@data/notities'

/**
 * De notities over één object, op de plek van dat object.
 *
 *   <GekoppeldeNotities koppeling={{ soort: 'klant', id: klant.id, label: klant.name }} />
 *
 * Een nieuwe notitie die hier begint, hangt al aan dit object. Het verslag
 * van een overleg verschijnt hier ook, zodra iemand het aan dit object
 * gekoppeld heeft — en alleen voor wie het verslag mag lezen.
 *
 * Dit is iets anders dan de notities rechts op een event: dat is het gesprek
 * van het team over het dossier, met vermeldingen en meldingen. Dit is wat je
 * over een klant of een stuk materiaal wil onthouden, ook buiten één event.
 */
export default function GekoppeldeNotities({ koppeling, className }) {
  const { t } = useTaal()
  const { uid } = useAuth()
  const { notities, laadt } = useNotities({ uid, koppeling })
  // Het id en niet de notitie zelf: zo toont het venster wat er nu in de
  // database staat, ook nadat iemand er een koppeling bij zette.
  const [openId, setOpenId] = useState(null)
  const open = notities.find((n) => n.id === openId) ?? null
  const [nieuw, setNieuw] = useState(false)

  return (
    <section className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="label mb-0">{t('notities.hier')}</h3>
        <Button variant="ghost" size="sm" iconLeft="plus" onClick={() => setNieuw(true)}>
          {t('notities.toevoegen')}
        </Button>
      </div>

      {laadt ? (
        <Spinner size="sm" />
      ) : notities.length === 0 ? (
        <p className="text-sm text-ink-500">{t('notities.hier_leeg')}</p>
      ) : (
        <NotitieLijst notities={notities} onOpen={(n) => setOpenId(n.id)} zonder={koppeling} compact />
      )}

      {open ? <NotitieDetail notitie={open} zonder={koppeling} onClose={() => setOpenId(null)} /> : null}
      {nieuw ? <NotitieBewerken koppelingen={[koppeling]} onClose={() => setNieuw(false)} /> : null}
    </section>
  )
}
