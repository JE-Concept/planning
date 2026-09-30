import { useState } from 'react'
import { SOCIAL_STAGES, stageOf } from '@lib/social-stage'
import { formatDate } from '@lib/dates'
import { kaartLink } from '@lib/kaart'
import { Badge, Button, Drawer, EmptyState } from '@ui/index'
import { Icon } from '@components/ds'
import PostCard from '@components/social/PostCard'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useSocialEventKaart } from '@data/social-events'
import { usePostsForTask } from '@data/social'
import { updateTask } from '@data/tasks'
import { startTimer, stopTimer, useRunningTimer } from '@data/time'

/**
 * Het event, zoals de socialrol het opent.
 *
 * Een eigen paneel en niet het gewone takenpaneel, om één reden: daar staan het
 * budget, het offertebedrag en de kostprijs op. Ze weglaten met een `if` zou
 * niets afschermen — de gegevens zaten dan nog altijd in het antwoord van de
 * database, en wie de ontwikkelaarsconsole opent leest ze alsnog. Daarom leest
 * dit paneel uit `socialEvents`, de kale kopie waar geen bedrag in staat.
 *
 * Wat er wél op moet: waar het event over gaat, wanneer het is, welke content
 * eruit moet komen, en de knop om de stand te verzetten. Plus de posts die er
 * al aan hangen, want daarvoor open je het.
 */
export default function SocialEventPaneel({ taskId, onClose }) {
  const kaart = useSocialEventKaart(taskId)
  const posts = usePostsForTask(taskId)
  const { brandById } = useWorkspace()
  const { uid } = useAuth()
  const { t } = useTaal()
  const toast = useToast()
  const { timer, elapsed } = useRunningTimer(uid)
  const [bezig, setBezig] = useState(false)

  const stand = stageOf(kaart)
  const loopt = timer?.taskId === taskId

  const verzet = async (naar) => {
    setBezig(true)
    try {
      await updateTask(taskId, { socialStage: naar })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const timerKnop = async () => {
    setBezig(true)
    try {
      if (loopt) {
        const id = await stopTimer(uid)
        toast.success(id ? t('timer.gestopt', { tijd: elapsed }) : t('timer.te_kort'))
      } else {
        await startTimer({ uid, task: { id: taskId, title: kaart?.title, listId: kaart?.listId }, billable: false })
        toast.success(t('timer.loopt'))
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <Drawer
      open={Boolean(taskId)}
      onClose={onClose}
      title={kaart?.title || t('social.event.geen_naam')}
      subtitle={[kaart?.customerName, kaart?.location].filter(Boolean).join(' · ') || undefined}
    >
      {!kaart ? (
        <EmptyState title={t('social.event.weg')} description={t('social.event.weg_uitleg')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
            {kaart.date || kaart.eventDate ? (
              <Badge tone="neutral">{formatDate(kaart.date ?? kaart.eventDate)}</Badge>
            ) : null}
            {kaart.listName ? <Badge tone="neutral">{kaart.listName}</Badge> : null}
            {/*
              Wie de beelden maakt, moet er geraken. De locatie staat al in de
              ondertitel; dit is de route erheen.
            */}
            {kaartLink(kaart) ? (
              <a
                className="je-link-quiet je-locatiekaart"
                href={kaartLink(kaart)}
                target="_blank"
                rel="noreferrer"
                style={{ marginTop: 0 }}
              >
                <Icon name="map-pin" size={14} />
                {t('events.locatie.openen')}
              </a>
            ) : null}
          </div>

          <div>
            <div className="je-eyebrow">{t('social.event.stand')}</div>
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {SOCIAL_STAGES.map((stap) => (
                <Button
                  key={stap.key}
                  size="sm"
                  variant={stap.key === stand ? 'primary' : 'secondary'}
                  disabled={bezig}
                  onClick={() => verzet(stap.key)}
                >
                  {stap.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="je-eyebrow">{t('social.event.posts')}</div>
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {posts.length ? (
                posts.map((post) => <PostCard key={post.id} post={post} brand={brandById[post.brandId]} compact />)
              ) : (
                <p className="je-muted-caption">{t('social.event.geen_posts')}</p>
              )}
            </div>
          </div>

          {/* Tijd boeken hoort hier: het is het werk waarvoor dit bord bestaat. */}
          <div>
            <Button size="sm" variant={loopt ? 'primary' : 'secondary'} iconLeft={loopt ? 'square' : 'play'} onClick={timerKnop} loading={bezig}>
              {loopt ? t('timer.stoppen') : t('timer.starten')}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
