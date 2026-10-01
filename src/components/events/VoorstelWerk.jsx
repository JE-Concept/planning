import { SOORT_KEYS, ontbreektInVoorstel, prijsVan, sorteer } from '@lib/voorstel'
import { Button, Icon, IconButton, Input, Select, Textarea } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { stelVoorstelVoor, voegOnderdeelToe, wijzigOnderdeel, wisOnderdeel } from '@data/offertes'

/**
 * Het conceptvoorstel bewerken.
 *
 * ── Waarom dit naast de offerteregels staat en niet erin ──────────────────
 * Het zijn twee verschillende vragen. De regels beantwoorden "wat rekenen we
 * aan", het voorstel beantwoordt "wat krijgt de klant". Dezelfde cijfers,
 * andere taal. Ze in één tabel persen zou betekenen dat iemand die een zin
 * herschrijft, per ongeluk een btw-tarief aanraakt.
 *
 * ── Waarom er geen prijsveld verplicht is ─────────────────────────────────
 * Een onderdeel zonder eigen prijs haalt die uit de offerteregels van dezelfde
 * rubriek. Dat is het normale geval: de drankenpagina kost wat de drankenlijn
 * kost. Het veld staat er voor het andere geval — een ontvangst en een
 * hoofdgerecht die allebei onder catering vallen maar elk hun eigen prijs op
 * de pagina krijgen.
 *
 * ── Bewaren bij het verlaten van het veld ─────────────────────────────────
 * Net als op de fiche. Bij elke toetsaanslag bewaren zou van één alinea
 * tweehonderd schrijfbeurten maken, en een voorstel wordt met alinea's
 * geschreven, niet met letters.
 */
export default function VoorstelWerk({ offerte, ev }) {
  const { t } = useTaal()
  const { uid } = useAuth()
  const toast = useToast()

  const onderdelen = sorteer(offerte?.onderdelen ?? [])
  const regels = offerte?.regels ?? []
  const mist = ontbreektInVoorstel(onderdelen, regels)

  const fout = (err) => toast.error(err.message)

  return (
    <div className="je-panel je-offertewerk">
      <div className="je-offertewerk__kop">
        <span className="je-caps">{t('voorstel.kop')}</span>
        <span className="je-muted-caption">{t('voorstel.uitleg')}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-3)' }}>
          <Button
            variant="ghost"
            size="sm"
            iconLeft="refresh-cw"
            title={t('voorstel.opnieuw_uitleg')}
            onClick={() => stelVoorstelVoor(offerte, ev, uid).catch(fout)}
          >
            {t('voorstel.opnieuw')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft="plus"
            onClick={() => voegOnderdeelToe(offerte, { soort: 'extra' }, uid).catch(fout)}
          >
            {t('voorstel.onderdeel_erbij')}
          </Button>
        </span>
      </div>

      {mist.length ? (
        <p className="je-offertewerk__mist">
          <Icon name="info" size={14} />
          {mist.map((sleutel) => t(sleutel)).join(' ')}
        </p>
      ) : null}

      {onderdelen.length === 0 ? (
        <p className="je-muted-caption" style={{ padding: 'var(--space-5)' }}>{t('voorstel.leeg')}</p>
      ) : null}

      {onderdelen.map((onderdeel) => (
        <OnderdeelRij
          key={onderdeel.id}
          offerte={offerte}
          onderdeel={onderdeel}
          afgeleid={prijsVan({ ...onderdeel, perPersoon: null }, regels)}
          uid={uid}
          t={t}
          fout={fout}
        />
      ))}
    </div>
  )
}

function OnderdeelRij({ offerte, onderdeel, afgeleid, uid, t, fout }) {
  const zet = (velden) => wijzigOnderdeel(offerte, onderdeel.id, velden, uid).catch(fout)

  return (
    <div className="je-voorstelrij">
      <div className="je-voorstelrij__kop">
        <Select
          aria-label={t('voorstel.veld.soort')}
          value={onderdeel.soort}
          onChange={(e) => zet({ soort: e.target.value })}
          options={SOORT_KEYS.map((k) => ({ value: k, label: t(`voorstel.soort.${k}`) }))}
        />
        <Input
          defaultValue={onderdeel.titel}
          aria-label={t('voorstel.veld.titel')}
          placeholder={t('voorstel.veld.titel')}
          onBlur={(e) => e.target.value !== onderdeel.titel && zet({ titel: e.target.value })}
        />
        <Input
          defaultValue={onderdeel.accent}
          aria-label={t('voorstel.veld.accent')}
          placeholder={t('voorstel.veld.accent')}
          title={t('voorstel.veld.accent_hulp')}
          onBlur={(e) => e.target.value !== onderdeel.accent && zet({ accent: e.target.value })}
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          defaultValue={onderdeel.perPersoon ?? ''}
          aria-label={t('voorstel.veld.prijs')}
          placeholder={afgeleid == null ? t('voorstel.veld.prijs') : String(afgeleid)}
          title={t('voorstel.veld.prijs_hulp')}
          onBlur={(e) => {
            const waarde = e.target.value === '' ? null : Number(e.target.value)
            if (waarde !== onderdeel.perPersoon) zet({ perPersoon: waarde })
          }}
        />
        <IconButton
          icon="trash-2"
          variant="ghost"
          label={t('voorstel.onderdeel_weg')}
          onClick={() => wisOnderdeel(offerte, onderdeel.id, uid).catch(fout)}
        />
      </div>

      <Textarea
        rows={3}
        defaultValue={onderdeel.tekst}
        aria-label={t('voorstel.veld.tekst')}
        placeholder={t('voorstel.veld.tekst')}
        onBlur={(e) => e.target.value !== onderdeel.tekst && zet({ tekst: e.target.value })}
      />

      <Textarea
        rows={2}
        defaultValue={onderdeel.punten.join('\n')}
        aria-label={t('voorstel.veld.punten')}
        placeholder={t('voorstel.veld.punten_hulp')}
        onBlur={(e) => {
          const punten = e.target.value.split('\n').map((p) => p.trim()).filter(Boolean)
          if (punten.join('\n') !== onderdeel.punten.join('\n')) zet({ punten })
        }}
      />
    </div>
  )
}
