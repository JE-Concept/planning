import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { dayKey, fromDateInput } from '@lib/dates'
import { planningKeuzes } from '@lib/planning'
import { missingForOffer } from '@lib/pipeline'
import { verantwoordelijkeVan, zetVerantwoordelijke } from '@lib/eventteam'
import { aantalDagen, eindeVan, isMeerdaags, zetEinddatum, zetMeerdaags } from '@lib/eventdagen'
import { Checkbox, Icon, Input, Select } from '@components/ds'
import { euro, longDate } from '@components/events/parts'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { updateEvent } from '@data/events'
import CustomerPicker from './CustomerPicker'
import LocatieVeld from './LocatieVeld'

/**
 * De fiche van een event: klant, datum, gasten, locatie, bedrag, team.
 *
 * ── Waarom hier en niet in een dialoog ────────────────────────────────────
 * Dit stond achter een potloodje dat een venster opende. Dat venster was een
 * formulier met een bewaarknop, en dus een beslissing: je opende het om één
 * getal te wijzigen en moest daarna nog bevestigen dat je het meende. Voor
 * "het worden er toch 145" is dat drie handelingen te veel, en het venster
 * dekte ondertussen af waar je het getal vandaan haalde.
 *
 * Nu staat elk veld waar de waarde staat en bewaart het zichzelf zodra je
 * verder klikt. Er is geen annuleren meer — dat is de prijs — maar wél een
 * logboek: wie wat wanneer veranderde staat in `auditLog`, en dat is een
 * betere waarborg dan een knop die je toch altijd indrukt.
 *
 * ── Waarom het bewaren pas bij het verlaten gebeurt ───────────────────────
 * Elke aanslag wegschrijven zou van "140" eerst "1", dan "14" maken, en dat is
 * wat het logboek en de meldingen zouden zien. Tekst- en getalvelden bewaren
 * daarom bij blur of Enter; keuzelijsten en vinkjes bewaren meteen, want daar
 * bestaat geen halve waarde.
 */
