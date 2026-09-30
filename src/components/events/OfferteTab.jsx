import { useEffect, useRef, useState } from 'react'
import { RUBRIEKEN, btwVoor, ontbrekend, regelBedrag, totalenVan } from '@lib/offerte'
import { prijsVan } from '@lib/formules'
import { Button, Icon, IconButton, Input, Select, Spinner } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import {
  maakOfferte,
  offerteLink,
  useOffertes,
  useOfferte,
  verstuurOfferte,
  voegRegelToe,
  wijzigRegel,
  wisRegel,
} from '@data/offertes'
import OfferteBlad from './OfferteBlad'

const BTW_TARIEVEN = [6, 12, 21]

/* De motor rekent in euro's, afgerond op de cent — niet in centen. */
const geld = (bedrag) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(Number(bedrag) || 0)

/**
 * De offerte van een event: eerst een draft, dan bijgewerkt, dan verstuurd.
 *
 * ── Waarom de draft vanzelf verschijnt ────────────────────────────────────
 * Een offerte die je eerst moet aanmaken, wordt een offerte die je vergeet.
 * Zodra een event de offertestap bereikt, staat er hier een — uitgerekend uit
 * de formule, het aantal gasten en het bedrag dat al op de fiche stond. Dat is
 * een vertrekpunt en geen eindpunt: elke lijn is aan te passen, en dat is de
 * hele bedoeling. Wat de tool voorrekent, gaat niet zomaar de deur uit.
 *
 * ── Waarom het aanmaken hier gebeurt en niet op de server ─────────────────
 * Het rekenwerk (btw per tarief, de 70/30-splitsing van een all-inprijs) staat
 * in `@lib/offerte`, met tests erop. Een tweede kopie in `functions/` zou
 * betekenen dat er twee versies van dat rekenwerk bestaan, en een btw-fout op
 * een offerte is geen schoonheidsfoutje. Het gebeurt dus één keer, hier, en
 * het houdt zichzelf tegen wanneer er al een offerte is.
 */
