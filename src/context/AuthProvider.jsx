import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth, db, googleProvider, herstelZonderCache, isConfigured } from '@lib/firebase'
import { normalise } from '@lib/collections'

const AuthContext = createContext(null)

const functions = getFunctions(app, 'europe-west1')

/**
 * Sign-in states the UI actually has to distinguish:
 *   loading        — we do not know yet
 *   signed-out     — nobody is here
 *   denied         — a Google account signed in but has no access
 *   stuck          — er komt geen antwoord; de cache zit vast
 *   ready          — signed in with a profile
 */

/**
 * Hoe lang we op het profiel wachten voor we het opgeven.
 *
 * Niet omdat het langzaam mag zijn, maar omdat "nooit" bestaat: een vastgelopen
 * cacheslot geeft geen fout en geen antwoord, en dan draait de spinner tot
 * iemand de app weggooit. Twaalf seconden is ruim voor mobiel internet en kort
 * genoeg om niet als kapot te voelen.
 */
const WACHTTIJD_MS = 12000
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

    // Komt er binnen de wachttijd niets, dan is er niets te melden en niets te
    // doen — behalve het zeggen. Zonder deze klok blijft de spinner eeuwig
    // draaien op een cache die op zichzelf wacht.
    const klok = setTimeout(() => {
      setState((huidig) => (huidig === 'ready' ? huidig : 'stuck'))
    }, WACHTTIJD_MS)

    const stop = onSnapshot(
      doc(db, 'profiles', user.uid),
      (snap) => {
        // Een leeg antwoord uit de cache betekent niet "geen lid", het betekent
        // "ik weet het nog niet". Het profiel is net door ensureProfile
        // geschreven, dus de server heeft het; de cache is er alleen nog niet
        // aan toe. Wie dit als een weigering leest, zet de eigenaar van de tool
        // buiten zijn eigen tool — en dat is precies wat er gebeurde.
        if (!snap.exists() && snap.metadata.fromCache) return

        clearTimeout(klok)

        if (!snap.exists() || snap.data().active === false) {
          setProfile(null)
          setState('denied')
          return
        }
        setProfile(normalise({ id: snap.id, ...snap.data() }))
        setError(null)
        setState('ready')
      },
      (err) => {
        clearTimeout(klok)
        setError(`[${err?.code ?? 'firestore'}] ${err?.message ?? 'Je profiel is niet op te halen.'}`)
        setState('denied')
      }
    )

    return () => {
      clearTimeout(klok)
      stop()
    }
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
      herstelZonderCache,
      uid: user?.uid ?? null,
      isAdmin: profile?.role === 'owner' || profile?.role === 'admin',
      /** Personeel: alleen de openings- en sluitingslijst, verder niets. */
      isStaff: profile?.role === 'staff',
      /**
       * De socialrol: alleen de socials.
       *
       * Ze ziet geen bedragen — niet omdat het scherm ze verzwijgt, maar omdat
       * de regels haar de events niet laten lezen. Ze werkt met een kale kopie
       * zonder één bedrag erin. Zie `functions/social-projectie.js`.
       */
      isSocial: profile?.role === 'social',
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
