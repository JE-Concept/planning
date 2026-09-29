import { useMemo, useState } from 'react'
import { addDays, dayKey, formatDate, startOfWeek } from '@lib/dates'
import { geplandTegenoverGeboekt, roosterVan, urenTekst } from '@lib/rooster'
import { Icon } from '@components/ds'
import { Button, Field, Input, Modal, Select, Spinner } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
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
      toast.success(
        n === 0
          ? 'Deze week is leeg; er viel niets te kopiëren.'
          : `${n} ${n === 1 ? 'dienst' : 'diensten'} naar volgende week gekopieerd.`
      )
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
        title="Rooster"
        subtitle={`${urenTekst(rooster.minuten)} ingepland`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setMaandag(addDays(maandag, -7))} aria-label="Vorige week">
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMaandag(startOfWeek())}>
              Deze week
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMaandag(addDays(maandag, 7))} aria-label="Volgende week">
              ›
            </Button>
            {isAdmin ? (
              <Button variant="secondary" size="sm" onClick={kopieer} disabled={bezig}>
                Kopieer naar volgende week
              </Button>
            ) : null}
          </>
        }
      />

      {rooster.botsingen.length ? (
        <p className="je-rooster__waarschuwing" role="alert">
          <Icon name="alert-triangle" size={15} />
          {rooster.botsingen.length === 1
            ? 'Eén iemand staat twee keer tegelijk ingepland.'
            : `${rooster.botsingen.length} keer staat iemand twee keer tegelijk ingepland.`}{' '}
          Dat merk je anders pas op de dag zelf.
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
                <th scope="col">Wie</th>
                {rooster.dagen.map((dag) => (
                  <th key={dag.sleutel} scope="col" className={dag.sleutel === dayKey(new Date()) ? 'je-rooster__vandaag' : undefined}>
                    <span className="je-rooster__dagnaam">{dag.naam}</span>
                    <span className="je-rooster__dagnr">{dag.nummer}</span>
                  </th>
                ))}
                <th scope="col">Week</th>
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
                              aria-label={`Dienst toevoegen voor ${rij.persoon.fullName || rij.persoon.email} op ${dag.naam} ${dag.nummer}`}
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
                          title={`${urenTekst(cijfers.geboekteMinuten)} geboekt`}
                        >
                          {cijfers.verschilMinuten === 0
                            ? 'precies geboekt'
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
                <th scope="row">Per dag</th>
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
      title={dienst.id ? 'Dienst aanpassen' : 'Dienst toevoegen'}
      width="max-w-md"
      footer={
        <>
          {dienst.id ? (
            <Button variant="ghost" onClick={weg} disabled={bezig}>
              Weghalen
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onKlaar}>
            Annuleren
          </Button>
          <Button variant="primary" onClick={bewaar} disabled={!geldig || bezig}>
            {bezig ? <Spinner className="h-3 w-3" /> : null} Bewaren
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Wie" className="sm:col-span-2">
          <Select value={f.profileId} onChange={zet('profileId')}>
            {mensen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName || p.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Van" hint="Zoals het op de deur hangt, bijvoorbeeld 17:00.">
          <Input value={f.start} onChange={zet('start')} placeholder="17:00" />
        </Field>
        <Field label="Tot" hint="Loopt het over middernacht, vul dan gewoon 03:00 in.">
          <Input value={f.end} onChange={zet('end')} placeholder="23:00" />
        </Field>
        <Field label="Pauze" hint="In minuten; telt niet mee in de uren.">
          <Input type="number" min="0" step="5" value={f.breakMinutes} onChange={zet('breakMinutes')} />
        </Field>
        <Field label="Waar">
          <Select value={f.brandId} onChange={zet('brandId')}>
            <option value="">Geen plek gekozen</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notitie" className="sm:col-span-2">
          <Input value={f.note} onChange={zet('note')} placeholder="Opbouw, avondbar, keuken…" />
        </Field>
      </div>
    </Modal>
  )
}
