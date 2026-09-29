import { useMemo, useState } from 'react'
import { addMonths, formatDate, formatMonth, formatTime, startOfMonth } from '@lib/dates'
import { maandVerslag, meetpunten, naarCsv, reeksVoorPunt } from '@lib/checklist-report'
import { Button, EmptyState, Icon, Spinner } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useChecklists, useRunsInRange } from '@data/checklists'

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
  const { runs, loading } = useRunsInRange(`${sleutel}-01`, `${sleutel}-${laatsteDag}`)

  const verslag = useMemo(
    () => maandVerslag({ maand: sleutel, checklists, runs }),
    [sleutel, checklists, runs]
  )

  const grafieken = useMemo(() => meetpunten(verslag), [verslag])

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
        // Kop en ondertitel horen bij het document: de afdrukstijl laat ze staan
        // en verbergt alleen de knoppen ernaast. Dus Nederlands, in beide talen.
        eyebrow="Registraties"
        title={formatMonth(maand)}
        subtitle="Wat er afgevinkt is, door wie, en wat er gemeten werd."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMaand(addMonths(maand, -1))}
              aria-label={t('rapport.vorige_maand')}
            >
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMaand(startOfMonth())}>
              {t('rapport.deze_maand')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMaand(addMonths(maand, 1))}
              disabled={addMonths(maand, 1) > new Date()}
              aria-label={t('rapport.volgende_maand')}
            >
              ›
            </Button>
            <Button variant="secondary" size="sm" iconLeft="download" onClick={downloadCsv}>
              CSV
            </Button>
            <Button size="sm" iconLeft="file-text" onClick={() => window.print()}>
              {t('rapport.afdrukken')}
            </Button>
          </>
        }
      />

      <div className="je-pagebody">
        {/* Alleen op papier: een blad zonder kop zegt niet waarover het gaat. */}
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
            {/* Vanaf hier is alles document en niets scherm: vaste Nederlandse
                tekst, zodat dezelfde maand altijd hetzelfde blad oplevert. */}
            <div className="je-dash__cijfers">
              <Vak label="Afgevinkt" waarde={`${Math.round(verslag.ratio * 100)}%`} onder={`${verslag.gedaan} van ${verslag.verplicht} punten`} />
              <Vak label="Volledige dagen" waarde={`${verslag.volledigeDagen}/${verslag.dagenMetWerk}`} onder="alles afgevinkt" />
              <Vak
                label="Overschrijdingen"
                waarde={verslag.overschrijdingen.length}
                onder={verslag.overschrijdingen.length ? 'buiten de grens' : 'alles binnen de grens'}
                slecht={verslag.overschrijdingen.length > 0}
              />
            </div>

            {verslag.overschrijdingen.length ? (
              <section className="je-panel je-report__blok">
                <div className="je-panel__head" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                  <span className="je-eyebrow" style={{ color: 'var(--danger)' }}>
                    Metingen buiten de grens
                  </span>
                </div>
                <table className="je-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Wat</th>
                      <th>Gemeten</th>
                      <th>Grens</th>
                      <th>Ingevuld door</th>
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
                          {o.richting === 'boven' ? 'max' : 'min'} {o.grens} {o.eenheid}
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
                <span className="je-eyebrow">Dag per dag</span>
                <span className="je-panel__right">{verslag.dagen.length} dagen</span>
              </div>
              <table className="je-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Lijst</th>
                    <th>Afgevinkt</th>
                    <th>Afgerond door</th>
                    <th>Wat open bleef</th>
                  </tr>
                </thead>
                <tbody>
                  {verslag.dagen.flatMap((dag) =>
                    dag.lijsten.map((lijst) => (
                      <tr key={`${dag.dag}-${lijst.checklistId}`} className={lijst.volledig ? undefined : 'je-report__open'}>
                        <td>{formatDate(`${dag.dag}T12:00:00`)}</td>
                        <td>{lijst.checklistName}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {lijst.gedaan.length}/{lijst.verplicht}
                        </td>
                        <td>
                          {lijst.afgerondDoor
                            ? `${lijst.afgerondDoor}${lijst.afgerondOm ? ` om ${formatTime(lijst.afgerondOm)}` : ''}`
                            : lijst.begonnen
                              ? 'niet afgerond'
                              : 'niet begonnen'}
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
                            <em>niets afgevinkt</em>
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
              Dit verslag komt rechtstreeks uit de afvinklijsten van JE Plan. Elk vinkje draagt de naam van
              wie het zette en het tijdstip; de gemeten waarden staan zoals ze ingevuld zijn.
              {isAdmin ? ' De lijsten zelf zijn aan te passen in Instellingen → Dagelijkse lijsten.' : ''}
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
          {reeks.aantal} metingen · laagste {reeks.min} {reeks.eenheid} · hoogste {reeks.max} {reeks.eenheid}
        </span>
      </div>
      <div className="je-report__grafiek">
        <svg viewBox={`0 0 ${B} ${H}`} role="img" aria-label={`${reeks.label} per dag`} preserveAspectRatio="none">
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
                grens {grens} {reeks.eenheid}
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
          Op {reeks.punten.length - reeks.aantal} van de {reeks.punten.length} dagen is er niets gemeten.
        </p>
      ) : null}
    </section>
  )
}
