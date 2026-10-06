import { useEffect, useState } from 'react'
import { Acties, Badge, Button, Dialog, Field, GevaarKnop, Input, Select, Spinner } from '@components/ds'
import ColumnEditor from '@components/board/ColumnEditor'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  archiveList,
  countTasksPerStatus,
  createBrand,
  createList,
  createSpace,
  countTasksWithTag,
  deleteTag,
  mergeTags,
  updateBrand,
  updateList,
  upsertTag,
} from '@data/workspace'
import { STANDAARD_KLEUR, STANDAARD_MERKKLEUR } from '@lib/kleur'

/**
 * De kolommen van één lijst, geopend vanuit de instellingen.
 *
 * De aantallen per kolom worden hier één keer opgehaald: de editor gebruikt ze
 * om te vragen waar de taken heen moeten als je een kolom weghaalt, en zonder
 * die vraag verdwijnen ze uit beeld.
 */
function Kolommen({ list, onClose }) {
  const { statusesOf } = useWorkspace()
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    let levend = true
    countTasksPerStatus(list.id)
      .then((c) => levend && setCounts(c))
      .catch(() => levend && setCounts({}))
    return () => {
      levend = false
    }
  }, [list.id])

  if (!counts) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    )
  }

  return <ColumnEditor list={list} statuses={statusesOf(list.id)} counts={counts} onClose={onClose} />
}

/**
 * De instellingen van voor het design: ruimtes, lijsten, merken en labels.
 * Ze staan niet in het design, maar de andere borden (Socials, Requirements,
 * Teamoverleg…) hangen ervan af, dus ze blijven beschikbaar als extra tabblad.
 */
