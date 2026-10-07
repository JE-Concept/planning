import { useEffect, useMemo, useRef, useState } from 'react'
import { BTW_TARIEVEN, DEFAULT_FORMULES, FORMULE_CATEGORIEEN } from '@lib/formule-templates'
import { bestelTekst, bestellijstVan, nodigTekst, prijsVan, standaardKeuzes } from '@lib/formules'
import { useNarrow } from '@lib/useNarrow'
import { Badge, bevestig, Button, Field, Icon, IconButton, Input, Select, Switch, Textarea } from '@components/ds'
import { TEMPLATE_ICONS } from '@data/templates'
import {
  createFormule,
  deleteFormule,
  formuleSamenvatting,
  nieuweBestelregel,
  nieuweFormule,
  nieuweKeuze,
  nieuweOptie,
  saveFormule,
} from '@data/formules'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { huidigeLocaleVan } from '@lib/dates'

// Bedragen volgen de gekozen taal, net als de datums: een Engelse pagina met
// een Belgisch komma-bedrag leest als een typfout.
const euro = (bedrag) =>
  new Intl.NumberFormat(huidigeLocaleVan(), { style: 'currency', currency: 'EUR' }).format(Number(bedrag) || 0)

/** De iconen en btw-tarieven zoals ze op het scherm staan; de waarde blijft de waarde. */
const ICOON_SLEUTEL = {
  sparkles: 'inst.icoon.feest',
  users: 'inst.icoon.team',
  utensils: 'inst.icoon.eten',
  'music-4': 'inst.icoon.muziek',
  lightbulb: 'inst.icoon.techniek',
  'calendar-days': 'inst.icoon.kalender',
  'file-text': 'inst.icoon.document',
}

const BTW_SLEUTEL = { 6: 'inst.btw.6', 12: 'inst.btw.12', 21: 'inst.btw.21' }

const getal = (waarde) => (waarde === '' || waarde === null || waarde === undefined ? 0 : Number(waarde) || 0)

/**
 * Formules beheren: prijs per persoon, de vragen die erbij horen, en de
 * bestelregels die uit die antwoorden volgen.
 *
 * Er staat een proefberekening onderaan, en dat is met opzet. Een bestelregel
 * intikken is abstract ("0,4 flessen per persoon, bak van zes"); wat je wil
 * zien is wat dat bij vijftig man aan de leverancier vraagt. Wie zich vergist
 * in de eenheid of de verpakking ziet dat daar meteen, en niet pas op de dag
 * van het event.
 */
