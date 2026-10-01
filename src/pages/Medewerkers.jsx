import { useMemo, useState } from 'react'
import { formatDate } from '@lib/dates'
import { AFDELINGEN, afdelingLabel } from '@lib/checklist-templates'
import { Avatar, Badge, Button, Field, Icon, Input, Select } from '@components/ds'
import { EmptyState } from '@ui/index'
import PageHeader from '@components/layout/PageHeader'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useEvents } from '@data/events'
import { inviteMember, setMemberActive, setMemberDepartment } from '@data/workspace'
import { useAapiMedewerkers } from '@data/aapi'
/*
  Twee soorten afdeling met dezelfde naam, en ze zijn niet hetzelfde. Die van de
  afvinklijsten zijn keuken, zaal, verantwoordelijke en iedereen — ze bepalen
  welke punten je ziet. Die van AAPI zijn bar, zaal, keuken en evenementen — ze
  zeggen waar iemand staat. Ze overlappen half, en juist daarom staan ze hier
  met twee namen in plaats van door elkaar.
*/
import { STATUUT_TEKST, afdelingLabel as aapiAfdeling, kleurVan } from '@lib/aapi-weergave'

/**
 * De medewerkers: studenten, flexi's, iedereen die komt werken.
 *
 * ── Waarom dit niet in de instellingen staat ──────────────────────────────
 * Daar staat de rollentabel: wie beheerder is, wie de socials doet. Dat is iets
 * wat je drie keer per jaar aanraakt. Dit is operationeel — elke maand komt er
 * iemand bij en gaat er iemand weg, en elke week wil je weten wie er waar
 * staat. Dat hoort bij Team en niet achter een tandwiel.
 *
 * ── Wat er wél en niet staat ──────────────────────────────────────────────
 * Hun afdeling, want die bepaalt welke punten ze op de openings- en
 * sluitingslijst zien. En de events waarop ze staan, want dat is de vraag die
 * je hier komt stellen. Geen uurtarieven: die horen bij de loonadministratie
 * en niet in een lijst die openstaat op een telefoon achter de bar.
 */
