import { useMemo, useState } from 'react'
import { addMonths, formatDate, formatMonth, formatTime, startOfMonth } from '@lib/dates'
import { maandVerslag, meetStand, meetpunten, naarCsv, reeksVoorPunt } from '@lib/checklist-report'
import { EmptyState, Icon, PeriodeKiezer, Spinner } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useChecklists, useRunsInRange, useSluiting } from '@data/checklists'

/**
 * Het verslag waar een controle om vraagt.
 *
 * Afvinken is de helft van het werk; de andere helft is kunnen tonen dát het
 * gebeurd is. Op papier was dat een map met bladen, en het enige wat die map kon
 * wat een scherm niet kan, is op tafel gelegd worden. Vandaar dat deze pagina
 * bedoeld is om afgedrukt te worden: de knop maakt er een PDF van via het
 * afdrukvenster van de browser, en wat op het scherm hoort maar niet op papier —
 * de navigatie, de knoppen — verdwijnt daarbij vanzelf.
 *
 * Wat erin staat is wat gevraagd wordt: per dag wie wat afvinkte, welke punten
 * open bleven, en de gemeten temperaturen met hun grens. De overschrijdingen
 * staan bovenaan apart, want dat is waar een controleur naar zoekt en niet iets
 * wat je hem in dertig dagtabellen laat opzoeken.
 *
 * Dit verslag blijft Nederlands, ook wanneer de tool op Engels staat.
 *
 * Het is geen scherm maar een document: het gaat naar de printer en ligt bij een
 * FAVV-controle op tafel. Een controleur leest Nederlands, en een bewijsstuk dat
 * per gebruiker van taal verandert is geen bewijsstuk — dan kan twee keer
 * dezelfde maand twee verschillende papieren opleveren. Alles binnen `je-report`
 * staat daarom met vaste tekst in de code: de kop, de cijfers, de kolommen, de
 * voetnoot. Hetzelfde geldt voor de CSV-export; zie `naarCsv` in
 * `@lib/checklist-report`.
 *
 * Vertaald wordt enkel wat bedienen is: bladeren, exporteren, afdrukken, en de
 * lege staat. Die knoppen staan niet op papier — de afdrukstijl haalt ze weg —
 * dus ze mogen de taal van wie kijkt volgen.
 */
