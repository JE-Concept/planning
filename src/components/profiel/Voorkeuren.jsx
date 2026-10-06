import { useEffect, useState } from 'react'
import { TALEN } from '@lib/i18n'
import { meldingsrecht, pushIngesteld, pushMogelijk, pushStaatAan, zetPushAan, zetPushUit } from '@lib/push'
import { Acties, Button, Schakelknop } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import MeldingsVoorkeuren from '@components/notifications/MeldingsVoorkeuren'
import AgendaAbonnement from '@components/kalenderfeed/AgendaAbonnement'
import { useInstalleren } from '@lib/installeren'

/**
 * Jouw instellingen: taal, meldingen, agenda, de app op je toestel.
 *
 * ── Waarom dit op je profiel staat en niet in een menu ────────────────────
 * Het hing onder je naam in de zijbalk, en dat menu was een navigatie
 * geworden: zes regels diep, met je taal, twee soorten meldingen, je agenda en
 * afmelden door elkaar. Een menu waar je in moet zoeken is geen menu meer.
 *
 * En het hoort hier: dit zijn allemaal dingen die alleen over jou gaan. Het
 * verschil met Instellingen blijft zoals het was — dat is van de beheerders en
 * geldt voor iedereen, dit is van jou alleen en geldt op jouw toestel.
 *
 * ── Toestel of persoon ───────────────────────────────────────────────────
 * Twee regels over meldingen, en dat is met opzet: de ene zet ze aan op dít
 * toestel, de andere bepaalt welke berichten je überhaupt wil. Wie ze als één
 * ding leest, zet zijn telefoon uit en mist daarna ook zijn mail.
 */
export default function Voorkeuren() {
  const { taal, kies, t } = useTaal()

  const [meldingen, setMeldingen] = useState(false)
  const [agenda, setAgenda] = useState(false)

  return (
    <>
      <section className="je-card je-voorkeuren">
        <h2 style={{ font: 'var(--type-h4)', margin: 0 }}>{t('profiel.voorkeuren')}</h2>

        <div className="je-voorkeur">
          <div>
            <div className="je-voorkeur__naam">{t('taal.titel')}</div>
            <div className="je-muted-caption">{t('taal.uitleg')}</div>
          </div>
          {/*
            Een radiogroep en geen menu meer. Deze knoppen stonden vroeger in
            het menu onder je naam; sinds ze op je profiel staan, is er geen
            menu meer om `menuitemradio` bij te horen, en een menu-item zonder
            menu is precies wat een schermlezer verkeerd voorleest.
          */}
          <div role="radiogroup" aria-label={t('taal.titel')} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {/*
              De knoppen staan altijd in de eigen taal en worden niet vertaald:
              wie de tool per ongeluk in een taal zette die hij niet leest, moet
              de weg terug kunnen vinden.
            */}
            {TALEN.map((optie) => (
              <Schakelknop
                key={optie.code}
                aan={optie.code === taal}
                role="radio"
                aria-pressed={undefined}
                aria-checked={optie.code === taal}
                lang={optie.code}
                onClick={() => kies(optie.code)}
              >
                {optie.label}
              </Schakelknop>
            ))}
          </div>
        </div>

        <PushRegel />

        <div className="je-voorkeur">
          <div>
            <div className="je-voorkeur__naam">{t('menu.welke_meldingen')}</div>
            <div className="je-muted-caption">{t('profiel.welke_meldingen_hint')}</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setMeldingen(true)}>
            {t('profiel.instellen')}
          </Button>
        </div>

        <div className="je-voorkeur">
          <div>
            <div className="je-voorkeur__naam">{t('kalender.menu')}</div>
            <div className="je-muted-caption">{t('profiel.agenda_hint')}</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAgenda(true)}>
            {t('profiel.instellen')}
          </Button>
        </div>

        <InstallRegel />
      </section>

      {meldingen ? <MeldingsVoorkeuren open onClose={() => setMeldingen(false)} /> : null}
      {agenda ? <AgendaAbonnement open onClose={() => setAgenda(false)} /> : null}
    </>
  )
}

/** Meldingen op dít toestel. */
function PushRegel() {
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
        return
      }
      const uitkomst = await zetPushAan(profile?.id)
      setAan(uitkomst.ok)
      if (uitkomst.ok) toast.success(t('menu.push_aan'))
      // Alleen de gebruiker kan een geweigerde melding terugdraaien; de app mag
      // het niet opnieuw vragen, dus zeggen we waar het staat.
      else if (uitkomst.reden === 'geweigerd') toast.error(t('menu.push_geblokkeerd'))
      else if (uitkomst.reden === 'niet-ingesteld') toast.error(t('menu.push_niet_ingesteld'))
      else if (uitkomst.reden !== 'afgebroken') toast.error(t('menu.push_mislukt'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <div className="je-voorkeur">
      <div>
        <div className="je-voorkeur__naam">{t('profiel.push')}</div>
        <div className="je-muted-caption">
          {geweigerd
            ? t('menu.push_geblokkeerd_kort')
            : pushIngesteld()
              ? t('profiel.push_hint')
              : t('menu.push_niet_ingesteld_kort')}
        </div>
      </div>
      {/* Aanzetten is wat dit blok vraagt; uitzetten mag, maar is de tweede keus. */}
      <Acties
        plaats="rij"
        hoofd={aan ? null : { label: t('menu.push_aanzetten'), bezig, uit: geweigerd || !pushIngesteld(), onClick: klik }}
        tweede={aan ? { label: t('menu.push_uitzetten'), bezig, uit: geweigerd || !pushIngesteld(), onClick: klik } : null}
      />
    </div>
  )
}

/**
 * De app op je beginscherm, op het profiel.
 *
 * Dezelfde bron als de balk bovenaan (`@lib/installeren`): die vangt de
 * gebeurtenis op bij het laden, en hier hoeven we er dus niet op te wachten.
 * Dat was het probleem van de vorige versie — deze regel luisterde pas vanaf
 * het moment dat je het profiel opende, en toen was het moment voorbij.
 *
 * Op een iPhone staat hier de weg in plaats van een knop, en wie de app al
 * geïnstalleerd heeft, krijgt dat te horen in plaats van niets.
 */
function InstallRegel() {
  const { t } = useTaal()
  const { kan, apple, alGeopend, installeer } = useInstalleren()

  if (alGeopend) {
    return (
      <div className="je-voorkeur">
        <div>
          <div className="je-voorkeur__naam">{t('menu.installeren')}</div>
          <div className="je-muted-caption">{t('install.al_geopend')}</div>
        </div>
      </div>
    )
  }

  if (!kan) return null

  return (
    <div className="je-voorkeur">
      <div>
        <div className="je-voorkeur__naam">{t('menu.installeren')}</div>
        <div className="je-muted-caption">
          {apple ? t('install.apple_stappen') : t('profiel.installeren_hint')}
        </div>
      </div>
      {apple ? null : (
        <Button size="sm" variant="secondary" iconLeft="download" onClick={installeer}>
          {t('profiel.installeren')}
        </Button>
      )}
    </div>
  )
}
