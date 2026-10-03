import { useMemo, useState } from 'react'
import { addDays, dayKey, formatDate, startOfDay } from '@lib/dates'
import { conflicten, reeks, vrijInPeriode } from '@lib/voorraad'
import { useNarrow } from '@lib/useNarrow'
import { Button, Icon, Select } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { EmptyState, Spinner } from '@ui/index'
import { useTaal } from '@context/TaalProvider'
import { useAuth } from '@context/AuthProvider'
import { useBezet, useMateriaal, useReservaties } from '@data/materiaal'

/**
 * Het magazijn: wat er is, en wanneer het vrij is.
 *
 * ── Waarom dit scherm een kalender is en geen lijst ───────────────────────
 * "Hoeveel tenten heb ik" is geen bruikbare vraag. Een tent gaat niet op; ze
 * is bezet van vrijdag tot maandag en daarna weer vrij. De vraag die iemand
 * werkelijk stelt is "kan ik er twee op dat weekend", en dat lees je alleen
 * af van een tijdbalk.
 *
 * ── Waarom conflicten bovenaan staan en niet in het rood in een rij ───────
 * Een overboeking is geen foutmelding maar een beslissing: bijhuren,
 * verzetten, of de andere klant bellen. Die beslissing hoort gezien te worden
 * zonder te scrollen, en ze hoort te blijven staan tot iemand ze genomen
 * heeft.
 */
const VENSTERS = [14, 30, 60]