export default function ChecklistReport() {
  const { isAdmin } = useAuth()
  const { t } = useTaal()
  const [maand, setMaand] = useState(() => startOfMonth())

  const sleutel = `${maand.getFullYear()}-${String(maand.getMonth() + 1).padStart(2, '0')}`
  const laatsteDag = new Date(maand.getFullYear(), maand.getMonth() + 1, 0).getDate()

  const { checklists } = useChecklists({ includeArchived: true })
  const { runs, loading: runsLaden } = useRunsInRange(`${sleutel}-01`, `${sleutel}-${laatsteDag}`)
  const { sluiting, loading: sluitingLaadt } = useSluiting()
  // Wachten op de sluitingsdagen: anders staat elke maandag even als "niet
  // begonnen" op het scherm, en wie net dan afdrukt, drukt dat af.
  const loading = runsLaden || sluitingLaadt

  const verslag = useMemo(
    () => maandVerslag({ maand: sleutel, checklists, runs, sluiting }),
    [sleutel, checklists, runs, sluiting]
  )

  const grafieken = useMemo(() => meetpunten(verslag), [verslag])
  const stand = meetStand(verslag)

  const downloadCsv = () => {
    // De byte order mark ervoor, anders leest Excel de accenten verkeerd en
    // wordt "Temperatuur koelcel" een rij vol vraagtekens.
    const blob = new Blob(['\uFEFF', naarCsv(verslag)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `registraties-${sleutel}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }} className="je-report">
      <PageHeader
        eyebrow={t('rapport.eyebrow')}
        title={formatMonth(maand)}
        subtitle={t('rapport.ondertitel')}
        bediening={
          <PeriodeKiezer
            vorige={{ label: t('rapport.vorige_maand'), onClick: () => setMaand(addMonths(maand, -1)) }}
            nu={{ label: t('rapport.deze_maand'), onClick: () => setMaand(startOfMonth()) }}
            volgende={{
              label: t('rapport.volgende_maand'),
              onClick: () => setMaand(addMonths(maand, 1)),
              uit: addMonths(maand, 1) > new Date(),
            }}
          />
        }
        acties={{
          tweede: { label: 'CSV', icon: 'download', onClick: downloadCsv },
          hoofd: { label: t('rapport.afdrukken'), icon: 'file-text', onClick: () => window.print() },
        }}
      />

      <div className="je-pagebody">
        {/*
          Alleen op papier: een blad zonder kop zegt niet waarover het gaat.

          Deze twee regels blijven Nederlands in beide talen. Ze staan nooit op
          het scherm — de afdrukstijl haalt ze tevoorschijn — en ze zijn de kop
          van het blad dat bij een FAVV-controle op tafel ligt.
        */}
        <div className="je-report__kop">
          <strong>JE Concept — registraties {formatMonth(maand)}</strong>
          <span>Afgedrukt op {formatDate(new Date())}</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <Spinner />
          </div>
        ) : verslag.dagen.length === 0 ? (
          <EmptyState title={t('rapport.leeg_titel')} description={t('rapport.leeg_tekst')} />
        ) : (
          <>
            {/*
              Het scherm volgt de taal; het bestand dat je downloadt niet. De
              CSV houdt vaste Nederlandse kolomkoppen, want twee exports van
              dezelfde maand horen hetzelfde bestand te zijn — zie `naarCsv`.
            */}
            <div className="je-dash__cijfers">
              <Vak
                label={t('rapport.vak.afgevinkt')}
                waarde={`${Math.round(verslag.ratio * 100)}%`}
                onder={t('rapport.vak.punten', { gedaan: verslag.gedaan, totaal: verslag.verplicht })}
              />
              {/* Gesloten dagen tellen niet mee in de noemer, maar staan er wel
                  onder: "4/5" zonder meer laat de lezer raden waar de rest van
                  de week bleef. */}
              <Vak
                label={t('rapport.vak.volledige_dagen')}
                waarde={`${verslag.volledigeDagen}/${verslag.dagenMetWerk}`}
                onder={
                  verslag.geslotenDagen
                    ? `${t('rapport.vak.alles_afgevinkt')} · ${t('rapport.vak.gesloten', { aantal: verslag.geslotenDagen })}`
                    : t('rapport.vak.alles_afgevinkt')
                }
              />
              {/* Nul overschrijdingen zonder één meting is geen goed nieuws maar
                  een leeg blad; zie `meetStand`. */}
              <Vak
                label={t('rapport.vak.overschrijdingen')}
                waarde={stand === 'geen' ? '—' : verslag.overschrijdingen.length}
                onder={
                  stand === 'buiten'
                    ? t('rapport.vak.buiten')
                    : stand === 'binnen'
                      ? t('rapport.vak.binnen_gemeten', { gemeten: verslag.gemeten, totaal: verslag.meetpunten })
                      : t('rapport.vak.geen_metingen')
                }
                slecht={stand === 'buiten' || (stand === 'geen' && verslag.meetpunten > 0)}
              />
            </div>

            {verslag.overschrijdingen.length ? (
              <section className="je-panel je-report__blok">
                <div className="je-panel__head" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                  <span className="je-eyebrow" style={{ color: 'var(--danger)' }}>
                    {t('rapport.buiten.titel')}
                  </span>
                </div>
                <table className="je-table">
                  <thead>
                    <tr>
                      <th>{t('rapport.kol.datum')}</th>
                      <th>{t('rapport.kol.wat')}</th>
                      <th>{t('rapport.kol.gemeten')}</th>
                      <th>{t('rapport.kol.grens')}</th>
                      <th>{t('rapport.kol.ingevuld_door')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verslag.overschrijdingen.map((o, i) => (
                      <tr key={`${o.dag}-${o.puntId}-${i}`}>
                        <td>{formatDate(`${o.dag}T12:00:00`)}</td>
                        <td>{o.label}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                          {o.waarde} {o.eenheid}
                        </td>
                        <td>
                          {o.richting === 'boven' ? t('rapport.grens.max') : t('rapport.grens.min')} {o.grens} {o.eenheid}
                        </td>
                        <td>{o.door ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            {grafieken.map((punt) => (
              <Grafiek key={punt.id} reeks={reeksVoorPunt(verslag, punt.id)} />
            ))}

            <section className="je-panel je-report__blok">
              <div className="je-panel__head" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <span className="je-eyebrow">{t('rapport.dag.titel')}</span>
                <span className="je-panel__right">{t('rapport.dagen', { aantal: verslag.dagen.length })}</span>
              </div>
              <table className="je-table">
                <thead>
                  <tr>
                    <th>{t('rapport.kol.datum')}</th>
                    <th>{t('rapport.kol.lijst')}</th>
                    <th>{t('rapport.kol.afgevinkt')}</th>
                    <th>{t('rapport.kol.afgerond_door')}</th>
                    <th>{t('rapport.kol.open')}</th>
                  </tr>
                </thead>
                <tbody>
                  {verslag.dagen.flatMap((dag) =>
                    // Een gesloten dag waarop niets gedaan werd, krijgt één regel
                    // en geen rij per lijst. Weglaten zou een gat in de datums
                    // laten; elke lijst als "niet begonnen" tonen was de fout.
                    dag.gesloten && dag.lijsten.length === 0 ? (
                      <tr key={dag.dag} className="je-report__gesloten">
                        <td>{formatDate(`${dag.dag}T12:00:00`)}</td>
                        <td colSpan={4}>
                          <em>
                            {dag.gesloten.reden
                              ? t('rapport.gesloten_reden', { reden: dag.gesloten.reden })
                              : t('rapport.gesloten')}
                          </em>
                        </td>
                      </tr>
                    ) : dag.lijsten.map((lijst) => (
                      <tr key={`${dag.dag}-${lijst.checklistId}`} className={lijst.volledig ? undefined : 'je-report__open'}>
                        <td>
                          {formatDate(`${dag.dag}T12:00:00`)}
                          {dag.gesloten ? <span className="je-report__klein">{t('rapport.gesloten_toch')}</span> : null}
                        </td>
                        <td>{lijst.checklistName}</td>
                        {/*
                          Het aantal verspringt met de herhaling van de punten —
                          op de 1e telt het poetsplan er twaalf, op een donderdag
                          vijf. Wie dat niet weet, leest het als een fout; vandaar
                          eronder hoeveel er die dag periodiek bij kwamen, met de
                          namen in de tooltip. Zie `@lib/checklist-report`.
                        */}
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {lijst.gedaan.length}/{lijst.verplicht}
                          {lijst.periodiek.length ? (
                            <span
                              className="je-report__klein"
                              title={lijst.periodiek.map((p) => p.label).join(', ')}
                            >
                              {t('rapport.periodiek', { aantal: lijst.periodiek.length })}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {lijst.afgerondDoor
                            ? [
                                lijst.afgerondDoor,
                                lijst.afgerondOm ? t('rapport.om', { tijd: formatTime(lijst.afgerondOm) }) : null,
                              ]
                                .filter(Boolean)
                                .join(' ')
                            : lijst.begonnen
                              ? t('rapport.niet_afgerond')
                              : t('rapport.niet_begonnen')}
                        </td>
                        {/*
                          Een dag die niet begonnen is, alle punten laten
                          uitschrijven zegt niets meer: dat zijn er vierentwintig
                          en de boodschap is "geen enkel". Wat wél telt is welke
                          punten op een dag die wél gedaan is, zijn blijven staan.
                          Op papier staat de hele opsomming er, want dat is het
                          bewijsstuk; op het scherm wordt ze afgekapt, want daar
                          lees je een tabel.
                        */}
                        <td className="je-report__ontbreekt">
                          {lijst.ontbreekt.length === 0 ? (
                            '—'
                          ) : !lijst.begonnen ? (
                            <em>{t('rapport.niets_afgevinkt')}</em>
                          ) : (
                            <span className="je-report__kort">
                              {lijst.ontbreekt.map((p) => p.label).join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <p className="je-report__voet">
              {t('rapport.voet')} {t('rapport.voet_telling')}
              {isAdmin ? ` ${t('rapport.voet_admin')}` : ''} {t('rapport.csv_blijft_nl')}
            </p>
          </>
        )}
      </div>
    </div>
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

/**
 * De metingen van één punt over de maand.
 *
 * Met de hand getekend in SVG en niet met een bibliotheek: het is één lijn met
 * een grens erdoor, en daar een pakket voor meeleveren kost iedereen laadtijd
 * voor iets wat in dertig regels past.
 *
 * Twee dingen doen het werk. De schaal loopt altijd tot voorbij de grens, ook
 * als geen enkele meting daar in de buurt kwam — anders staat de grenslijn buiten
 * beeld en lijkt alles net goed. En dagen zonder meting zijn een onderbreking in
 * de lijn, geen rechte verbinding naar de volgende dag: dat laatste zou een maand
 * met gaten tonen als een maand waarin elke dag gemeten is.
 */
function Grafiek({ reeks }) {
  const { t } = useTaal()
  const B = 640
  const H = 150
  const marge = { links: 40, rechts: 12, boven: 12, onder: 20 }

  if (reeks.aantal === 0) return null

  const grenswaarden = reeks.punten
    .map((p) => p.meting?.grens)
    .filter((g) => g != null)
  const grens = grenswaarden.length ? grenswaarden[0] : null

  const alles = [reeks.min, reeks.max, ...(grens != null ? [grens] : [])]
  let laag = Math.min(...alles)
  let hoog = Math.max(...alles)
  if (hoog === laag) {
    laag -= 1
    hoog += 1
  }
  const lucht = (hoog - laag) * 0.15
  laag -= lucht
  hoog += lucht

  const x = (i) => marge.links + (i * (B - marge.links - marge.rechts)) / Math.max(1, reeks.punten.length - 1)
  const y = (v) => marge.boven + ((hoog - v) * (H - marge.boven - marge.onder)) / (hoog - laag)

  // Losse stukken lijn, zodat een dag zonder meting een gat blijft.
  const stukken = []
  let huidig = []
  reeks.punten.forEach((punt, i) => {
    if (punt.meting) huidig.push(`${x(i)},${y(punt.meting.waarde)}`)
    else if (huidig.length) {
      stukken.push(huidig)
      huidig = []
    }
  })
  if (huidig.length) stukken.push(huidig)

  return (
    <section className="je-panel je-report__blok">
      <div className="je-panel__head" style={{ padding: 'var(--space-4) var(--space-5)' }}>
        <span className="je-eyebrow">{reeks.label}</span>
        <span className="je-panel__right">
          {t('rapport.grafiek.samenvatting', {
            aantal: reeks.aantal,
            min: reeks.min,
            max: reeks.max,
            eenheid: reeks.eenheid,
          })}
        </span>
      </div>
      <div className="je-report__grafiek">
        <svg
          viewBox={`0 0 ${B} ${H}`}
          role="img"
          aria-label={t('rapport.grafiek.aria', { label: reeks.label })}
          preserveAspectRatio="none"
        >
          {[hoog, (hoog + laag) / 2, laag].map((waarde) => (
            <g key={waarde}>
              <line x1={marge.links} x2={B - marge.rechts} y1={y(waarde)} y2={y(waarde)} stroke="var(--border-hairline)" strokeWidth="1" />
              <text x={marge.links - 6} y={y(waarde) + 3} textAnchor="end" fontSize="9" fill="var(--text-3)">
                {waarde.toFixed(1)}
              </text>
            </g>
          ))}

          {grens != null ? (
            <>
              <line
                x1={marge.links}
                x2={B - marge.rechts}
                y1={y(grens)}
                y2={y(grens)}
                stroke="var(--danger)"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <text x={B - marge.rechts} y={y(grens) - 4} textAnchor="end" fontSize="9" fill="var(--danger)">
                {t('rapport.grafiek.grens', { waarde: grens, eenheid: reeks.eenheid })}
              </text>
            </>
          ) : null}

          {stukken.map((stuk, i) => (
            <polyline key={i} points={stuk.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
          ))}

          {reeks.punten.map((punt, i) =>
            punt.meting ? (
              <circle
                key={punt.dag}
                cx={x(i)}
                cy={y(punt.meting.waarde)}
                r="2.5"
                fill={punt.meting.staat === 'buiten' ? 'var(--danger)' : 'var(--accent)'}
              />
            ) : null
          )}
        </svg>
        <div className="je-report__asx">
          <span>{reeks.punten[0]?.dag.slice(-2)}</span>
          <span>{reeks.punten.at(-1)?.dag.slice(-2)}</span>
        </div>
      </div>
      {reeks.aantal < reeks.punten.length ? (
        <p className="je-report__gat">
          <Icon name="alert-triangle" size={14} />
          {t('rapport.grafiek.gaten', {
            zonder: reeks.punten.length - reeks.aantal,
            totaal: reeks.punten.length,
          })}
        </p>
      ) : null}
    </section>
  )
}
