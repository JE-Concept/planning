import { useMemo, useState } from 'react'
import { bestelTekst, bestellijstVoorEvent, keuzeSamenvatting, nodigTekst, perCategorie } from '@lib/formules'
import { Badge, bevestig, Button, Checkbox, Icon, IconButton, Input, Select } from '@components/ds'
import { FORMULE_CATEGORIEEN } from '@lib/formule-templates'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { updateEvent } from '@data/events'

const nieuweId = () => Math.random().toString(36).slice(2, 10)

/**
 * De bestellijst van één event.
 *
 * Ze is bij het aanmaken uit de formule berekend en staat daarna op zichzelf:
 * hier wordt ze afgevinkt, bijgesteld en aangevuld. Dat is met opzet — een
 * bestellijst leeft. De klant belt dat er vier man bijkomen, de slager heeft
 * geen kalfsbrochettes, iemand voegt ijs toe. Zou dit scherm telkens opnieuw
 * uit de formule rekenen, dan was al dat werk bij de eerstvolgende wijziging weg.
 *
 * Herberekenen kan wel, maar op één knop en met een waarschuwing erbij: het
 * gooit de handmatige aanpassingen weg en dat hoort een bewuste daad te zijn.
 */
export default function Bestellijst({ ev }) {
  const { formules, alleFormules } = useWorkspace()
  const { t } = useTaal()
  const toast = useToast()
  const [bezig, setBezig] = useState(false)

  const regels = useMemo(() => ev.bestellijst ?? [], [ev.bestellijst])
  const groepen = useMemo(() => perCategorie(regels), [regels])
  const formule = (alleFormules ?? formules).find((f) => f.id === ev.formuleId) ?? null

  // Waarop de lijst berekend is, tegenover wat er nu op de fiche staat. Vier
  // gasten erbij is precies het moment waarop een bestellijst stil fout gaat.
  const berekendOp = regels.find((r) => r.personen != null)?.personen ?? null
  const verschilt = berekendOp != null && ev.pax != null && Number(ev.pax) !== Number(berekendOp)

  const bewaar = (volgende) => updateEvent(ev.id, { bestellijst: volgende }).catch((err) => toast.error(err.message))
  const zet = (id, patch) => bewaar(regels.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const herbereken = async () => {
    if (!formule) return
    const personen = Number(ev.pax) || berekendOp || 0
    if (!(await bevestig(t('bestellijst.herbereken_vraag', { aantal: personen })))) return
    setBezig(true)
    try {
      await updateEvent(ev.id, { bestellijst: bestellijstVoorEvent(formule, ev.formuleKeuzes ?? {}, personen) })
      toast.success(t('bestellijst.herberekend', { aantal: personen }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const voegToe = () =>
    bewaar([
      ...regels,
      {
        id: nieuweId(),
        item: '',
        categorie: 'Overige',
        eenheid: 'stuks',
        inhoud: 1,
        verpakking: '',
        perPersoon: 0,
        vast: 0,
        personen: berekendOp,
        nodig: 0,
        verpakkingen: 1,
        bestellen: 1,
        // Waar een regel vandaan komt, staat in de bestellijst zelf en gaat
        // mee naar de slager; dat is een gegeven en geen schermtekst.
        bron: ['Met de hand toegevoegd'],
        besteld: false,
      },
    ])

  const klaar = regels.filter((r) => r.besteld).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{ev.formule || t('bestellijst.titel')}</span>
          <span className="je-panel__right">
            {t('bestellijst.besteld', { klaar, totaal: regels.length })}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', padding: 'var(--space-4) var(--space-6)' }}>
          {berekendOp != null ? <Badge>{t('bestellijst.berekend_op', { aantal: berekendOp })}</Badge> : null}
          {formule ? <span className="je-muted-caption">{keuzeSamenvatting(formule, ev.formuleKeuzes ?? {})}</span> : null}
          {formule ? (
            <Button variant="secondary" size="sm" iconLeft="repeat" loading={bezig} style={{ marginLeft: 'auto' }} onClick={herbereken}>
              {t('bestellijst.herberekenen')}
            </Button>
          ) : null}
        </div>
        {verschilt ? (
          <div className="je-formule-waarschuwing">
            <Icon name="alert-triangle" size={16} />
            <span>{t('bestellijst.verschil', { pax: ev.pax, berekend: berekendOp })}</span>
          </div>
        ) : null}
      </div>

      {regels.length === 0 ? (
        <div className="je-panel" style={{ padding: 'var(--space-6)' }}>
          <div className="je-muted-caption">{t('bestellijst.leeg')}</div>
        </div>
      ) : null}

      {groepen.map(({ categorie, items }) => (
        <div key={categorie} className="je-panel">
          <div className="je-panel__head">
            <span className="je-eyebrow">{categorie}</span>
            <span className="je-panel__right">{t('bestellijst.regels', { aantal: items.length })}</span>
          </div>
          {items.map((r) => (
            <div key={r.id} className="je-bestelregel">
              <Checkbox
                checked={Boolean(r.besteld)}
                onChange={() => zet(r.id, { besteld: !r.besteld })}
                aria-label={t('bestellijst.aria_besteld', { item: r.item })}
              />
              <div style={{ flex: 1, minWidth: 160 }}>
                <Input
                  defaultValue={r.item}
                  key={`${r.id}-item`}
                  onBlur={(e) => e.target.value !== r.item && zet(r.id, { item: e.target.value })}
                  aria-label={t('bestellijst.artikel')}
                />
                <div className="je-muted-caption" style={{ marginTop: 2 }}>
                  {[bestelTekst(r), nodigTekst(r), r.bron?.length ? r.bron.join(', ') : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ width: 110 }}>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  key={`${r.id}-aantal`}
                  defaultValue={String(r.bestellen ?? 0)}
                  onBlur={(e) => {
                    const waarde = Math.max(0, Number(e.target.value) || 0)
                    if (waarde !== r.bestellen) zet(r.id, { bestellen: waarde, verpakkingen: Math.ceil(waarde / Math.max(1, r.inhoud || 1)) })
                  }}
                  aria-label={t('bestellijst.aria_aantal', { item: r.item })}
                />
              </div>
              <span className="je-muted-caption" style={{ width: 70 }}>
                {r.eenheid}
              </span>
              <div style={{ width: 130 }}>
                <Select
                  value={r.categorie ?? 'Overige'}
                  onChange={(e) => zet(r.id, { categorie: e.target.value })}
                  options={FORMULE_CATEGORIEEN.map((c) => ({ value: c, label: c }))}
                  aria-label={t('bestellijst.aria_categorie', { item: r.item })}
                />
              </div>
              <IconButton
                icon="x"
                label={t('bestellijst.aria_weg', { item: r.item })}
                size="sm"
                onClick={() => bewaar(regels.filter((x) => x.id !== r.id))}
              />
            </div>
          ))}
        </div>
      ))}

      <div>
        <Button variant="secondary" size="sm" iconLeft="plus" onClick={voegToe}>
          {t('bestellijst.regel_toevoegen')}
        </Button>
      </div>
    </div>
  )
}
