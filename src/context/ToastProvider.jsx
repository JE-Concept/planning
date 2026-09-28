import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { cn } from '@lib/cn'

const ToastContext = createContext(null)

const TONES = {
  info: 'bg-navy-dark text-white',
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((all) => all.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, tone = 'info') => {
      counter.current += 1
      const id = counter.current
      setToasts((all) => [...all, { id, message, tone }])
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3500)
    },
    [dismiss]
  )

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={cn(
              'pointer-events-auto max-w-lg rounded-lg px-4 py-2.5 text-sm shadow-lg',
              TONES[t.tone] ?? TONES.info
            )}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast moet binnen <ToastProvider> gebruikt worden.')
  return ctx
}
