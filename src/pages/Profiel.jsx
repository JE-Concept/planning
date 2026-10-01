import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Field, Input } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import Voorkeuren from '@components/profiel/Voorkeuren'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { removeAvatar, updateMyProfile, uploadAvatar } from '@data/profiel'

/**
 * Je eigen profiel.
 *
 * Twee blokken, en het verschil ertussen is wie erover gaat. Bovenaan wat je
 * zelf bepaalt: je naam en je foto. Daaronder wat vastligt — je adres, je rol,
 * je tarief — niet als uitgeschakelde invulvakjes maar als wat het is: gegevens
 * met de mededeling bij wie je moet zijn. Een grijs vakje nodigt uit om te
 * klikken en zegt niets terug.
 *
 * De foto wordt in de browser vierkant geknipt en verkleind voor hij vertrekt;
 * zie `@lib/beeld`.
 */
export default function Profiel() {
  const { uid, profile } = useAuth()
  const { t } = useTaal()
  const toast = useToast()

  const [naam, setNaam] = useState(profile?.fullName ?? '')
  const [bezig, setBezig] = useState(false)
  const [fotoBezig, setFotoBezig] = useState(false)
  const bestand = useRef(null)

  // Het profiel komt binnen via de luisteraar op Firestore. Zolang er niets
  // getypt is volgt het veld die bron; typt er iemand, dan wint wat er staat.
  const [geraakt, setGeraakt] = useState(false)
  useEffect(() => {
    if (!geraakt) setNaam(profile?.fullName ?? '')
  }, [profile?.fullName, geraakt])

  const bewaar = async (e) => {
    e.preventDefault()
    setBezig(true)
    try {
      await updateMyProfile(uid, { fullName: naam })
      setGeraakt(false)
      toast.success(t('profiel.bewaard'))
    } catch (err) {
      // De datalaag geeft een sleutel terug wanneer de tekst bij de taal hoort.
      toast.error(err.message.startsWith('profiel.') ? t(err.message) : err.message)
    } finally {
      setBezig(false)
    }
  }

  const kiesFoto = async (e) => {
    const file = e.target.files?.[0]
    // Het veld meteen leegmaken, anders levert dezelfde foto opnieuw kiezen
    // geen change-gebeurtenis op en lijkt de knop stuk.
    e.target.value = ''
    if (!file) return

    setFotoBezig(true)
    try {
      await uploadAvatar(uid, file)
      toast.success(t('profiel.foto_klaar'))
    } catch (err) {
      toast.error(err.message.startsWith('profiel.') ? t(err.message) : err.message)
    } finally {
      setFotoBezig(false)
    }
  }

  const haalWeg = async () => {
    setFotoBezig(true)
    try {
      await removeAvatar(uid)
      toast.success(t('profiel.foto_weggehaald'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setFotoBezig(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('profiel.eyebrow')} title={t('profiel.titel')} subtitle={t('profiel.uitleg')} />

      {/*
        Twee kolommen op een breed scherm, onder elkaar op een smal. De velden
        zelf blijven leesbaar breed — een naamveld van twee schermbreedtes is
        geen betere naam — maar de pagina laat het scherm niet half leeg.
      */}
      <div className="je-pagebody je-profiel">
        <section className="je-card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Avatar profile={profile} size="xl" />
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft="image"
                  loading={fotoBezig}
                  onClick={() => bestand.current?.click()}
                >
                  {profile?.avatarUrl ? t('profiel.foto_vervangen') : t('profiel.foto_kiezen')}
                </Button>
                {profile?.avatarUrl ? (
                  <Button size="sm" variant="ghost" iconLeft="trash-2" loading={fotoBezig} onClick={haalWeg}>
                    {t('profiel.foto_weg')}
                  </Button>
                ) : null}
              </div>
              <input
                ref={bestand}
                type="file"
                accept="image/*"
                onChange={kiesFoto}
                aria-label={t('profiel.foto')}
                style={{ display: 'none' }}
              />
              <p style={{ font: 'var(--type-caption)', fontWeight: 400, color: 'var(--ink-500)', textAlign: 'center', maxWidth: 220 }}>
                {t('profiel.foto_hint')}
              </p>
            </div>

            <form onSubmit={bewaar} style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Field label={t('profiel.naam')} hint={t('profiel.naam_hint')} htmlFor="profiel-naam">
                <Input
                  id="profiel-naam"
                  value={naam}
                  onChange={(e) => {
                    setGeraakt(true)
                    setNaam(e.target.value)
                  }}
                  maxLength={80}
                />
              </Field>
              <div>
                <Button type="submit" size="sm" loading={bezig} disabled={!naam.trim() || naam.trim() === profile?.fullName}>
                  {t('profiel.bewaren')}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <Voorkeuren />

      </div>
    </div>
  )
}
