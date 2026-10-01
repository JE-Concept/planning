import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '@lib/format'
import { Avatar, Button, Field, Input } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { ROLE_LABEL } from '@components/layout/Sidebar'
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

  const vast = [
    { label: t('profiel.adres'), waarde: profile?.email },
    { label: t('profiel.rol'), waarde: profile?.role ? t(ROLE_LABEL[profile.role] ?? profile.role) : null },
    { label: t('profiel.afdeling'), waarde: profile?.department || t('profiel.geen_afdeling') },
    ...(profile?.hourlyRate ? [{ label: t('profiel.tarief'), waarde: `${formatCurrency(profile.hourlyRate)} / u` }] : []),
  ]

  return (
    <div>
      <PageHeader eyebrow={t('profiel.eyebrow')} title={t('profiel.titel')} subtitle={t('profiel.uitleg')} />

      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 680 }}>
        <section className="je-card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Avatar profile={profile} size="xl" ring />
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

        <section className="je-card" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ font: 'var(--type-h4)', margin: 0 }}>{t('profiel.vast')}</h2>
          <p style={{ font: 'var(--type-body-sm)', color: 'var(--ink-500)', margin: 'var(--space-2) 0 var(--space-4)' }}>
            {t('profiel.vast_uitleg')}
          </p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 'var(--space-3) var(--space-5)', margin: 0 }}>
            {vast.map((r) => (
              <div key={r.label} style={{ display: 'contents' }}>
                <dt style={{ font: 'var(--type-body-sm)', color: 'var(--ink-500)' }}>{r.label}</dt>
                <dd style={{ font: 'var(--type-body-sm)', margin: 0 }}>{r.waarde}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