export default function EventFiche({ ev }) {
  const { t } = useTaal()
  const { brands, profiles } = useWorkspace()
  const toast = useToast()

  /*
    Wie het dossier mag dragen: iemand van het bureau. Personeel en de
    socialrol staan daar niet tussen — die lezen de bedragen niet eens.

    Wie er komt werken staat niet meer hier maar in het personeelsblok, bij de
    ploeg die uit AAPI komt. Zie `EventPersoneel`.
  */
  const verantwoordelijken = useMemo(
    () => profiles.filter((p) => p.active !== false && p.role !== 'staff' && p.role !== 'social'),
    [profiles]
  )
  const ontbreekt = missingForOffer(ev)

  const bewaar = (patch) => updateEvent(ev.id, patch).catch((err) => toast.error(err.message))

  return (
    <section className="je-fiche" aria-label={t('events.fiche.titel')}>
      <div className="je-fiche__velden">
        {/* De klantkiezer brengt zijn eigen label en uitleg mee. */}
        <div className="je-fiche__cel">
          <CustomerPicker
            customerId={ev.customerId ?? ''}
            customerName={ev.customerName ?? ''}
            onChange={(klant) => bewaar({ customerId: klant.customerId || null, customerName: klant.customerName?.trim() || null })}
          />
        </div>

        <Cel label={t('events.velden.datum')}>
          <Input
            type="date"
            defaultValue={ev.eventDate ? dayKey(ev.eventDate) : ''}
            key={`datum-${ev.eventDate ?? ''}`}
            aria-label={t('events.velden.datum')}
            onChange={(e) => {
              // Een datumveld heeft geen halve waarde: de browser geeft pas
              // iets door als de hele datum klopt.
              const datum = fromDateInput(e.target.value)
              bewaar({ eventDate: datum, dueDate: datum ?? ev.dueDate ?? null })
            }}
          />
          <span className="je-muted-caption">{ev.eventDate ? longDate(ev.eventDate) : t('events.fiche.geen_datum')}</span>
        </Cel>

        {/*
          Meerdaags: een vinkje, en pas daarna een tweede datum.

          Twee datumvelden naast elkaar zou eenvoudiger zijn om te bouwen, maar
          het meeste wat hier staat duurt één dag, en dan staat er op elke fiche
          een leeg veld dat uitleg vraagt. Het vinkje stelt de vraag die mensen
          zich stellen — duurt dit langer dan één dag — en het veld komt pas
          wanneer het antwoord ja is.

          Het vinkje zelf wordt niet bewaard; dat het aanstaat lees je af aan de
          einddatum. Zie `@lib/eventdagen` voor waarom.
        */}
        <div className="je-fiche__cel" data-breed="">
          <div className="je-meerdaags">
            <Checkbox
              label={t('events.fiche.meerdaags')}
              checked={isMeerdaags(ev)}
              disabled={!ev.eventDate}
              onChange={(e) => bewaar(zetMeerdaags(ev, e.target.checked))}
            />
            {isMeerdaags(ev) ? (
              <div className="je-meerdaags__tot">
                <span className="je-caps">{t('events.fiche.tot_en_met')}</span>
                <Input
                  type="date"
                  // De einddatum kan niet voor de begindag liggen. De browser
                  // houdt dat tegen; `zetEinddatum` houdt het nog eens tegen,
                  // want een `min` is geen waarborg.
                  min={ev.eventDate ? dayKey(ev.eventDate) : undefined}
                  defaultValue={dayKey(eindeVan(ev))}
                  key={`einddatum-${dayKey(eindeVan(ev))}`}
                  aria-label={t('events.fiche.tot_en_met')}
                  onChange={(e) => bewaar(zetEinddatum(ev, fromDateInput(e.target.value)))}
                />
                <span className="je-muted-caption">
                  {t('events.fiche.duurt_dagen', { aantal: aantalDagen(ev) })}
                </span>
              </div>
            ) : (
              <span className="je-muted-caption">{t('events.fiche.meerdaags_hint')}</span>
            )}
          </div>
        </div>

        <Getal
          label={t('events.fiche.gasten')}
          waarde={ev.pax}
          onBewaar={(n) => bewaar({ pax: n })}
          eenheid="pax"
        />
        <Getal label={t('events.velden.kinderen')} waarde={ev.kids} onBewaar={(n) => bewaar({ kids: n })} />

        {/* Breed: onder dit veld hangt een lijst met adressen, en in één
            kolom past een straatnaam er niet leesbaar in. */}
        <div className="je-fiche__cel" data-breed="">
          <LocatieVeld value={ev} onChange={(plek) => bewaar(plek)} />
        </div>

        <Tekst label={t('events.fiche.formule')} waarde={ev.formule} onBewaar={(v) => bewaar({ formule: v })} />

        <Getal
          label={t('events.fiche.offerte')}
          waarde={ev.quoteAmount}
          // `budget` is het oude ClickUp-veld waar de rapportage op leest; de
          // fiche toont `quoteAmount`. Ze horen hetzelfde bedrag te dragen.
          onBewaar={(n) => bewaar({ quoteAmount: n, budget: n })}
          onder={ev.quoteAmount ? t('events.fiche.voorschot_van', { bedrag: euro(Math.round(ev.quoteAmount * 0.4)) }) : null}
        />

        {/*
          De planning staat naast de pijplijn en niet erin: de pijplijn zegt
          waar het dossier tegenover de klant staat, dit zegt of het intern
          rond is. Die twee lopen niet gelijk.
        */}
        <Cel label={t('planning.titel')}>
          <Select
            aria-label={t('planning.titel')}
            value={ev.planning ?? ''}
            onChange={(e) => bewaar({ planning: e.target.value || null })}
            options={planningKeuzes()}
          />
        </Cel>

        <Cel label={t('events.velden.concept')}>
          <Select
            aria-label={t('events.velden.concept')}
            value={ev.brandId ?? ''}
            onChange={(e) => bewaar({ brandId: e.target.value || null })}
            options={[
              { value: '', label: t('events.los_event') },
              ...brands.filter((b) => !b.archived || b.id === ev.brandId).map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Cel>

        <Tekst
          label={t('events.velden.type')}
          waarde={ev.eventType}
          hint={t('events.velden.type_hint')}
          onBewaar={(v) => bewaar({ eventType: v })}
        />
      </div>

      {/*
        Verantwoordelijk is één persoon, en dat is hier een keuzelijst en geen
        rijtje vinkjes. Bij vijf vinkjes is iedereen verantwoordelijk en dus
        niemand; een lijst waar er maar één uit kan, zegt dat zonder uitleg.
      */}
      <div className="je-fiche__team">
        <span className="je-caps">{t('events.fiche.verantwoordelijk')}</span>
        <div className="je-fiche__cel" style={{ maxWidth: 320 }}>
          <Select
            aria-label={t('events.fiche.verantwoordelijk')}
            value={verantwoordelijkeVan(ev) ?? ''}
            onChange={(e) => bewaar(zetVerantwoordelijke(e.target.value))}
            options={[
              { value: '', label: t('events.fiche.niemand') },
              ...verantwoordelijken.map((p) => ({ value: p.id, label: p.fullName || p.email })),
            ]}
          />
        </div>
      </div>

      {/*
        Wat er nog niet ingevuld is. Dit hield vroeger de offertestap tegen;
        nu is het een herinnering. Wat ontbreekt hoort zichtbaar te zijn, maar
        het werk niet te blokkeren — zie `missingForOffer`.
      */}
      {ontbreekt.length ? (
        <p className="je-fiche__ontbreekt">
          <Icon name="info" size={14} />
          {t('events.velden.ontbreekt', { wat: ontbreekt.map((m) => t(`events.ontbreekt.${m}`)).join(', ') })}
        </p>
      ) : null}

    </section>
  )
}

/** Eén hokje op de fiche: een kopje en wat eronder hoort. */
function Cel({ label, breed = false, children }) {
  return (
    <div className="je-fiche__cel" data-breed={breed ? '' : undefined}>
      {label ? <span className="je-caps">{label}</span> : null}
      {children}
    </div>
  )
}

/**
 * Een tekstveld dat zichzelf bewaart zodra je eruit klikt.
 *
 * De waarde staat in eigen state zolang er getypt wordt en wordt pas
 * weggeschreven bij blur of Enter. Komt er ondertussen van buitenaf een andere
 * waarde binnen — iemand anders past hetzelfde event aan — dan wint die, tenzij
 * dit veld op dat moment de focus heeft: iemand die aan het typen is, mag zijn
 * zin niet onder zijn handen zien veranderen.
 */
function Tekst({ label, waarde, hint, onBewaar }) {
  const id = useId()
  const veld = useRef(null)
  const [tekst, setTekst] = useState(waarde ?? '')

  useEffect(() => {
    if (document.activeElement !== veld.current) setTekst(waarde ?? '')
  }, [waarde])

  const klaar = () => {
    const schoon = tekst.trim()
    if (schoon === (waarde ?? '').trim()) return
    onBewaar(schoon || null)
  }

  return (
    <div className="je-fiche__cel">
      <label className="je-caps" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        ref={veld}
        value={tekst}
        placeholder={hint}
        onChange={(e) => setTekst(e.target.value)}
        onBlur={klaar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setTekst(waarde ?? '')
        }}
      />
    </div>
  )
}

/** Hetzelfde, maar voor een getal. Leeg betekent niets, niet nul. */
function Getal({ label, waarde, eenheid, onder, onBewaar }) {
  const id = useId()
  const veld = useRef(null)
  const [tekst, setTekst] = useState(waarde == null ? '' : String(waarde))

  useEffect(() => {
    if (document.activeElement !== veld.current) setTekst(waarde == null ? '' : String(waarde))
  }, [waarde])

  const klaar = () => {
    const schoon = tekst.trim()
    const nieuw = schoon === '' ? null : Number(schoon)
    if (nieuw != null && Number.isNaN(nieuw)) return
    if (nieuw === (waarde ?? null)) return
    onBewaar(nieuw)
  }

  return (
    <div className="je-fiche__cel">
      <label className="je-caps" htmlFor={id}>
        {label}
      </label>
      <div className="je-fiche__getal">
        <Input
          id={id}
          ref={veld}
          type="number"
          min="0"
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onBlur={klaar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setTekst(waarde == null ? '' : String(waarde))
          }}
        />
        {eenheid ? <span className="je-muted-caption">{eenheid}</span> : null}
      </div>
      {onder ? <span className="je-muted-caption">{onder}</span> : null}
    </div>
  )
}
