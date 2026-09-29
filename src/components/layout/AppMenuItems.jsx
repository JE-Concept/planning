import { useEffect, useState } from 'react'
import { cn } from '@lib/cn'
import { meldingsrecht, pushIngesteld, pushMogelijk, pushStaatAan, zetPushAan, zetPushUit } from '@lib/push'
import { TALEN } from '@lib/i18n'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
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

/**
 * De taalkeuze.
 *
 * Twee knoppen naast elkaar in plaats van een uitklapmenu: er zijn twee talen,
 * en een menu in een menu is een klik te veel voor een keuze die je één keer
 * maakt. De taal waar je in staat, staat aangeduid — anders weet je na het
 * klikken niet of er iets gebeurd is.
 *
 * De knoppen staan altijd in de eigen taal ("Nederlands", "English") en worden
 * niet vertaald: wie de tool per ongeluk in een taal zette die hij niet leest,
 * moet de weg terug kunnen vinden.
 */
export function TaalMenuItem() {
  const { taal, kies, t } = useTaal()

  return (
    <div className="px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t('taal.titel')}</div>
      <div className="mt-1 flex gap-1">
        {TALEN.map((optie) => (
          <button
            key={optie.code}
            type="button"
            role="menuitemradio"
            aria-checked={optie.code === taal}
            lang={optie.code}
            className={cn(
              'rounded px-2 py-1 text-sm',
              optie.code === taal ? 'bg-ink-100 font-semibold text-ink-900' : 'text-ink-700 hover:bg-ink-50'
            )}
            onClick={() => kies(optie.code)}
          >
            {optie.label}
          </button>
        ))}
      </div>
      <div className="mt-1 text-xs text-ink-400">{t('taal.uitleg')}</div>
    </div>
  )
}

export function InstallMenuItem() {
  const { t } = useTaal()
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
      {t('menu.installeren')}
    </button>
  )
}

export function PushMenuItem() {
  const { profile } = useAuth()
  const { t } = useTaal()
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
        toast.success(t('menu.push_uit'))
      } else {
        const uitkomst = await zetPushAan(profile?.id)
        setAan(uitkomst.ok)
        if (uitkomst.ok) toast.success(t('menu.push_aan'))
        else if (uitkomst.reden === 'geweigerd') {
          // Alleen de gebruiker kan dit terugdraaien; de app mag het niet
          // opnieuw vragen, dus zeggen we waar het staat.
          toast.error(t('menu.push_geblokkeerd'))
        } else if (uitkomst.reden === 'niet-ingesteld') {
          toast.error(t('menu.push_niet_ingesteld'))
        } else if (uitkomst.reden !== 'afgebroken') {
          toast.error(t('menu.push_mislukt'))
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
          ? t('menu.push_geblokkeerd_kort')
          : pushIngesteld()
            ? undefined
            : t('menu.push_niet_ingesteld_kort')
      }
    >
      {aan ? t('menu.push_uitzetten') : t('menu.push_aanzetten')}
    </button>
  )
}

/**
 * De eventdatums in je eigen agenda.
 *
 * Staat naast de meldingen en niet in Instellingen: het is een adres dat van
 * jou alleen is, en Instellingen is van de beheerders. Zelfde reden dat hier
 * alleen de knop staat — het venster hangt buiten dit menu, want het menu klapt
 * dicht zodra je erop klikt.
 */
export function AgendaMenuItem({ onOpen }) {
  const { t } = useTaal()

  return (
    <button type="button" role="menuitem" className={item} onClick={onOpen}>
      {t('kalender.menu')}
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
  const { t } = useTaal()

  return (
    <button type="button" role="menuitem" className={item} onClick={onOpen}>
      {t('menu.welke_meldingen')}
    </button>
  )
}
