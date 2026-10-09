import { useMemo, useState } from 'react'
import { formatDate } from '@lib/dates'
import { STANDAARD_KLEUR } from '@lib/kleur'
import { Acties, Avatar, Badge, Dialog } from '@components/ds'
import ObjectKiezer from '@components/common/ObjectKiezer'
import Koppelingen from '@components/notities/Koppelingen'
import NotitieBewerken from '@components/notities/NotitieBewerken'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useMeetingTasks } from '@data/meetings'
import { verwijderNotitie, zetNotitieKoppelingen } from '@data/notities'

/**
 * Eén notitie, open.
 *
 * Een gewone notitie is tekst en wat ze raakt. Het verslag van een overleg is
 * meer: deelnemers, de besproken punten en de actiepunten die eruit kwamen —
 * dat stond vroeger in een eigen venster op Teamoverleg en staat nu hier,
 * zodat een verslag dat je vanaf een event opent er hetzelfde uitziet.
 *
 * Wat ze raakt is op beide te wijzigen. Bij een verslag is dat zelfs het
 * belangrijkste: het model vat samen, maar dat "Blum personeelsfeest" over het
 * event van Blum ging, weet alleen wie erbij was.
 */
export default function NotitieDetail({ notitie, onClose, zonder = null }) {
  const { t } = useTaal()
  const { uid, isAdmin } = useAuth()
  const { profileById } = useWorkspace()
  const toast = useToast()
  const [bewerken, setBewerken] = useState(false)
  const [koppelingen, setKoppelingen] = useState(notitie.koppelingen ?? [])
  const [koppelen, setKoppelen] = useState(false)
  const [bezig, setBezig] = useState(false)

  const overleg = notitie.soort === 'overleg'
  const magBewerken = !overleg && !notitie.prive
  const magWeg = magBewerken && (notitie.auteurId === uid || isAdmin)
  const auteur = notitie.auteurId ? profileById[notitie.auteurId] : null

  const bewaarKoppelingen = async () => {
    setBezig(true)
    try {
      await zetNotitieKoppelingen(notitie.id, koppelingen, uid)
      toast.success(t('notities.koppelingen_bewaard'))
      setKoppelen(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  if (bewerken) return <NotitieBewerken notitie={notitie} onClose={onClose} />

  // Twee standen: lezen, of kiezen waar ze over gaat.
  const voet = koppelen
    ? {
        terug: {
          onClick: () => {
            setKoppelingen(notitie.koppelingen ?? [])
            setKoppelen(false)
          },
        },
        hoofd: { label: t('notities.bewaren'), onClick: bewaarKoppelingen, bezig },
      }
    : {
        gevaar: magWeg
          ? {
              label: t('notities.weg'),
              size: 'sm',
              vraag: t('notities.weg_vraag'),
              onConfirm: () => verwijderNotitie(notitie.id).then(onClose).catch((e) => toast.error(e.message)),
            }
          : null,
        tweede: { label: t('notities.veld.over'), icon: 'pencil', onClick: () => setKoppelen(true) },
        hoofd: magBewerken ? { label: t('notities.bewerken'), onClick: () => setBewerken(true) } : null,
      }

  return (
    <Dialog
      open
      onClose={onClose}
      title={notitie.titel || formatDate(notitie.datum)}
      width={672}
      footer={<Acties {...voet} />}
    >
      <div className="space-y-5 px-5 py-4">
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span>{formatDate(notitie.datum)}</span>
          {overleg ? <Badge subtle>{t('notities.soort_overleg')}</Badge> : null}
          {notitie.prive ? <Badge subtle>{t('notities.prive')}</Badge> : null}
          {auteur || notitie.auteurNaam ? (
            <span className="flex items-center gap-1.5">
              <Avatar profile={auteur ?? { fullName: notitie.auteurNaam }} size="xs" />
              {t('notities.door', { wie: auteur?.fullName || notitie.auteurNaam })}
            </span>
          ) : null}
        </p>

        <section>
          <h3 className="label">{t('notities.over')}</h3>
          {koppelen ? (
            <ObjectKiezer waarde={koppelingen} onChange={setKoppelingen} autoFocus />
          ) : notitie.koppelingen?.length ? (
            <Koppelingen koppelingen={notitie.koppelingen} zonder={zonder} onNavigeer={onClose} />
          ) : (
            <p className="text-sm text-ink-500">{t('notities.nergens_aan')}</p>
          )}
        </section>

        {notitie.tekst ? <p className="whitespace-pre-wrap text-sm text-ink-800">{notitie.tekst}</p> : null}

        {overleg ? <Verslag notitie={notitie} /> : null}
      </div>
    </Dialog>
  )
}

/** De delen die alleen een verslag van een overleg heeft. */
function Verslag({ notitie }) {
  const { t } = useTaal()
  const { profileById } = useWorkspace()
  const tasks = useMeetingTasks(notitie.taskId ?? notitie.id)

  const [acties, dossier] = useMemo(
    () => [tasks.filter((x) => x.parentId), tasks.find((x) => !x.parentId)],
    [tasks]
  )

  return (
    <>
      {dossier ? <p className="text-xs text-ink-500">{dossier.statusName}</p> : null}

      <section>
        <h3 className="label">{t('notities.overleg.deelnemers')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {(notitie.deelnemers ?? []).map((naam) => (
            <Badge key={naam} subtle>
              {naam}
            </Badge>
          ))}
        </div>
      </section>

      <section>
        <h3 className="label">{t('notities.overleg.besproken')}</h3>
        <ul className="space-y-2.5">
          {(notitie.samenvatting ?? []).map((punt) => (
            <li key={punt.onderwerp}>
              <p className="text-sm font-semibold text-ink-900">{punt.onderwerp}</p>
              <p className="text-sm text-ink-700">{punt.tekst}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="label">{t('notities.overleg.actiepunten', { aantal: acties.length })}</h3>
        <ul className="space-y-1">
          {acties.map((taak) => {
            const wie = taak.assignees?.[0] ? profileById[taak.assignees[0]] : null
            return (
              <li
                key={taak.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 px-3 py-2"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: taak.statusColor ?? STANDAARD_KLEUR }}
                />
                <span className="min-w-0 flex-1 text-sm text-ink-800">{taak.title}</span>
                {wie ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-600">
                    <Avatar profile={wie} size="xs" />
                    {wie.fullName || wie.email}
                  </span>
                ) : (
                  <Badge tone="warning">
                    {taak.voorgesteldeVerantwoordelijke
                      ? `${taak.voorgesteldeVerantwoordelijke}?`
                      : t('notities.overleg.geen_wie')}
                  </Badge>
                )}
              </li>
            )
          })}
          {acties.length === 0 ? (
            <li className="px-1 py-2 text-sm text-ink-500">{t('notities.overleg.geen_actiepunten')}</li>
          ) : null}
        </ul>
        <p className="mt-2 text-[11px] text-ink-500">{t('notities.overleg.actiepunten_zijn_taken')}</p>
      </section>

      {notitie.bron ? (
        <p className="text-xs text-ink-500">
          {t('notities.overleg.bron')}:{' '}
          <a href={notitie.bron} target="_blank" rel="noreferrer" className="underline">
            {t('notities.overleg.de_opname')}
          </a>
        </p>
      ) : null}

      <p className="rounded-xl bg-ink-50 px-3 py-2 text-[11px] text-ink-600">{t('notities.overleg.door_ai')}</p>
    </>
  )
}
