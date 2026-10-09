import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '@lib/dates'
import { Badge, Button, EmptyState } from '@components/ds'
import PloegCode from '@components/ploeg/PloegCode'
import PageHeader from '@components/layout/PageHeader'
import { useTaal } from '@context/TaalProvider'
import { useAapiMedewerkers, useAapiShifts } from '@data/aapi'
import { afdelingLabel as aapiAfdeling, kaartVanMedewerker, kleurVan, statuutLabel } from '@lib/aapi-weergave'

/**
 * De medewerkers: studenten, flexi's, iedereen die komt werken.
 *
 * ── Waarom er hier niemand bijkomt ────────────────────────────────────────
 * Deze lijst kwam uit AAPI én uit JE Plan tegelijk: bovenaan stond wie hier een
 * account had, met een knop om iemand uit te nodigen, en daaronder de ploeg
 * zoals de personeelsadministratie haar kent. Twee lijsten met dezelfde kop, en
 * de bovenste was bijna altijd leeg — wie hier komt werken heeft geen reden om
 * in te loggen.
 *
 * Erger dan leeg: het waren twee waarheden over dezelfde vraag. Wie in dienst
 * is, staat in AAPI; daar wordt de Dimona gedaan en daar hangt het loon aan.
 * Een tweede lijst die je met de hand bijhoudt, loopt achter vanaf de dag dat
 * iemand vergeet hem bij te werken, en dan weet niemand nog welke van de twee
 * klopt.
 *
 * Dus: medewerkers komen hier binnen via de import en nergens anders. Wie
 * daarnaast een account nodig heeft — en dat zijn er weinig — krijgt dat in
 * Instellingen, bij de rollen. Daar hoort het ook: dat gaat over toegang, niet
 * over wie er zaterdag staat.
 *
 * ── Wat er staat en wat niet ──────────────────────────────────────────────
 * Wat je nodig hebt om iemand in te plannen en te bereiken: naam, afdeling,
 * statuut, e-mail, gsm, sinds wanneer hij meedraait. Geen rijksregisternummer,
 * geen rekeningnummer, geen adres — die staan in AAPI en worden bewust niet
 * meegenomen. Zie `functions/aapi/personeel.js`.
 *
 * Wie alleen uit de planningsexport komt, heeft op zijn kaartje geen afdeling
 * en geen statuut; die staan op zijn shifts. Zie `kaartVanMedewerker`.
 */

// Ruim genoeg om voor iedereen die meedraait minstens één shift te vinden.
const SHIFTS_TERUG_DAGEN = 180
const SHIFTS_VOORUIT_DAGEN = 180

export default function Medewerkers() {
  const { t } = useTaal()
  const navigate = useNavigate()
  const { medewerkers, loading } = useAapiMedewerkers()

  // Eén keer per bezoek vastgelegd: een venster dat bij elke render opschuift,
  // opent bij elke render een nieuw abonnement.
  const venster = useMemo(() => {
    const nu = Date.now()
    return {
      van: new Date(nu - SHIFTS_TERUG_DAGEN * 86400000),
      tot: new Date(nu + SHIFTS_VOORUIT_DAGEN * 86400000),
    }
  }, [])
  const { shifts } = useAapiShifts(venster)

  const ploeg = useMemo(
    () =>
      [...medewerkers]
        .sort((a, b) => String(a.displayName ?? '').localeCompare(String(b.displayName ?? '')))
        .map((m) => ({ ...m, kaart: kaartVanMedewerker(m, shifts) })),
    [medewerkers, shifts]
  )
  const zonderContact = ploeg.filter((m) => m.kaart.zonderContact).length

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.team')}
        title={t('medewerkers.titel')}
        subtitle={t('medewerkers.uitleg')}
      />

      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <section className="je-panel">
          <div className="je-panel__head">
            <span className="je-eyebrow">{t('medewerkers.uit_aapi')}</span>
            <span className="je-panel__right">{ploeg.length}</span>
          </div>

          {ploeg.length === 0 ? (
            <div style={{ padding: 'var(--space-6)' }}>
              {/*
                Een lege lijst is hier geen fout maar een stap die nog moet
                gebeuren, en dan hoort er een knop te staan die ernaartoe gaat
                in plaats van een zin die zegt dat er niets is.
              */}
              <EmptyState
                title={t(loading ? 'medewerkers.laden' : 'medewerkers.leeg')}
                description={loading ? null : t('medewerkers.leeg_uitleg')}
                actie={
                  loading
                    ? null
                    : { label: t('medewerkers.naar_import'), icon: 'upload', onClick: () => navigate('/planning?tab=import') }
                }
              />
            </div>
          ) : (
            <>
              <p className="je-muted-caption" style={{ padding: 'var(--space-3) var(--space-6) 0' }}>
                {t('medewerkers.uit_aapi_uitleg')}
              </p>
              {zonderContact > 0 ? (
                /*
                  Wie alleen uit de planningsexport komt, heeft geen e-mail of
                  gsm. Dat zeggen we één keer bovenaan, met de weg ernaartoe,
                  in plaats van vijftien keer een streepje.
                */
                <p className="je-muted-caption" style={{ padding: 'var(--space-2) var(--space-6) 0' }}>
                  {t(zonderContact === 1 ? 'medewerkers.zonder_contact_een' : 'medewerkers.zonder_contact', { aantal: zonderContact })}{' '}
                  <Button variant="ghost" size="sm" icon="upload" onClick={() => navigate('/planning?tab=import')}>
                    {t('medewerkers.naar_import')}
                  </Button>
                </p>
              ) : null}
              {ploeg.map((m) => (
                <div key={m.id} className="je-medewerker">
                  <span
                    className="je-personeelrij__streep"
                    aria-hidden="true"
                    style={{ '--afdeling': kleurVan(m.kaart.afdeling) }}
                  />
                  <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                    <div style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{m.displayName}</div>
                    <div className="je-muted-caption">
                      {[m.email, m.gsm].filter(Boolean).join(' · ') || t('medewerkers.geen_contact')}
                    </div>
                  </div>
                  {m.kaart.afdeling ? <Badge tone="neutral">{aapiAfdeling(t, m.kaart.afdeling)}</Badge> : null}
                  <Badge tone="neutral">{statuutLabel(t, m.kaart.statuut)}</Badge>
                  {m.inDienstSinds ? (
                    <span className="je-muted-caption">
                      {t('medewerkers.sinds', { datum: formatDate(m.inDienstSinds) })}
                    </span>
                  ) : null}
                  {/* De cijfercode waarmee hij zich aanmeldt. Niet zomaar
                      zichtbaar: opvragen is een handeling, en ze wordt
                      bijgehouden. Zie `functions/ploeg.js`. */}
                  <PloegCode medewerkerId={m.id} />
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
