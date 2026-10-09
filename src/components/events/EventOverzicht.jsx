import { DREMPELS, standVan } from '@lib/eventstand'
import { PIPELINE, indexOf, labelOf } from '@lib/pipeline'
import { Button, Icon } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { useOfferte } from '@data/offertes'
import { useEventMails } from '@data/mails'
import { eventDatumTekst, eventTijd, hours } from './parts'

/**
 * Het overzicht: hoe staat dit event ervoor.
 *
 * ── Waarom dit het eerste tabblad is ──────────────────────────────────────
 * Omdat het de vraag is waarmee iemand een event opent. Niet "welke taken
 * staan er" en niet "wat staat er op de offerte" — die komen daarna, als het
 * antwoord op de eerste vraag daar aanleiding toe geeft. Tot nu was Taken het
 * eerste scherm, en dan kijk je naar een lijst zonder te weten of ze er een
 * is om je zorgen over te maken.
 *
 * ── Waarom er een lijstje "vraagt aandacht" staat ─────────────────────────
 * Een dashboard dat alleen getallen toont, laat het oordeel aan de lezer. Dat
 * werkt bij drie events en niet bij veertig. Het oordeel staat in
 * `@lib/eventstand`, met tests erop, en hier staat alleen hoe het eruitziet.
 *
 * ── Waarom het de offerte en de post zelf ophaalt ─────────────────────────
 * Twee abonnementen extra op het eerste tabblad van een event. Dat is de prijs
 * voor een overzicht dat klopt: zonder de offerte kan het niet zeggen of er
 * geld tegenover staat, en dat is de helft van wat iemand komt halen.
 */
