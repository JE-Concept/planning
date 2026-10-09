import { useMemo, useState } from 'react'
import { dayKey, formatDate } from '@lib/dates'
import { leesFunctieFout } from '@lib/functie-fout'
import { beginstatus, kiesTakenlijst, standaardDeadline } from '@lib/agenda-taak'
import { urenTekst } from '@lib/rooster'
import { groepeerActies, zoekVerslagen } from '@lib/verslag-zoek'
import { Acties, Avatar, Badge, Button, Dialog, EmptyState, Field, GevaarKnop, Input, Select, Spinner, Textarea } from '@components/ds'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { summariseMeeting, useAlleActiepunten, useMeetingTasks, useMeetings } from '@data/meetings'
import {
  addAgendaItem,
  besprekenEnTaak,
  deleteAgendaItem,
  markDiscussed,
  reopenAgendaItem,
  totalMinutes,
  useAgenda,
} from '@data/agenda'
import { STANDAARD_KLEUR } from '@lib/kleur'

/**
 * Teamoverleg.
 *
 * Wat je hier leest is de samenvatting; de actiepunten eronder zijn gewone
 * taken, dus ze staan ook in Mijn werk van wie ze kreeg. Dat is met opzet: een
 * actiepunt dat alleen in een verslag staat, gebeurt niet.
 */
