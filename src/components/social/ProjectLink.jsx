import { useState } from 'react'
import { Badge, Button, Input } from '@ui/index'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useAuth } from '@context/AuthProvider'
import { linkPostToTask } from '@data/social'
import { useSocialEventZoeker } from '@data/social-events'
import { useTaskSearch } from '@data/tasks'

/**
 * The project a post belongs to.
 *
 * Most posts exist because of something else — a wedding, an opening, a fair —
 * and the team asks "what goes out for Blum" as often as "what goes out this
 * week". Hanging the post on its task is what makes both questions answerable.
 */
export default function ProjectLink({ post }) {
  const [term, setTerm] = useState('')
  const [picking, setPicking] = useState(false)
  const { isSocial } = useAuth()

  /*
    Twee bronnen voor dezelfde kiezer, en met opzet maar één tegelijk open.

    Het team zoekt in de taken zelf. De socialrol mag die niet lezen — daar staan
    de bedragen op — en zoekt in de kale kopie. Zonder dit onderscheid vroeg haar
    kiezer tweehonderdvijftig taken op, kreeg een rechtenfout terug, en bleef de
    lijst leeg: koppelen was voor haar dus simpelweg stuk.
  */
  const team = useTaskSearch(term, { enabled: picking && !isSocial })
  const kopie = useSocialEventZoeker(term, { enabled: picking && isSocial })
  const { results } = isSocial ? kopie : team
  const { t } = useTaal()
  const toast = useToast()

  const link = async (task) => {
    try {
      await linkPostToTask(post.id, task)
      setPicking(false)
      setTerm('')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (post.taskId && !picking) {
    return (
      <section>
        <h3 className="label">{t('social.project.kop')}</h3>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 px-3 py-2">
          <span aria-hidden="true" className="text-ink-400">
            ▤
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
            {post.taskTitle || t('social.project.gekoppeld')}
          </span>
          {post.taskListName ? <Badge subtle>{post.taskListName}</Badge> : null}
          <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
            {t('social.project.wijzigen')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => link(null)}>
            {t('social.project.losmaken')}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h3 className="label">{t('social.project.kop')}</h3>
      {!picking ? (
        <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
          {t('social.project.koppelen')}
        </Button>
      ) : (
        <div className="space-y-2 rounded-xl bg-ink-50 p-3">
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('social.project.zoek_plaatshouder')}
            aria-label={t('social.project.zoek_label')}
          />
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {results.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => link(task)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: task.statusColor ?? '#8593a9' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-ink-800">{task.title}</span>
                  <span className="shrink-0 text-[11px] text-ink-400">{task.listName}</span>
                </button>
              </li>
            ))}
            {results.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-ink-400">{t('social.project.geen_taken')}</li>
            ) : null}
          </ul>
          <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
            {t('alg.annuleren')}
          </Button>
        </div>
      )}
    </section>
  )
}
