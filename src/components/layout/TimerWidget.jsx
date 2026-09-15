import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDuration } from '@lib/format'
import { Button, Spinner } from '@ui/index'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { startTimer, stopTimer, useRunningTimer } from '@data/time'

/**
 * The clock in the header. Visible on every screen, because a timer you have
 * to navigate to is a timer people forget to stop.
 */
export default function TimerWidget() {
  const { uid } = useAuth()
  const toast = useToast()
  const { timer, elapsed } = useRunningTimer(uid)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      if (timer) {
        const id = await stopTimer(uid)
        toast.success(id ? `Gestopt — ${formatDuration(elapsed)} geboekt.` : 'Te kort, niets geboekt.')
      } else {
        await startTimer({ uid, description: '' })
        toast.success('Timer loopt.')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {timer ? (
        <Link
          to="/uren"
          className="hidden max-w-[16rem] truncate text-xs text-ink-600 hover:text-ink-900 sm:block"
          title={timer.taskTitle || timer.description || 'Losse tijd'}
        >
          {timer.taskTitle || timer.description || 'Losse tijd'}
        </Link>
      ) : null}

      <Button
        variant={timer ? 'danger' : 'secondary'}
        size="sm"
        onClick={toggle}
        disabled={busy}
        className="tabular-nums"
        aria-label={timer ? 'Timer stoppen' : 'Timer starten'}
      >
        {busy ? <Spinner className="h-3 w-3" /> : <span aria-hidden="true">{timer ? '■' : '▶'}</span>}
        {timer ? formatDuration(elapsed, { withSeconds: true }) : 'Start'}
      </Button>
    </div>
  )
}
