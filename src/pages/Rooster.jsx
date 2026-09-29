import { useMemo, useState } from 'react'
import { addDays, dayKey, formatDate, formatWeekday, startOfWeek } from '@lib/dates'
import { geplandTegenoverGeboekt, roosterVan, urenTekst } from '@lib/rooster'
import { Icon } from '@components/ds'
import { Button, Field, Input, Modal, Select, Spinner } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { deleteShift, kopieerWeek, saveShift, useShifts } from '@data/rooster'
import { useTimeEntries } from '@data/time'

/**
 * Het weekrooster: wie wanneer werkt.
 *
 * Voor Meer en Het Vinne stond dit in een gedeeld blad, en een blad weet niet
 * wie er dubbel ingepland staat of wie er die week veertig uur haalt. Het rooster
 * hier weet dat wel, en het staat naast de urenregistratie zodat het verschil
 * tussen gepland en geboekt zichtbaar is. Dat verschil is waar een gesprek over
 * gaat: structureel meer werken dan gepland is een planningsprobleem, en
 * structureel minder is er ook een.
 *
 * De personeelsplanning van JE Concept draait in Aapi. Zolang de koppeling
 * daarmee niet gemaakt is — er is geen documentatie van — staat dit rooster op
 * zichzelf. Zie `src/data/aapi.js`.
 */
