import { useMemo } from 'react'
import { margeVan } from '@lib/marge'
import { euro } from '@components/events/parts'
import { Badge } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useKosten } from '@data/kosten'

/**
 * Wat dit dossier opbracht, en wat het kostte.
 *
 * ── Waarom dit op de fiche staat en niet in een rapport ───────────────────
 * Omdat de vraag bij het dossier hoort. "Verdient een BBQ van veertig
 * personen iets" beslist iemand terwijl hij naar dát event kijkt, niet
 * achteraf in een overzicht dat niemand opent. En de gegevens die de marge
 * mist — een inkoopprijs, een ploeg die nog niet gekoppeld is — zijn hier
 * met één klik te halen.
 *
 * ── Waarom "onvolledig" zo prominent staat ────────────────────────────────
 * Een ontbrekende inkoopprijs telt niet als nul, want dan zou een half
 * ingevuld dossier er winstgevender uitzien dan een volledig ingevuld (zie
 * `lib/marge.js`). Het gevolg is dat de marge in dat geval een bovengrens is,
 * en dat hoort er niet klein onder te staan maar ernaast.
 *
 * ── Wat hier met opzet niet staat ─────────────────────────────────────────
 * Geen bedrag per persoon. De loonkost staat per statuut opgeteld. Wie wat
 * verdient hoort in AAPI; dit is een raming om een formule mee te beoordelen.
 */
export default function EventMarge({ event, shifts = [], uren = [] }) {
  const { t } = useTaal()
  const { profileById } = useWorkspace()
  const { tarieven } = useKosten()

  const marge = useMemo(
    () =>
      margeVan({
        event,
        shifts,
        bestellijst: event?.bestellijst ?? [],
        uren,
        profielen: profileById,
        tarieven,
      }),
    [event, shifts, uren, profileById, tarieven]
  )

  if (marge.opbrengst == null && marge.kost === 0) return null

  const regels = [
    { sleutel: 'marge.loon', bedrag: marge.loon.kost, onder: t('marge.uren_ploeg', { uren: marge.loon.uren }) },
    { sleutel: 'marge.inkoop', bedrag: marge.inkoop.kost, onder: t('marge.regels', { aantal: marge.inkoop.regels }) },
    { sleutel: 'marge.eigen', bedrag: marge.eigen.kost, onder: t('marge.uren_team', { uren: marge.eigen.uren }) },
  ]

  return (
    <section className="je-panel je-marge">
      <div className="je-panel__head">
        <span className="je-eyebrow">{t('marge.titel')}</span>
        {marge.volledig ? null : (
          <Badge tone="warning">{t('marge.onvolledig')}</Badge>
        )}
        <span className="je-panel__right">{t('marge.excl_btw')}</span>
      </div>

      <div className="je-marge__cijfers">
        <div className="je-marge__vak">
          <span className="je-caps">{t('marge.opbrengst')}</span>
          <span className="je-marge__waarde">{marge.opbrengst == null ? '—' : euro(marge.opbrengst)}</span>
        </div>
        <div className="je-marge__vak">
          <span className="je-caps">{t('marge.kost')}</span>
          <span className="je-marge__waarde">{euro(marge.kost)}</span>
        </div>
        <div className="je-marge__vak">
          <span className="je-caps">{marge.volledig ? t('marge.marge') : t('marge.marge_hoogstens')}</span>
          <span
            className="je-marge__waarde"
            style={{ color: marge.marge != null && marge.marge < 0 ? 'var(--danger)' : undefined }}
          >
            {marge.marge == null ? '—' : euro(marge.marge)}
          </span>
          {marge.percent == null ? null : <span className="je-dash__sub">{marge.percent}%</span>}
        </div>
      </div>

      <div className="je-marge__regels">
        {regels.map((r) => (
          <div key={r.sleutel} className="je-marge__regel">
            <span>{t(r.sleutel)}</span>
            <span className="je-muted-caption">{r.onder}</span>
            <span className="je-marge__bedrag">{euro(r.bedrag)}</span>
          </div>
        ))}
      </div>

      {marge.volledig ? null : (
        <div className="je-marge__mist">
          <p className="je-caps" style={{ marginBottom: 'var(--space-2)' }}>{t('marge.wat_mist')}</p>
          <ul>
            {marge.ontbreekt.map((o) => (
              <li key={o.soort}>{uitleg(t, o)}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** Eén zin per ontbrekend stuk, met het aantal erbij zodat je weet wat je te doen staat. */
function uitleg(t, o) {
  if (o.soort === 'opbrengst') return t('marge.mist.opbrengst')
  if (o.soort === 'tarief') return t('marge.mist.tarief', { statuten: o.statuten.join(', ') })
  if (o.soort === 'inkoopprijs') return t('marge.mist.inkoopprijs', { aantal: o.aantal })
  if (o.soort === 'uurtarief') return t('marge.mist.uurtarief', { mensen: o.mensen.join(', ') })
  return t('marge.mist.geen_ploeg')
}
