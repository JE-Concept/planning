import { useMemo, useState } from 'react'
import { addDays, formatTime, startOfMonth, startOfWeek } from '@lib/dates'
import { SOORTEN, filter, mensenIn, naarCsv, perDag, zinVan } from '@lib/logboek'
import { Badge, EmptyState, Input, Select, Spinner } from '@components/ds'
import PageHeader from '@components/layout/PageHeader'
import { useTaal } from '@context/TaalProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useLogboek } from '@data/logboek'

/**
 * Het logboek: wie heeft wat veranderd, in de hele tool.
 *
 * De vraag die dit beantwoordt komt in elk team langs zodra er met meer dan
 * twee mensen gewerkt wordt: "wie heeft dit verzet?" — en een halve dag later
 * "en wanneer is die prijs dan veranderd?". Tot nu stond dat alleen per taak in
 * het takenpaneel; alles daarbuiten (een klant, een formule, een rol, een
 * regel in de regelengine) was onvindbaar.
 *
 * Het staat onder Team en niet in Instellingen, met opzet. Instellingen is van
 * de beheerders; dit is van iedereen. Een logboek dat alleen de baas mag
 * inkijken is een controlemiddel, een logboek dat het hele team mag inkijken is
 * een geheugen — en dit is bedoeld als het tweede.
 *
 * Per dag gegroepeerd, want zo wordt het gelezen: je weet ongeveer wanneer iets
 * gebeurde en zoekt van daaruit. De filters staan erboven voor het andere
 * geval: je weet wat er veranderde maar niet wanneer.
 */
export default function Logboek() {
  const { t } = useTaal()
  const { profileById } = useWorkspace()

  const [soort, setSoort] = useState('')
  const [wie, setWie] = useState('')
  const [zoek, setZoek] = useState('')
  const [periode, setPeriode] = useState('maand')

  // Eén filter gaat mee in de query (daar staat een index voor klaar), de rest
  // filtert hier. Waarom dat zo is, staat in `@data/logboek`.
  const { regels, loading, fout } = useLogboek({ soort, wie: soort ? '' : wie })

  const vanaf = useMemo(() => {
    const nu = new Date()
    if (periode === 'week') return startOfWeek(nu)
    if (periode === 'maand') return startOfMonth(nu)
    if (periode === 'kwartaal') return addDays(nu, -90)
    return null
  }, [periode])

  const gefilterd = useMemo(() => filter(regels, { wie, soort, zoek, vanaf }), [regels, wie, soort, zoek, vanaf])
  const dagen = useMemo(() => perDag(gefilterd), [gefilterd])
  const mensen = useMemo(() => mensenIn(regels), [regels])

  const exporteer = () => {
    const blob = new Blob([naarCsv(gefilterd)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `logboek-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div>
      <PageHeader
        eyebrow="JE Plan"
        title={t('logboek.titel')}
        subtitle={t('logboek.regel', { aantal: gefilterd.length })}
        acties={
          gefilterd.length
            ? { tweede: { label: t('logboek.exporteer'), icon: 'file-text', onClick: exporteer } }
            : null
        }
      />

      <div className="je-pagebody">
        <p className="je-muted-caption" style={{ marginBottom: 'var(--space-5)' }}>
          {t('logboek.uitleg')} {t('logboek.bewaartermijn')}
        </p>

        <div className="je-filterbalk">
          <div className="je-filterbalk__zoek">
            <Input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder={t('logboek.zoeken')}
              aria-label={t('logboek.zoeken')}
            />
          </div>

          <Select
            boxed
            value={wie}
            onChange={(e) => setWie(e.target.value)}
            aria-label={t('logboek.iedereen')}
            options={[
              { value: '', label: t('logboek.iedereen') },
              ...mensen.map((m) => ({ value: m.id, label: profileById[m.id]?.fullName ?? m.naam })),
            ]}
          />

          <Select
            boxed
            value={soort}
            onChange={(e) => setSoort(e.target.value)}
            aria-label={t('logboek.alles')}
            options={[
              { value: '', label: t('logboek.alles') },
              ...SOORTEN.map((s) => ({ value: s, label: t(`logboek.soort.${s}`) })),
            ]}
          />

          <Select
            boxed
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            aria-label={t('logboek.periode')}
            options={[
              { value: 'week', label: t('logboek.periode_week') },
              { value: 'maand', label: t('logboek.periode_maand') },
              { value: 'kwartaal', label: t('logboek.periode_kwartaal') },
              { value: '', label: t('logboek.periode_alles') },
            ]}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <Spinner />
          </div>
        ) : fout ? (
          <EmptyState title={t('schil.laadt_niet_titel')} description={fout.code ?? fout.message} />
        ) : !regels.length ? (
          <EmptyState title={t('logboek.nog_niets')} description={t('logboek.nog_niets_uitleg')} />
        ) : !dagen.length ? (
          <EmptyState title={t('logboek.niets')} description={t('logboek.niets_uitleg')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {dagen.map((dag) => (
              <section key={dag.sleutel}>
                <div className="je-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
                  {dag.label}
                </div>
                <ul className="je-panel" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {dag.regels.map((regel, i) => (
                    <li
                      key={regel.id}
                      style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        padding: 'var(--space-4) var(--space-5)',
                        borderTop: i ? '1px solid var(--border-hairline)' : 'none',
                        alignItems: 'baseline',
                      }}
                    >
                      <span
                        className="je-muted-caption"
                        style={{ fontVariantNumeric: 'tabular-nums', minWidth: 42 }}
                      >
                        {formatTime(regel.at)}
                      </span>
                      <Badge tone="neutral">{t(`logboek.soort.${regel.soort}`)}</Badge>
                      <span style={{ flex: 1, font: 'var(--type-body-sm)' }}>
                        {zinVan(regel)}
                        {/* Bij een verwijdering is de schrijver er niet meer om
                            te zeggen wie het deed. Dat hoort erbij te staan. */}
                        {regel.actorZeker === false ? (
                          <span className="je-muted-caption" style={{ display: 'block', marginTop: 2 }}>
                            {t('logboek.onzeker')}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