export default function Rooster() {
  const { isAdmin, uid } = useAuth()
  const { profiles, brands, brandById } = useWorkspace()
  const { t } = useTaal()
  const toast = useToast()

  const [maandag, setMaandag] = useState(() => startOfWeek())
  const [bewerk, setBewerk] = useState(null)
  const [bezig, setBezig] = useState(false)

  const { shifts, loading } = useShifts(maandag)

  // Personeel en teamleden allebei: wie de zaak openzet staat evengoed op het
  // rooster als wie de events doet.
  const mensen = useMemo(
    () => profiles.filter((p) => p.active !== false && p.role !== 'guest'),
    [profiles]
  )

  const rooster = useMemo(
    () => roosterVan({ shifts, profiles: mensen, datum: maandag }),
    [shifts, mensen, maandag]
  )

  // De dagnaam wordt hier opgemaakt en niet uit `rooster` gelezen: dat raster
  // wordt maar herrekend wanneer de week of de diensten veranderen, en dan
  // zouden de namen na een taalwissel in de oude taal blijven staan.
  const dagnaam = (dag) => formatWeekday(dag.datum)

  const maand = dayKey(maandag).slice(0, 7)
  const { entries } = useTimeEntries({ month: maand })
  const weekEntries = useMemo(() => {
    const dagen = new Set(rooster.dagen.map((d) => d.sleutel))
    return entries.filter((e) => dagen.has(dayKey(e.startedAt)))
  }, [entries, rooster.dagen])

  const vergelijking = useMemo(
    () => geplandTegenoverGeboekt({ rooster, entries: weekEntries }),
    [rooster, weekEntries]
  )
  const geboektPer = useMemo(
    () => Object.fromEntries(vergelijking.map((v) => [v.persoon.id, v])),
    [vergelijking]
  )

  const botsendeIds = useMemo(() => {
    const ids = new Set()
    for (const [a, b] of rooster.botsingen) {
      ids.add(a.id)
      ids.add(b.id)
    }
    return ids
  }, [rooster.botsingen])

  const kopieer = async () => {
    setBezig(true)
    try {
      const n = await kopieerWeek({ shifts, vanDatum: maandag, naarDatum: addDays(maandag, 7) })
      toast.success(n === 0 ? t('rooster.niets_te_kopieren') : t('rooster.gekopieerd', { aantal: n }))
      setMaandag(addDays(maandag, 7))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        eyebrow={`${formatDate(rooster.dagen[0].datum)} — ${formatDate(rooster.dagen[6].datum)}`}
        title={t('nav.rooster')}
        subtitle={t('rooster.ingepland', { uren: urenTekst(rooster.minuten) })}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setMaandag(addDays(maandag, -7))} aria-label={t('rooster.vorige_week')}>
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMaandag(startOfWeek())}>
              {t('rooster.deze_week')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMaandag(addDays(maandag, 7))} aria-label={t('rooster.volgende_week')}>
              ›
            </Button>
            {isAdmin ? (
              <Button variant="secondary" size="sm" onClick={kopieer} disabled={bezig}>
                {t('rooster.kopieer')}
              </Button>
            ) : null}
          </>
        }
      />

      {rooster.botsingen.length ? (
        <p className="je-rooster__waarschuwing" role="alert">
          <Icon name="alert-triangle" size={15} />
          {t('rooster.botsing', { aantal: rooster.botsingen.length })}{' '}
          {t('rooster.botsing_staart')}
        </p>
      ) : null}

      {loading ? (
        <div style={{ display: 'flex', flex: 1, justifyContent: 'center', padding: 'var(--space-8)' }}>
          <Spinner />
        </div>
      ) : (
        <div className="je-rooster">
          <table className="je-rooster__tabel">
            <thead>
              <tr>
                <th scope="col">{t('rooster.wie')}</th>
                {rooster.dagen.map((dag) => (
                  <th key={dag.sleutel} scope="col" className={dag.sleutel === dayKey(new Date()) ? 'je-rooster__vandaag' : undefined}>
                    <span className="je-rooster__dagnaam">{dagnaam(dag)}</span>
                    <span className="je-rooster__dagnr">{dag.nummer}</span>
                  </th>
                ))}
                <th scope="col">{t('rooster.week')}</th>
              </tr>
            </thead>
            <tbody>
              {rooster.rijen.map((rij) => {
                const cijfers = geboektPer[rij.persoon.id]
                return (
                  <tr key={rij.persoon.id}>
                    <th scope="row" className="je-rooster__wie">
                      <span>{rij.persoon.fullName || rij.persoon.email}</span>
                      {rij.persoon.department ? (
                        <span className="je-muted-caption">{rij.persoon.department}</span>
                      ) : null}
                    </th>

                    {rooster.dagen.map((dag) => (
                      <td key={dag.sleutel}>
                        <div className="je-rooster__cel">
                          {rij.perDag[dag.sleutel].map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className={`je-plainbtn je-rooster__dienst${
                                botsendeIds.has(s.id) ? ' je-rooster__dienst--botst' : ''
                              }`}
                              style={
                                s.brandId && brandById[s.brandId]
                                  ? { borderLeftColor: brandById[s.brandId].color }
                                  : undefined
                              }
                              onClick={() => setBewerk(s)}
                              disabled={!isAdmin && s.profileId !== uid}
                            >
                              <span>
                                {s.start}–{s.end}
                              </span>
                              {s.note ? <span className="je-muted-caption">{s.note}</span> : null}
                            </button>
                          ))}
                          {isAdmin ? (
                            <button
                              type="button"
                              className="je-plainbtn je-rooster__plus"
                              aria-label={t('rooster.dienst_toevoegen_voor', {
                                wie: rij.persoon.fullName || rij.persoon.email,
                                dag: dagnaam(dag),
                                nummer: dag.nummer,
                              })}
                              onClick={() =>
                                setBewerk({ profileId: rij.persoon.id, date: dag.sleutel, start: '17:00', end: '23:00' })
                              }
                            >
                              +
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ))}

                    <td className="je-rooster__totaal">
                      <span>{urenTekst(rij.minuten)}</span>
                      {/* Gepland tegenover geboekt: twee getallen die iets anders
                          meten, en het verschil is waar het gesprek over gaat. */}
                      {cijfers && cijfers.geboekteMinuten > 0 ? (
                        <span
                          className="je-muted-caption"
                          title={t('rooster.geboekt', { uren: urenTekst(cijfers.geboekteMinuten) })}
                        >
                          {cijfers.verschilMinuten === 0
                            ? t('rooster.precies')
                            : `${cijfers.verschilMinuten > 0 ? '+' : '−'}${urenTekst(Math.abs(cijfers.verschilMinuten))}`}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t('rooster.per_dag')}</th>
                {rooster.dagen.map((dag) => (
                  <td key={dag.sleutel} className="je-rooster__totaal">
                    {rooster.perDag[dag.sleutel].minuten ? urenTekst(rooster.perDag[dag.sleutel].minuten) : '—'}
                  </td>
                ))}
                <td className="je-rooster__totaal">{urenTekst(rooster.minuten)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {bewerk ? (
        <DienstDialoog
          dienst={bewerk}
          mensen={mensen}
          brands={brands}
          onKlaar={() => setBewerk(null)}
          onFout={(bericht) => toast.error(bericht)}
        />
      ) : null}
    </div>
  )
}

/**
 * Eén dienst zetten of weghalen.
 *
 * De uren zijn tekstvelden met een klokformaat en geen tijdstipkiezer: een
 * rooster gaat over klokuren zoals ze op de deur hangen, en wie ze als moment
 * bewaart krijgt ze bij een zomeruurwissel een uur verschoven te zien.
 */
function DienstDialoog({ dienst, mensen, brands, onKlaar, onFout }) {
  const { t } = useTaal()
  const [f, setF] = useState({
    profileId: dienst.profileId,
    date: dienst.date,
    start: dienst.start ?? '17:00',
    end: dienst.end ?? '23:00',
    breakMinutes: dienst.breakMinutes ?? 0,
    brandId: dienst.brandId ?? '',
    note: dienst.note ?? '',
  })
  const [bezig, setBezig] = useState(false)
  const zet = (veld) => (e) => setF((huidig) => ({ ...huidig, [veld]: e.target.value }))

  const bewaar = async () => {
    setBezig(true)
    try {
      await saveShift({ id: dienst.id, ...f, brandId: f.brandId || null })
      onKlaar()
    } catch (err) {
      onFout(err.message)
      setBezig(false)
    }
  }

  const weg = async () => {
    setBezig(true)
    try {
      await deleteShift(dienst.id)
      onKlaar()
    } catch (err) {
      onFout(err.message)
      setBezig(false)
    }
  }

  const geldig = /^\d{1,2}:\d{2}$/.test(f.start) && /^\d{1,2}:\d{2}$/.test(f.end)

  return (
    <Modal
      open
      onClose={onKlaar}
      title={dienst.id ? t('rooster.dienst_aanpassen') : t('rooster.dienst_toevoegen')}
      width="max-w-md"
      footer={
        <>
          {dienst.id ? (
            <Button variant="ghost" onClick={weg} disabled={bezig}>
              {t('rooster.weghalen')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onKlaar}>
            {t('alg.annuleren')}
          </Button>
          <Button variant="primary" onClick={bewaar} disabled={!geldig || bezig}>
            {bezig ? <Spinner className="h-3 w-3" /> : null} {t('alg.opslaan')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('rooster.wie')} className="sm:col-span-2">
          <Select value={f.profileId} onChange={zet('profileId')}>
            {mensen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName || p.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('rooster.van')} hint={t('rooster.van_hint')}>
          <Input value={f.start} onChange={zet('start')} placeholder="17:00" />
        </Field>
        <Field label={t('rooster.tot')} hint={t('rooster.tot_hint')}>
          <Input value={f.end} onChange={zet('end')} placeholder="23:00" />
        </Field>
        <Field label={t('rooster.pauze')} hint={t('rooster.pauze_hint')}>
          <Input type="number" min="0" step="5" value={f.breakMinutes} onChange={zet('breakMinutes')} />
        </Field>
        <Field label={t('rooster.waar')}>
          <Select value={f.brandId} onChange={zet('brandId')}>
            <option value="">{t('rooster.geen_plek')}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('rooster.notitie')} className="sm:col-span-2">
          <Input value={f.note} onChange={zet('note')} placeholder={t('rooster.notitie_hint')} />
        </Field>
      </div>
    </Modal>
  )
}
