import { useMemo, useState } from 'react'
import { cn } from '@lib/cn'
import { addDays, dayKey, formatDate, formatTime, isToday } from '@lib/dates'
import { afdelingLabel, dueOn, grensTekst, meetOordeel, repeatLabel, runProgress, visibleTo } from '@lib/checklist-templates'
import { herhalingVan, volgendeKeer } from '@lib/checklist-herhaling'
import { Acties, Avatar, Badge, EmptyState, Icon, Input, PeriodeKiezer, ProgressBar, Spinner, Textarea } from '@components/ds'
import PageHeader, { Tab } from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useOffline } from '@context/OfflineProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useChecklists, useRunsForDay, closeRun, saveNotes, setItemValue, toggleItem } from '@data/checklists'

/**
 * Openen en sluiten van de bistro.
 *
 * Eén lijst per dag waar iedereen in afvinkt, in plaats van een blad per
 * persoon: wie binnenkomt ziet wat de vorige al deed en pakt de rest op. Bij
 * elk vinkje staat wie het zette en wanneer — dat is het enige wat het papier
 * niet kon, en meteen het punt van de oefening.
 *
 * Dit scherm is tweetalig, en daar was het de hele oefening om begonnen: hier
 * werkt personeel dat geen Nederlands leest. Wat eromheen staat — de koppen, de
 * knoppen, de meldingen — komt uit `taal/bistro.js`. Wat afgevinkt wordt niet:
 * de punten, de groepen en hun toelichting staan in de database en worden door
 * de beheerders zelf geschreven. Twee versies van die lijsten laten bestaan is
 * erger dan een Nederlands punt op een Engels scherm, want dan loopt er één
 * achter en weet niemand welke.
 */