export default function Materiaal() {
  const { t } = useTaal()
  const { isAdmin } = useAuth()
  const narrow = useNarrow()

  const [start, setStart] = useState(() => dayKey(startOfDay()))
  const [dagen, setDagen] = useState(14)
  const [categorie, setCategorie] = useState('alle')

  const eind = useMemo(() => dayKey(addDays(new Date(`${start}T12:00:00`), dagen - 1)), [start, dagen])

  const { materiaal, laadt } = useMateriaal()
  const { perMateriaal } = useReservaties({ van: start, tot: eind })
  const bezet = useBezet(materiaal, perMateriaal)

  const categorieen = useMemo(
    () => [...new Set(materiaal.map((m) => m.categorie).filter(Boolean))].sort(),
    [materiaal]
  )

  const getoond = useMemo(
    () => materiaal.filter((m) => categorie === 'alle' || m.categorie === categorie),
    [materiaal, categorie]
  )

  /*
    Alle conflicten in het venster, met het artikel erbij. Ze worden hier
    geteld en niet per rij, want de vraag bovenaan is "moet ik vandaag iets
    oplossen" en niet "welke rij is rood".
  */
  const alleConflicten = useMemo(
    () =>
      materiaal.flatMap((m) =>
        conflicten(m, bezet.get(m.id)).map((c) => ({ ...c, materiaal: m }))
      ),
    [materiaal, bezet]
  )

  const uitVandaag = useMemo(
    () => materiaal.reduce((som, m) => som + ((m.aantal ?? 0) - vrijInPeriode(m, { van: start, tot: start }, bezet.get(m.id))), 0),
    [materiaal, bezet, start]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={t('materiaal.eyebrow')}
        title={t('materiaal.titel')}
        actions={
          isAdmin ? (
            <Button size="sm" iconLeft="plus" onClick={() => undefined} disabled>
              {t('materiaal.toevoegen')}
            </Button>
          ) : null
        }
      />

      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {laadt ? (
          <div className="je-muted-caption" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spinner /> {t('alg.laden')}
          </div>
        ) : materiaal.length === 0 ? (
          <EmptyState title={t('materiaal.leeg')} description={t('materiaal.leeg_uitleg')} />
        ) : (
          <>
            {alleConflicten.length ? (
              <section className="je-materiaal__alarm">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <Icon name="alert-triangle" size={16} />
                  <span className="je-caps" style={{ color: 'var(--danger)' }}>
                    {t('materiaal.conflicten', { aantal: alleConflicten.length })}
                  </span>
                </div>
                <ul>
                  {alleConflicten.slice(0, 5).map((c) => (
                    <li key={`${c.materiaal.id}-${c.dag}`}>
                      {t('materiaal.conflict_regel', {
                        naam: c.materiaal.naam,
                        dag: formatDate(`${c.dag}T12:00:00`),
                        tekort: c.tekort,
                        aantal: c.aantal,
                      })}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="je-dash__cijfers">
              <Vak label={t('materiaal.stuks')} waarde={materiaal.reduce((s, m) => s + (m.aantal ?? 0), 0)} onder={t('materiaal.soorten', { aantal: materiaal.length })} />
              <Vak label={t('materiaal.uit')} waarde={uitVandaag} onder={t('materiaal.uit_onder')} />
              <Vak
                label={t('materiaal.conflicten_kort')}
                waarde={alleConflicten.length}
                onder={alleConflicten.length ? t('materiaal.vragen_beslissing') : t('materiaal.alles_past')}
                slecht={alleConflicten.length > 0}
              />
            </div>

            <section className="je-panel">
              <div className="je-panel__head" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <span className="je-eyebrow">{t('materiaal.kalender')}</span>
                <label className="je-muted-caption" htmlFor="van" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {t('materiaal.vanaf')}
                  <input
                    id="van"
                    type="date"
                    className="je-input"
                    value={start}
                    onChange={(e) => setStart(e.target.value || dayKey(startOfDay()))}
                    style={{ width: 150 }}
                  />
                </label>
                <Select
                  aria-label={t('materiaal.venster')}
                  value={String(dagen)}
                  onChange={(e) => setDagen(Number(e.target.value))}
                  options={VENSTERS.map((d) => ({ value: String(d), label: t('materiaal.dagen', { aantal: d }) }))}
                />
                <Select
                  aria-label={t('materiaal.categorie')}
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value)}
                  options={[
                    { value: 'alle', label: t('materiaal.alle_categorieen') },
                    ...categorieen.map((c) => ({ value: c, label: c })),
                  ]}
                />
                <span className="je-panel__right" style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <Legenda kleur="var(--accent)" tekst={t('materiaal.legenda.event')} />
                  <Legenda kleur="var(--navy-300)" tekst={t('materiaal.legenda.optie')} />
                  <Legenda kleur="var(--danger)" tekst={t('materiaal.legenda.over')} />
                </span>
              </div>

              <div className="je-materiaal__schuif">
                <div className="je-materiaal__raster" style={{ '--dagen': dagen }}>
                  <div className="je-materiaal__kop">
                    <span />
                    {reeks(getoond[0] ?? {}, { van: start, dagen }, new Map()).map((d) => (
                      <span key={d.dag} className="je-materiaal__dagkop">
                        {d.dag.slice(-2)}
                      </span>
                    ))}
                  </div>

                  {getoond.map((m) => {
                    const rij = reeks(m, { van: start, dagen }, bezet.get(m.id))
                    return (
                      <div key={m.id} className="je-materiaal__rij">
                        <span className="je-materiaal__naam">
                          <span>{m.naam}</span>
                          <span className="je-muted-caption">{m.aantal}×</span>
                        </span>
                        {rij.map((d) => (
                          <span
                            key={d.dag}
                            className="je-materiaal__cel"
                            title={t('materiaal.cel', {
                              naam: m.naam,
                              dag: formatDate(`${d.dag}T12:00:00`),
                              vrij: d.vrij,
                              aantal: m.aantal ?? 0,
                            })}
                            style={{ background: kleurVan(d) }}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>

              {narrow ? (
                <p className="je-muted-caption" style={{ padding: 'var(--space-4) var(--space-6)', margin: 0 }}>
                  {t('materiaal.schuif_uitleg')}
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

/** Vol is vol; een optie is lichter, want die is nog te bellen. */
function kleurVan(dag) {
  if (dag.over) return 'var(--danger)'
  if (dag.vast > 0 && dag.optie > 0) return 'var(--navy-500)'
  if (dag.vast > 0) return 'var(--accent)'
  if (dag.optie > 0) return 'var(--navy-300)'
  return 'var(--surface-2)'
}

function Legenda({ kleur, tekst }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: 'var(--type-micro)', color: 'var(--text-2)' }}>
      <span style={{ width: 11, height: 11, borderRadius: 2, background: kleur }} />
      {tekst}
    </span>
  )
}

function Vak({ label, waarde, onder, slecht }) {
  return (
    <div className={`je-kpi${slecht ? ' je-kpi--slecht' : ''}`} style={{ cursor: 'default' }}>
      <span className="je-caps">{label}</span>
      <span className="je-kpi__waarde">{waarde}</span>
      {onder ? <span className="je-dash__sub">{onder}</span> : null}
    </div>
  )
}