export default function Meetings() {
  const { uid, isAdmin } = useAuth()
  const { t } = useTaal()
  const { meetings, loading } = useMeetings(uid)
  const { items: agenda } = useAgenda('open')
  const [tab, setTab] = useState('agenda')
  const [open, setOpen] = useState(null)
  const [pasting, setPasting] = useState(false)
  const [zoek, setZoek] = useState('')

  // Alleen op het tabblad waar gezocht wordt; daarbuiten is het een
  // abonnement op het halve takenbord dat niemand leest.
  const actiepunten = useAlleActiepunten(tab === 'verslagen')
  const gevonden = useMemo(
    () => zoekVerslagen({ verslagen: meetings, actiesPerVerslag: groepeerActies(actiepunten), term: zoek }),
    [meetings, actiepunten, zoek]
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('nav.teamoverleg')}
        subtitle={
          tab === 'agenda'
            ? t('overleg.agenda_samenvatting', { aantal: agenda.length, duur: urenTekst(totalMinutes(agenda)) })
            : zoek.trim()
              ? t('overleg.gevonden', { aantal: meetings.length, gevonden: gevonden.length })
              : t('overleg.verslag_aantal', { aantal: meetings.length })
        }
        acties={
          tab === 'verslagen' && isAdmin
            ? { hoofd: { label: t('overleg.samenvatten'), onClick: () => setPasting(true) } }
            : null
        }
        tabs={
          <>
            <Tab active={tab === 'agenda'} onClick={() => setTab('agenda')}>
              {t('overleg.agenda')}
              {agenda.length ? (
                <span className="ml-1.5 tabular-nums text-[11px] text-ink-400">{agenda.length}</span>
              ) : null}
            </Tab>
            <Tab active={tab === 'verslagen'} onClick={() => setTab('verslagen')}>
              {t('overleg.verslagen')}
            </Tab>
          </>
        }
      />

      {tab === 'agenda' ? <Agenda items={agenda} /> : null}

      <div className={tab === 'agenda' ? 'hidden' : 'je-paginarand min-h-0 flex-1 overflow-y-auto pb-8'}>
        <div className="max-w-4xl space-y-3 py-4">
          {meetings.length === 0 ? (
            <EmptyState
              title={t('overleg.geen_verslagen')}
              description={t('overleg.geen_verslagen_uitleg')}
            />
          ) : (
            <>
              {/* Zoeken gaat door de samenvattingen én de actiepunten. Een
                  verslag dat je niet terugvindt, had je net zo goed niet
                  kunnen maken. */}
              <Input
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder={t('overleg.zoek')}
                aria-label={t('overleg.zoek_label')}
              />

              {gevonden.length === 0 ? (
                <EmptyState
                  title={t('overleg.niets_gevonden')}
                  description={t('overleg.niets_gevonden_uitleg', { term: zoek.trim() })}
                />
              ) : (
                <ul className="space-y-2">
                  {gevonden.map((meeting) => (
                    <li key={meeting.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(meeting)}
                        className="card w-full p-4 text-left transition hover:shadow-cue-md"
                      >
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-display text-base font-extrabold text-ink-900">
                            {meeting.titel}
                          </span>
                          <span className="text-xs text-ink-500">{formatDate(meeting.datum)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-600">
                          {meeting.samenvatting?.[0]?.tekst ?? ''}
                        </p>

                        {/* Waarom dit verslag in de lijst staat. Zonder die
                            regel moet je alsnog elk verslag openen. */}
                        {meeting.treffers?.length ? (
                          <ul className="je-verslagtreffers">
                            {meeting.treffers.slice(0, 3).map((treffer, i) => (
                              <li key={`${treffer.soort}-${i}`}>
                                <Badge subtle>
                                  {treffer.soort === 'actiepunt'
                                    ? t('overleg.treffer_actiepunt')
                                    : t('overleg.treffer_besproken')}
                                </Badge>
                                <span>{treffer.tekst || treffer.detail}</span>
                              </li>
                            ))}
                            {meeting.treffers.length > 3 ? (
                              <li className="text-ink-500">
                                {t('overleg.nog_andere', { aantal: meeting.treffers.length - 3 })}
                              </li>
                            ) : null}
                          </ul>
                        ) : null}

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(meeting.deelnemers ?? []).slice(0, 6).map((naam) => (
                            <Badge key={naam} subtle>
                              {naam}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {open ? <MeetingDetail meeting={open} onClose={() => setOpen(null)} /> : null}
      {pasting ? <PasteTranscript onClose={() => setPasting(false)} /> : null}
    </div>
  )
}

/**
 * De agenda: wat er op het volgende overleg moet.
 *
 * Elk punt heeft een eigenaar en een verwachte tijd. Die tijd staat er om te
 * zien hoe lang het overleg gaat duren, niet om het af te kappen: een overleg
 * duurt zolang de punten duren. Er stond hier eerder een waarschuwing zodra de
 * agenda niet meer "in een uur paste" — dat uur bestond alleen in deze code, en
 * een tool die oranje kleurt bij een agenda die gewoon vol is, leert je haar
 * negeren.
 */
function Agenda({ items }) {
  const { uid, isAdmin } = useAuth()
  const { t } = useTaal()
  const { profileById } = useWorkspace()
  const { items: besproken } = useAgenda('besproken')
  const toast = useToast()
  const [toonBesproken, setToonBesproken] = useState(false)
  const [afronden, setAfronden] = useState(null)

  const [titel, setTitel] = useState('')
  const [omschrijving, setOmschrijving] = useState('')
  const [minuten, setMinuten] = useState(10)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!titel.trim()) return
    setBusy(true)
    try {
      await addAgendaItem({ titel, omschrijving, minuten, uid })
      setTitel('')
      setOmschrijving('')
      setMinuten(10)
    } catch (err) {
      // Stond eerder op "Het samenvatten", maar dit is het toevoegen van een
      // agendapunt — en een foutmelding die iets anders benoemt dan wat je net
      // deed, stuurt de lezer de verkeerde kant op.
      toast.error(leesFunctieFout(err, t('overleg.punt_toevoegen')))
    } finally {
      setBusy(false)
    }
  }

  const totaal = totalMinutes(items)

  return (
    <div className="je-paginarand min-h-0 flex-1 overflow-y-auto pb-8">
      <div className="max-w-4xl space-y-4 py-4">
        <form onSubmit={submit} className="card space-y-3 p-4">
          <h2 className="label mb-0">{t('overleg.punt_toevoegen')}</h2>
          <Input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder={t('overleg.onderwerp_hint')}
            aria-label={t('overleg.onderwerp')}
          />
          <Textarea
            rows={2}
            value={omschrijving}
            onChange={(e) => setOmschrijving(e.target.value)}
            placeholder={t('overleg.omschrijving_hint')}
            aria-label={t('overleg.omschrijving')}
          />
          <div className="flex flex-wrap items-end gap-3">
            {/* Geen eigenaarskeuze: wie het punt zet, is de eigenaar. */}
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <Avatar profile={profileById[uid]} size="xs" />
              {t('overleg.jij_eigenaar')}
            </span>
            <Field label={t('overleg.verwachte_tijd')} className="ml-auto w-32">
              <Select value={minuten} onChange={(e) => setMinuten(Number(e.target.value))}>
                {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {t('overleg.minuten', { minuten: m })}
                  </option>
                ))}
              </Select>
            </Field>
            <Acties plaats="rij" hoofd={{ label: t('overleg.op_de_agenda'), type: 'submit', bezig: busy, uit: !titel.trim() }} />
          </div>
        </form>

        {items.length === 0 ? (
          <EmptyState
            title={t('overleg.agenda_leeg')}
            description={t('overleg.agenda_leeg_uitleg')}
          />
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <h2 className="label mb-0">{t('overleg.volgende')}</h2>
              {/* Boven het uur leest "1u30" beter dan "95 min" — zelfde
                  notatie als de urenregistratie. */}
              <span className="text-xs font-semibold tabular-nums text-ink-500">
                {t('overleg.geplande_duur', { duur: urenTekst(totaal) })}
              </span>
            </div>

            <ul className="space-y-2">
              {items.map((item) => {
                const owner = item.ownerId ? profileById[item.ownerId] : null
                return (
                  <li key={item.id} className="card p-3.5">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink-900">{item.titel}</span>
                        {item.omschrijving ? (
                          <span className="mt-0.5 block whitespace-pre-wrap text-sm text-ink-600">
                            {item.omschrijving}
                          </span>
                        ) : null}
                      </span>
                      <Badge subtle>{t('overleg.minuten', { minuten: item.minuten || 0 })}</Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-ink-600">
                        {owner ? (
                          <>
                            <Avatar profile={owner} size="xs" />
                            {owner.fullName || owner.email}
                          </>
                        ) : (
                          // Punten van voor "wie zet is eigenaar" kunnen er nog
                          // zonder staan.
                          <span className="text-ink-400">{t('overleg.geen_eigenaar')}</span>
                        )}
                      </span>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => setAfronden(item)}
                      >
                        {t('overleg.besproken')}
                      </Button>
                      {item.ownerId === uid || isAdmin ? (
                        <GevaarKnop
                          label={t('alg.verwijderen')}
                          size="sm"
                          vraag={t('overleg.punt_verwijderen')}
                          onConfirm={() => deleteAgendaItem(item.id).catch((e) => toast.error(e.message))}
                        />
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {afronden ? <Afronden item={afronden} onClose={() => setAfronden(null)} /> : null}

        {besproken.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setToonBesproken((v) => !v)}
              className="je-tekstknop text-xs font-semibold text-ink-500 hover:text-ink-800"
            >
              {toonBesproken ? '▾' : '▸'} {t('overleg.al_besproken', { aantal: besproken.length })}
            </button>
            {toonBesproken ? (
              <ul className="mt-2 space-y-1">
                {besproken.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink-600 line-through">{item.titel}</span>
                    {/* Of er werk uit kwam. Zonder dit is "besproken" niet te
                        onderscheiden van "besproken en vergeten". */}
                    {item.taskId ? <Badge subtle>{t('overleg.taak_aangemaakt_badge')}</Badge> : null}
                    {item.besprokenOp ? (
                      <span className="text-[11px] text-ink-500">{formatDate(item.besprokenOp)}</span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reopenAgendaItem(item.id).catch((e) => toast.error(e.message))}
                    >
                      {t('overleg.terugzetten')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Een agendapunt afronden, en er in dezelfde handeling een taak van maken.
 *
 * Dat "in dezelfde handeling" is het hele punt. Zolang afvinken en een taak
 * aanmaken twee schermen waren, gebeurde het tweede niet — het overleg loopt
 * door en de volgende spreker is al begonnen. Hier staat alles wat een taak
 * nodig heeft al ingevuld: de titel van het punt, de eigenaar ervan, en een
 * deadline op het volgende overleg. Wie het anders wil, verandert het; wie
 * niets verandert, heeft in één klik een taak met een naam en een datum.
 *
 * "Alleen afvinken" blijft bestaan, want niet elk punt levert werk op. Een
 * mededeling is besproken en klaar, en daar een lege taak van maken vervuilt
 * het bord dat het net overzichtelijk moest houden.
 */
function Afronden({ item, onClose }) {
  const { t } = useTaal()
  const { profiles, activeLists, profileById } = useWorkspace()
  const toast = useToast()

  const lijst = useMemo(() => kiesTakenlijst(activeLists), [activeLists])
  const [titel, setTitel] = useState(item.titel ?? '')
  const [eigenaar, setEigenaar] = useState(item.ownerId ?? '')
  const [deadline, setDeadline] = useState(() => standaardDeadline())
  const [busy, setBusy] = useState(false)

  const kandidaten = profiles.filter((p) => p.active !== false && p.role !== 'staff')

  const alleenAfvinken = async () => {
    setBusy(true)
    try {
      await markDiscussed(item.id)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const metTaak = async () => {
    setBusy(true)
    try {
      await besprekenEnTaak({
        item,
        lijst,
        status: beginstatus(lijst),
        titel,
        eigenaar: eigenaar || null,
        deadline,
      })
      const wie = eigenaar ? profileById[eigenaar] : null
      toast.success(
        wie
          ? t('overleg.taak_aangemaakt_voor', { wie: wie.fullName || wie.email })
          : t('overleg.taak_aangemaakt')
      )
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog width={512}
      open
      onClose={onClose}
      title={t('overleg.afronden_titel')}
      footer={
        <Acties
          tweede={{ label: t('overleg.alleen_afvinken'), onClick: alleenAfvinken, uit: busy }}
          hoofd={{ label: t('overleg.taak_aanmaken'), onClick: metTaak, bezig: busy, uit: !titel.trim() || !lijst }}
        />
      }
    >
      <div className="space-y-3 px-5 py-4">
        <p className="text-sm text-ink-600">{t('overleg.afronden_uitleg', { titel: item.titel })}</p>

        <Field label={t('overleg.wat_gebeuren')}>
          <Input value={titel} onChange={(e) => setTitel(e.target.value)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('overleg.wie_doet')}>
            <Select value={eigenaar} onChange={(e) => setEigenaar(e.target.value)}>
              <option value="">{t('overleg.nog_te_verdelen')}</option>
              {kandidaten.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName || p.email}
                </option>
              ))}
            </Select>
          </Field>
          <label className="block">
            <span className="label">{t('overleg.tegen_wanneer')}</span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="field"
              aria-label={t('overleg.deadline_label')}
            />
          </label>
        </div>

        {lijst ? (
          <p className="text-[11px] text-ink-500">{t('overleg.taak_op_lijst', { lijst: lijst.name })}</p>
        ) : (
          <p className="text-[11px] text-amber-700">{t('overleg.geen_takenlijst')}</p>
        )}
      </div>
    </Dialog>
  )
}

function MeetingDetail({ meeting, onClose }) {
  const { t } = useTaal()
  const tasks = useMeetingTasks(meeting.taskId)
  const { profileById } = useWorkspace()

  const [acties, verslag] = useMemo(
    () => [tasks.filter((t) => t.parentId), tasks.find((t) => !t.parentId)],
    [tasks]
  )

  return (
    <Dialog open onClose={onClose} title={meeting.titel} width={672}>
      <div className="space-y-5 px-5 py-4">
        <p className="text-xs text-ink-500">
          {formatDate(meeting.datum)}
          {verslag ? ` · ${verslag.statusName}` : ''}
        </p>

        <section>
          <h3 className="label">{t('overleg.deelnemers')}</h3>
          <div className="flex flex-wrap gap-1.5">
            {(meeting.deelnemers ?? []).map((naam) => (
              <Badge key={naam} subtle>
                {naam}
              </Badge>
            ))}
          </div>
        </section>

        <section>
          <h3 className="label">{t('overleg.besproken_kop')}</h3>
          <ul className="space-y-2.5">
            {(meeting.samenvatting ?? []).map((punt) => (
              <li key={punt.onderwerp}>
                <p className="text-sm font-semibold text-ink-900">{punt.onderwerp}</p>
                <p className="text-sm text-ink-700">{punt.tekst}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="label">{t('overleg.actiepunten', { aantal: acties.length })}</h3>
          <ul className="space-y-1">
            {acties.map((taak) => {
              const wie = taak.assignees?.[0] ? profileById[taak.assignees[0]] : null
              return (
                <li
                  key={taak.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 px-3 py-2"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: taak.statusColor ?? STANDAARD_KLEUR }}
                  />
                  <span className="min-w-0 flex-1 text-sm text-ink-800">{taak.title}</span>
                  {wie ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-600">
                      <Avatar profile={wie} size="xs" />
                      {wie.fullName || wie.email}
                    </span>
                  ) : (
                    <Badge tone="warning">
                      {taak.voorgesteldeVerantwoordelijke
                        ? `${taak.voorgesteldeVerantwoordelijke}?`
                        : t('overleg.geen_wie')}
                    </Badge>
                  )}
                </li>
              )
            })}
            {acties.length === 0 ? (
              <li className="px-1 py-2 text-sm text-ink-500">{t('overleg.geen_actiepunten')}</li>
            ) : null}
          </ul>
          <p className="mt-2 text-[11px] text-ink-500">{t('overleg.actiepunten_zijn_taken')}</p>
        </section>

        {meeting.bron ? (
          <p className="text-xs text-ink-500">
            {t('overleg.bron')}:{' '}
            <a href={meeting.bron} target="_blank" rel="noreferrer" className="underline">
              {t('overleg.de_opname')}
            </a>
          </p>
        ) : null}

        <p className="rounded-xl bg-ink-50 px-3 py-2 text-[11px] text-ink-600">{t('overleg.door_ai')}</p>
      </div>
    </Dialog>
  )
}

function PasteTranscript({ onClose }) {
  const { t } = useTaal()
  const toast = useToast()
  const [transcript, setTranscript] = useState('')
  // dayKey rekent lokaal; toISOString gaf tussen middernacht en twee uur
  // 's nachts de dag ervoor.
  const [datum, setDatum] = useState(() => dayKey(new Date()))
  const [bron, setBron] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const r = await summariseMeeting({ transcript, datum, bron: bron || null })
      toast.success(
        t('overleg.verslag_toegevoegd', { aantal: r.actiepunten, toegewezen: r.toegewezen })
      )
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('overleg.samenvatten')}
      width={672}
      footer={
        <Acties
          terug={{ onClick: onClose }}
          hoofd={{ label: t('overleg.samenvatten_knop'), onClick: submit, bezig: busy, uit: transcript.trim().length < 200 }}
        />
      }
    >
      <div className="space-y-3 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t('overleg.datum_overleg')}</span>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">{t('overleg.link_opname')}</span>
            <input
              type="url"
              value={bron}
              onChange={(e) => setBron(e.target.value)}
              placeholder="https://…"
              className="field"
            />
          </label>
        </div>

        <label className="block">
          <span className="label">{t('overleg.transcript')}</span>
          <Textarea
            rows={12}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={t('overleg.transcript_hint')}
          />
        </label>

        {busy ? (
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Spinner className="h-3 w-3" /> {t('overleg.model_leest')}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
