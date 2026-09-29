import { useEffect, useState } from 'react'
import { Badge, Button, ConfirmButton, Field, Input, Select, Spinner } from '@ui/index'
import ColumnEditor from '@components/board/ColumnEditor'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  archiveList,
  countTasksPerStatus,
  createBrand,
  createList,
  createSpace,
  deleteTag,
  updateBrand,
  updateList,
  upsertTag,
} from '@data/workspace'

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
  const toast = useToast()
  const [kolommenVan, setKolommenVan] = useState(null)
  const [spaceName, setSpaceName] = useState('')
  const [listDraft, setListDraft] = useState({ spaceId: '', name: '', kind: 'tasks' })

  const addSpace = async (e) => {
    e.preventDefault()
    try {
      await createSpace(spaceName)
      setSpaceName('')
      toast.success('Ruimte aangemaakt.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addList = async (e) => {
    e.preventDefault()
    try {
      await createList(listDraft)
      setListDraft((d) => ({ ...d, name: '' }))
      toast.success('Lijst aangemaakt, met vier standaardkolommen.')
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
                    aria-label="Lijstnaam"
                  />
                  <Badge color={list.kind === 'social' ? '#d62976' : '#3377ff'} subtle>
                    {list.kind === 'social' ? 'social' : 'taken'}
                  </Badge>
                  {/* De kolommen van een bord horen bij de inrichting van de
                      ruimte, niet alleen bij het bord zelf: wie hier lijsten
                      aanmaakt, zet er meteen de juiste stappen op. */}
                  {list.kind === 'social' ? null : (
                    <Button variant="ghost" size="sm" onClick={() => setKolommenVan(list)}>
                      Kolommen
                    </Button>
                  )}
                  {list.archived ? (
                    <Button variant="ghost" size="sm" onClick={() => updateList(list.id, { archived: false })}>
                      Terughalen
                    </Button>
                  ) : (
                    <ConfirmButton
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-ink-400"
                      question="Lijst archiveren? De taken blijven bewaard."
                      onConfirm={() => archiveList(list.id)}
                    >
                      Archiveren
                    </ConfirmButton>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={addSpace} className="card space-y-2 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">Nieuwe ruimte</h2>
          <Input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="Naam" required />
          <Button type="submit" variant="primary" size="sm" disabled={!spaceName.trim()}>
            Aanmaken
          </Button>
        </form>

        <form onSubmit={addList} className="card space-y-2 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">Nieuwe lijst</h2>
          <Select
            value={listDraft.spaceId}
            onChange={(e) => setListDraft((d) => ({ ...d, spaceId: e.target.value }))}
            required
            aria-label="Ruimte"
          >
            <option value="">Kies een ruimte…</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            value={listDraft.name}
            onChange={(e) => setListDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Naam"
            required
          />
          <Select
            value={listDraft.kind}
            onChange={(e) => setListDraft((d) => ({ ...d, kind: e.target.value }))}
            aria-label="Soort"
          >
            <option value="tasks">Takenbord</option>
            <option value="social">Socialcontent</option>
          </Select>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!listDraft.name.trim() || !listDraft.spaceId}
          >
            Aanmaken
          </Button>
        </form>
      </div>
    </div>
  )
}

// ─── Brands and tags ────────────────────────────────────────────────────────

export function BrandSettings() {
  const { brands, tags } = useWorkspace()
  const toast = useToast()
  const [brand, setBrand] = useState({ name: '', key: '', color: '#3377ff' })
  const [tag, setTag] = useState({ name: '', color: '#8593a9' })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card overflow-hidden">
        <h2 className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
          Merken
        </h2>
        <ul className="divide-y divide-ink-100">
          {brands.map((b) => (
            <li key={b.id} className="flex items-center gap-2 px-4 py-2">
              <input
                type="color"
                value={b.color}
                onChange={(e) => updateBrand(b.id, { color: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded border border-ink-200 p-0.5"
                aria-label={`Kleur van ${b.name}`}
              />
              <Input
                defaultValue={b.name}
                onBlur={(e) => e.target.value.trim() && updateBrand(b.id, { name: e.target.value.trim() })}
                className="h-8 text-sm"
                aria-label="Merknaam"
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
              setBrand({ name: '', key: '', color: '#3377ff' })
              toast.success('Merk toegevoegd.')
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
            aria-label="Kleur"
          />
          <Input
            value={brand.name}
            onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
            placeholder="Nieuw merk"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!brand.name.trim()}>
            Toevoegen
          </Button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
          Labels
        </h2>
        <ul className="flex flex-wrap gap-1.5 p-4">
          {tags.map((t) => (
            <li key={t.id}>
              <span className="inline-flex items-center gap-1">
                <Badge color={t.color}>{t.name}</Badge>
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-ink-400"
                  question={`Label "${t.name}" verwijderen?`}
                  onConfirm={() => deleteTag(t.id)}
                  aria-label="Label verwijderen"
                >
                  ✕
                </ConfirmButton>
              </span>
            </li>
          ))}
          {tags.length === 0 ? <li className="text-sm text-ink-500">Nog geen labels.</li> : null}
        </ul>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await upsertTag(tag)
              setTag({ name: '', color: '#8593a9' })
            } catch (err) {
              toast.error(err.message)
            }
          }}
          className="flex items-center gap-2 border-t border-ink-100 px-4 py-3"
        >
          <input
            type="color"
            value={tag.color}
            onChange={(e) => setTag((t) => ({ ...t, color: e.target.value }))}
            className="h-8 w-8 cursor-pointer rounded border border-ink-200 p-0.5"
            aria-label="Kleur"
          />
          <Input
            value={tag.name}
            onChange={(e) => setTag((t) => ({ ...t, name: e.target.value }))}
            placeholder="Nieuw label"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!tag.name.trim()}>
            Toevoegen
          </Button>
        </form>
      </section>
    </div>
  )
}
