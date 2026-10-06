import { useState } from 'react'
import { DOELEN, SOORTEN, omschrijf, volgendeKeer } from '@lib/herhaling'
import { formatDate } from '@lib/dates'
import { Acties, Checkbox, GevaarKnop, Input, Select, Textarea } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { bewerkHerhaling, nieuweHerhaling, useHerhalingen, wisHerhaling } from '@data/herhalingen'

const WEEKDAGEN = [1, 2, 3, 4, 5, 6, 7]

/**
 * Werk dat vanzelf terugkomt, ingesteld.
 *
 * ── Waarom hier en niet op het takenbord ──────────────────────────────────
 * Omdat het geen taak is maar een afspraak. Wie op het bord staat te werken,
 * wil zijn taken van vandaag; wie hier komt, komt iets afspreken dat maanden
 * meegaat. Die twee door elkaar zetten, levert een bord op waarop je recepten
 * en gerechten naast elkaar ziet staan.
 *
 * ── Waarom er "volgende keer" bij staat ───────────────────────────────────
 * Omdat dat de enige manier is om te zien of je het goed hebt ingesteld. "Elke
 * maandag" kan iedereen typen; of het ook maandag 6 oktober wordt, is wat
 * iemand wil weten voor hij het scherm sluit.
 */
export default function HerhalingenPaneel() {
  const { t } = useTaal()
  const { uid } = useAuth()
  const toast = useToast()
  const { profiles, lists } = useWorkspace()
  const herhalingen = useHerhalingen()
  const [bezig, setBezig] = useState(false)

  const fout = (err) => toast.error(err.message)

  const erbij = async () => {
    setBezig(true)
    try {
      await nieuweHerhaling({ titel: t('herhaling.nieuwe'), soort: 'wekelijks', dagen: [1] }, uid)
    } catch (err) {
      fout(err)
    } finally {
      setBezig(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <p className="je-muted-caption" style={{ margin: 0, flex: 1 }}>
          {t('herhaling.uitleg')}
        </p>
        <Acties plaats="rij" hoofd={{ label: t('herhaling.erbij'), icon: 'plus', bezig, onClick: erbij }} />
      </div>

      {herhalingen.length === 0 ? (
        <div className="je-panel" style={{ padding: 'var(--space-5)' }}>
          <span className="je-muted-caption">{t('herhaling.leeg')}</span>
        </div>
      ) : null}

      {herhalingen.map((herhaling) => (
        <Rij
          key={herhaling.id}
          herhaling={herhaling}
          profiles={profiles}
          lists={lists}
          uid={uid}
          t={t}
          fout={fout}
        />
      ))}
    </div>
  )
}

function Rij({ herhaling, profiles, lists, uid, t, fout }) {
  const zet = (velden) => bewerkHerhaling(herhaling.id, { ...herhaling, ...velden }, uid).catch(fout)
  const volgende = volgendeKeer(herhaling)

  return (
    <div className="je-panel je-herhaling" data-uit={herhaling.actief === false ? '' : undefined}>
      <div className="je-herhaling__kop">
        <Input
          defaultValue={herhaling.titel}
          aria-label={t('herhaling.veld.titel')}
          onBlur={(e) => e.target.value !== herhaling.titel && zet({ titel: e.target.value })}
        />
        <Select
          aria-label={t('herhaling.veld.doel')}
          value={herhaling.doel ?? 'taak'}
          onChange={(e) => zet({ doel: e.target.value })}
          options={DOELEN.map((d) => ({ value: d, label: t(`herhaling.doel.${d}`) }))}
        />
        <Select
          aria-label={t('herhaling.veld.wie')}
          value={herhaling.profileId ?? ''}
          onChange={(e) => zet({ profileId: e.target.value || null })}
          options={[
            { value: '', label: t('alg.niemand') },
            ...profiles.map((p) => ({ value: p.id, label: p.fullName ?? p.email ?? p.id })),
          ]}
        />
        <GevaarKnop
          size="sm"
          iconLeft="trash-2"
          aria-label={t('herhaling.weg')}
          title={t('herhaling.weg')}
          vraag={t('herhaling.weg_vraag', { titel: herhaling.titel })}
          onConfirm={() => wisHerhaling(herhaling.id).catch(fout)}
        />
      </div>

      <div className="je-herhaling__ritme">
        <Select
          aria-label={t('herhaling.veld.soort')}
          value={herhaling.soort ?? 'wekelijks'}
          onChange={(e) => zet({ soort: e.target.value })}
          options={SOORTEN.map((s) => ({ value: s, label: t(`herhaling.soort.${s}`) }))}
        />

        {herhaling.soort === 'wekelijks' ? (
          <span className="je-herhaling__dagen">
            {WEEKDAGEN.map((dag) => (
              <Checkbox
                key={dag}
                checked={(herhaling.dagen ?? []).includes(dag)}
                label={t(`herhaling.dagkort.${dag}`)}
                onChange={() =>
                  zet({
                    dagen: (herhaling.dagen ?? []).includes(dag)
                      ? herhaling.dagen.filter((d) => d !== dag)
                      : [...(herhaling.dagen ?? []), dag],
                  })
                }
              />
            ))}
          </span>
        ) : null}

        {herhaling.soort === 'maandelijks' ? (
          <Input
            type="number"
            min="1"
            max="28"
            defaultValue={herhaling.dagVanMaand ?? 1}
            aria-label={t('herhaling.veld.dag_van_maand')}
            onBlur={(e) => Number(e.target.value) !== herhaling.dagVanMaand && zet({ dagVanMaand: Number(e.target.value) })}
          />
        ) : null}

        {herhaling.doel === 'social' ? null : (
          <Select
            aria-label={t('herhaling.veld.bord')}
            value={herhaling.listId ?? ''}
            onChange={(e) => zet({ listId: e.target.value || null })}
            options={[
              { value: '', label: t('herhaling.geen_bord') },
              ...lists.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        )}

        <Checkbox
          checked={herhaling.actief !== false}
          label={t('herhaling.actief')}
          onChange={() => zet({ actief: herhaling.actief === false })}
        />
      </div>

      <Textarea
        rows={2}
        defaultValue={herhaling.omschrijving ?? ''}
        aria-label={t('herhaling.veld.omschrijving')}
        placeholder={t('herhaling.veld.omschrijving')}
        onBlur={(e) => e.target.value !== (herhaling.omschrijving ?? '') && zet({ omschrijving: e.target.value })}
      />

      <p className="je-muted-caption" style={{ margin: 0 }}>
        {omschrijf(herhaling)}
        {volgende ? ` · ${t('herhaling.volgende', { datum: formatDate(volgende) })}` : ''}
      </p>
    </div>
  )
}
