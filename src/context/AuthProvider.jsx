import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth, db, googleProvider, isConfigured } from '@lib/firebase'
import { normalise } from '@lib/collections'

const AuthContext = createContext(null)

const functions = getFunctions(app, 'europe-west1')

/**
 * Sign-in states the UI actually has to distinguish:
 *   loading        — we do not know yet
 *   signed-out     — nobody is here
 *   denied         — a Google account signed in but has no access
 *   ready          — signed in with a profile
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState(isConfigured ? 'loading' : 'misconfigured')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isConfigured) return undefined

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setState('signed-out')
        return
      }

      try {
        // The function is the gate: it checks the invite list and the allowed
        // domains, and only then writes the profile the rules look for.
        await httpsCallable(functions, 'ensureProfile')()
      } catch (err) {
        // `functions/not-found` betekent dat ensureProfile niet is uitgerold —
        // een uitrolfout, geen toegangsfout. Dat onderscheid hoort zichtbaar te
        // zijn, anders zoekt iedereen naar een uitnodiging die niets oplost.
        setError(
          err?.code === 'functions/not-found'
            ? 'De functie ensureProfile is niet uitgerold. Draai "Go live" met "alles".'
            : `${err?.code ? `[${err.code}] ` : ''}${err?.message || 'Aanmelden is niet gelukt.'}`
        )
        setProfile(null)
        setState('denied')
        return
      }

      setState('loading')
    })
  }, [])

  // The profile doc drives the session: deactivate somebody and their browser
  // drops to the "no access" screen without a redeploy or a re-login.
  useEffect(() => {
    if (!user) return undefined

    return onSnapshot(
      doc(db, 'profiles', user.uid),
      (snap) => {
        if (!snap.exists() || snap.data().active === false) {
          setProfile(null)
          setState('denied')
          return
        }
        setProfile(normalise({ id: snap.id, ...snap.data() }))
        setError(null)
        setState('ready')
      },
      () => setState('denied')
    )
  }, [user])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') return
      setError(err?.message || 'Aanmelden is niet gelukt.')
    }
  }, [])

  const logOut = useCallback(async () => {
    await signOut(auth)
    setProfile(null)
    setError(null)
  }, [])

  const value = useMemo(
    () => ({
      state,
      user,
      profile,
      error,
      signIn,
      logOut,
      uid: user?.uid ?? null,
      isAdmin: profile?.role === 'owner' || profile?.role === 'admin',
      /** Personeel: alleen de openings- en sluitingslijst, verder niets. */
      isStaff: profile?.role === 'staff',
    }),
    [state, user, profile, error, signIn, logOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth moet binnen <AuthProvider> gebruikt worden.')
  return ctx
}
