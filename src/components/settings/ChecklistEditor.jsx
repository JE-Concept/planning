import { useMemo, useState } from 'react'
import { huidigeLocaleVan } from '@lib/dates'
import { herhalingProbleem, herhalingUitleg, herhalingVan, herhalingVoor } from '@lib/checklist-herhaling'
import {
  AFDELINGEN,
  HERHALINGEN,
  WEEKDAGEN,
  VELDSOORTEN,
  afdelingLabel,
  nieuwPuntId,
  repeatLabel,
} from '@lib/checklist-templates'
import { Badge, Button, ConfirmButton, Field, Input, Select, Spinner } from '@ui/index'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import {
  archiveChecklist,
  createChecklist,
  restoreChecklist,
  updateChecklist,
  useChecklists,
} from '@data/checklists'

/**
 * De dagelijkse lijsten beheren.
 *
 * Openen, sluiten, de FAVV-controles en het poetsplan staan in de app, maar ze
 * veranderen: een nieuw toestel, een andere leverancier, een controle die
 * erbij komt. Dat hoort niet via een uitrol te gaan.
 *
 * Twee dingen bepalen wat iemand 's ochtends te zien krijgt, en daarom staan ze
 * hier naast elk punt:
 *   wie  — iedereen, of alleen de keuken, de zaal of de verantwoordelijke
 *   wanneer — elke dag, bepaalde dagen, of eens per maand, kwartaal of jaar
 *
 * Wat er niet verandert is de id van een punt. Daar hangen de afvinkingen van
 * vandaag en van alle vorige dagen aan; een tekst bijschaven mag die dus nooit
 * meeslepen. Nieuwe punten krijgen er een op basis van hun tekst, oude houden
 * de hunne.
 */
/**
 * De keuzelijsten zoals ze op het scherm staan.
 *
 * De sleutels blijven wat ze in de database zijn — `who`, `kind`, het nummer
 * van de weekdag — want daar hangen de afvinkingen en de berekening aan. Wat
 * je leest hangt aan de taal.
 */
const AFDELING_SLEUTEL = {
  iedereen: 'inst.afdeling.iedereen',
  verantwoordelijke: 'inst.afdeling.verantwoordelijke',
  keuken: 'inst.afdeling.keuken',
  zaal: 'inst.afdeling.zaal',
}

const HERHALING_SLEUTEL = {
  dagelijks: 'inst.freq.dagelijks',
  weekdag: 'inst.freq.weekdag',
  wekelijks: 'inst.freq.wekelijks',
  maandelijks: 'inst.freq.maandelijks',
  kwartaal: 'inst.freq.kwartaal',
  jaarlijks: 'inst.freq.jaarlijks',
}

const DAG_SLEUTEL = {
  1: 'inst.dag.ma',
  2: 'inst.dag.di',
  3: 'inst.dag.wo',
  4: 'inst.dag.do',
  5: 'inst.dag.vr',
  6: 'inst.dag.za',
  0: 'inst.dag.zo',
}

const VELDSOORT_SLEUTEL = {
  '': 'inst.veldsoort.geen',
  datum: 'inst.veldsoort.datum',
  getal: 'inst.veldsoort.getal',
}