export function StructureSettings() {
  const { spaces, lists } = useWorkspace()
  const { t } = useTaal()
  const toast = useToast()
  const [kolommenVan, setKolommenVan] = useState(null)
  const [spaceName, setSpaceName] = useState('')
  const [listDraft, setListDraft] = useState({ spaceId: '', name: '', kind: 'tasks' })

  const addSpace = async (e) => {
    e.preventDefault()
    try {
      await createSpace(spaceName)
      setSpaceName('')
      toast.success(t('inst.struct.ruimte_aangemaakt'))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addList = async (e) => {
    e.preventDefault()
    try {
      await createList(listDraft)
      setListDraft((d) => ({ ...d, name: '' }))
      toast.success(t('inst.struct.lijst_aangemaakt'))
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {kolommenVan ? (
        <Kolommen list={kolommenVan} onClose={() => setKolommenVan(null)} />
      ) : null}

      {spaces.map((space) => (
        <section key={space.id} className="card overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-ink-100 px-4 py-2.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: space.color }}
            />
            <span className="text-sm font-semibold text-ink-900">{space.name}</span>
          </h2>

          <ul className="divide-y divide-ink-100">
            {lists
              .filter((l) => l.spaceId === space.id)
              .map((list) => (
                <li key={list.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <Input
                    defaultValue={list.name}
                    onBlur={(e) =>
                      e.target.value.trim() && updateList(list.id, { name: e.target.value.trim() })
                    }
                    className="h-8 max-w-xs text-sm"
                    aria-label={t('inst.struct.lijstnaam')}
                  />
                  <Badge tone={list.kind === 'social' ? 'accent' : 'neutral'}>
                    {list.kind === 'social' ? t('inst.struct.soort_social') : t('inst.struct.soort_taken')}
                  </Badge>
                  {/* De kolommen van een bord horen bij de inrichting van de
                      ruimte, niet alleen bij het bord zelf: wie hier lijsten
                      aanmaakt, zet er meteen de juiste stappen op. */}
                  {list.kind === 'social' ? null : (
                    <Button variant="ghost" size="sm" onClick={() => setKolommenVan(list)}>
                      {t('inst.struct.kolommen')}
                    </Button>
                  )}
                  {list.archived ? (
                    <Button variant="ghost" size="sm" onClick={() => updateList(list.id, { archived: false })}>
                      {t('inst.struct.terughalen')}
                    </Button>
                  ) : (
                    <GevaarKnop
                      label={t('alg.archiveren')}
                      size="sm"
                      className="ml-auto"
                      vraag={t('inst.struct.archiveer_vraag')}
                      onConfirm={() => archiveList(list.id)}
                    />
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={addSpace} className="card space-y-2 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">{t('inst.struct.nieuwe_ruimte')}</h2>
          <Input
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            placeholder={t('inst.struct.naam')}
            required
          />
          <Acties plaats="rij" hoofd={{ label: t('alg.aanmaken'), type: 'submit', uit: !spaceName.trim() }} />
        </form>

        <form onSubmit={addList} className="card space-y-2 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">{t('inst.struct.nieuwe_lijst')}</h2>
          <Select
            value={listDraft.spaceId}
            onChange={(e) => setListDraft((d) => ({ ...d, spaceId: e.target.value }))}
            required
            aria-label={t('inst.struct.ruimte')}
          >
            <option value="">{t('inst.struct.kies_ruimte')}</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            value={listDraft.name}
            onChange={(e) => setListDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder={t('inst.struct.naam')}
            required
          />
          <Select
            value={listDraft.kind}
            onChange={(e) => setListDraft((d) => ({ ...d, kind: e.target.value }))}
            aria-label={t('inst.struct.soort')}
          >
            <option value="tasks">{t('inst.struct.takenbord')}</option>
            <option value="social">{t('inst.struct.socialcontent')}</option>
          </Select>
          <Acties plaats="rij" hoofd={{ label: t('alg.aanmaken'), type: 'submit', uit: !listDraft.name.trim() || !listDraft.spaceId }} />
        </form>
      </div>
    </div>
  )
}

// ─── Brands and tags ────────────────────────────────────────────────────────

export function BrandSettings() {
  const { brands, tags } = useWorkspace()
  const { t } = useTaal()
  const toast = useToast()
  const [brand, setBrand] = useState({ name: '', key: '', color: STANDAARD_MERKKLEUR })
  const [tag, setTag] = useState({ name: '', color: STANDAARD_KLEUR })
  const [samenvoegen, setSamenvoegen] = useState(null)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card overflow-hidden">
        <h2 className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
          {t('inst.merk.kop')}
        </h2>
        <ul className="divide-y divide-ink-100">
          {brands.map((b) => (
            <li key={b.id} className="flex items-center gap-2 px-4 py-2">
              <input
                type="color"
                value={b.color}
                onChange={(e) => updateBrand(b.id, { color: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded border border-ink-200 p-0.5"
                aria-label={t('inst.merk.kleur_van', { naam: b.name })}
              />
              <Input
                defaultValue={b.name}
                onBlur={(e) => e.target.value.trim() && updateBrand(b.id, { name: e.target.value.trim() })}
                className="h-8 text-sm"
                aria-label={t('inst.merk.naam')}
              />
            </li>
          ))}
        </ul>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await createBrand({
                ...brand,
                key: brand.key || brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              })
              setBrand({ name: '', key: '', color: STANDAARD_MERKKLEUR })
              toast.success(t('inst.merk.toegevoegd'))
            } catch (err) {
              toast.error(err.message)
            }
          }}
          className="flex items-center gap-2 border-t border-ink-100 px-4 py-3"
        >
          <input
            type="color"
            value={brand.color}
            onChange={(e) => setBrand((b) => ({ ...b, color: e.target.value }))}
            className="h-8 w-8 cursor-pointer rounded border border-ink-200 p-0.5"
            aria-label={t('inst.merk.kleur')}
          />
          <Input
            value={brand.name}
            onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
            placeholder={t('inst.merk.nieuw')}
          />
          <Acties plaats="rij" hoofd={{ label: t('alg.toevoegen'), type: 'submit', uit: !brand.name.trim() }} />
        </form>
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
          {t('inst.label.kop')}
        </h2>
        <ul className="flex flex-wrap gap-1.5 p-4">
          {tags.map((label) => (
            <li key={label.id}>
              <span className="inline-flex items-center gap-1">
                <Badge color={label.color}>{label.name}</Badge>
                {/*
                  Samenvoegen staat naast verwijderen omdat het meestal is wat je
                  bedoelt: "je concept" en "jeconcept" zijn hetzelfde label dat
                  twee keer getypt is. Verwijderen laat de taken achter met een
                  naam die nergens meer bij hoort; samenvoegen neemt ze mee.
                */}
                {tags.length > 1 ? (
                  <button
                    type="button"
                    className="je-plainbtn text-[11px] font-medium text-accent-700 underline"
                    onClick={() => setSamenvoegen(label)}
                  >
                    {t('inst.label.samenvoegen')}
                  </button>
                ) : null}
                <GevaarKnop
                  icon="x"
                  size="sm"
                  vraag={t('inst.label.verwijder_vraag', { naam: label.name })}
                  onConfirm={() => deleteTag(label.id)}
                  aria-label={t('inst.label.verwijderen')}
                />
              </span>
            </li>
          ))}
          {tags.length === 0 ? <li className="text-sm text-ink-500">{t('inst.label.geen')}</li> : null}
        </ul>

        {samenvoegen ? (
          <SamenvoegDialoog
            bron={samenvoegen}
            tags={tags}
            onKlaar={() => setSamenvoegen(null)}
            onFout={(bericht) => toast.error(bericht)}
            onGelukt={(aantal) =>
              toast.success(
                aantal === 0
                  ? t('inst.label.samengevoegd_leeg')
                  : t('inst.label.samengevoegd', { aantal })
              )
            }
          />
        ) : null}

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await upsertTag(tag)
              setTag({ name: '', color: STANDAARD_KLEUR })
            } catch (err) {
              toast.error(err.message)
            }
          }}
          className="flex items-center gap-2 border-t border-ink-100 px-4 py-3"
        >
          <input
            type="color"
            value={tag.color}
            onChange={(e) => setTag((vorig) => ({ ...vorig, color: e.target.value }))}
            className="h-8 w-8 cursor-pointer rounded border border-ink-200 p-0.5"
            aria-label={t('inst.merk.kleur')}
          />
          <Input
            value={tag.name}
            onChange={(e) => setTag((vorig) => ({ ...vorig, name: e.target.value }))}
            placeholder={t('inst.label.nieuw')}
          />
          <Acties plaats="rij" hoofd={{ label: t('alg.toevoegen'), type: 'submit', uit: !tag.name.trim() }} />
        </form>
      </section>
    </div>
  )
}


/**
 * Twee labels tot één maken.
 *
 * Het aantal staat erbij voor je klikt. Een samenvoeging raakt taken aan die je
 * niet ziet, en "31 taken verplaatsen" is een ander besluit dan "geen enkele".
 */
function SamenvoegDialoog({ bron, tags, onKlaar, onGelukt, onFout }) {
  const { t } = useTaal()
  const anderen = tags.filter((label) => label.id !== bron.id)
  const [doelId, setDoelId] = useState(anderen[0]?.id ?? '')
  const [aantal, setAantal] = useState(null)
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    let gestopt = false
    countTasksWithTag(bron.name)
      .then((n) => !gestopt && setAantal(n))
      .catch(() => !gestopt && setAantal(null))
    return () => {
      gestopt = true
    }
  }, [bron.name])

  const doel = anderen.find((label) => label.id === doelId)

  const voerUit = async () => {
    if (!doel) return
    setBezig(true)
    try {
      const n = await mergeTags({ vanNaam: bron.name, naarNaam: doel.name, vanId: bron.id })
      onGelukt(n)
      onKlaar()
    } catch (err) {
      onFout(err.message)
      setBezig(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onKlaar}
      title={t('inst.label.samenvoeg_titel', { naam: bron.name })}
      width={384}
      footer={
        <Acties
          terug={{ onClick: onKlaar }}
          hoofd={{ label: t('inst.label.samenvoegen_knop'), onClick: voerUit, bezig, uit: !doel }}
        />
      }
    >
      <div className="grid gap-4">
        <Field label={t('inst.label.wordt')} hint={t('inst.label.wordt_hint')}>
          <Select value={doelId} onChange={(e) => setDoelId(e.target.value)}>
            {anderen.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-sm text-ink-600">
          {aantal === null
            ? t('inst.label.tellen')
            : aantal === 0
              ? t('inst.label.geen_taak', { naam: bron.name })
              : t('inst.label.taken', { aantal, van: bron.name, naar: doel?.name ?? '' })}
        </p>
      </div>
    </Dialog>
  )
}