export default function Medewerkers() {
  const { t } = useTaal()
  const { uid, isAdmin } = useAuth()
  const { profiles } = useWorkspace()
  const { events } = useEvents()
  const { medewerkers: uitAapi } = useAapiMedewerkers()
  const toast = useToast()

  const [adres, setAdres] = useState('')
  const [afdeling, setAfdeling] = useState('zaal')
  const [bezig, setBezig] = useState(false)
  const [toonWeg, setToonWeg] = useState(false)

  const adresOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(adres.trim())

  const ploeg = useMemo(() => profiles.filter((p) => p.role === 'staff'), [profiles])
  const actief = ploeg.filter((p) => p.active !== false)
  const weg = ploeg.filter((p) => p.active === false)

  /*
    Op welke events iemand staat. Alleen wat nog komt: wie vorig jaar twee
    feesten gedaan heeft, hoeft daar niet elke week onder te staan.
  */
  const vandaag = new Date().setHours(0, 0, 0, 0)
  const perPersoon = useMemo(() => {
    const uit = {}
    for (const ev of events) {
      if (ev.eventDate && new Date(ev.eventDate).getTime() < vandaag) continue
      for (const id of ev.medewerkers ?? []) (uit[id] ??= []).push(ev)
    }
    for (const lijst of Object.values(uit)) {
      lijst.sort((a, b) => new Date(a.eventDate ?? 0) - new Date(b.eventDate ?? 0))
    }
    return uit
  }, [events, vandaag])

  const nodig = async () => {
    if (!adresOk) return
    setBezig(true)
    try {
      /*
        Uitnodigen en niet aanmaken: een profiel ontstaat pas wanneer iemand
        zich met dat adres aanmeldt via Google. Een rij vooraf zou een profiel
        zijn zonder mens erachter, en die blijft staan als er niemand komt.
      */
      await inviteMember({ email: adres, role: 'staff', department: afdeling, invitedBy: uid })
      toast.success(t('medewerkers.uitgenodigd', { wie: adres.trim() }))
      setAdres('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const regel = (p) => (
    <div key={p.id} className="je-medewerker">
      <Avatar profile={p} size={34} tone={p.active === false ? 'muted' : 'pale'} />
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{p.fullName || p.email}</div>
        <div className="je-muted-caption">{p.email}</div>
      </div>

      {isAdmin ? (
        <div style={{ width: 150 }}>
          <Select
            boxed
            aria-label={t('medewerkers.afdeling_van', { wie: p.fullName || p.email })}
            value={p.department ?? ''}
            onChange={(e) => setMemberDepartment(p.id, e.target.value).catch((err) => toast.error(err.message))}
            options={[
              { value: '', label: t('medewerkers.geen_afdeling') },
              ...AFDELINGEN.filter((a) => a.key !== 'iedereen').map((a) => ({ value: a.key, label: a.label })),
            ]}
          />
        </div>
      ) : (
        <Badge tone="neutral">{afdelingLabel(p.department)}</Badge>
      )}

      {/*
        Waar deze persoon staat. Dit is de reden dat de pagina bestaat: een
        rollentabel zegt wie er is, dit zegt wie er zaterdag staat.
      */}
      <div style={{ flex: '1 1 220px', minWidth: 160 }}>
        {(perPersoon[p.id] ?? []).length === 0 ? (
          <span className="je-muted-caption">{t('medewerkers.nergens')}</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(perPersoon[p.id] ?? []).slice(0, 3).map((ev) => (
              <span key={ev.id} style={{ font: 'var(--type-caption)', fontWeight: 400 }}>
                {ev.eventDate ? `${formatDate(ev.eventDate)} · ` : ''}
                {ev.name}
              </span>
            ))}
            {(perPersoon[p.id] ?? []).length > 3 ? (
              <span className="je-muted-caption">
                {t('medewerkers.en_meer', { aantal: (perPersoon[p.id] ?? []).length - 3 })}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {isAdmin ? (
        <Button
          variant="ghost"
          size="sm"
          iconLeft={p.active === false ? 'rotate-ccw' : 'archive'}
          onClick={() =>
            setMemberActive(p.id, p.active === false).catch((err) => toast.error(err.message))
          }
        >
          {t(p.active === false ? 'medewerkers.terug' : 'medewerkers.weg')}
        </Button>
      ) : null}
    </div>
  )

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.team')}
        title={t('medewerkers.titel')}
        subtitle={t('medewerkers.uitleg')}
      />

      <div className="je-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {isAdmin ? (
          <section className="je-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Field label={t('medewerkers.erbij')} hint={t('medewerkers.erbij_hint')} className="je-medewerker__adres">
                <Input
                  type="email"
                  value={adres}
                  onChange={(e) => setAdres(e.target.value)}
                  placeholder="voornaam@gmail.com"
                />
              </Field>
              <div style={{ width: 150 }}>
                <Field label={t('medewerkers.afdeling')}>
                  <Select
                    value={afdeling}
                    onChange={(e) => setAfdeling(e.target.value)}
                    options={AFDELINGEN.filter((a) => a.key !== 'iedereen').map((a) => ({
                      value: a.key,
                      label: a.label,
                    }))}
                  />
                </Field>
              </div>
              <Button size="sm" iconLeft="plus" onClick={nodig} loading={bezig} disabled={!adresOk}>
                {t('medewerkers.uitnodigen')}
              </Button>
            </div>
            <p className="je-muted-caption" style={{ marginTop: 'var(--space-3)' }}>
              <Icon name="info" size={14} /> {t('medewerkers.na_uitnodiging')}
            </p>
          </section>
        ) : null}

        <section className="je-panel">
          <div className="je-panel__head">
            <span className="je-eyebrow">{t('medewerkers.actief')}</span>
            <span className="je-panel__right">{actief.length}</span>
          </div>
          {actief.length === 0 ? (
            <div style={{ padding: 'var(--space-6)' }}>
              <EmptyState title={t('medewerkers.leeg')} description={t('medewerkers.leeg_uitleg')} />
            </div>
          ) : (
            actief.map(regel)
          )}
        </section>

        {/*
          De ploeg zoals AAPI haar kent.

          Een andere lijst dan die hierboven, en met opzet gescheiden. Die gaat
          over accounts in JE Plan — wie mag inloggen en wat ziet hij. Deze gaat
          over wie er in dienst is, en komt uit het systeem waar de
          personeelsadministratie echt staat. De meesten hiervan hebben hier
          geen account en hoeven dat ook niet.

          Alleen lezen: wat uit AAPI komt, wijzig je in AAPI.
        */}
        {uitAapi.length > 0 ? (
          <section className="je-panel">
            <div className="je-panel__head">
              <span className="je-eyebrow">{t('medewerkers.uit_aapi')}</span>
              <span className="je-panel__right">{uitAapi.length}</span>
            </div>
            <p className="je-muted-caption" style={{ padding: 'var(--space-3) var(--space-6) 0' }}>
              {t('medewerkers.uit_aapi_uitleg')}
            </p>
            {[...uitAapi]
              .sort((a, b) => String(a.displayName ?? '').localeCompare(String(b.displayName ?? '')))
              .map((m) => (
                <div key={m.id} className="je-medewerker">
                  <span
                    className="je-personeelrij__streep"
                    aria-hidden="true"
                    style={{ '--afdeling': kleurVan(m.afdeling) }}
                  />
                  <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                    <div style={{ font: 'var(--type-body-sm)', fontWeight: 600 }}>{m.displayName}</div>
                    <div className="je-muted-caption">
                      {[m.email, m.gsm].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <Badge tone="neutral">{aapiAfdeling(t, m.afdeling)}</Badge>
                  <Badge tone="neutral">{t(STATUUT_TEKST[m.statuut] ?? 'aapi.statuut.onbekend')}</Badge>
                  {m.inDienstSinds ? (
                    <span className="je-muted-caption">
                      {t('medewerkers.sinds', { datum: formatDate(m.inDienstSinds) })}
                    </span>
                  ) : null}
                </div>
              ))}
          </section>
        ) : null}

        {weg.length > 0 ? (
          <section className="je-panel">
            <button type="button" className="je-plainbtn je-panel__head" onClick={() => setToonWeg((v) => !v)}>
              <span className="je-eyebrow">{t('medewerkers.gestopt')}</span>
              <span className="je-panel__right">{weg.length}</span>
            </button>
            {toonWeg ? weg.map(regel) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
