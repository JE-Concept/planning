import { useRef, useState } from 'react'
import { formatDate, formatDateTime } from '@lib/dates'
import { Acties, Badge, Button, Icon, Stat } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { importeerPlanning, useImportRuns, useImportWachtrij } from '@data/aapi'

/**
 * Een exportbestand uit AAPI inlezen.
 *
 * ── Waarom eerst kijken en dan pas doen ───────────────────────────────────
 * Dezelfde som draait twee keer: één keer zonder te schrijven (`dryRun`) en,
 * als je het goedvindt, één keer echt. Dat is niet uit voorzichtigheid om de
 * voorzichtigheid — het is de enige manier om te zien of je het juiste bestand
 * te pakken hebt. "43 rijen, 1 tot 30 oktober, 15 mensen" is herkenbaar; een
 * bestandsnaam is dat niet.
 *
 * Dat die twee keer hetzelfde uitrekenen kan, is precies waarom het rekenwerk
 * een pure functie is (zie `functions/aapi/import.js`).
 */
/** De kleur van een regel in de wachtrij. Afgewezen is grijs en niet rood. */
const WACHTRIJ_TOON = {
  wachtend: 'neutral',
  klaar: 'success',
  afgewezen: 'neutral',
  mislukt: 'warning',
}

export default function PlanningImport({ onNaarDag }) {
  const { t } = useTaal()
  const toast = useToast()
  const invoer = useRef(null)

  const [bestand, setBestand] = useState(null)
  const [voorbeeld, setVoorbeeld] = useState(null)
  const [uitkomst, setUitkomst] = useState(null)
  const [bezig, setBezig] = useState(false)
  const [sleept, setSleept] = useState(false)

  const { runs } = useImportRuns()
  const { rijen: wachtrij } = useImportWachtrij()

  const kies = async (file) => {
    if (!file) return
    setBestand(file)
    setVoorbeeld(null)
    setUitkomst(null)
    setBezig(true)
    try {
      const { rapport } = await importeerPlanning(file, { dryRun: true })
      setVoorbeeld(rapport)
    } catch (err) {
      toast.error(err.message)
      setBestand(null)
    } finally {
      setBezig(false)
    }
  }

  const doeHet = async () => {
    setBezig(true)
    try {
      const { rapport } = await importeerPlanning(bestand, { dryRun: false })
      setUitkomst(rapport)
      setVoorbeeld(null)
      toast.success(t('aapi.import.klaar'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const opnieuw = () => {
    setBestand(null)
    setVoorbeeld(null)
    setUitkomst(null)
  }

  const rapport = uitkomst ?? voorbeeld

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <section className="je-panel" style={{ padding: 'var(--space-6)' }}>
        <h2 style={{ font: 'var(--type-h4)', margin: 0 }}>{t('aapi.import.titel')}</h2>
        <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)', margin: 'var(--space-2) 0 var(--space-5)' }}>
          {t('aapi.import.uitleg')}
        </p>

        {bestand ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <Icon name="file-text" size={20} />
            <span style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{bestand.name}</span>
            <Acties
              plaats="rij"
              terug={{ label: t('aapi.import.opnieuw'), onClick: opnieuw, uit: bezig }}
              hoofd={voorbeeld ? { label: t('aapi.import.nu'), icon: 'upload', bezig, onClick: doeHet } : null}
            />
          </div>
        ) : (
          <div
            className="je-neerzetvak"
            data-sleept={sleept ? '' : undefined}
            onDragOver={(e) => {
              e.preventDefault()
              setSleept(true)
            }}
            onDragLeave={() => setSleept(false)}
            onDrop={(e) => {
              e.preventDefault()
              setSleept(false)
              kies(e.dataTransfer.files?.[0])
            }}
          >
            <Icon name="upload" size={22} />
            <Button size="sm" variant="secondary" loading={bezig} onClick={() => invoer.current?.click()}>
              {t('aapi.import.kies')}
            </Button>
            <span className="je-muted-caption">{t('aapi.import.sleep')}</span>
            <input
              ref={invoer}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              aria-label={t('aapi.import.kies')}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                kies(file)
              }}
            />
          </div>
        )}
      </section>

      {rapport ? <Rapport rapport={rapport} definitief={Boolean(uitkomst)} onNaarDag={onNaarDag} /> : null}

      {/*
        Wat er per mail binnenkwam. Staat boven de historiek omdat het de vraag
        beantwoordt die ernaartoe leidt: "ik heb het doorgestuurd, waar is het".
        Een afgewezen bijlage staat er met de reden erbij — dat is geen storing,
        maar wel het antwoord.
      */}
      {wachtrij.length ? (
        <section className="je-panel">
          <div className="je-panel__head">
            <span className="je-eyebrow">{t('aapi.import.per_mail')}</span>
          </div>
          {wachtrij.map((rij) => (
            <div key={rij.id} className="je-importrij">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{rij.fileName}</div>
                <div className="je-muted-caption">
                  {rij.van}
                  {rij.ontvangenOp ? ` · ${formatDateTime(rij.ontvangenOp)}` : ''}
                  {rij.fout ? ` · ${rij.fout}` : ''}
                </div>
              </div>
              <Badge tone={WACHTRIJ_TOON[rij.status] ?? 'neutral'}>
                {t(`aapi.wachtrij.${rij.status}`)}
              </Badge>
            </div>
          ))}
        </section>
      ) : null}

      <section className="je-panel">
        <div className="je-panel__head">
          <span className="je-eyebrow">{t('aapi.import.historiek')}</span>
        </div>
        {runs.length === 0 ? (
          <p style={{ padding: 'var(--space-6)' }} className="je-muted-caption">
            {t('aapi.import.historiek_leeg')}
          </p>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="je-importrij">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>
                  {run.startedAt ? formatDateTime(run.startedAt) : '—'}
                </div>
                <div className="je-muted-caption">
                  {t(run.soort === 'personeel' ? 'aapi.import.soort.personeel' : 'aapi.import.soort.planning')}
                  {' · '}
                  {t(`aapi.import.bron.${run.source}`)}
                  {run.fileName ? ` · ${run.fileName}` : ''}
                  {run.byName ? ` · ${t('aapi.import.door', { wie: run.byName })}` : ''}
                </div>
              </div>
              <span className="je-muted-caption">
                {run.soort === 'personeel'
                  ? `${run.employeesCreated}+ / ${run.employeesUpdated}~ / ${run.employeesUnchanged}=`
                  : `${run.shiftsCreated}+ / ${run.shiftsUpdated}~ / ${run.shiftsUnchanged}=`}
              </span>
              <Badge tone={run.status === 'ok' ? 'success' : 'warning'}>{run.status}</Badge>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

/** Wat erin zat, of wat ervan geworden is. */
function Rapport({ rapport, definitief, onNaarDag }) {
  const { t } = useTaal()

  const periode =
    rapport.windowStart && rapport.windowEnd
      ? `${formatDate(rapport.windowStart)} – ${formatDate(rapport.windowEnd)}`
      : '—'

  return (
    <section className="je-panel" style={{ padding: 'var(--space-6)' }}>
      <div className="je-panel__head" style={{ padding: 0, marginBottom: 'var(--space-5)' }}>
        <span className="je-eyebrow">{definitief ? t('aapi.import.klaar') : t('aapi.import.voorbeeld')}</span>
      </div>

      {/*
        De personeelslijst telt mensen, de planning telt shifts. Eén rij cijfers
        die voor allebei moet dienen, zegt voor allebei de helft.
      */}
      {rapport.soort === 'personeel' ? (
        <>
          <div className="je-importcijfers">
            <Stat label={t('aapi.import.rijen')} value={String(rapport.rowsRead)} />
            <Stat label={t('aapi.import.nieuw')} value={String(rapport.employeesCreated)} />
            <Stat label={t('aapi.import.bijgewerkt')} value={String(rapport.employeesUpdated)} />
            <Stat label={t('aapi.import.ongewijzigd')} value={String(rapport.employeesUnchanged)} />
            <Stat label={t('aapi.import.herkend')} value={String(rapport.employeesMatched)} />
          </div>
          {/*
            Wat er in het bestand stond en met opzet niet overgenomen is. Dit
            hoort in het rapport en niet alleen in de code: wie het uploadt mag
            weten wat ermee gebeurd is — zeker bij dít bestand.
          */}
          {rapport.weggelaten?.length ? (
            <p className="je-muted-caption" style={{ marginTop: 'var(--space-4)' }}>
              <Icon name="lock" size={14} /> {t('aapi.import.weggelaten', { velden: rapport.weggelaten.join(', ') })}
            </p>
          ) : null}
        </>
      ) : (
      <div className="je-importcijfers">
        <Stat label={t('aapi.import.rijen')} value={String(rapport.rowsRead)} />
        <Stat label={t('aapi.import.periode')} value={periode} />
        <Stat label={t('aapi.import.mensen')} value={String(rapport.employeesSeen)} sub={rapport.employeesCreated ? `+${rapport.employeesCreated}` : undefined} />
        <Stat label={t('aapi.import.eventshifts')} value={String(rapport.eventShifts)} />
        <Stat label={t('aapi.import.nieuw')} value={String(rapport.shiftsCreated)} />
        <Stat label={t('aapi.import.bijgewerkt')} value={String(rapport.shiftsUpdated)} />
        <Stat label={t('aapi.import.ongewijzigd')} value={String(rapport.shiftsUnchanged)} />
        <Stat label={t('aapi.import.verdwenen')} value={String(rapport.shiftsRemoved)} />
        <Stat label={t('aapi.import.gekoppeld')} value={String(rapport.linksAuto)} />
        <Stat label={t('aapi.import.twijfel')} value={String(rapport.linksAmbiguous)} />
      </div>
      )}

      {/*
        Een kolom die erbij gekomen is, is geen fout maar wel iets wat iemand
        moet weten: er staat iets in de export dat wij niet lezen.
      */}
      {rapport.unknownColumns?.length ? (
        <p className="je-muted-caption" style={{ marginTop: 'var(--space-4)' }}>
          <Icon name="info" size={14} /> {t('aapi.import.onbekende_kolommen', { kolommen: rapport.unknownColumns.join(', ') })}
        </p>
      ) : null}

      {rapport.errors?.length ? (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <span className="je-caps">{t('aapi.import.fouten')}</span>
          <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: '1.2em', font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>
            {rapport.errors.map((f) => (
              <li key={`${f.rij}-${f.planningId ?? ''}`}>{t('aapi.import.fout_regel', { rij: f.rij, reden: f.reden })}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {definitief && rapport.linksAmbiguous > 0 ? (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <span className="je-caps">{t('aapi.import.nazien')}</span>
          <p className="je-muted-caption" style={{ marginTop: 4 }}>{t('aapi.import.nazien_uitleg')}</p>
          {onNaarDag && rapport.windowStart ? (
            <Button
              size="sm"
              variant="secondary"
              iconLeft="calendar-days"
              style={{ marginTop: 'var(--space-3)' }}
              onClick={() => onNaarDag(String(rapport.windowStart).slice(0, 10))}
            >
              {t('aapi.event.naar_kalender')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