export default function OfferteTab({ ev }) {
  const { t } = useTaal()
  const { uid } = useAuth()
  const toast = useToast()
  const { laadt, offerte } = useOfferte(ev.id)
  const alle = useOffertes()
  const { formules } = useWorkspace()
  const [bezig, setBezig] = useState(false)
  const bezigMetMaken = useRef(false)

  // Eén keer per event, en nooit twee tegelijk: `useOfferte` heeft een tel
  // nodig voor de nieuwe offerte binnenkomt, en zonder deze vlag maakt een
  // tweede tekenbeurt er in die tussentijd nog een.
  useEffect(() => {
    if (laadt || offerte || bezigMetMaken.current) return
    bezigMetMaken.current = true

    // Komt het event uit een formule, dan levert die posten met hun eigen
    // tarief (eten 12%, drank 21%) en worden dat de lijnen. Is er alleen een
    // offertebedrag, dan is dat één prijs die eten én drank dekt en wordt ze
    // gesplitst — precies de regel waar het anders misloopt.
    const formule = formules.find((f) => f.id === ev.formuleId) ?? null
    const prijs = formule ? prijsVan(formule, ev.formuleKeuzes ?? {}, ev.pax ?? 0) : null

    // Het volgnummer is het aantal offertes van dit jaar plus één.
    const jaar = new Date().getFullYear()
    const ditJaar = alle.filter((o) => new Date(o.datum?.toDate?.() ?? o.datum ?? 0).getFullYear() === jaar).length

    maakOfferte({ event: { ...ev, date: ev.eventDate }, prijs, uid, volgnummer: ditJaar + 1 })
      .catch((err) => toast.error(err.message))
      .finally(() => {
        bezigMetMaken.current = false
      })
    // `alle` verandert zodra deze offerte binnenkomt; dat mag dit effect niet
    // opnieuw laten lopen. De vlag hierboven vangt de rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laadt, offerte, ev.id])

  if (laadt || !offerte) {
    return (
      <div className="je-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 'var(--space-5)' }}>
        <Spinner /> <span className="je-muted-caption">{t('offerte.klaarzetten')}</span>
      </div>
    )
  }

  const totalen = totalenVan(offerte.regels)
  const mist = ontbrekend(offerte, { date: ev.eventDate })

  const link = offerteLink(offerte)

  const versturen = async () => {
    setBezig(true)
    try {
      await verstuurOfferte(offerte, uid)
      toast.success(t('offerte.verstuurd_bevestiging'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  /*
    Kopiëren en niet alleen tonen: dit adres gaat in een mail, en een link die
    je moet overtypen wordt verkeerd overgetypt. Lukt het klembord niet — dat
    weigeren sommige browsers — dan staat de link er nog altijd om zelf te
    selecteren.
  */
  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t('offerte.link_gekopieerd'))
    } catch {
      toast.error(t('offerte.link_kopieer_mislukt'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="je-panel je-offertewerk">
        <div className="je-offertewerk__kop">
          <span className="je-caps">{t('offerte.regels')}</span>
          <span className="je-muted-caption">{offerte.nummer}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => voegRegelToe(offerte, { omschrijving: '' }, uid)}>
              {t('offerte.regel_erbij')}
            </Button>
            <Button variant="secondary" size="sm" iconLeft="download" onClick={() => window.print()}>
              {t('offerte.afdrukken')}
            </Button>
            <Button size="sm" loading={bezig} onClick={versturen}>
              {t('offerte.versturen')}
            </Button>
          </span>
        </div>

        {/*
          De klantenpagina. Ze staat hier en niet achteraan: wie een offerte
          nakijkt, wil met één blik zien wat de klant te zien krijgt — en met
          één klik het adres hebben dat hij hem stuurt.
        */}
        {link ? (
          <div className="je-offertewerk__link">
            <span className="je-caps">{t('offerte.klantpagina')}</span>
            <a href={link} target="_blank" rel="noreferrer" className="je-link-quiet">
              {link.replace(/^https?:\/\//, '')}
            </a>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-3)' }}>
              <Button variant="ghost" size="sm" iconLeft="copy" onClick={kopieer}>
                {t('offerte.link_kopieren')}
              </Button>
              <Button variant="secondary" size="sm" iconLeft="share-2" onClick={() => window.open(link, '_blank')}>
                {t('offerte.link_openen')}
              </Button>
            </span>
          </div>
        ) : null}

        {offerte.status !== 'concept' ? (
          <p className="je-offertewerk__stand" data-stand={offerte.status}>
            <Icon name={offerte.status === 'goedgekeurd' ? 'check-circle' : 'info'} size={14} />
            {t(`offerte.stand.${offerte.status}`)}
            {offerte.feedback ? <span className="je-offertewerk__feedback">{offerte.feedback}</span> : null}
          </p>
        ) : null}

        {mist.length ? (
          <p className="je-offertewerk__mist">
            <Icon name="info" size={14} />
            {mist.map((sleutel) => t(sleutel)).join(' ')}
          </p>
        ) : null}

        <table className="je-offertewerk__tabel">
          <thead>
            <tr>
              <th>{t('offerte.kolom.omschrijving')}</th>
              <th>{t('offerte.kolom.rubriek')}</th>
              <th className="je-num">{t('offerte.kolom.aantal')}</th>
              <th className="je-num">{t('offerte.kolom.eenheid')}</th>
              <th className="je-num">{t('offerte.kolom.btw')}</th>
              <th className="je-num">{t('offerte.kolom.bedrag')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(offerte.regels ?? []).map((regel) => (
              <RegelRij key={regel.id} offerte={offerte} regel={regel} uid={uid} t={t} />
            ))}
            {(offerte.regels ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="je-muted-caption">
                  {t('offerte.geen_regels')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="je-offertewerk__totaal">
          <span className="je-muted-caption">
            {t('offerte.excl')} {geld(totalen.excl)}
          </span>
          <strong>{geld(totalen.incl)}</strong>
        </div>
      </div>

      {/* Hetzelfde blad dat de klant krijgt, meteen ernaast: wie een lijn
          aanpast, ziet wat het met het document doet. */}
      <div className="je-offerteblad-schaal je-print-hier">
        <OfferteBlad offerte={offerte} />
      </div>
    </div>
  )
}

/** Eén lijn, bewerkbaar. Bewaart bij het verlaten van het veld, net als de fiche. */
function RegelRij({ offerte, regel, uid, t }) {
  const zet = (velden) => wijzigRegel(offerte, regel.id, velden, uid)

  return (
    <tr>
      <td>
        <Input
          defaultValue={regel.omschrijving}
          aria-label={t('offerte.kolom.omschrijving')}
          onBlur={(e) => e.target.value !== regel.omschrijving && zet({ omschrijving: e.target.value })}
        />
      </td>
      <td>
        <Select
          aria-label={t('offerte.kolom.rubriek')}
          value={regel.rubriek}
          onChange={(e) =>
            // De rubriek bepaalt het tarief, tenzij iemand er zelf een koos dat
            // ervan afwijkt; dan blijft die staan.
            zet({
              rubriek: e.target.value,
              btwPercent: regel.btwPercent === btwVoor(regel.rubriek) ? btwVoor(e.target.value) : regel.btwPercent,
            })
          }
          options={RUBRIEKEN.map((r) => ({ value: r, label: t(`offerte.rubriek.${r}`) }))}
        />
      </td>
      <td className="je-num">
        <Input
          type="number"
          min="0"
          step="1"
          defaultValue={regel.aantal}
          aria-label={t('offerte.kolom.aantal')}
          onBlur={(e) => Number(e.target.value) !== regel.aantal && zet({ aantal: Number(e.target.value) })}
        />
      </td>
      <td className="je-num">
        <Input
          type="number"
          min="0"
          step="0.01"
          defaultValue={regel.eenheidExcl}
          aria-label={t('offerte.kolom.eenheid')}
          onBlur={(e) => Number(e.target.value) !== regel.eenheidExcl && zet({ eenheidExcl: Number(e.target.value) })}
        />
      </td>
      <td className="je-num">
        <Select
          aria-label={t('offerte.kolom.btw')}
          value={String(regel.btwPercent)}
          onChange={(e) => zet({ btwPercent: Number(e.target.value) })}
          options={BTW_TARIEVEN.map((p) => ({ value: String(p), label: `${p}%` }))}
        />
      </td>
      <td className="je-num">
        {geld(regelBedrag(regel))}
      </td>
      <td>
        <IconButton
          icon="trash-2"
          label={t('offerte.regel_weg')}
          size="sm"
          variant="bare"
          onClick={() => wisRegel(offerte, regel.id, uid)}
        />
      </td>
    </tr>
  )
}
