import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Icon } from '@components/ds'
import { useAssistant } from '@context/AssistantProvider'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'

/**
 * Een handvol sneltoetsen, en een scherm dat ze toont.
 *
 * Bewust een handvol. Een sneltoets die niemand onthoudt is ballast: hij staat
 * in de weg bij het typen en levert niets op. Wat hier staat zijn de sprongen
 * die op een dag tien keer gemaakt worden — van het bord naar de taken, van de
 * taken naar de lijst van de bistro — plus de twee die de tool zelf bedienen.
 *
 * Losse letters, geen combinaties met Ctrl: dit wordt met één hand gedaan
 * terwijl de andere de telefoon vasthoudt. Dat kan alleen omdat ze genegeerd
 * worden zodra de cursor in een veld staat — anders zou "l" typen in een
 * omschrijving je naar de bistro sturen.
 */

const MAC = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

/** Staat de cursor ergens waar letters tekst zijn en geen bevel? */
export function inEenVeld(doel) {
  if (!doel) return false
  if (doel.isContentEditable) return true
  const tag = (doel.tagName ?? '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

export default function Sneltoetsen({ hulpOpen, setHulpOpen }) {
  const navigate = useNavigate()
  const { isStaff } = useAuth()
  const { t } = useTaal()
  const { open: chatOpen, setOpen: setChatOpen } = useAssistant()

  const toetsen = useMemo(() => {
    const zoeken = { toets: MAC() ? '⌘K' : 'Ctrl+K', wat: t('inst.sneltoets.zoeken') }
    const schuin = { toets: '/', wat: t('inst.sneltoets.schuin') }
    const hulp = { toets: '?', wat: t('inst.sneltoets.hulp') }

    // Personeel heeft één scherm; sprongen naar borden die ze niet mogen zien
    // horen ook niet in hun lijstje te staan.
    if (isStaff) return [hulp]

    return [
      zoeken,
      schuin,
      { toets: 'E', wat: t('inst.sneltoets.eventbord'), pad: '/' },
      { toets: 'T', wat: t('inst.sneltoets.tasks'), pad: '/tasks' },
      { toets: 'D', wat: t('inst.sneltoets.dashboard'), pad: '/dashboard' },
      { toets: 'L', wat: t('inst.sneltoets.openensluiten'), pad: '/openen-sluiten' },
      { toets: 'A', wat: t('inst.sneltoets.assistent') },
      hulp,
    ]
  }, [isStaff, t])

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return
      // Ctrl+K en ⌘K horen bij de zoekbalk zelf; die vangt ze daar op.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (inEenVeld(e.target)) return

      if (e.key === '?') {
        e.preventDefault()
        setHulpOpen(true)
        return
      }

      if (isStaff) return

      const sprong = { e: '/', t: '/tasks', d: '/dashboard', l: '/openen-sluiten' }[e.key.toLowerCase()]
      if (sprong) {
        e.preventDefault()
        navigate(sprong)
        return
      }

      if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setChatOpen(chatOpen === true ? false : true)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, setHulpOpen, setChatOpen, chatOpen, isStaff])

  return (
    <Dialog open={hulpOpen} onClose={() => setHulpOpen(false)} title={t('menu.sneltoetsen')} width={448}>
      <ul className="je-sneltoetsen">
        {toetsen.map((toets) => (
          <li key={toets.toets}>
            <kbd className="je-kbd">{toets.toets}</kbd>
            <span>{toets.wat}</span>
          </li>
        ))}
      </ul>
      <p className="je-muted-caption" style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 6 }}>
        <Icon name="info" size={14} />
        {t('inst.sneltoets.uitleg')}
      </p>
    </Dialog>
  )
}
