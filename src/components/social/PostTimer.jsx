import { useState } from 'react'
import { formatDuration } from '@lib/format'
import { Button } from '@ui/index'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { startTimer, stopTimer, useRunningTimer } from '@data/time'

/**
 * Tijd boeken op socialwerk.
 *
 * Wie de content maakt, werkt op de kalender en niet op het takenbord — en daar
 * stond geen timer. Het gevolg was dat een halve dag beeld maken en schrijven
 * nergens terechtkwam, terwijl precies dat werk op een factuur hoort of op zijn
 * minst geteld moet worden.
 *
 * Hangt de post aan een taak, dan gaat de tijd daarheen: dan telt ze mee bij het
 * event en zie je op de fiche wat de content gekost heeft. Staat de post op
 * zichzelf, dan wordt het een boeking op het merk, met de titel van de post als
 * omschrijving. Zo is ze achteraf nog te plaatsen.
 */
export default function PostTimer({ post }) {
  const { uid } = useAuth()
  const { t } = useTaal()
  const toast = useToast()
  const { socialLists } = useWorkspace()
  const { timer, elapsed } = useRunningTimer(uid)
  const [bezig, setBezig] = useState(false)

  const loopt =
    Boolean(timer) &&
    (post.taskId ? timer.taskId === post.taskId : timer.description === post.title)

  const schakel = async () => {
    setBezig(true)
    try {
      if (loopt) {
        const id = await stopTimer(uid)
        toast.success(
          id ? t('timer.gestopt', { tijd: formatDuration(elapsed) }) : t('timer.te_kort')
        )
      } else {
        await startTimer({
          uid,
          task: post.taskId ? { id: post.taskId, title: post.taskTitle || post.title } : null,
          list: socialLists[0] ?? null,
          brandId: post.brandId ?? null,
          description: post.title,
          // Content voor een klant is factureerbaar zodra ze aan een event hangt;
          // een losse post is dat niet vanzelf.
          billable: Boolean(post.taskId),
        })
        toast.success(t('timer.loopt'))
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="label mb-0">{t('social.tijd.kop')}</h3>
        <Button variant={loopt ? 'danger' : 'secondary'} size="sm" onClick={schakel} disabled={bezig}>
          {loopt ? `■ ${formatDuration(elapsed, { withSeconds: true })}` : `▶ ${t('timer.start')}`}
        </Button>
      </div>
      <p className="text-sm text-ink-600">
        {post.taskId ? t('social.tijd.aan_event') : t('social.tijd.op_merk')}
      </p>
    </section>
  )
}