export default function FormuleSettings() {
  const { alleFormules, formulesStored, templates } = useWorkspace()
  const { t } = useTaal()
  const toast = useToast()
  const narrow = useNarrow()
  const [sel, setSel] = useState(alleFormules[0]?.id)
  const huidig = alleFormules.find((f) => f.id === sel) ?? alleFormules[0]
  const [draft, setDraft] = useState(huidig)
  const [proef, setProef] = useState('50')
  // Eén slot voor "nieuw" en "dupliceren": ze maken hetzelfde soort document
  // aan, en twee formules die "Winter BBQ (kopie)" heten is opruimwerk voor
  // iemand anders.
  const [bezigMaken, setBezigMaken] = useState(false)
  const vuil = useRef(false)

  useEffect(() => {
    if (!vuil.current) setDraft(huidig)
  }, [huidig])

  // Zolang er niets bewaard is gelden de voorbeeldformules. De eerste wijziging
  // schrijft ze allemaal weg, zodat ze vanaf dan echt in de database bestaan —
  // anders zou een aanpassing aan de ene de andere doen verdwijnen.
  const zorgVoorOpslag = async () => {
    if (formulesStored) return
    await Promise.all(DEFAULT_FORMULES.map((f) => saveFormule(f)))
  }

  useEffect(() => {
    if (!vuil.current || !draft) return undefined
    const t = setTimeout(async () => {
      try {
        await zorgVoorOpslag()
        await saveFormule(draft)
      } catch (err) {
        toast.error(err.message)
      } finally {
        vuil.current = false
      }
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const keuzes = useMemo(() => standaardKeuzes(draft), [draft])
  const personen = Math.max(0, parseInt(proef || '0', 10) || 0)
  const voorbeeld = useMemo(() => (draft ? bestellijstVan(draft, keuzes, personen) : []), [draft, keuzes, personen])
  const prijs = useMemo(() => (draft ? prijsVan(draft, keuzes, personen) : null), [draft, keuzes, personen])

  if (!draft) {
    return (
      <div className="je-panel" style={{ padding: 'var(--space-6)' }}>
        <div className="je-muted-caption">{t('inst.formule.geen')}</div>
      </div>
    )
  }

  const wijzig = (fn) => {
    vuil.current = true
    setDraft((d) => fn(d))
  }
  const zetOptie = (id, patch) =>
    wijzig((d) => ({ ...d, opties: d.opties.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
  const zetKeuze = (optieId, keuzeId, patch) =>
    zetOptie(optieId, {
      keuzes: draft.opties
        .find((o) => o.id === optieId)
        .keuzes.map((k) => (k.id === keuzeId ? { ...k, ...patch } : k)),
    })
  const zetRegel = (id, patch) =>
    wijzig((d) => ({ ...d, bestelregels: d.bestelregels.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))

  const kies = (id) => {
    vuil.current = false
    setSel(id)
  }

  const maakNieuw = async () => {
    if (bezigMaken) return
    setBezigMaken(true)
    try {
      await zorgVoorOpslag()
      kies(await createFormule(nieuweFormule(alleFormules.length)))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezigMaken(false)
    }
  }

  const dupliceer = async () => {
    if (bezigMaken) return
    setBezigMaken(true)
    try {
      await zorgVoorOpslag()
      const { id: _id, ...rest } = draft
      kies(await createFormule({ ...rest, name: `${draft.name} (kopie)`, position: alleFormules.length }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezigMaken(false)
    }
  }

  /**
   * Een formule verwijderen kan, maar archiveren is bijna altijd wat je wil:
   * events die eruit gemaakt zijn dragen hun eigen kopie van prijs en
   * bestellijst, dus die blijven kloppen — alleen kan niemand er nog een nieuw
   * event mee starten.
   */
  const verwijder = async () => {
    if (!(await bevestig(t('inst.formule.verwijder_vraag', { naam: draft.name }), { knop: t('alg.verwijderen'), gevaar: true }))) return
    try {
      await zorgVoorOpslag()
      await deleteFormule(draft.id)
      kies(alleFormules.find((f) => f.id !== draft.id)?.id)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const keuzeOpties = [
    { value: '', label: t('inst.formule.altijd') },
    ...draft.opties.flatMap((o) => (o.keuzes ?? []).map((k) => ({ value: k.id, label: `${o.label}: ${k.label}` }))),
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr)' : '260px minmax(0,1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
      <section className="je-panel">
        {alleFormules.map((f, i) => {
          const aan = f.id === draft.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => kies(f.id)}
              className="je-plainbtn je-hover-quiet"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-5)',
                background: aan ? 'var(--accent-quiet)' : 'transparent',
                borderTop: i ? '1px solid var(--border-hairline)' : 'none',
                borderLeft: `2px solid ${aan ? 'var(--navy-700)' : 'transparent'}`,
                opacity: f.archived ? 0.55 : 1,
              }}
            >
              <span style={{ color: 'var(--text-accent)', display: 'flex' }}>
                <Icon name={f.icon || 'utensils'} size={18} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: 'var(--type-body-sm)', fontWeight: 600 }}>
                  {aan ? draft.name : f.name}
                </span>
                <span className="je-muted-caption" style={{ display: 'block' }}>
                  {formuleSamenvatting(aan ? draft : f)}
                </span>
              </span>
            </button>
          )
        })}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-hairline)' }}>
          <Button variant="secondary" size="sm" iconLeft="plus" block onClick={maakNieuw} loading={bezigMaken}>
            {t('inst.formule.nieuwe')}
          </Button>
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <section className="je-panel">
          <div className="je-formule-kop">
            <div style={{ flex: 1, minWidth: 200 }}>
              <Field label={t('inst.formule.naam')}>
                <Input value={draft.name} onChange={(e) => wijzig((d) => ({ ...d, name: e.target.value }))} />
              </Field>
            </div>
            <div style={{ width: 140 }}>
              <Field label={t('inst.tpl.icoon')}>
                <Select
                  options={TEMPLATE_ICONS.map(([value, label]) => ({
                    value,
                    label: t(ICOON_SLEUTEL[value] ?? label),
                  }))}
                  value={draft.icon}
                  onChange={(e) => wijzig((d) => ({ ...d, icon: e.target.value }))}
                />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <IconButton icon="copy" label={t('inst.tpl.dupliceren')} variant="outline" onClick={dupliceer} disabled={bezigMaken} />
              <IconButton icon="trash-2" label={t('alg.verwijderen')} variant="outline" onClick={verwijder} />
            </div>
          </div>

          <div className="je-formule-kop">
            <div style={{ width: 150 }}>
              <Field label={t('inst.formule.prijs_pp')} hint={t('inst.formule.excl_btw')}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(draft.prijsPerPersoon ?? 0)}
                  onChange={(e) => wijzig((d) => ({ ...d, prijsPerPersoon: getal(e.target.value) }))}
                />
              </Field>
            </div>
            <div style={{ width: 150 }}>
              <Field label={t('inst.formule.vaste_kost')} hint={t('inst.formule.ongeacht')}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(draft.prijsVast ?? 0)}
                  onChange={(e) => wijzig((d) => ({ ...d, prijsVast: getal(e.target.value) }))}
                />
              </Field>
            </div>
            <div style={{ width: 230 }}>
              <Field label={t('inst.formule.btw_tarief')}>
                <Select
                  options={BTW_TARIEVEN.map((b) => ({
                    value: String(b.value),
                    label: t(BTW_SLEUTEL[b.value] ?? b.label),
                  }))}
                  value={String(draft.btwPercent ?? 12)}
                  onChange={(e) => wijzig((d) => ({ ...d, btwPercent: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <div style={{ width: 190 }}>
              <Field label={t('inst.formule.taken_template')}>
                <Select
                  options={templates.map((tp) => ({ value: tp.id, label: tp.name }))}
                  value={draft.templateId ?? ''}
                  onChange={(e) => wijzig((d) => ({ ...d, templateId: e.target.value }))}
                />
              </Field>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingBottom: 6 }}>
              <Switch
                checked={!draft.archived}
                onChange={() => wijzig((d) => ({ ...d, archived: !d.archived }))}
                aria-label={t('inst.formule.actief_label')}
              />
              <span className="je-muted-caption">
                {draft.archived ? t('inst.formule.gearchiveerd') : t('inst.formule.actief')}
              </span>
            </div>
          </div>

          <div style={{ padding: '0 var(--space-6) var(--space-5)' }}>
            <Field label={t('inst.formule.omschrijving')} hint={t('inst.formule.omschrijving_hint')}>
              <Textarea
                rows={2}
                value={draft.omschrijving ?? ''}
                onChange={(e) => wijzig((d) => ({ ...d, omschrijving: e.target.value }))}
              />
            </Field>
          </div>
        </section>

        <section className="je-panel">
          <div className="je-panel__head">
            <span className="je-eyebrow">{t('inst.formule.vragen')}</span>
            <span className="je-panel__sub">{t('inst.formule.vragen_sub')}</span>
          </div>

          {draft.opties.map((optie, i) => (
            <div key={optie.id} className="je-formule-optie" style={{ borderTop: i ? '1px solid var(--border-hairline)' : 'none' }}>
              <div className="je-formule-kop" style={{ padding: 0 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Field label={t('inst.formule.vraag')}>
                    <Input value={optie.label} onChange={(e) => zetOptie(optie.id, { label: e.target.value })} />
                  </Field>
                </div>
                <div style={{ width: 230 }}>
                  <Field label={t('inst.formule.btw_meerprijs')}>
                    <Select
                      value={optie.btwPercent == null ? '' : String(optie.btwPercent)}
                      onChange={(e) => zetOptie(optie.id, { btwPercent: e.target.value === '' ? null : Number(e.target.value) })}
                      options={[
                        { value: '', label: t('inst.formule.btw_zoals', { percent: draft.btwPercent ?? 12 }) },
                        ...BTW_TARIEVEN.map((b) => ({
                          value: String(b.value),
                          label: t(BTW_SLEUTEL[b.value] ?? b.label),
                        })),
                      ]}
                    />
                  </Field>
                </div>
                <div style={{ paddingBottom: 4 }}>
                  <IconButton
                    icon="x"
                    label={t('inst.formule.vraag_verwijderen')}
                    size="sm"
                    onClick={() =>
                      wijzig((d) => ({
                        ...d,
                        opties: d.opties.filter((o) => o.id !== optie.id),
                        // Bestelregels die aan een verdwenen antwoord hingen
                        // zouden anders nooit meer meetellen en ook nergens meer
                        // te zien zijn: die gaan mee weg.
                        bestelregels: d.bestelregels.filter(
                          (r) => !r.keuzeId || !(optie.keuzes ?? []).some((k) => k.id === r.keuzeId)
                        ),
                      }))
                    }
                  />
                </div>
              </div>

              {(optie.keuzes ?? []).map((k) => (
                <div key={k.id} className="je-formule-keuze">
                  <Input
                    value={k.label}
                    onChange={(e) => zetKeuze(optie.id, k.id, { label: e.target.value })}
                    aria-label={t('inst.formule.antwoord')}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={String(k.prijsPerPersoon ?? 0)}
                    onChange={(e) => zetKeuze(optie.id, k.id, { prijsPerPersoon: getal(e.target.value) })}
                    aria-label={t('inst.formule.meerprijs_pp', { antwoord: k.label })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={String(k.prijsVast ?? 0)}
                    onChange={(e) => zetKeuze(optie.id, k.id, { prijsVast: getal(e.target.value) })}
                    aria-label={t('inst.formule.meerprijs_vast', { antwoord: k.label })}
                  />
                  <IconButton
                    icon="x"
                    label={t('inst.formule.antwoord_verwijderen')}
                    size="sm"
                    disabled={(optie.keuzes ?? []).length <= 1}
                    onClick={() =>
                      zetOptie(optie.id, { keuzes: optie.keuzes.filter((x) => x.id !== k.id) })
                    }
                  />
                </div>
              ))}
              <div className="je-formule-keuze je-formule-keuze--kop je-muted-caption">
                <span>{t('inst.formule.antwoord')}</span>
                <span>{t('inst.formule.per_persoon')}</span>
                <span>{t('inst.formule.vast')}</span>
                <span />
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft="plus"
                onClick={() => zetOptie(optie.id, { keuzes: [...(optie.keuzes ?? []), nieuweKeuze('Nieuw antwoord')] })}
              >
                {t('inst.formule.antwoord_toevoegen')}
              </Button>
            </div>
          ))}

          <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-hairline)' }}>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="plus"
              onClick={() => wijzig((d) => ({ ...d, opties: [...d.opties, nieuweOptie()] }))}
            >
              {t('inst.formule.vraag_toevoegen')}
            </Button>
          </div>
        </section>

        <section className="je-panel">
          <div className="je-panel__head">
            <span className="je-eyebrow">{t('inst.formule.bestelregels')}</span>
            <span className="je-panel__sub">{t('inst.formule.bestelregels_sub')}</span>
          </div>

          <div className="je-formule-regel je-formule-regel--kop je-muted-caption">
            <span>{t('inst.formule.artikel')}</span>
            <span>{t('inst.formule.categorie')}</span>
            <span>{t('inst.formule.eenheid')}</span>
            <span>{t('inst.formule.pp_kort')}</span>
            <span>{t('inst.formule.vast_kort')}</span>
            <span>{t('inst.formule.per_verpakking')}</span>
            <span>{t('inst.formule.verpakking')}</span>
            <span>{t('inst.formule.inkoop_kort')}</span>
            <span>{t('inst.formule.leverancier')}</span>
            <span>{t('inst.formule.hoort_bij')}</span>
            <span />
          </div>

          {draft.bestelregels.map((r) => (
            <div key={r.id} className="je-formule-regel">
              <Input value={r.item} onChange={(e) => zetRegel(r.id, { item: e.target.value })} aria-label={t('inst.formule.artikel')} />
              <Select
                value={r.categorie ?? 'Keuken'}
                onChange={(e) => zetRegel(r.id, { categorie: e.target.value })}
                options={FORMULE_CATEGORIEEN.map((c) => ({ value: c, label: c }))}
                aria-label={t('inst.formule.categorie')}
              />
              <Input value={r.eenheid ?? ''} onChange={(e) => zetRegel(r.id, { eenheid: e.target.value })} aria-label={t('inst.formule.eenheid')} />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={String(r.perPersoon ?? 0)}
                onChange={(e) => zetRegel(r.id, { perPersoon: getal(e.target.value) })}
                aria-label={t('inst.formule.per_persoon_label')}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={String(r.vast ?? 0)}
                onChange={(e) => zetRegel(r.id, { vast: getal(e.target.value) })}
                aria-label={t('inst.formule.vaste_hoeveelheid')}
              />
              <Input
                type="number"
                step="1"
                min="1"
                value={String(r.inhoud ?? 1)}
                onChange={(e) => zetRegel(r.id, { inhoud: Math.max(1, getal(e.target.value)) })}
                aria-label={t('inst.formule.eenheden_verpakking')}
              />
              <Input
                value={r.verpakking ?? ''}
                onChange={(e) => zetRegel(r.id, { verpakking: e.target.value })}
                aria-label={t('inst.formule.verpakking_naam')}
              />
              {/*
                De inkoopprijs per besteleenheid. Leeg is "nog niet gekend" en
                niet "gratis": `lib/marge.js` laat zo'n regel buiten de kost en
                meldt haar, want een ontbrekende prijs die als nul meetelt
                maakt elke marge te mooi.
              */}
              <Input
                type="number"
                step="0.01"
                min="0"
                value={r.inkoopprijs ?? ''}
                onChange={(e) => zetRegel(r.id, { inkoopprijs: e.target.value === '' ? null : getal(e.target.value) })}
                aria-label={t('inst.formule.inkoopprijs')}
              />
              <Input
                value={r.leverancier ?? ''}
                onChange={(e) => zetRegel(r.id, { leverancier: e.target.value })}
                aria-label={t('inst.formule.leverancier')}
              />
              <Select
                value={r.keuzeId ?? ''}
                onChange={(e) => zetRegel(r.id, { keuzeId: e.target.value || null })}
                options={keuzeOpties}
                aria-label={t('inst.formule.hoort_bij_label')}
              />
              <IconButton
                icon="x"
                label={t('inst.formule.regel_verwijderen')}
                size="sm"
                onClick={() => wijzig((d) => ({ ...d, bestelregels: d.bestelregels.filter((x) => x.id !== r.id) }))}
              />
            </div>
          ))}

          <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-hairline)' }}>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="plus"
              onClick={() => wijzig((d) => ({ ...d, bestelregels: [...d.bestelregels, nieuweBestelregel()] }))}
            >
              {t('inst.formule.regel_toevoegen')}
            </Button>
          </div>
        </section>

        <section className="je-panel">
          <div className="je-panel__head">
            <span className="je-eyebrow">{t('inst.formule.proef')}</span>
            <span className="je-panel__sub">{t('inst.formule.proef_sub')}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-5)', padding: 'var(--space-4) var(--space-6)' }}>
            <div style={{ width: 130 }}>
              <Field label={t('inst.formule.aantal_personen')}>
                <Input type="number" min="0" step="1" value={proef} onChange={(e) => setProef(e.target.value)} />
              </Field>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
              <Badge tone="accent">{t('inst.formule.excl', { bedrag: euro(prijs.exclBtw) })}</Badge>
              {prijs.btwRegels.map((b) => (
                <Badge key={b.percent}>
                  {t('inst.formule.btw_regel', { percent: b.percent, bedrag: euro(b.btw) })}
                </Badge>
              ))}
              <Badge tone="success">{t('inst.formule.incl', { bedrag: euro(prijs.inclBtw) })}</Badge>
            </div>
          </div>
          {voorbeeld.map((r, i) => (
            <div
              key={r.id ?? `${r.item}-${i}`}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-6)',
                borderTop: '1px solid var(--border-hairline)',
              }}
            >
              <span style={{ flex: 1, minWidth: 160, font: 'var(--type-body-sm)' }}>{r.item}</span>
              <span className="je-muted-caption">{r.categorie}</span>
              <strong style={{ font: 'var(--type-body-sm)' }}>{bestelTekst(r)}</strong>
              <span className="je-muted-caption" style={{ width: 150, textAlign: 'right' }}>
                {nodigTekst(r) ?? ''}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