export default function EventOverzicht({ ev, tasks, documenten, totalSeconden, onTab }) {
  const { t } = useTaal()
  const { eventStatuses } = useWorkspace()
  const { offerte } = useOfferte(ev.id)
  const mails = useEventMails(ev.id)

  const stand = standVan({
    event: ev,
    tasks,
    offerte,
    mails,
    documenten,
    secondenGeboekt: totalSeconden,
  })

  const si = indexOf(ev.statusName)
  const geld = (v) =>
    v == null ? '—' : new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(v)

  return (
    <div className="je-overzicht">
      {/* ── Waar staat het, en hoe dringend ─────────────────────────── */}
      <section className="je-panel je-overzicht__kop" data-stand={stand.stand}>
        {/*
          Geen statusbadge meer hier: die staat al in de kop van de pagina,
          recht erboven, en twee keer "Aanvraag" onder elkaar las als twee
          verschillende dingen. De kop blijft bij elk tabblad staan; dit niet.
        */}
        <div className="je-overzicht__standen">
          <span className="je-muted-caption">
            {[eventDatumTekst(ev), eventTijd(ev), ev.location].filter(Boolean).join(' · ') || t('overzicht.geen_datum')}
          </span>
        </div>
        <div className="je-overzicht__teller">
          {stand.dagen == null ? (
            <span className="je-muted-caption">{t('overzicht.geen_datum')}</span>
          ) : stand.dagen >= 0 ? (
            <>
              <strong>{stand.dagen}</strong>
              <span className="je-muted-caption">{t('overzicht.dagen_te_gaan')}</span>
            </>
          ) : (
            <>
              <strong>{-stand.dagen}</strong>
              <span className="je-muted-caption">{t('overzicht.dagen_geleden')}</span>
            </>
          )}
        </div>
      </section>

      {/*
        ── Wat er nog aan schort ─────────────────────────────────────

        Eén regel met een teller, en de opsomming pas wanneer je erom vraagt.

        Het stond hier als een uitgeklapte lijst van vijf zinnen, bovenaan het
        scherm dat je opent om te weten hoe het ervoor staat. Vijf zinnen lees
        je één keer; de tweede keer scroll je eroverheen, en dan is de
        waarschuwing meubilair geworden. "Vijf dingen ontbreken" is wat je moet
        weten, en wát precies pas wanneer je er iets aan gaat doen.

        Een `<details>` en geen eigen open-dicht-toestand: dat is wat de
        browser hiervoor heeft, het werkt met het toetsenbord en een
        schermlezer zegt vanzelf of het open of dicht staat.
      */}
      {stand.aandacht.length ? (
        <details className="je-panel je-overzicht__aandacht" data-stand={stand.stand}>
          <summary className="je-aandachtkop">
            <Icon name="alert-triangle" size={15} />
            <strong>{t('overzicht.mist_aantal', { aantal: stand.aandacht.length })}</strong>
            <span className="je-muted-caption">{t('overzicht.mist_bekijk')}</span>
          </summary>
          <ul>
            {stand.aandacht.map((sleutel) => {
              const los = OPLOSSING[sleutel]
              return (
                <li key={sleutel}>
                  <span>{t(sleutel, { dagen: DREMPELS.gegevens })}</span>
                  {los ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => (los.veld ? naarVeld(los.veld) : onTab(los.tab))}
                    >
                      {t(los.label)}
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </details>
      ) : (
        <section className="je-panel je-overzicht__aandacht" data-stand="rond">
          <h2 className="je-caps">
            <Icon name="check-circle" size={14} /> {t('overzicht.in_orde')}
          </h2>
          <p className="je-muted-caption">{t('overzicht.in_orde_uitleg')}</p>
        </section>
      )}

      {/* ── De cijfers ──────────────────────────────────────────────── */}
      <div className="je-overzicht__kaarten">
        <Kaart
          titel={t('overzicht.kaart.taken')}
          // Nul is een aantal, geen ontbrekend gegeven: een streepje las als
          // "dat weten we niet".
          groot={stand.taken.totaal ? `${stand.taken.af}/${stand.taken.totaal}` : '0'}
          onder={
            // Nul taken is niet "alles afgevinkt": zo stond het er live.
            !stand.taken.totaal
              ? t('overzicht.taken_geen')
              : stand.taken.open
                ? t('overzicht.taken_open', { aantal: stand.taken.open })
                : t('overzicht.taken_klaar')
          }
          deel={stand.taken.deel}
          naar="taken"
          onTab={onTab}
        />
        <Kaart
          titel={t('overzicht.kaart.offerte')}
          groot={geld(stand.offerte.incl)}
          onder={t(`overzicht.offerte.${stand.offerte.stand}`)}
          toon={stand.offerte.verlopen ? 'waarschuwing' : null}
          naar="offerte"
          onTab={onTab}
        />
        <Kaart
          titel={t('overzicht.kaart.gasten')}
          groot={ev.pax ? String(ev.pax) : '—'}
          // De tegel gaat over gasten; "Nog geen klant" eronder las als een
          // antwoord op een andere vraag. Die staat bij "Vraagt aandacht".
          onder={ev.pax ? ev.customerName || '' : t('overzicht.gasten_leeg')}
          // Zonder aantal brengt de tegel je naar het veld waar het hoort.
          onKlik={ev.pax ? null : () => naarVeld('gasten')}
        />
        <Kaart
          titel={t('overzicht.kaart.mail')}
          groot={String(stand.mail.aantal)}
          onder={
            stand.mail.laatste?.onderwerp
              ? stand.mail.laatste.onderwerp
              : t('overzicht.geen_mail')
          }
          naar="mail"
          onTab={onTab}
        />
        <Kaart
          titel={t('overzicht.kaart.tijd')}
          groot={hours(stand.tijd.seconden)}
          onder={t('overzicht.geboekt')}
          naar="tijd"
          onTab={onTab}
        />
        <Kaart
          titel={t('overzicht.kaart.bijlagen')}
          groot={String(stand.bijlagen)}
          // Over bijlagen, niet over de bestellijst: die heeft een eigen tabblad.
          onder={stand.bijlagen ? t('overzicht.bijlagen_wel') : t('overzicht.bijlagen_geen')}
          naar="mail"
          onTab={onTab}
        />
      </div>

      {/* ── De pijplijn, als tijdlijn en niet als knoppenbalk ────────── */}
      <section className="je-panel je-overzicht__pijplijn">
        <h2 className="je-caps">{t('overzicht.pijplijn')}</h2>
        <ol>
          {PIPELINE.map((stap, i) => (
            <li key={stap.key} data-stand={i < si ? 'gehad' : i === si ? 'nu' : 'komt'}>
              <span className="je-overzicht__bol" />
              <span>{labelOf(stap.key, eventStatuses)}</span>
            </li>
          ))}
        </ol>
      </section>

    </div>
  )
}

/**
 * Wat elk aandachtspunt oplost: een veld op de fiche, of een tabblad.
 *
 * Een aandachtspunt was alleen een zin. "Er hangt nog geen klant aan dit
 * dossier" — en dan moest je zelf gaan zoeken waar het klantveld stond, onder
 * de tegels en de tijdlijn. De knop ernaast brengt je erheen en zet de cursor
 * erin. Wat geen knop heeft (niet gefactureerd), los je op met de stapknop in
 * de kop, en die staat al in beeld.
 */
const OPLOSSING = {
  'overzicht.let.geen_datum': { veld: 'datum', label: 'overzicht.los.datum' },
  'overzicht.let.geen_klant': { veld: 'klant', label: 'overzicht.los.klant' },
  'overzicht.let.geen_gasten': { veld: 'gasten', label: 'overzicht.los.gasten' },
  'overzicht.let.geen_locatie': { veld: 'locatie', label: 'overzicht.los.locatie' },
  'overzicht.let.planning_open': { veld: 'planning', label: 'overzicht.los.planning' },
  'overzicht.let.geen_offerte': { tab: 'offerte', label: 'overzicht.los.offerte_maken' },
  'overzicht.let.offerte_concept': { tab: 'offerte', label: 'overzicht.los.offerte' },
  'overzicht.let.offerte_verlopen': { tab: 'offerte', label: 'overzicht.los.offerte' },
  'overzicht.let.taken_na_afloop': { tab: 'taken', label: 'overzicht.los.taken' },
}

/**
 * Naar een veld op de fiche, en de cursor erin.
 *
 * De fiche staat op hetzelfde tabblad, onder het overzicht; ze merkt haar
 * velden met `data-veld`. Via het document en niet via een ref: de fiche is
 * een eigen component met eigen velden (de klantkiezer brengt zijn eigen
 * invoer mee), en een ref door drie lagen heen is meer bedrading dan dit
 * waard is. Het veld licht even op, zodat het oog volgt waar de pagina heen
 * sprong.
 */
function naarVeld(naam) {
  const cel = document.querySelector(`.je-fiche [data-veld="${naam}"]`)
  if (!cel) return
  cel.scrollIntoView({ block: 'center', behavior: 'smooth' })
  cel.querySelector('input:not([type="hidden"]):not([disabled]), select, textarea, button')?.focus({ preventScroll: true })
  cel.setAttribute('data-gezocht', '')
  setTimeout(() => cel.removeAttribute('data-gezocht'), 1600)
}

/**
 * Eén cijfer met zijn naam eronder.
 *
 * Klikbaar wanneer er een tabblad bij hoort: wie op het aantal taken kijkt en
 * er iets aan wil doen, hoort niet eerst naar boven te moeten om het juiste
 * tabblad te zoeken.
 */
function Kaart({ titel, groot, onder, deel = null, naar = null, onTab = null, onKlik = null, toon = null }) {
  const binnen = (
    <>
      <span className="je-overzicht__kaarttitel">{titel}</span>
      <strong className="je-overzicht__kaartgroot">{groot}</strong>
      <span className="je-overzicht__kaartonder">{onder}</span>
      {deel == null ? null : (
        <span className="je-overzicht__balk">
          <span style={{ width: `${Math.round(deel * 100)}%` }} />
        </span>
      )}
    </>
  )

  const klik = onKlik ?? (naar && onTab ? () => onTab(naar) : null)
  if (!klik) {
    return (
      <div className="je-paneel-kaart" data-toon={toon ?? undefined}>
        {binnen}
      </div>
    )
  }

  return (
    <button type="button" className="je-paneel-kaart je-plainbtn" data-toon={toon ?? undefined} onClick={klik}>
      {binnen}
    </button>
  )
}
