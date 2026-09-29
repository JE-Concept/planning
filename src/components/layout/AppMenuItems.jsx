import { useEffect, useState } from 'react'
import { meldingsrecht, pushIngesteld, pushMogelijk, pushStaatAan, zetPushAan, zetPushUit } from '@lib/push'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'

/**
 * De twee dingen die alleen op jouw toestel gelden: de app installeren en
 * meldingen aanzetten.
 *
 * Ze staan in het accountmenu en niet in Instellingen, want dat is per persoon
 * en per toestel — en personeel komt niet in Instellingen, terwijl net zij een
 * melding willen als de sluitlijst nog open staat.
 */

const item =
  'w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-50'

export function InstallMenuItem() {
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    const onPrompt = (e) => {
      // Chrome toont zijn eigen balk maar één keer en onthoudt dat je hem
      // wegklikte; zo staat de knop er altijd nog.
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setPrompt(null))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!prompt) return null

  return (
    <button
      type="button"
      role="menuitem"
      className={item}
      onClick={async () => {
        prompt.prompt()
        await prompt.userChoice
        setPrompt(null)
      }}
    >
      Installeren op dit toestel
    </button>
  )
}

export function PushMenuItem() {
  const { profile } = useAuth()
  const toast = useToast()
  const [aan, setAan] = useState(false)
  const [bezig, setBezig] = useState(false)

  useEffect(() => setAan(pushStaatAan()), [])

  if (!pushMogelijk()) return null

  const geweigerd = meldingsrecht() === 'denied'

  const klik = async () => {
    setBezig(true)
    try {
      if (aan) {
        await zetPushUit()
        setAan(false)
        toast.success('Meldingen staan uit op dit toestel.')
      } else {
        const uitkomst = await zetPushAan(profile?.id)
        setAan(uitkomst.ok)
        if (uitkomst.ok) toast.success('Meldingen staan aan op dit toestel.')
        else if (uitkomst.reden === 'geweigerd') {
          // Alleen de gebruiker kan dit terugdraaien; de app mag het niet
          // opnieuw vragen, dus zeggen we waar het staat.
          toast.error('De browser blokkeert meldingen. Zet ze aan bij de site-instellingen.')
        } else if (uitkomst.reden === 'niet-ingesteld') {
          toast.error('Meldingen zijn nog niet ingesteld voor deze installatie.')
        } else if (uitkomst.reden !== 'afgebroken') {
          toast.error('Meldingen lukken niet op dit toestel.')
        }
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={item}
      disabled={bezig || geweigerd || !pushIngesteld()}
      onClick={klik}
      title={
        geweigerd
          ? 'De browser blokkeert meldingen voor deze site.'
          : pushIngesteld()
            ? undefined
            : 'Nog niet ingesteld voor deze installatie.'
      }
    >
      {aan ? 'Meldingen uitzetten' : 'Meldingen aanzetten'}
    </button>
  )
}

/**
 * Welke berichten je wil ontvangen.
 *
 * Staat hier en niet in Instellingen, om dezelfde reden als de knop erboven:
 * Instellingen is van de beheerders, terwijl dit van iedereen persoonlijk is.
 * Het verschil met de knop erboven is dat die over dít toestel gaat en deze
 * over jou — vandaar twee regels en niet één.
 *
 * Alleen de knop: het venster zelf hangt buiten dit menu, want het menu klapt
 * dicht zodra je erop klikt en nam het venster anders meteen weer mee.
 */
export function MeldingsVoorkeurenMenuItem({ onOpen }) {
  return (
    <button type="button" role="menuitem" className={item} onClick={onOpen}>
      Welke meldingen ik krijg
    </button>
  )
}