export default function ChecklistEditor({ isAdmin }) {
  const { checklists, loading } = useChecklists({ includeArchived: true })
  const { t } = useTaal()
  const toast = useToast()
  const [open, setOpen] = useState(null)
  const [nieuweNaam, setNieuweNaam] = useState('')
  // Op slot terwijl het loopt: twee klikken op "Maken" gaven twee lijsten, en
  // die staan dan allebei in de zaal op een tablet.
  const [maken, setMaken] = useState(false)

  const actief = useMemo(() => checklists.find((c) => c.id === open) ?? checklists[0], [checklists, open])

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  const bewaar = (patch) =>
    updateChecklist(actief.id, patch).catch((err) => toast.error(err.message))

  const maakLijst = async (e) => {
    e.preventDefault()
    if (maken) return
    setMaken(true)
    try {
      const id = await createChecklist({ name: nieuweNaam })
      setNieuweNaam('')
      setOpen(id)
      toast.success(t('inst.lijst.aangemaakt'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setMaken(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-ink-600">{t('inst.lijst.uitleg')}</p>

      <div className="flex flex-wrap gap-1.5">
        {checklists.map((lijst) => (
          <Button
            key={lijst.id}
            size="sm"
            variant={lijst.id === actief?.id ? 'primary' : 'secondary'}
            onClick={() => setOpen(lijst.id)}
          >
            {lijst.name}
            {lijst.archived ? t('inst.lijst.uit') : ''}
          </Button>
        ))}
      </div>

      {actief ? (
        <Lijst lijst={actief} isAdmin={isAdmin} onBewaar={bewaar} toast={toast} />
      ) : (
        <p className="card px-4 py-6 text-center text-sm text-ink-500">{t('inst.lijst.geen')}</p>
      )}

      {isAdmin ? (
        <form onSubmit={maakLijst} className="card flex flex-wrap items-end gap-2 p-4">
          <Field label={t('inst.lijst.nieuwe')} className="min-w-[14rem] flex-1">
            <Input
              value={nieuweNaam}
              onChange={(e) => setNieuweNaam(e.target.value)}
              placeholder={t('inst.lijst.nieuwe_plaatshouder')}
              required
            />
          </Field>
          <Button type="submit" variant="primary" size="sm" loading={maken} disabled={maken || !nieuweNaam.trim()}>
            {t('alg.aanmaken')}
          </Button>
        </form>
      ) : null}
    </div>
  )
}

// ─── Eén lijst ──────────────────────────────────────────────────────────────

function Lijst({ lijst, isAdmin, onBewaar, toast }) {
  const { t } = useTaal()
  const secties = lijst.sections ?? []

  const zetSecties = (volgende) => onBewaar({ sections: volgende })

  const zetSectie = (index, patch) =>
    zetSecties(secties.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const zetPunt = (sectieIndex, puntIndex, patch) =>
    zetSectie(sectieIndex, {
      items: secties[sectieIndex].items.map((p, i) => (i === puntIndex ? { ...p, ...patch } : p)),
    })

  const voegPuntToe = (sectieIndex) => {
    const bestaande = secties.flatMap((s) => s.items).map((p) => p.id)
    const punt = {
      id: nieuwPuntId('nieuw punt', bestaande),
      label: '',
      hint: '',
      secret: false,
      who: 'iedereen',
      repeat: { kind: 'dagelijks' },
    }
    zetSectie(sectieIndex, { items: [...secties[sectieIndex].items, punt] })
  }

  const voegSectieToe = () => {
    const bestaande = secties.map((s) => s.id)
    zetSecties([
      ...secties,
      { id: nieuwPuntId('nieuwe groep', bestaande), title: 'Nieuwe groep', items: [] },
    ])
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          defaultValue={lijst.name}
          onBlur={(e) => e.target.value.trim() && onBewaar({ name: e.target.value.trim() })}
          aria-label={t('inst.lijst.naam')}
          className="h-8 max-w-xs text-sm font-semibold"
          disabled={!isAdmin}
        />
        <Select
          value={lijst.kind ?? 'other'}
          onChange={(e) => onBewaar({ kind: e.target.value })}
          aria-label={t('inst.lijst.soort')}
          className="h-8 max-w-[11rem] text-sm"
          disabled={!isAdmin}
        >
          <option value="open">{t('inst.lijst.soort_open')}</option>
          <option value="close">{t('inst.lijst.soort_close')}</option>
          <option value="other">{t('inst.lijst.soort_other')}</option>
        </Select>
        {lijst.archived ? (
          <Badge color="#8593a9" subtle>
            {t('inst.lijst.uit_gebruik')}
          </Badge>
        ) : null}

        {isAdmin ? (
          <div className="ml-auto">
            {lijst.archived ? (
              <Button variant="ghost" size="sm" onClick={() => restoreChecklist(lijst.id)}>
                {t('inst.lijst.terughalen')}
              </Button>
            ) : (
              <ConfirmButton
                variant="ghost"
                size="sm"
                className="text-ink-400"
                question={t('inst.lijst.uit_nemen_vraag')}
                onConfirm={() => archiveChecklist(lijst.id).catch((e) => toast.error(e.message))}
              >
                {t('inst.lijst.uit_nemen')}
              </ConfirmButton>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {secties.map((sectie, si) => (
          <div key={sectie.id} className="rounded-lg border border-ink-200">
            <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
              <Input
                defaultValue={sectie.title}
                onBlur={(e) => e.target.value.trim() && zetSectie(si, { title: e.target.value.trim() })}
                aria-label={t('inst.lijst.groepsnaam')}
                className="h-7 max-w-xs text-xs font-semibold uppercase tracking-wide"
                disabled={!isAdmin}
              />
              <span className="text-xs text-ink-400">{t('inst.lijst.punten', { aantal: sectie.items.length })}</span>
              {isAdmin ? (
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-ink-400"
                  question={t('inst.lijst.groep_weg_vraag')}
                  onConfirm={() => zetSecties(secties.filter((_, i) => i !== si))}
                >
                  {t('inst.lijst.groep_weg')}
                </ConfirmButton>
              ) : null}
            </div>

            <ul className="divide-y divide-ink-100">
              {sectie.items.map((punt, pi) => (
                <li key={punt.id} className="px-3 py-2.5">
                  <Punt
                    punt={punt}
                    isAdmin={isAdmin}
                    onWijzig={(patch) => zetPunt(si, pi, patch)}
                    onWeg={() =>
                      zetSectie(si, { items: sectie.items.filter((_, i) => i !== pi) })
                    }
                  />
                </li>
              ))}
              {sectie.items.length === 0 ? (
                <li className="px-3 py-3 text-sm text-ink-400">{t('inst.lijst.geen_punten')}</li>
              ) : null}
            </ul>

            {isAdmin ? (
              <div className="border-t border-ink-100 px-3 py-2">
                <Button variant="ghost" size="sm" onClick={() => voegPuntToe(si)}>
                  {t('inst.lijst.punt_erbij')}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {isAdmin ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={voegSectieToe}>
          {t('inst.lijst.groep_erbij')}
        </Button>
      ) : null}
    </section>
  )
}

// ─── Eén punt ───────────────────────────────────────────────────────────────

function Punt({ punt, onWijzig, onWeg, isAdmin }) {
  const { t } = useTaal()
  const [open, setOpen] = useState(!punt.label)
  const repeat = herhalingVan(punt)

  // `weekendOnly` is de oude vorm van dit veld. Alleen wissen bij een punt dat
  // het nog draagt; op de rest zou het een sleutel zijn die nergens over gaat.
  const bewaarHerhaling = (volgende) =>
    onWijzig(punt.weekendOnly ? { repeat: volgende, weekendOnly: false } : { repeat: volgende })

  const zetHerhaling = (patch) => bewaarHerhaling({ ...repeat, ...patch })

  // Van soort wisselen bouwt de herhaling opnieuw op in plaats van het nieuwe
  // soort op de oude velden te plakken: alleen wat dit soort gebruikt, met de
  // waarden die je al koos waar ze hetzelfde betekenen.
  const zetSoort = (kind) => bewaarHerhaling(herhalingVoor(kind, repeat))

  const probleem = herhalingProbleem(repeat)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          defaultValue={punt.label}
          onBlur={(e) => onWijzig({ label: e.target.value })}
          placeholder={t('inst.punt.plaatshouder')}
          aria-label={t('inst.punt.omschrijving')}
          className="h-8 min-w-[12rem] flex-1 text-sm"
          disabled={!isAdmin}
        />
        <Badge subtle color="#4A7FC1">
          {t(AFDELING_SLEUTEL[punt.who ?? 'iedereen'] ?? afdelingLabel(punt.who))}
        </Badge>
        <Badge subtle>{repeatLabel(punt)}</Badge>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? t('inst.punt.klaar') : t('inst.punt.wijzigen')}
        </Button>
        {isAdmin ? (
          <ConfirmButton
            variant="ghost"
            size="sm"
            className="text-ink-400"
            question={t('inst.punt.weg_vraag')}
            onConfirm={onWeg}
          >
            {t('inst.punt.weg')}
          </ConfirmButton>
        ) : null}
      </div>

      {open ? (
        <div className="grid gap-2 rounded-lg bg-ink-50 p-3 sm:grid-cols-2">
          <Field label={t('inst.punt.wie')}>
            <Select
              value={punt.who ?? 'iedereen'}
              onChange={(e) => onWijzig({ who: e.target.value })}
              disabled={!isAdmin}
            >
              {AFDELINGEN.map((a) => (
                <option key={a.key} value={a.key}>
                  {t(AFDELING_SLEUTEL[a.key] ?? a.label)}
                </option>
              ))}
            </Select>
          </Field>

          {/* De eerstvolgende keer staat eronder. "Elk kwartaal, de 1e" zegt pas
              iets als je erbij ziet dat dat 1 oktober is — en het is meteen de
              enige manier om te merken dat een keuze nergens op uitkomt. */}
          <Field label={t('inst.punt.hoe_vaak')} hint={probleem ? undefined : herhalingUitleg(repeat)}>
            <Select
              value={repeat.kind}
              onChange={(e) => zetSoort(e.target.value)}
              aria-label={t('inst.punt.hoe_vaak_label')}
              disabled={!isAdmin}
            >
              {HERHALINGEN.map((h) => (
                <option key={h.kind} value={h.kind}>
                  {t(HERHALING_SLEUTEL[h.kind] ?? h.label)}
                </option>
              ))}
            </Select>
            {probleem ? <span className="je-herhaling-fout">{probleem}</span> : null}
          </Field>

          {repeat.kind === 'weekdag' ? (
            <Field label={t('inst.punt.welke_dagen')} className="sm:col-span-2">
              <div className="flex flex-wrap gap-1">
                {WEEKDAGEN.map(({ dag, label }) => {
                  const aan = (repeat.days ?? []).includes(dag)
                  return (
                    <button
                      key={dag}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() =>
                        zetHerhaling({
                          days: aan
                            ? (repeat.days ?? []).filter((d) => d !== dag)
                            : [...(repeat.days ?? []), dag].sort(),
                        })
                      }
                      className={`h-7 w-9 rounded-md border text-xs font-semibold ${
                        aan
                          ? 'border-accent-600 bg-accent-600 text-white'
                          : 'border-ink-200 bg-white text-ink-500'
                      }`}
                    >
                      {t(DAG_SLEUTEL[dag] ?? label)}
                    </button>
                  )
                })}
              </div>
            </Field>
          ) : null}

          {repeat.kind === 'wekelijks' ? (
            <Field label={t('inst.punt.welke_dag')}>
              <Select
                value={repeat.days?.[0] ?? 1}
                onChange={(e) => zetHerhaling({ days: [Number(e.target.value)] })}
                disabled={!isAdmin}
              >
                {WEEKDAGEN.map(({ dag, label }) => (
                  <option key={dag} value={dag}>
                    {t(DAG_SLEUTEL[dag] ?? label)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {['maandelijks', 'kwartaal', 'jaarlijks'].includes(repeat.kind) ? (
            <Field label={t('inst.punt.dag_van_maand')} hint={t('inst.punt.dag_van_maand_hint')}>
              <Input
                type="number"
                min="1"
                max="31"
                value={repeat.dayOfMonth ?? 1}
                onChange={(e) => zetHerhaling({ dayOfMonth: Number(e.target.value) })}
                disabled={!isAdmin}
              />
            </Field>
          ) : null}

          {repeat.kind === 'jaarlijks' ? (
            <Field label={t('inst.punt.maand')}>
              <Select
                value={repeat.month ?? 0}
                onChange={(e) => zetHerhaling({ month: Number(e.target.value) })}
                disabled={!isAdmin}
              >
                {Array.from({ length: 12 }, (_, m) => (
                  <option key={m} value={m}>
                    {/* De maandnaam volgt de gekozen taal; de waarde blijft het nummer. */}
                    {new Intl.DateTimeFormat(huidigeLocaleVan(), { month: 'long' }).format(new Date(2026, m, 1))}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label={t('inst.punt.waarde')} hint={t('inst.punt.waarde_hint')}>
            <Select
              value={punt.veld?.kind ?? ''}
              onChange={(e) =>
                onWijzig({
                  veld: e.target.value
                    ? { kind: e.target.value, label: punt.veld?.label ?? 'Waarde' }
                    : null,
                })
              }
              disabled={!isAdmin}
            >
              {VELDSOORTEN.map((v) => (
                <option key={v.kind} value={v.kind}>
                  {t(VELDSOORT_SLEUTEL[v.kind] ?? v.label)}
                </option>
              ))}
            </Select>
          </Field>

          {punt.veld ? (
            <Field label={t('inst.punt.wat_vraagt')}>
              <Input
                defaultValue={punt.veld.label ?? ''}
                onBlur={(e) => onWijzig({ veld: { ...punt.veld, label: e.target.value } })}
                placeholder={t('inst.punt.wat_vraagt_plaatshouder')}
                disabled={!isAdmin}
              />
            </Field>
          ) : null}

          {/*
            De grens waartussen de meting moet liggen.

            Dit is wat een vinkje niet kan zeggen. "Temperatuur gecontroleerd"
            betekent dat er iemand gekeken heeft; pas met een grens erbij weet je
            of de koelkast koud genoeg was, en dat is wat een controleur vraagt.
            Leeg laten mag: dan wordt er alleen genoteerd, niet beoordeeld. Een
            diepvries heeft een negatieve bovengrens, dus min en max staan er
            allebei los in in plaats van als "hoogstens".
          */}
          {punt.veld?.kind === 'getal' ? (
            <>
              <Field label={t('inst.punt.eenheid')} hint={t('inst.punt.eenheid_hint')}>
                <Input
                  defaultValue={punt.veld.eenheid ?? ''}
                  onBlur={(e) => onWijzig({ veld: { ...punt.veld, eenheid: e.target.value || null } })}
                  placeholder="°C"
                  disabled={!isAdmin}
                />
              </Field>
              <Field label={t('inst.punt.grenzen')} hint={t('inst.punt.grenzen_hint')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Input
                    type="number"
                    step="any"
                    defaultValue={punt.veld.min ?? ''}
                    onBlur={(e) =>
                      onWijzig({ veld: { ...punt.veld, min: e.target.value === '' ? null : Number(e.target.value) } })
                    }
                    aria-label={t('inst.punt.ondergrens', { punt: punt.label })}
                    placeholder={t('inst.punt.min')}
                    disabled={!isAdmin}
                  />
                  <span className="je-muted-caption">{t('inst.punt.tot')}</span>
                  <Input
                    type="number"
                    step="any"
                    defaultValue={punt.veld.max ?? ''}
                    onBlur={(e) =>
                      onWijzig({ veld: { ...punt.veld, max: e.target.value === '' ? null : Number(e.target.value) } })
                    }
                    aria-label={t('inst.punt.bovengrens', { punt: punt.label })}
                    placeholder={t('inst.punt.max')}
                    disabled={!isAdmin}
                  />
                </span>
              </Field>
            </>
          ) : null}

          <Field label={t('inst.punt.toelichting')} className="sm:col-span-2">
            <Input
              defaultValue={punt.hint ?? ''}
              onBlur={(e) => onWijzig({ hint: e.target.value })}
              placeholder={t('inst.punt.toelichting_plaatshouder')}
              disabled={!isAdmin}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(punt.secret)}
              onChange={(e) => onWijzig({ secret: e.target.checked })}
              disabled={!isAdmin}
              className="h-4 w-4 rounded border-ink-300"
            />
            {/* Codes horen niet zomaar op een scherm dat een gast kan meelezen. */}
            {t('inst.punt.code_verborgen')}
          </label>
        </div>
      ) : null}
    </div>
  )
}
