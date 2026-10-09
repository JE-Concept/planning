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
      {/*
        Bovenaan en niet onderaan. Onderaan staat de voet van elke lade en
        dialoog: "Klant aangemaakt" viel live over de knop Verwijderen van de
        fiche die net openging, precies waar je muis daarna heen gaat. Een
        melding hoort niets te bedekken wat je kunt aanklikken, en bovenaan
        staat nooit een actie die je meteen na het bewaren nodig hebt.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[100] flex flex-col items-center gap-2 px-4"
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