export default function Checklists() {
  const { checklists, loading } = useChecklists()
  const { profile } = useAuth()
  const { t } = useTaal()
  const toast = useToast()

  const [offset, setOffset] = useState(0)
  const [active, setActive] = useState(null)

  const date = useMemo(() => addDays(new Date(), offset), [offset])
  const day = dayKey(date)

  // Twee filters op elk punt: valt het vandaag, en gaat het deze persoon aan.
  const scope = useMemo(() => ({ date, person: profile }), [date, profile])

  const { byChecklist, wachtendeRuns, loading: runsLoading } = useRunsForDay(day)
  const { online } = useOffline()

  const current = useMemo(
    () => checklists.find((c) => c.id === active) ?? checklists[0] ?? null,
    [checklists, active]
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (checklists.length === 0) {
    return (
      <div className="p-8">
        <EmptyState title={t('lijst.geen_titel')} description={t('lijst.geen_tekst')} />
      </div>
    )
  }

  const run = byChecklist[current?.id]
  const progress = runProgress(current, run, scope)

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('lijst.titel')}
        // De afdeling komt uit de gedeelde tabel in `checklist-templates`, die ook
        // de lijsteditor vult; die tabel is van een ander stuk en staat nog in het
        // Nederlands. De datum volgt de taal vanzelf, via de opmaaktaal.
        subtitle={`${formatDate(date)}${isToday(date) ? ` — ${t('lijst.vandaag')}` : ''}${
          profile?.department ? ` · ${afdelingLabel(profile.department)}` : ''
        }`}
        bediening={
          <PeriodeKiezer
            vorige={{ label: t('lijst.vorige_dag'), onClick: () => setOffset((o) => o - 1) }}
            nu={{ label: t('alg.vandaag'), onClick: () => setOffset(0), uit: offset === 0 }}
            volgende={{
              label: t('lijst.volgende_dag'),
              onClick: () => setOffset((o) => Math.min(0, o + 1)),
              uit: offset === 0,
            }}
          />
        }
        tabs={checklists.map((list) => {
          const listRun = byChecklist[list.id]
          const p = runProgress(list, listRun, scope)
          return (
            <Tab key={list.id} active={current?.id === list.id} onClick={() => setActive(list.id)}>
              {list.name}
              <span className="ml-1.5 tabular-nums text-[11px] text-ink-400">
                {p.done}/{p.total}
              </span>
            </Tab>
          )
        })}
      />

      <div className="je-paginarand flex items-center gap-3 border-b border-ink-200 bg-white py-2.5">
        <ProgressBar
          value={progress.ratio}
          color={progress.ratio === 1 ? 'var(--success)' : undefined}
          className="h-2 flex-1"
        />
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-700">
          {t('lijst.voortgang', { gedaan: progress.done, totaal: progress.total })}
        </span>
        {run?.participants?.length ? (
          <span className="hidden shrink-0 text-xs text-ink-500 sm:block">
            {t('alg.persoon', { aantal: run.participants.length })}
          </span>
        ) : null}
        {/*
          De keuken en de koelcel hebben één streepje bereik. Wat daar afgevinkt
          wordt, staat eerst alleen op dit toestel; Firestore stuurt het later
          vanzelf door. Dat hier zeggen is het hele punt: wie denkt dat het rond
          is, sluit de app en dan staat er de volgende ochtend een halve lijst.
        */}
        {wachtendeRuns.has(current.id) || !online ? (
          <span className="je-nogopdittoestel" title={t('lijst.wordt_doorgestuurd')}>
            <Icon name="cloud-off" size={13} />
            {wachtendeRuns.has(current.id) ? t('lijst.nog_op_toestel') : t('lijst.geen_verbinding')}
          </span>
        ) : null}
      </div>

      {runsLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="je-paginarand min-h-0 flex-1 overflow-y-auto pb-8">
          <div className="max-w-4xl space-y-5 py-4">
            {current.sections.map((section) => (
              <Section
                key={section.id}
                section={section}
                run={run}
                scope={scope}
                onToggle={(item, done) =>
                  toggleItem({ checklist: current, day, item, done, profile, scope }).catch((err) =>
                    toast.error(err.message)
                  )
                }
                onValue={(item, waarde) =>
                  setItemValue({ checklist: current, day, item, waarde, profile }).catch((err) =>
                    toast.error(err.message)
                  )
                }
              />
            ))}

            <Binnenkort checklist={current} scope={scope} />

            <section className="card p-4">
              <h2 className="label">
                {current.kind === 'close' ? t('lijst.overdracht') : t('lijst.opmerkingen')}
              </h2>
              <Textarea
                rows={3}
                defaultValue={run?.notes ?? ''}
                key={`${current.id}-${day}-${run?.notesAt ?? ''}`}
                placeholder={
                  current.kind === 'close' ? t('lijst.overdracht_hint') : t('lijst.opmerkingen_hint')
                }
                onBlur={(e) => {
                  if ((e.target.value ?? '') === (run?.notes ?? '')) return
                  saveNotes({ checklist: current, day, notes: e.target.value, profile }).catch((err) =>
                    toast.error(err.message)
                  )
                }}
              />
              {run?.notesByName ? (
                <p className="mt-1.5 text-[11px] text-ink-500">
                  {run.notesAt
                    ? t('lijst.notitie_door_om', { wie: run.notesByName, tijd: formatTime(run.notesAt) })
                    : t('lijst.notitie_door', { wie: run.notesByName })}
                </p>
              ) : null}
            </section>

            <Acties
              plaats="rij"
              uitleg={
                run?.closedAt
                  ? t('lijst.afgerond_door', { wie: run.closedByName, tijd: formatTime(run.closedAt) })
                  : progress.done < progress.total
                    ? t('lijst.nog_te_gaan', { rest: progress.total - progress.done })
                    : null
              }
              hoofd={{
                label: run?.closedAt ? t('lijst.is_afgerond') : t('lijst.afronden'),
                uit: progress.done < progress.total || Boolean(run?.closedAt),
                onClick: () =>
                  closeRun({ checklist: current, day, profile })
                    .then(() => toast.success(t('lijst.afgerond_toast')))
                    .catch((err) => toast.error(err.message)),
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Wat er niet vandaag moet, maar er wel bij hoort.
 *
 * Het poetsplan leek alleen dagelijkse punten te kennen: de friteuse is voor
 * maandag, de dampkap voor de 1e, de vetvangput voor het kwartaal, en op elke
 * andere dag stond daar niets van op het scherm. Terecht — je gaat geen punt
 * afvinken dat vandaag niet moet — maar zo lijkt de helft van de lijst niet te
 * bestaan, en dan gaat iemand ze opnieuw aanmaken als dagelijks punt.
 *
 * Dit blok is dus geen werk maar een vooruitblik: lezen, niet afvinken. Het
 * telt niet mee in de voortgang en schrijft niets weg.
 */
function Binnenkort({ checklist, scope }) {
  const { t } = useTaal()
  const komt = useMemo(() => {
    const rijen = (checklist?.sections ?? [])
      .flatMap((section) => section.items)
      .filter((item) => visibleTo(item, scope.person) && !dueOn(item, scope.date))
      .map((item) => ({ item, wanneer: volgendeKeer(herhalingVan(item), scope.date) }))
      .filter((rij) => rij.wanneer)

    // Geen afkapping: het gaat er juist om dat de hele lijst bestaat. Wat er
    // staat is één regel per punt, en langer dan de lijst zelf wordt het niet.
    return rijen.sort((a, b) => a.wanneer - b.wanneer)
  }, [checklist, scope])

  if (komt.length === 0) return null

  return (
    <section className="card p-4">
      <h2 className="label">{t('lijst.binnenkort')}</h2>
      <ul className="space-y-1">
        {komt.map(({ item, wanneer }) => (
          <li key={item.id} className="flex items-baseline gap-2 text-sm text-ink-600">
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 text-xs text-ink-500">
              {repeatLabel(item)} · {formatDate(wanneer)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Section({ section, run, scope, onToggle, onValue }) {
  // Wat vandaag niet valt, of niet voor deze persoon is, staat er helemaal niet
  // — anders leest de lijst als een archief in plaats van als het werk van nu.
  const shown = section.items.filter(
    (item) => dueOn(item, scope.date) && visibleTo(item, scope.person)
  )

  if (shown.length === 0) return null

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-ink-100 bg-ink-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-700">
        {section.title}
      </h2>
      <ul className="divide-y divide-ink-100">
        {shown.map((item) => (
          <Item
            key={item.id}
            item={item}
            state={run?.items?.[item.id]}
            onToggle={onToggle}
            onValue={onValue}
          />
        ))}
      </ul>
    </section>
  )
}

function Item({ item, state, onToggle, onValue }) {
  const { t } = useTaal()
  const [revealed, setRevealed] = useState(false)
  const done = Boolean(state?.done)

  return (
    <li className={cn('je-checklijst px-4 py-2.5', done && 'bg-ink-50/50')}>
      {/* `je-checklijst` geeft de rij op een telefoon een ruim raakvlak: dit
          is het scherm dat in de koelcel openstaat, met natte handen. */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => onToggle(item, e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-accent-600"
        />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm', done ? 'text-ink-500 line-through' : 'text-ink-900')}>
            {item.label}
            {item.repeat && item.repeat.kind !== 'dagelijks' ? (
              <Badge className="ml-2 align-middle">
                {repeatLabel(item)}
              </Badge>
            ) : null}
          </span>

          {item.hint && !item.secret ? (
            <span className="mt-0.5 block text-xs text-ink-500">{item.hint}</span>
          ) : null}

          {/* Een code hoort niet zomaar op het scherm te staan waar iedereen
              meekijkt; hij staat er wel, maar pas na een klik. */}
          {item.secret ? (
            revealed ? (
              <span className="mt-0.5 block font-mono text-xs text-ink-700">{item.hint}</span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setRevealed(true)
                }}
                className="mt-0.5 text-xs font-medium text-accent-700 underline"
              >
                {t('lijst.code_tonen')}
              </button>
            )
          ) : null}

          {/* Bij sommige punten is "afgevinkt" niet het hele antwoord: bij
              frituurolie gaat het om wanneer ze vervangen is, en bij een koelkast
              om hoe koud hij was. */}
          {item.veld ? <Meetveld item={item} state={state} onValue={onValue} /> : null}

          {done && state?.byName ? (
            <span className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-500">
              <Avatar profile={{ fullName: state.byName }} size="xs" />
              {state.byName}
              {state.at ? ` · ${formatTime(state.at)}` : ''}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  )
}

/**
 * Het veld naast een vinkje, met de grens erbij.
 *
 * Een vinkje bij "temperatuur koelkast gecontroleerd" zegt dat er iemand gekeken
 * heeft. Het zegt niet dat de koelkast koud genoeg was, en dat is precies wat een
 * controleur wil zien. Daarom staat de grens onder het veld en kleurt de waarde
 * rood zodra ze eroverheen gaat — meteen, terwijl de persoon er nog staat, niet
 * pas op een rapport dat een maand later gelezen wordt.
 *
 * Er wordt niets tegengehouden. Een te warme koelkast is een feit dat genoteerd
 * moet worden, geen invoerfout; hem weigeren zou de meting laten verdwijnen in
 * plaats van het probleem.
 */
function Meetveld({ item, state, onValue }) {
  const { t } = useTaal()
  const [waarde, setWaarde] = useState(state?.waarde ?? '')
  const oordeel = meetOordeel(item.veld, waarde)
  const grens = grensTekst(item.veld)
  // De naam van het veld en het punt komen uit de lijst zelf en blijven dus
  // staan zoals de beheerder ze schreef; alleen het zinnetje eromheen vertaalt.
  const veldnaam = item.veld.label ?? t('lijst.waarde')
  const naam = t('lijst.veld_voor', { veld: veldnaam, punt: item.label })

  return (
    <span className="mt-1.5 block" onClick={(e) => e.preventDefault()}>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-600">{veldnaam}</span>
        <Input
          type={item.veld.kind === 'getal' ? 'number' : 'date'}
          step={item.veld.kind === 'getal' ? 'any' : undefined}
          value={waarde}
          onChange={(e) => setWaarde(e.target.value)}
          onBlur={(e) => onValue(item, e.target.value)}
          aria-label={naam}
          aria-invalid={oordeel.staat === 'buiten' ? 'true' : undefined}
          className="h-8 max-w-[9rem] text-sm"
          style={oordeel.staat === 'buiten' ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : undefined}
        />
        {item.veld.eenheid ? <span className="text-xs text-ink-500">{item.veld.eenheid}</span> : null}
        {grens ? <span className="text-[11px] text-ink-400">{grens}</span> : null}
        {state?.waardeByName ? (
          <span className="text-[11px] text-ink-400">{t('lijst.ingevuld_door', { wie: state.waardeByName })}</span>
        ) : null}
      </span>

      {oordeel.staat === 'buiten' ? (
        <span
          role="alert"
          className="mt-1 block text-[11px] font-medium"
          style={{ color: 'var(--danger)' }}
        >
          {t(oordeel.richting === 'boven' ? 'lijst.boven_grens' : 'lijst.onder_grens', {
            grens: `${oordeel.grens}${item.veld.eenheid ? ` ${item.veld.eenheid}` : ''}`,
          })}
        </span>
      ) : null}
    </span>
  )
}
