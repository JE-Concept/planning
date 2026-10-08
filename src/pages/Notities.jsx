import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { raakt } from '@lib/koppelingen'
import { groepeerActies, zoekVerslagen } from '@lib/verslag-zoek'
import { EmptyState, Field, Input, Spinner } from '@components/ds'
import ObjectKiezer from '@components/common/ObjectKiezer'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import NotitieBewerken from '@components/notities/NotitieBewerken'
import NotitieDetail from '@components/notities/NotitieDetail'
import NotitieLijst from '@components/notities/NotitieLijst'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useAlleActiepunten } from '@data/meetings'
import { useNotities } from '@data/notities'

/**
 * Alle notities op één plek: wat het team over klanten, events, materiaal en
 * uren opschreef, en de verslagen van het teamoverleg.
 *
 * Drie manieren om iets terug te vinden, en ze stapelen:
 *  - de soort (een gewone notitie of een overleg);
 *  - waar ze over gaat — met dezelfde objectkiezer als waarmee ze gekoppeld
 *    werd, dus "alles over Blum" is één keuze;
 *  - vrije tekst, over de titel, de tekst, de samenvatting en de actiepunten.
 *
 * `?notitie=<id>` opent er meteen één: daar landt de zoekbalk bovenaan.
 */
export default function Notities() {
  const { uid } = useAuth()
  const { t } = useTaal()
  const [params, setParams] = useSearchParams()
  const { notities, laadt } = useNotities({ uid })

  const [soort, setSoort] = useState('alles')
  const [over, setOver] = useState([])
  const [zoek, setZoek] = useState('')
  const [nieuw, setNieuw] = useState(false)

  const openId = params.get('notitie')
  const open = notities.find((n) => n.id === openId) ?? null
  const zetOpen = (id) =>
    setParams(
      (p) => {
        const volgende = new URLSearchParams(p)
        if (id) volgende.set('notitie', id)
        else volgende.delete('notitie')
        return volgende
      },
      { replace: true }
    )

  // De actiepunten alleen ophalen wanneer er verslagen in beeld kunnen komen.
  const actiepunten = useAlleActiepunten(soort !== 'notitie' && !!zoek.trim())

  const gefilterd = useMemo(
    () =>
      notities.filter(
        (n) =>
          (soort === 'alles' || (n.soort ?? 'notitie') === soort) &&
          over.every((k) => raakt(n, k))
      ),
    [notities, soort, over]
  )
  const gevonden = useMemo(
    () => zoekVerslagen({ verslagen: gefilterd, actiesPerVerslag: groepeerActies(actiepunten), term: zoek }),
    [gefilterd, actiepunten, zoek]
  )

  if (laadt) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  const gefilterdOp = zoek.trim() || over.length || soort !== 'alles'

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('notities.titel')}
        subtitle={
          gefilterdOp
            ? t('notities.gevonden', { aantal: notities.length, gevonden: gevonden.length })
            : t('notities.aantal', { aantal: notities.length })
        }
        acties={{ hoofd: { label: t('notities.nieuw'), icon: 'plus', onClick: () => setNieuw(true) } }}
        tabs={
          <>
            {['alles', 'notitie', 'overleg'].map((s) => (
              <Tab key={s} active={soort === s} onClick={() => setSoort(s)}>
                {t(`notities.filter.${s}`)}
              </Tab>
            ))}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3 py-4">
          <div className="card space-y-3 p-4">
            <Input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder={t('notities.zoek')}
              aria-label={t('notities.zoek_label')}
            />
            <Field label={t('notities.filter.over')}>
              <ObjectKiezer waarde={over} onChange={setOver} plaatshouder={t('notities.filter.over_hint')} />
            </Field>
          </div>

          {notities.length === 0 ? (
            <EmptyState title={t('notities.leeg')} description={t('notities.leeg_uitleg')} />
          ) : gevonden.length === 0 ? (
            <EmptyState
              title={t('notities.niets_gevonden')}
              description={t('notities.niets_gevonden_uitleg', { term: zoek.trim() })}
            />
          ) : (
            <NotitieLijst notities={gevonden} onOpen={(n) => zetOpen(n.id)} />
          )}
        </div>
      </div>

      {open ? <NotitieDetail notitie={open} onClose={() => zetOpen(null)} /> : null}
      {nieuw ? (
        <NotitieBewerken koppelingen={over} onClose={() => setNieuw(false)} onBewaard={(id) => zetOpen(id)} />
      ) : null}
    </div>
  )
}
